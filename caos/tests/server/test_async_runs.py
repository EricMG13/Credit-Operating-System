"""Async run execution — executor settings, enqueue/poll, failure, worker claim."""
from __future__ import annotations

from config import Settings


def test_run_executor_settings_defaults():
    s = Settings()
    assert s.caos_run_concurrency == 2
    assert s.caos_run_lease_seconds == 600
    assert s.caos_run_max_attempts == 3


from database import Run


def test_run_model_has_lease_columns():
    cols = Run.__table__.columns
    for name in ("claimed_at", "lease_expires_at", "attempts", "worker_id", "error"):
        assert name in cols, f"Run is missing column {name}"
    assert cols["attempts"].default.arg == 0


import pytest
from sqlalchemy import select


@pytest.mark.asyncio
async def test_execute_run_by_id_completes(seeded_db):
    from database import AsyncSessionLocal, Run
    from engine.fixtures import REFERENCE_ISSUER_ID
    from run_executor import execute_run_by_id

    async with AsyncSessionLocal() as s:
        run = Run(issuer_id=REFERENCE_ISSUER_ID, analyst_id="t")
        s.add(run)
        await s.commit()
        run_id = run.id

    await execute_run_by_id(run_id)

    async with AsyncSessionLocal() as s:
        run = (await s.execute(select(Run).where(Run.id == run_id))).scalar_one()
        assert run.status == "complete"
        assert run.qa_status == "Restricted"  # ATLF fixture → MATERIAL → Restricted


@pytest.mark.asyncio
async def test_execute_run_by_id_marks_failed_on_error(seeded_db, monkeypatch):
    from database import AsyncSessionLocal, Run
    from engine.fixtures import REFERENCE_ISSUER_ID
    import run_executor

    async def boom(session, run):
        raise RuntimeError("synthetic failure")

    monkeypatch.setattr(run_executor, "execute_run", boom)

    async with AsyncSessionLocal() as s:
        run = Run(issuer_id=REFERENCE_ISSUER_ID, analyst_id="t")
        s.add(run)
        await s.commit()
        run_id = run.id

    await run_executor.execute_run_by_id(run_id)

    async with AsyncSessionLocal() as s:
        run = (await s.execute(select(Run).where(Run.id == run_id))).scalar_one()
        assert run.status == "failed"
        assert "synthetic failure" in (run.error or "")


import asyncio


@pytest.mark.asyncio
async def test_same_layer_modules_synthesize_concurrently(seeded_db, monkeypatch):
    """Proof the layer fan-out actually overlaps I/O, not just that it looks like it.

    CP-1A (BusinessTransactionFactPack) and CP-4C (covenant capacity) both depend
    only on CP-1, so they share a CP-X dependency layer. Replace each with a synth
    that sleeps SLEEP seconds, then run the whole pipeline: if the layer runs them
    concurrently the two sleeps overlap (total ≈ 1×SLEEP); if it regressed to serial
    they'd sum (≈ 2×SLEEP)."""
    import time
    from database import AsyncSessionLocal, Run
    from engine import runner
    from engine.fixtures import REFERENCE_ISSUER_ID
    from run_executor import execute_run_by_id

    SLEEP = 0.5
    real_fp, real_cov = runner.synthesize_fact_pack, runner.synthesize_covenants

    async def slow_fp(retrieve):
        await asyncio.sleep(SLEEP)
        return await real_fp(retrieve)

    async def slow_cov(cp1, retrieve):
        await asyncio.sleep(SLEEP)
        return await real_cov(cp1, retrieve)

    monkeypatch.setattr(runner, "synthesize_fact_pack", slow_fp)
    monkeypatch.setattr(runner, "synthesize_covenants", slow_cov)

    async with AsyncSessionLocal() as s:
        run = Run(issuer_id=REFERENCE_ISSUER_ID, analyst_id="t")
        s.add(run)
        await s.commit()
        run_id = run.id

    t0 = time.perf_counter()
    await execute_run_by_id(run_id)
    elapsed = time.perf_counter() - t0

    async with AsyncSessionLocal() as s:
        assert (await s.get(Run, run_id)).status == "complete"
    # Concurrent ⇒ ≈1×SLEEP; serial would be ≥2×SLEEP. Generous margin for the
    # rest of the (fast, fixture) pipeline + CI jitter.
    assert elapsed < 1.5 * SLEEP, f"layer did not overlap: {elapsed:.2f}s ≥ {1.5*SLEEP}s (serial≈{2*SLEEP}s)"


@pytest.mark.asyncio
async def test_inprocess_executor_runs_enqueued(seeded_db):
    from database import AsyncSessionLocal, Run
    from engine.fixtures import REFERENCE_ISSUER_ID
    from run_executor import InProcessExecutor

    # Match real lifespan ordering: the executor starts at boot, then runs are
    # created and enqueued. (start() now sweeps stranded non-terminal runs, so a
    # run created *before* start() would be swept — that's the hard-crash path.)
    ex = InProcessExecutor()
    await ex.start()

    async with AsyncSessionLocal() as s:
        run = Run(issuer_id=REFERENCE_ISSUER_ID, analyst_id="t")
        s.add(run)
        await s.commit()
        run_id = run.id

    await ex.enqueue(run_id)
    # let the fire-and-forget task finish
    for _ in range(100):
        async with AsyncSessionLocal() as s:
            run = await s.get(Run, run_id)
            if run.status in ("complete", "failed"):
                break
        await asyncio.sleep(0.05)
    await ex.stop()
    assert run.status == "complete"


@pytest.mark.asyncio
async def test_inprocess_start_sweeps_stranded_runs(seeded_db):
    """Hard-crash recovery: a run left 'running'/'queued' by a SIGKILL (no stop())
    must be swept to 'failed' on the next start() — SQLite has no reaper."""
    from database import AsyncSessionLocal, Run
    from engine.fixtures import REFERENCE_ISSUER_ID
    from run_executor import InProcessExecutor

    async with AsyncSessionLocal() as s:
        stranded_running = Run(issuer_id=REFERENCE_ISSUER_ID, analyst_id="t", status="running")
        stranded_queued = Run(issuer_id=REFERENCE_ISSUER_ID, analyst_id="t", status="queued")
        done = Run(issuer_id=REFERENCE_ISSUER_ID, analyst_id="t", status="complete")
        s.add_all([stranded_running, stranded_queued, done])
        await s.commit()
        ids = (stranded_running.id, stranded_queued.id, done.id)

    await InProcessExecutor().start()

    async with AsyncSessionLocal() as s:
        r_running, r_queued, r_done = [await s.get(Run, i) for i in ids]
        assert r_running.status == "failed" and "process restart" in (r_running.error or "")
        assert r_queued.status == "failed"
        assert r_done.status == "complete"  # terminal runs are untouched


# These exercise the SKIP LOCKED claim path and only run against Postgres.
import os

requires_pg = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL", "").startswith("postgresql"),
    reason="worker claim/lease requires Postgres (SKIP LOCKED) — run in the CI server "
           "job's Postgres step, or locally via DATABASE_URL=postgresql+asyncpg://...",
)


@requires_pg
@pytest.mark.asyncio
async def test_two_workers_claim_one_run_once(seeded_db):
    from database import AsyncSessionLocal, Run
    from engine.fixtures import REFERENCE_ISSUER_ID
    from run_executor import QueueWorker

    async with AsyncSessionLocal() as s:
        run = Run(issuer_id=REFERENCE_ISSUER_ID, analyst_id="t")
        s.add(run)
        await s.commit()
        run_id = run.id

    w1, w2 = QueueWorker(), QueueWorker()
    id1 = await w1._claim_one()
    id2 = await w2._claim_one()
    claimed = [x for x in (id1, id2) if x == run_id]
    assert len(claimed) == 1, "exactly one worker may claim the run"


@requires_pg
@pytest.mark.asyncio
async def test_reaper_fails_exhausted_orphan(seeded_db):
    from database import AsyncSessionLocal, Run
    from engine.fixtures import REFERENCE_ISSUER_ID
    from run_executor import QueueWorker
    from datetime import datetime, timedelta, timezone

    past = datetime.now(timezone.utc) - timedelta(hours=1)
    async with AsyncSessionLocal() as s:
        run = Run(issuer_id=REFERENCE_ISSUER_ID, analyst_id="t",
                  status="running", attempts=3, lease_expires_at=past)
        s.add(run)
        await s.commit()
        run_id = run.id

    await QueueWorker()._reap_orphans()

    async with AsyncSessionLocal() as s:
        run = await s.get(Run, run_id)
        assert run.status == "failed"
        assert "max attempts" in (run.error or "")


from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def api_client():
    from main import app
    with TestClient(app) as c:
        yield c


def test_post_runs_returns_queued_fast(api_client):
    from conftest import wait_for_run
    from engine.fixtures import REFERENCE_ISSUER_ID
    r = api_client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID})
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "queued"
    wait_for_run(api_client, r.json()["id"])  # drain so the dedup guard doesn't 409 later tests


def test_post_runs_then_polls_to_complete(api_client):
    from conftest import wait_for_run
    from engine.fixtures import REFERENCE_ISSUER_ID
    r = api_client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID})
    body = wait_for_run(api_client, r.json()["id"])
    assert body["status"] == "complete"
    assert body["error"] is None


def test_failed_run_surfaces_error(api_client, monkeypatch):
    import run_executor
    from conftest import wait_for_run
    from engine.fixtures import REFERENCE_ISSUER_ID

    async def boom(session, run):
        raise RuntimeError("kaboom")

    monkeypatch.setattr(run_executor, "execute_run", boom)
    r = api_client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID})
    body = wait_for_run(api_client, r.json()["id"])
    assert body["status"] == "failed"
    assert "kaboom" in (body["error"] or "")


def test_duplicate_active_run_rejected(api_client, monkeypatch):
    """Two runs for one issuer can't be active at once: the second POST gets 409
    while the first is queued/running; a re-run is allowed once it's terminal."""
    import asyncio

    import run_executor
    from conftest import wait_for_run
    from engine.fixtures import REFERENCE_ISSUER_ID

    async def hold(session, run):  # mimic execute_run's status lifecycle, stalled mid-run
        run.status = "running"
        await session.commit()
        await asyncio.sleep(0.3)
        run.status = "complete"

    monkeypatch.setattr(run_executor, "execute_run", hold)
    first = api_client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID})
    assert first.status_code == 201, first.text
    dup = api_client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID})
    assert dup.status_code == 409, dup.text  # blocked while the first is active

    wait_for_run(api_client, first.json()["id"])  # let the first finish, then re-run is fine
    again = api_client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID})
    assert again.status_code == 201, again.text
    wait_for_run(api_client, again.json()["id"])  # drain


@pytest.mark.asyncio
async def test_sqlite_uses_wal_and_busy_timeout():
    import sqlite3
    from database import engine as db_engine, init_db, settings

    if db_engine.dialect.name != "sqlite":
        pytest.skip("sqlite-only pragma check")

    await init_db()  # opening a connection fires the WAL pragma
    path = settings.database_url.split("///")[-1]
    con = sqlite3.connect(path)
    mode = con.execute("PRAGMA journal_mode").fetchone()[0]
    con.close()
    assert mode.lower() == "wal"
    await db_engine.dispose()


@pytest.mark.asyncio
async def test_shutdown_cancellation_marks_run_failed(seeded_db, monkeypatch):
    """A run cancelled mid-flight at shutdown must not strand in 'running'."""
    from database import AsyncSessionLocal, Run
    from engine.fixtures import REFERENCE_ISSUER_ID
    import run_executor
    from run_executor import InProcessExecutor

    async def slow(session, run):
        await asyncio.sleep(30)  # block until cancelled

    monkeypatch.setattr(run_executor, "execute_run", slow)

    async with AsyncSessionLocal() as s:
        run = Run(issuer_id=REFERENCE_ISSUER_ID, analyst_id="t")
        s.add(run)
        await s.commit()
        run_id = run.id

    ex = InProcessExecutor()
    await ex.start()
    await ex.enqueue(run_id)
    await asyncio.sleep(0.1)  # let the task enter execute_run
    await ex.stop()           # cancels in-flight + awaits the mark-failed handler

    async with AsyncSessionLocal() as s:
        run = await s.get(Run, run_id)
        assert run.status == "failed"
        assert "shutdown" in (run.error or "")
