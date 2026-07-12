"""Durable Deep Research jobs (M-3) — background execution, sweep-on-boot, and
per-analyst isolation of the poll endpoint."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from conftest import requires_pg


def test_research_executor_settings_defaults():
    from config import Settings

    s = Settings()
    assert s.caos_research_concurrency == 2
    assert s.caos_research_lease_seconds == 1800
    assert s.caos_research_max_attempts == 2


def test_research_job_model_has_lease_columns():
    from database import ResearchJob

    cols = ResearchJob.__table__.columns
    for name in ("claimed_at", "lease_expires_at", "attempts", "worker_id"):
        assert name in cols, f"ResearchJob is missing column {name}"
    assert cols["attempts"].default.arg == 0


# ── Background execution ─────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_execute_research_by_id_completes_demo(seeded_db):
    from database import AsyncSessionLocal, ResearchJob
    from research_executor import execute_research_by_id

    async with AsyncSessionLocal() as s:
        job = ResearchJob(status="running", analyst_id="t",
                          brief={"subject": "Enterprise Software", "mode": "sector"})
        s.add(job)
        await s.commit()
        jid = job.id

    await execute_research_by_id(jid)

    async with AsyncSessionLocal() as s:
        job = await s.get(ResearchJob, jid)
        assert job.status == "complete"
        assert job.demo is True
        assert "Executive Summary" in (job.report or "")
        assert job.completed_at is not None


@pytest.mark.asyncio
async def test_execute_research_marks_failed_on_error(seeded_db, monkeypatch):
    from database import AsyncSessionLocal, ResearchJob
    import research_executor

    async def boom(brief, on_progress=None):
        raise RuntimeError("synthetic research failure")

    monkeypatch.setattr(research_executor, "run_deep_research", boom)

    async with AsyncSessionLocal() as s:
        job = ResearchJob(status="running", analyst_id="t",
                          brief={"subject": "Acme", "mode": "issuer"})
        s.add(job)
        await s.commit()
        jid = job.id

    await research_executor.execute_research_by_id(jid)

    async with AsyncSessionLocal() as s:
        job = await s.get(ResearchJob, jid)
        assert job.status == "failed"
        assert "synthetic research failure" in (job.error or "")


@pytest.mark.asyncio
async def test_research_executor_sweeps_stranded_jobs(seeded_db):
    """Hard-crash recovery: a job left 'running' by a restart (a stream can't be
    resumed) must be swept to 'failed' on the next start(); terminal jobs untouched."""
    from database import AsyncSessionLocal, ResearchJob
    from research_executor import ResearchExecutor

    async with AsyncSessionLocal() as s:
        stranded = ResearchJob(status="running", analyst_id="t", brief={"subject": "Acme", "mode": "issuer"})
        done = ResearchJob(status="complete", analyst_id="t", brief={}, report="done")
        s.add_all([stranded, done])
        await s.commit()
        sid, did = stranded.id, done.id

    await ResearchExecutor().start()

    async with AsyncSessionLocal() as s:
        assert (await s.get(ResearchJob, sid)).status == "failed"
        assert (await s.get(ResearchJob, did)).status == "complete"


# ── Poll endpoint isolation (per-analyst) ────────────────────────────────────
_ALICE = {"x-forwarded-user": "alice", "x-forwarded-email": "alice@example.com"}
_BOB = {"x-forwarded-user": "bob", "x-forwarded-email": "bob@example.com"}


def test_research_job_is_scoped_to_owner():
    from main import app

    with TestClient(app) as c:
        r = c.post("/api/research", json={"subject": "Enterprise Software", "mode": "sector"}, headers=_ALICE)
        assert r.status_code == 201, r.text
        jid = r.json()["id"]

        # Another analyst must not be able to read it — 404, not 403 (no existence leak).
        assert c.get(f"/api/research/{jid}", headers=_BOB).status_code == 404
        # The owner can.
        assert c.get(f"/api/research/{jid}", headers=_ALICE).status_code == 200


def test_research_get_unknown_id_404():
    from main import app

    with TestClient(app) as c:
        assert c.get("/api/research/does-not-exist").status_code == 404


# ── Poll-again branch: GET returns 'running' for an in-progress job ───────────
@pytest.mark.asyncio
async def test_get_returns_running_for_in_progress_job(seeded_db):
    """The durable contract's core: a not-yet-finished job polls as 'running' (so
    the client loops), with no report yet. Exercises the GET endpoint's passthrough
    of the non-terminal state directly (no flaky timing)."""
    from database import AsyncSessionLocal, ResearchJob
    from identity import CallerIdentity
    from routes.research import get_research

    async with AsyncSessionLocal() as s:
        job = ResearchJob(status="running", analyst_id="alice",
                          brief={"subject": "Acme", "mode": "issuer"},
                          progress={"sources": 2, "searches": 3})
        s.add(job)
        await s.commit()
        jid = job.id

    caller = CallerIdentity(id="alice", email="a@x.io", full_name="A", source="proxy")
    async with AsyncSessionLocal() as s:
        out = await get_research(jid, caller=caller, db=s)
    assert out.status == "running"
    assert out.report is None
    assert out.progress == {"sources": 2, "searches": 3}


# ── Concurrency cap: jobs past the cap queue, but all still complete ──────────
@pytest.mark.asyncio
async def test_research_concurrency_cap_completes_all(seeded_db, monkeypatch):
    """With the cap at 1, two jobs must serialize on the semaphore yet BOTH still
    complete — the gate must not drop or deadlock a queued job."""
    import asyncio

    from config import get_settings
    from database import AsyncSessionLocal, ResearchJob
    import research_executor

    s = get_settings()
    prev = s.caos_research_concurrency
    s.caos_research_concurrency = 1
    research_executor._sem = None  # rebuild the lazy semaphore at the new cap
    try:
        ids = []
        async with AsyncSessionLocal() as db:
            for _ in range(2):
                job = ResearchJob(status="running", analyst_id="t",
                                  brief={"subject": "Enterprise Software", "mode": "sector"})
                db.add(job)
                ids.append(job)
            await db.commit()
            ids = [j.id for j in ids]

        await asyncio.gather(*(research_executor.execute_research_by_id(i) for i in ids))

        async with AsyncSessionLocal() as db:
            for i in ids:
                assert (await db.get(ResearchJob, i)).status == "complete"
    finally:
        s.caos_research_concurrency = prev
        research_executor._sem = None


# ── QueueWorker claim/reaper (Postgres only — SKIP LOCKED) ───────────────────

@requires_pg
@pytest.mark.asyncio
async def test_two_research_workers_claim_one_job_once(seeded_db):
    from database import AsyncSessionLocal, ResearchJob
    from research_executor import ResearchQueueWorker

    async with AsyncSessionLocal() as s:
        job = ResearchJob(analyst_id="t", brief={"subject": "Claim Race Co", "mode": "issuer"})
        s.add(job)
        await s.commit()
        job_id = job.id

    w1, w2 = ResearchQueueWorker(), ResearchQueueWorker()
    id1 = await w1._claim_one()
    id2 = await w2._claim_one()
    claimed = [x for x in (id1, id2) if x == job_id]
    assert len(claimed) == 1, "exactly one worker may claim the job"


@requires_pg
@pytest.mark.asyncio
async def test_research_reaper_fails_exhausted_orphan(seeded_db):
    from datetime import datetime, timedelta, timezone

    from database import AsyncSessionLocal, ResearchJob
    from research_executor import ResearchQueueWorker

    past = datetime.now(timezone.utc) - timedelta(hours=1)
    async with AsyncSessionLocal() as s:
        job = ResearchJob(
            analyst_id="t", brief={"subject": "Reaper Orphan Co", "mode": "issuer"},
            status="running", attempts=2, lease_expires_at=past,
        )
        s.add(job)
        await s.commit()
        job_id = job.id

    await ResearchQueueWorker()._reap_orphans()

    async with AsyncSessionLocal() as s:
        job = await s.get(ResearchJob, job_id)
        assert job.status == "failed"
        assert "max attempts" in (job.error or "")
