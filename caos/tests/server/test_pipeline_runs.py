"""Tests for the Phase-3 remainder — pipeline_runs persistence (engine/pipeline.py)
+ the autonomy route's advisory-lock + persist + serve-prior-when-locked behavior.

The route handler is called directly with a seeded_db session (no TestClient) and
``autonomy.run_cycle`` mocked, so the lock + persist + prior-resume logic is
exercised without a real cycle. The SQLite lock fallback provides the
single-flight semantics in-process.
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest
import pytest_asyncio
from sqlalchemy import select

from database import AsyncSessionLocal, PipelineRun
from engine import locks, pipeline
from routes import autonomy as route_mod


@pytest_asyncio.fixture(autouse=True)
async def _isolate(seeded_db):
    """Per-test isolation: clear pipeline_runs (the seeded_db temp DB is shared
    across the suite, so prior tests' rows would leak into latest_prior/latest_draft)
    + reset the route's in-memory prior + the SQLite lock fallback set."""
    from sqlalchemy import delete
    route_mod._LAST_FINGERPRINTS = {}
    locks._sqlite_reset()
    async with AsyncSessionLocal() as db:
        await db.execute(delete(PipelineRun))
        await db.commit()
    yield
    locks._sqlite_reset()
    route_mod._LAST_FINGERPRINTS = {}


def _cycle_result(current=None, draft=None, n_changed=1, n_anomalies=2, n_claims=3):
    return {
        "draft": draft or {"status": "draft", "sections": [{"issuer_id": "i1"}],
                           "summary": {"n_sections": 1, "n_deterministic_bullets": 1}},
        "current_fingerprints": current or {"i1": "fp-a", "i2": "fp-b"},
        "tickets": [], "n_changed": n_changed, "n_anomalies": n_anomalies, "n_claims": n_claims,
    }


# ── persist_cycle / latest_prior / latest_draft (unit) ───────────────────────

@pytest.mark.asyncio
async def test_persist_cycle_writes_row(seeded_db):
    async with AsyncSessionLocal() as db:
        rid = await pipeline.persist_cycle(
            db, _cycle_result(), prior_fingerprints={"i1": "old"}, worker_id="w1")
        row = (await db.execute(select(PipelineRun).where(PipelineRun.id == rid))).scalars().one()
    assert row.kind == "autonomy-cycle"
    assert row.status == "complete"
    assert row.prior_fingerprints == {"i1": "old"}
    assert row.current_fingerprints == {"i1": "fp-a", "i2": "fp-b"}
    assert row.draft["status"] == "draft"
    assert row.summary == {"n_changed": 1, "n_anomalies": 2, "n_claims": 3,
                           "n_sections": 1, "n_deterministic_bullets": 1}
    assert row.worker_id == "w1"
    assert row.completed_at is not None


@pytest.mark.asyncio
async def test_latest_prior_returns_latest_complete(seeded_db):
    async with AsyncSessionLocal() as db:
        await pipeline.persist_cycle(db, _cycle_result(current={"i1": "first"}),
                                     prior_fingerprints={})
        await pipeline.persist_cycle(db, _cycle_result(current={"i1": "second", "i2": "x"}),
                                     prior_fingerprints={"i1": "first"})
        prior = await pipeline.latest_prior(db)
    assert prior == {"i1": "second", "i2": "x"}  # the latest complete cycle's current


@pytest.mark.asyncio
async def test_latest_prior_none_when_no_rows(seeded_db):
    async with AsyncSessionLocal() as db:
        assert await pipeline.latest_prior(db) is None
        assert await pipeline.latest_draft(db) is None


@pytest.mark.asyncio
async def test_latest_draft_returns_latest(seeded_db):
    async with AsyncSessionLocal() as db:
        await pipeline.persist_cycle(db, _cycle_result(draft={"status": "draft", "sections": ["old"]}))
        await pipeline.persist_cycle(db, _cycle_result(draft={"status": "draft", "sections": ["new"]}))
        draft = await pipeline.latest_draft(db)
    assert draft["sections"] == ["new"]


# ── route: async enqueue + serve-latest (the route no longer runs the cycle
#    inline — it enqueues a running row + serves the latest complete draft) ────

class _MockExecutor:
    """Captures enqueued job ids without running them (the route test doesn't
    exercise the executor — that's test_pipeline_executor.py's job)."""
    def __init__(self):
        self.enqueued = []

    def enqueue(self, job_id):
        self.enqueued.append(job_id)


def _mock_request(executor=None):
    from types import SimpleNamespace
    return SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(
        pipeline_executor=executor or _MockExecutor())))


async def _persist_complete(current=None, draft=None, completed_at=None):
    async with AsyncSessionLocal() as db:
        rid = await pipeline.persist_cycle(
            db, _cycle_result(current=current, draft=draft))
        if completed_at is not None:
            from sqlalchemy import update as _update
            await db.execute(_update(PipelineRun).where(PipelineRun.id == rid)
                             .values(completed_at=completed_at))
            await db.commit()
        return rid


@pytest.mark.asyncio
async def test_route_enqueues_when_no_complete(seeded_db):
    ex = _MockExecutor()
    async with AsyncSessionLocal() as db:
        out = await route_mod.get_autonomy_draft(_mock_request(ex), db, caller=SimpleNamespace())
    # No complete draft → "no draft yet" envelope, refreshing (a cycle was enqueued).
    assert out["sections"] == []
    assert "no draft yet" in out["error"]
    assert out["refreshing"] is True
    assert len(ex.enqueued) == 1  # one cycle enqueued
    async with AsyncSessionLocal() as db:
        running = await pipeline.latest_running(db)
    assert running is not None  # the running row was written


@pytest.mark.asyncio
async def test_route_serves_latest_complete_when_running(seeded_db):
    # A complete draft exists + a running job is in progress → serve the complete,
    # do NOT enqueue a second cycle.
    await _persist_complete(draft={"status": "draft", "sections": ["served"],
                                   "summary": {"n_sections": 1}})
    async with AsyncSessionLocal() as db:
        await pipeline.enqueue_cycle(db)  # a running row
    ex = _MockExecutor()
    async with AsyncSessionLocal() as db:
        out = await route_mod.get_autonomy_draft(_mock_request(ex), db, caller=SimpleNamespace())
    assert out["sections"] == ["served"]  # served the latest complete
    assert out["refreshing"] is True       # a cycle is running
    assert ex.enqueued == []               # did NOT enqueue a second cycle


@pytest.mark.asyncio
async def test_route_no_enqueue_when_fresh_complete(seeded_db):
    # A fresh complete draft (just completed) + no running → serve it, no enqueue.
    await _persist_complete(draft={"status": "draft", "sections": ["fresh"],
                                   "summary": {"n_sections": 1}})
    ex = _MockExecutor()
    async with AsyncSessionLocal() as db:
        out = await route_mod.get_autonomy_draft(_mock_request(ex), db, caller=SimpleNamespace())
    assert out["sections"] == ["fresh"]
    assert out["refreshing"] is False  # fresh + no running → no work
    assert ex.enqueued == []


@pytest.mark.asyncio
async def test_route_force_enqueues_even_when_fresh(seeded_db):
    await _persist_complete(draft={"status": "draft", "sections": ["fresh"],
                                   "summary": {"n_sections": 1}})
    ex = _MockExecutor()
    async with AsyncSessionLocal() as db:
        out = await route_mod.get_autonomy_draft(_mock_request(ex), db,
                                                 caller=SimpleNamespace(), force=True)
    assert ex.enqueued == [1 if False else ex.enqueued[0]]  # one enqueued
    assert len(ex.enqueued) == 1
    assert out["refreshing"] is True


@pytest.mark.asyncio
async def test_route_cold_start_enqueues_with_prior_from_latest_complete(seeded_db):
    # A prior complete cycle's current_fingerprints become the new cycle's prior.
    # The complete is made STALE so the route enqueues a refresh (a fresh complete
    # would be served as-is — see test_route_no_enqueue_when_fresh_complete).
    from datetime import datetime, timedelta, timezone
    stale = datetime.now(timezone.utc) - timedelta(hours=2)
    await _persist_complete(current={"i1": "persisted-prior"},
                            draft={"status": "draft", "sections": ["old"],
                                   "summary": {"n_sections": 1}},
                            completed_at=stale)
    ex = _MockExecutor()
    async with AsyncSessionLocal() as db:
        await route_mod.get_autonomy_draft(_mock_request(ex), db, caller=SimpleNamespace())
    # The enqueued running row carries the latest complete's current as its prior.
    async with AsyncSessionLocal() as db:
        running = await pipeline.latest_running(db)
    assert running is not None
    assert running.prior_fingerprints == {"i1": "persisted-prior"}


@pytest.mark.asyncio
async def test_route_failure_returns_empty_draft(seeded_db, monkeypatch):
    # Force the route to raise (e.g. pipeline.latest_running blows up) → empty draft.
    async def _boom(*a, **kw):
        raise RuntimeError("db blew up")
    monkeypatch.setattr(route_mod.pipeline, "latest_running", _boom)
    ex = _MockExecutor()
    async with AsyncSessionLocal() as db:
        out = await route_mod.get_autonomy_draft(_mock_request(ex), db, caller=SimpleNamespace())
    assert out["status"] == "draft"
    assert out["ratified"] is False
    assert out["marking"] == "AI-GENERATED, UNRATIFIED"
    assert out["sections"] == []
    assert out["refreshing"] is False
