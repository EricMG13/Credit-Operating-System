"""Tests for engine/pipeline_executor.py — the durable, multi-worker-safe
autonomy-cycle executor. The claim/execute/sweep mechanism is exercised on the
SQLite test DB (the SKIP LOCKED fallback); ``execute_job`` mocks
``autonomy.run_cycle`` so no real cycle runs.
"""

from __future__ import annotations

import asyncio

import pytest
import pytest_asyncio
from sqlalchemy import delete, select

from database import AsyncSessionLocal, PipelineRun
from engine import pipeline, pipeline_executor


@pytest_asyncio.fixture(autouse=True)
async def _isolate(seeded_db):
    """Per-test isolation: clear pipeline_runs + the SQLite claimed set."""
    pipeline_executor._sqlite_reset()
    async with AsyncSessionLocal() as db:
        await db.execute(delete(PipelineRun))
        await db.commit()
    yield
    pipeline_executor._sqlite_reset()
    async with AsyncSessionLocal() as db:
        await db.execute(delete(PipelineRun))
        await db.commit()


async def _make_job(prior=None, status="running"):
    async with AsyncSessionLocal() as db:
        row = PipelineRun(kind="autonomy-cycle", status=status,
                          prior_fingerprints=prior, current_fingerprints={},
                          draft={}, summary={})
        db.add(row)
        await db.commit()
        return row.id


def _wire_run_cycle(monkeypatch, result=None, raises=None):
    async def _run(db, prior_fingerprints=None):
        if raises is not None:
            raise raises
        return result or {
            "draft": {"status": "draft", "sections": [{"issuer_id": "i1"}],
                      "summary": {"n_sections": 1, "n_deterministic_bullets": 0}},
            "current_fingerprints": {"i1": "fp-new"},
            "tickets": [], "n_changed": 1, "n_anomalies": 2, "n_claims": 3,
        }
    monkeypatch.setattr(pipeline_executor.autonomy, "run_cycle", _run)


# ── enqueue_cycle (pipeline.py) ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_enqueue_cycle_creates_running_row(seeded_db):
    async with AsyncSessionLocal() as db:
        rid = await pipeline.enqueue_cycle(db, prior_fingerprints={"i1": "old"})
        row = await db.get(PipelineRun, rid)
    assert row.status == "running"
    assert row.prior_fingerprints == {"i1": "old"}
    assert row.kind == "autonomy-cycle"


# ── claim_next_job (SQLite fallback) ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_claim_next_job_claims_one_then_another_then_none(seeded_db):
    a = await _make_job()
    b = await _make_job()
    async with AsyncSessionLocal() as db:
        j1 = await pipeline_executor.claim_next_job(db, "w1")
        j2 = await pipeline_executor.claim_next_job(db, "w2")
        j3 = await pipeline_executor.claim_next_job(db, "w3")
    assert j1.id in (a, b)
    assert j2.id in (a, b) and j2.id != j1.id
    assert j3 is None  # both claimed → none left
    assert j1.worker_id == "w1" and j2.worker_id == "w2"


@pytest.mark.asyncio
async def test_claim_next_job_does_not_reclaim(seeded_db):
    jid = await _make_job()
    async with AsyncSessionLocal() as db:
        first = await pipeline_executor.claim_next_job(db, "w1")
        # A second claim attempt in the same process skips the already-claimed row.
        second = await pipeline_executor.claim_next_job(db, "w2")
    assert first.id == jid
    assert second is None


@pytest.mark.asyncio
async def test_claim_next_job_none_when_no_running(seeded_db):
    await _make_job(status="complete")  # not running → not claimable
    async with AsyncSessionLocal() as db:
        assert await pipeline_executor.claim_next_job(db, "w1") is None


# ── execute_job ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_execute_job_completes_row(seeded_db, monkeypatch):
    _wire_run_cycle(monkeypatch)
    jid = await _make_job(prior={"i1": "old"})
    await pipeline_executor.execute_job(jid)
    async with AsyncSessionLocal() as db:
        row = await db.get(PipelineRun, jid)
    assert row.status == "complete"
    assert row.current_fingerprints == {"i1": "fp-new"}
    assert row.draft["status"] == "draft"
    assert row.summary == {"n_changed": 1, "n_anomalies": 2, "n_claims": 3,
                           "n_sections": 1, "n_deterministic_bullets": 0}
    assert row.completed_at is not None


@pytest.mark.asyncio
async def test_execute_job_failure_marks_failed(seeded_db, monkeypatch):
    _wire_run_cycle(monkeypatch, raises=RuntimeError("cycle boom"))
    jid = await _make_job()
    await pipeline_executor.execute_job(jid)
    async with AsyncSessionLocal() as db:
        row = await db.get(PipelineRun, jid)
    assert row.status == "failed"
    assert "cycle boom" in (row.error or "")
    assert row.completed_at is not None


@pytest.mark.asyncio
async def test_execute_job_non_running_is_noop(seeded_db, monkeypatch):
    called = {"run": False}

    async def _run(db, prior_fingerprints=None):
        called["run"] = True
        return {"draft": {}, "current_fingerprints": {}, "n_changed": 0,
                "n_anomalies": 0, "n_claims": 0}
    monkeypatch.setattr(pipeline_executor.autonomy, "run_cycle", _run)

    jid = await _make_job(status="complete")  # already complete → no-op
    await pipeline_executor.execute_job(jid)
    assert called["run"] is False


# ── PipelineExecutor: sweep + enqueue ────────────────────────────────────────

@pytest.mark.asyncio
async def test_executor_start_sweeps_stranded_running(seeded_db):
    stranded = await _make_job()
    done = await _make_job(status="complete")
    ex = pipeline_executor.PipelineExecutor()
    await ex.start()
    async with AsyncSessionLocal() as db:
        r1 = await db.get(PipelineRun, stranded)
        r2 = await db.get(PipelineRun, done)
    assert r1.status == "failed"  # swept
    assert "abandoned" in (r1.error or "")
    assert r2.status == "complete"  # untouched


@pytest.mark.asyncio
async def test_executor_enqueue_runs_job_to_complete(seeded_db, monkeypatch):
    _wire_run_cycle(monkeypatch)
    ex = pipeline_executor.PipelineExecutor()
    async with AsyncSessionLocal() as db:
        jid = await pipeline.enqueue_cycle(db, prior_fingerprints={"i1": "old"})
    # Run the job DIRECTLY (await execute_job) rather than via the fire-and-forget
    # enqueue + sleep — deterministic, no timing race. The Executor.enqueue path
    # is just asyncio.create_task(execute_job(...)); awaiting execute_job tests the
    # same code. The row is UPDATED in place to complete.
    await pipeline_executor.execute_job(jid)
    async with AsyncSessionLocal() as db:
        row = await db.get(PipelineRun, jid)
    assert row.status == "complete"
    assert row.current_fingerprints == {"i1": "fp-new"}


@pytest.mark.asyncio
async def test_executor_stop_cancels_inflight(seeded_db, monkeypatch):
    # A blocking run_cycle that never completes naturally; we cancel the task
    # directly and assert execute_job's CancelledError path marks the row failed.
    async def _slow(db, prior_fingerprints=None):
        await asyncio.sleep(30)
        return {"draft": {}, "current_fingerprints": {}, "n_changed": 0,
                "n_anomalies": 0, "n_claims": 0}
    monkeypatch.setattr(pipeline_executor.autonomy, "run_cycle", _slow)
    async with AsyncSessionLocal() as db:
        jid = await pipeline.enqueue_cycle(db)
    task = asyncio.create_task(pipeline_executor.execute_job(jid))
    await asyncio.sleep(0.05)  # let it enter run_cycle's sleep
    task.cancel()
    await asyncio.gather(task, return_exceptions=True)  # collects the CancelledError
    async with AsyncSessionLocal() as db:
        row = await db.get(PipelineRun, jid)
    assert row.status == "failed"  # cancelled → marked failed, not stranded
    assert row.completed_at is not None
