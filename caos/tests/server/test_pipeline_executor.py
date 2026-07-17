"""Tests for engine/pipeline_executor.py — the durable, multi-worker-safe
autonomy-cycle executor. The claim/execute/sweep mechanism is exercised on the
SQLite test DB (the SKIP LOCKED fallback); ``execute_job`` mocks
``autonomy.run_cycle`` so no real cycle runs. Recovery tests exercise periodic
lease reclamation rather than a one-shot boot sweep.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from sqlalchemy import delete, update

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


async def _make_job(prior=None, status="queued", **values):
    async with AsyncSessionLocal() as db:
        row = PipelineRun(kind="autonomy-cycle", status=status,
                          prior_fingerprints=prior, current_fingerprints={},
                          draft={}, summary={}, **values)
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


async def _wait_for_status(job_id, expected, timeout=2.0):
    deadline = asyncio.get_running_loop().time() + timeout
    while asyncio.get_running_loop().time() < deadline:
        async with AsyncSessionLocal() as db:
            row = await db.get(PipelineRun, job_id)
            if row is not None and row.status == expected:
                return row
        await asyncio.sleep(0.01)
    async with AsyncSessionLocal() as db:
        row = await db.get(PipelineRun, job_id)
    pytest.fail(f"job {job_id} did not reach {expected}; status={getattr(row, 'status', None)}")


async def _claim(job_id, worker_id="test-worker"):
    async with AsyncSessionLocal() as db:
        row = await pipeline_executor.claim_next_job(db, worker_id)
    assert row is not None and row.id == job_id
    return worker_id


# ── enqueue_cycle (pipeline.py) ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_enqueue_cycle_creates_queued_row(seeded_db):
    async with AsyncSessionLocal() as db:
        rid = await pipeline.enqueue_cycle(db, prior_fingerprints={"i1": "old"})
        row = await db.get(PipelineRun, rid)
    assert row.status == "queued"
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
async def test_claim_next_job_does_not_reclaim_live_lease(seeded_db):
    jid = await _make_job()
    async with AsyncSessionLocal() as db:
        first = await pipeline_executor.claim_next_job(db, "w1")
        # A second claim skips the first worker's unexpired lease.
        second = await pipeline_executor.claim_next_job(db, "w2")
    assert first.id == jid
    assert second is None


@pytest.mark.asyncio
async def test_claim_next_job_none_when_no_nonterminal(seeded_db):
    await _make_job(status="complete")
    async with AsyncSessionLocal() as db:
        assert await pipeline_executor.claim_next_job(db, "w1") is None


# ── execute_job ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_execute_job_completes_row(seeded_db, monkeypatch):
    _wire_run_cycle(monkeypatch)
    jid = await _make_job(prior={"i1": "old"})
    owner = await _claim(jid)
    await pipeline_executor.execute_job(jid, expected_worker_id=owner)
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
    owner = await _claim(jid)
    await pipeline_executor.execute_job(jid, expected_worker_id=owner)
    async with AsyncSessionLocal() as db:
        row = await db.get(PipelineRun, jid)
    assert row.status == "failed"
    assert "cycle boom" in (row.error or "")
    assert row.completed_at is not None


@pytest.mark.asyncio
async def test_lease_set_failure_still_marks_job_failed(seeded_db, monkeypatch):
    """The lease-set commit must be INSIDE the try/except, not before it — a
    commit failure there (DB blip, pool exhaustion) must still mark the job
    failed, not strand it in 'running' with no error and no lease."""
    real_get_settings = pipeline_executor.get_settings

    class _BoomSettings:
        def __getattr__(self, name):
            if name == "caos_pipeline_lease_seconds":
                raise RuntimeError("synthetic lease-set failure")
            return getattr(real_get_settings(), name)

    monkeypatch.setattr(pipeline_executor, "get_settings", lambda: _BoomSettings())

    jid = await _make_job(status="running")
    await pipeline_executor.execute_job(jid)
    async with AsyncSessionLocal() as db:
        row = await db.get(PipelineRun, jid)
    assert row.status == "failed"
    assert "synthetic lease-set failure" in (row.error or "")


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


# ── PipelineExecutor: continuous claim, recovery, heartbeat, fencing ─────────

@pytest.mark.asyncio
async def test_executor_claims_null_lease_strand(seeded_db, monkeypatch):
    """A legacy/crashed NULL lease is reclaimable and completes."""
    _wire_run_cycle(monkeypatch)
    stranded = await _make_job(status="running")
    done = await _make_job(status="complete")
    ex = pipeline_executor.PipelineExecutor()
    await ex.start()
    try:
        r1 = await _wait_for_status(stranded, "complete", timeout=4.0)
        async with AsyncSessionLocal() as db:
            r2 = await db.get(PipelineRun, done)
        assert r1.current_fingerprints == {"i1": "fp-new"}
        assert r2.status == "complete"
    finally:
        await ex.stop()


@pytest.mark.asyncio
async def test_executor_does_not_sweep_live_leased_running(seeded_db):
    """Multi-replica safety: a 'running' cycle whose lease has NOT expired is
    genuinely still running (on this replica or a live sibling) and must survive
    the periodic claim loop — only an expired lease is reclaimable."""
    async with AsyncSessionLocal() as db:
        row = PipelineRun(
            kind="autonomy-cycle", status="running",
            current_fingerprints={}, draft={}, summary={},
            worker_id="sibling-replica:123",
            lease_expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        )
        db.add(row)
        await db.commit()
        live = row.id

    ex = pipeline_executor.PipelineExecutor()
    await ex.start()
    try:
        await asyncio.sleep(0.05)
        async with AsyncSessionLocal() as db:
            assert (await db.get(PipelineRun, live)).status == "running"
    finally:
        await ex.stop()


@pytest.mark.asyncio
async def test_executor_reclaims_expired_leased_running(seeded_db, monkeypatch):
    """An expired attempt is reclaimed and re-executed, not merely failed."""
    _wire_run_cycle(monkeypatch)

    async with AsyncSessionLocal() as db:
        row = PipelineRun(
            kind="autonomy-cycle", status="running",
            current_fingerprints={}, draft={}, summary={},
            worker_id="dead-replica:456",
            lease_expires_at=datetime.now(timezone.utc) - timedelta(minutes=10),
        )
        db.add(row)
        await db.commit()
        dead = row.id

    ex = pipeline_executor.PipelineExecutor()
    await ex.start()
    try:
        recovered = await _wait_for_status(dead, "complete", timeout=4.0)
        assert recovered.worker_id == ex._worker_id
        assert recovered.lease_expires_at is None
    finally:
        await ex.stop()


@pytest.mark.asyncio
async def test_executor_revisits_future_lease_after_start(seeded_db, monkeypatch):
    """A crash with a still-live lease at boot is recovered after that lease
    expires; this is the regression that a one-shot startup sweep missed."""
    _wire_run_cycle(monkeypatch)
    jid = await _make_job(
        status="running",
        worker_id="crashed-worker",
        lease_expires_at=datetime.now(timezone.utc) + timedelta(milliseconds=80),
    )
    settings = pipeline_executor.get_settings()
    monkeypatch.setattr(settings, "caos_pipeline_poll_seconds", 0.02)
    ex = pipeline_executor.PipelineExecutor()
    await ex.start()
    try:
        recovered = await _wait_for_status(jid, "complete", timeout=2.0)
        assert recovered.worker_id == ex._worker_id
    finally:
        await ex.stop()


@pytest.mark.asyncio
async def test_executor_enqueue_runs_job_to_complete(seeded_db, monkeypatch):
    _wire_run_cycle(monkeypatch)
    async with AsyncSessionLocal() as db:
        jid = await pipeline.enqueue_cycle(db, prior_fingerprints={"i1": "old"})
    ex = pipeline_executor.PipelineExecutor()
    await ex.start()
    try:
        ex.enqueue(jid)
        row = await _wait_for_status(jid, "complete", timeout=4.0)
        assert row.current_fingerprints == {"i1": "fp-new"}
    finally:
        await ex.stop()


@pytest.mark.asyncio
async def test_stale_worker_cannot_commit_after_reclaim(seeded_db, monkeypatch):
    entered = asyncio.Event()
    release = asyncio.Event()

    async def _blocked(db, prior_fingerprints=None):
        entered.set()
        await release.wait()
        return {
            "draft": {"status": "draft", "summary": {}},
            "current_fingerprints": {"stale": "result"},
            "n_changed": 1, "n_anomalies": 0, "n_claims": 0,
        }

    monkeypatch.setattr(pipeline_executor.autonomy, "run_cycle", _blocked)
    jid = await _make_job()
    owner = await _claim(jid, "old-worker")
    task = asyncio.create_task(
        pipeline_executor.execute_job(jid, expected_worker_id=owner)
    )
    await asyncio.wait_for(entered.wait(), timeout=1)
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(PipelineRun).where(PipelineRun.id == jid).values(
                worker_id="new-worker",
                lease_expires_at=datetime.now(timezone.utc) + timedelta(minutes=1),
            )
        )
        await db.commit()
    release.set()
    await task
    async with AsyncSessionLocal() as db:
        row = await db.get(PipelineRun, jid)
    assert row.status == "running"
    assert row.worker_id == "new-worker"
    assert row.current_fingerprints == {}


@pytest.mark.asyncio
async def test_executor_stop_cancels_inflight(seeded_db, monkeypatch):
    # A blocking cycle is drained and marked terminal on executor shutdown.
    async def _slow(db, prior_fingerprints=None):
        await asyncio.sleep(30)
        return {"draft": {}, "current_fingerprints": {}, "n_changed": 0,
                "n_anomalies": 0, "n_claims": 0}
    monkeypatch.setattr(pipeline_executor.autonomy, "run_cycle", _slow)
    async with AsyncSessionLocal() as db:
        jid = await pipeline.enqueue_cycle(db)
    ex = pipeline_executor.PipelineExecutor()
    await ex.start()
    ex.enqueue(jid)
    await _wait_for_status(jid, "running", timeout=4.0)
    await ex.stop()
    async with AsyncSessionLocal() as db:
        row = await db.get(PipelineRun, jid)
    assert row.status == "failed"  # cancelled → marked failed, not stranded
    assert row.completed_at is not None
