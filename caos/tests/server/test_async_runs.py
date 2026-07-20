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
from sqlalchemy.exc import IntegrityError


# ── #4: DB-level backstop for the active-run dedup ─────────────────────────
@pytest.mark.asyncio
async def test_active_run_unique_index_fires_at_db_level(seeded_db):
    """migrations/0034 (uq_runs_issuer_active): a partial unique index on
    (issuer_id) WHERE status IN ('queued','running') — the backstop for
    routes/runs.py's _CREATE_RUN_LOCK, which can't coordinate a race across
    multiple app replicas. Two active rows for the same issuer must be
    rejected AT THE DATABASE, independent of any application-layer check.

    The suite shares one process-global DB (conftest's documented #1 hazard) —
    every other test in this file freely creates ad-hoc Runs against the same
    REFERENCE_ISSUER_ID, so this test must not leave an ACTIVE row behind, or
    every later active-run insert in the file collides with it too."""
    from database import AsyncSessionLocal, Run
    from engine.fixtures import REFERENCE_ISSUER_ID

    async with AsyncSessionLocal() as s:
        queued = Run(issuer_id=REFERENCE_ISSUER_ID, analyst_id="a", status="queued")
        s.add(queued)
        await s.commit()
        queued_id = queued.id

    try:
        async with AsyncSessionLocal() as s:
            s.add(Run(issuer_id=REFERENCE_ISSUER_ID, analyst_id="b", status="running"))
            with pytest.raises(IntegrityError):
                await s.commit()
            await s.rollback()

        # A TERMINAL row for the same issuer does not collide — only queued/running
        # are covered by the partial predicate, matching create_run's own re-run
        # semantics ("re-runs once the prior one is terminal are allowed").
        async with AsyncSessionLocal() as s:
            s.add(Run(issuer_id=REFERENCE_ISSUER_ID, analyst_id="c", status="complete"))
            await s.commit()  # no raise
    finally:
        async with AsyncSessionLocal() as s:
            row = await s.get(Run, queued_id)
            row.status = "failed"  # free the active slot for every later test in this file
            await s.commit()


@pytest.mark.asyncio
async def test_execute_run_by_id_completes(seeded_db):
    from database import AsyncSessionLocal, NotificationEvent, Run
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
        event = (await s.execute(select(NotificationEvent).where(
            NotificationEvent.subject_id == run_id
        ))).scalar_one()
        assert event.analyst_id == "t"
        assert event.kind == "run_complete"
        assert event.action_label == "Open dependency map"


@pytest.mark.asyncio
async def test_execute_run_by_id_marks_failed_on_error(seeded_db, monkeypatch):
    from database import AsyncSessionLocal, NotificationEvent, Run
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
        event = (await s.execute(select(NotificationEvent).where(
            NotificationEvent.subject_id == run_id
        ))).scalar_one()
        assert event.kind == "run_failed"
        assert event.action_label == "Open dependency map"


@pytest.mark.asyncio
async def test_stale_claim_cannot_execute_or_clobber_newer_attempt(seeded_db, monkeypatch):
    from database import AsyncSessionLocal, Run
    from engine.fixtures import REFERENCE_ISSUER_ID
    import run_executor

    calls = 0

    async def should_not_run(session, run):
        nonlocal calls
        calls += 1

    monkeypatch.setattr(run_executor, "execute_run", should_not_run)

    async with AsyncSessionLocal() as session:
        run = Run(
            issuer_id=REFERENCE_ISSUER_ID,
            analyst_id="lease-fence",
            status="complete",
            attempts=2,
            worker_id="new-worker",
        )
        session.add(run)
        await session.commit()
        run_id = run.id

    await run_executor.execute_run_by_id(
        run_id,
        expected_attempt=1,
        expected_worker_id="old-worker",
    )

    async with AsyncSessionLocal() as session:
        row = await session.get(Run, run_id)
        assert row.status == "complete"
        assert row.attempts == 2
    assert calls == 0


@pytest.mark.asyncio
async def test_notification_render_failure_uses_minimal_event_and_run_stays_terminal(
    seeded_db, monkeypatch
):
    from database import AsyncSessionLocal, NotificationEvent, Run
    from engine.fixtures import REFERENCE_ISSUER_ID
    import run_executor

    async def fail_run(session, run):
        raise RuntimeError("synthetic execution failure")

    async def fail_rich_notification(session, run):
        raise RuntimeError("synthetic notification rendering failure")

    monkeypatch.setattr(run_executor, "execute_run", fail_run)
    monkeypatch.setattr(
        run_executor, "emit_run_terminal_notification", fail_rich_notification
    )

    async with AsyncSessionLocal() as session:
        run = Run(issuer_id=REFERENCE_ISSUER_ID, analyst_id="notification-fallback")
        session.add(run)
        await session.commit()
        run_id = run.id

    await run_executor.execute_run_by_id(run_id)

    async with AsyncSessionLocal() as session:
        run = await session.get(Run, run_id)
        assert run is not None and run.status == "failed"
        events = list((await session.execute(select(NotificationEvent).where(
            NotificationEvent.subject_id == run_id
        ))).scalars().all())
        assert len(events) == 1
        assert events[0].kind == "run_failed"
        assert events[0].title == "Issuer analysis failed"
        assert events[0].action_label == "Open dependency map"


@pytest.mark.asyncio
async def test_session_bound_database_failure_rolls_back_and_retries_once(
    seeded_db, monkeypatch
):
    from database import AsyncSessionLocal, Run
    from engine.fixtures import REFERENCE_ISSUER_ID
    from engine.runner import RetryableRunTransactionError
    import run_executor

    calls = 0

    async def transient_portfolio_failure(_session, run):
        nonlocal calls
        calls += 1
        if calls == 1:
            run_executor.budget.set_budget(
                run_executor.budget.RunBudget(limit=1_000, used=125)
            )
            raise RetryableRunTransactionError("portfolio read lost connection")
        assert run.tokens_used == 125
        run.status = "complete"
        run.tokens_used = 150

    monkeypatch.setattr(run_executor, "execute_run", transient_portfolio_failure)

    async with AsyncSessionLocal() as session:
        run = Run(issuer_id=REFERENCE_ISSUER_ID, analyst_id="transaction-retry")
        session.add(run)
        await session.commit()
        run_id = run.id

    await run_executor.execute_run_by_id(run_id)

    async with AsyncSessionLocal() as session:
        row = await session.get(Run, run_id)
        assert row is not None
        assert row.status == "complete"
        assert row.error is None
        assert row.tokens_used == 150
    assert calls == 2


import asyncio


@pytest.mark.asyncio
async def test_same_layer_modules_synthesize_concurrently(seeded_db, monkeypatch):
    """Proof the layer fan-out actually overlaps I/O, not just that it looks like it.

    CP-4 (legal review) and CP-4C (covenant capacity) both depend only on CP-1,
    so they share a CP-X dependency layer (CP-1A moved to layer 0 when its
    repudiated CP-1 edge was removed — corpus M2 / audit SPEC-2). Replace each
    with a synth that sleeps SLEEP seconds, then run the whole pipeline: if the
    layer runs them concurrently the two sleeps overlap (total ≈ 1×SLEEP); if it
    regressed to serial they'd sum (≈ 2×SLEEP)."""
    from database import AsyncSessionLocal, Run
    from engine import bindings
    from engine.fixtures import REFERENCE_ISSUER_ID
    from run_executor import execute_run_by_id

    SLEEP = 0.5
    spans = {}
    # These synthesizers now live behind the bindings dispatch seam (spec P1·C1);
    # patch them there, not on runner.
    real_lr, real_cov = bindings.synthesize_legal_review, bindings.synthesize_covenants

    async def slow_lr(retrieve):
        loop = asyncio.get_running_loop()
        spans["CP-4:start"] = loop.time()
        await asyncio.sleep(SLEEP)
        result = await real_lr(retrieve)
        spans["CP-4:end"] = loop.time()
        return result

    async def slow_cov(cp1, retrieve):
        loop = asyncio.get_running_loop()
        spans["CP-4C:start"] = loop.time()
        await asyncio.sleep(SLEEP)
        result = await real_cov(cp1, retrieve)
        spans["CP-4C:end"] = loop.time()
        return result

    monkeypatch.setattr(bindings, "synthesize_legal_review", slow_lr)
    monkeypatch.setattr(bindings, "synthesize_covenants", slow_cov)

    async with AsyncSessionLocal() as s:
        run = Run(issuer_id=REFERENCE_ISSUER_ID, analyst_id="t")
        s.add(run)
        await s.commit()
        run_id = run.id

    await execute_run_by_id(run_id)

    async with AsyncSessionLocal() as s:
        assert (await s.get(Run, run_id)).status == "complete"
    # Prove the two target synthesizers overlapped directly. Total pipeline
    # elapsed time includes unrelated serial session modules and fixture overhead,
    # so it is too noisy a proxy for same-layer fan-out.
    assert {"CP-4:start", "CP-4:end", "CP-4C:start", "CP-4C:end"} <= spans.keys()
    overlap = min(spans["CP-4:end"], spans["CP-4C:end"]) - max(spans["CP-4:start"], spans["CP-4C:start"])
    assert overlap > 0.8 * SLEEP, f"target synthesizers did not overlap enough: {overlap:.2f}s"


@pytest.mark.asyncio
async def test_inprocess_executor_runs_enqueued(seeded_db):
    from database import AsyncSessionLocal, Run
    from engine.fixtures import REFERENCE_ISSUER_ID
    from run_executor import InProcessExecutor

    # Match real lifespan ordering: the executor starts at boot, then runs are
    # created and enqueued. Pre-existing queued rows are recovered separately.
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
async def test_inprocess_start_recovers_nonterminal_runs(seeded_db, monkeypatch):
    """Hard-crash recovery fails an interrupted attempt but resumes queued work."""
    from database import AsyncSessionLocal, Issuer, Run
    from engine.fixtures import REFERENCE_ISSUER_ID
    from run_executor import InProcessExecutor

    async with AsyncSessionLocal() as s:
        # A second issuer for the queued row — migrations/0035's active-run
        # unique index (one active run per issuer) means two SIMULTANEOUSLY
        # active rows can't legitimately share an issuer.
        other = Issuer(name="Sweep Test Co")
        s.add(other)
        await s.flush()
        stranded_running = Run(issuer_id=REFERENCE_ISSUER_ID, analyst_id="t", status="running")
        stranded_queued = Run(issuer_id=other.id, analyst_id="t", status="queued")
        done = Run(issuer_id=REFERENCE_ISSUER_ID, analyst_id="t", status="complete")
        s.add_all([stranded_running, stranded_queued, done])
        await s.commit()
        ids = (stranded_running.id, stranded_queued.id, done.id)

    resumed = asyncio.Event()

    async def _record_resume(run_id: str):
        if run_id == ids[1]:
            resumed.set()

    monkeypatch.setattr("run_executor.execute_run_by_id", _record_resume)
    executor = InProcessExecutor()
    await executor.start()
    await asyncio.wait_for(resumed.wait(), timeout=1)

    async with AsyncSessionLocal() as s:
        r_running, r_queued, r_done = [await s.get(Run, i) for i in ids]
        assert r_running.status == "failed" and "process restart" in (r_running.error or "")
        assert r_queued.status == "queued"  # execute stub proves it was re-enqueued
        assert r_done.status == "complete"  # terminal runs are untouched
        from database import NotificationEvent
        events = list((await s.execute(select(NotificationEvent).where(
            NotificationEvent.subject_id.in_(ids[:2])
        ))).scalars().all())
        assert {event.subject_id for event in events} == {ids[0]}
    await executor.stop()


@pytest.mark.asyncio
async def test_active_run_unique_index_blocks_racing_second(seeded_db):
    """The partial unique index (migration 0021) is the multi-replica backstop behind
    the in-process create_run lock: a second queued/running run for the same issuer
    cannot be committed even by a direct insert (a racing replica that slipped past the
    per-process lock). Uses a dedicated issuer so it doesn't pollute shared run state."""
    from sqlalchemy.exc import IntegrityError

    from database import AsyncSessionLocal, Issuer, Run

    async with AsyncSessionLocal() as s:
        s.add(Issuer(id="dedup-idx-iss", name="Dedup Idx Co"))
        s.add(Run(issuer_id="dedup-idx-iss", analyst_id="t", status="running"))
        await s.commit()

    async with AsyncSessionLocal() as s:
        s.add(Run(issuer_id="dedup-idx-iss", analyst_id="t", status="queued"))
        with pytest.raises(IntegrityError):
            await s.commit()

    # A terminal run for the same issuer is allowed (the index predicate excludes it).
    async with AsyncSessionLocal() as s:
        s.add(Run(issuer_id="dedup-idx-iss", analyst_id="t", status="complete"))
        await s.commit()


# These exercise the SKIP LOCKED claim path and only run against Postgres.
from conftest import requires_pg


@requires_pg
@pytest.mark.asyncio
async def test_two_workers_claim_one_run_once(seeded_db):
    from database import AsyncSessionLocal, Issuer, Run
    from run_executor import QueueWorker

    # Dedicated issuer: the active-run partial unique index permits only one
    # queued/running run per issuer, and this test intentionally leaves its run
    # claimed (never drained). On Postgres the cross-test issuer cleanup is a
    # no-op (it is SQLite-path-only), so sharing REFERENCE_ISSUER_ID would leave
    # an active run that collides with the next pg test's insert.
    async with AsyncSessionLocal() as s:
        s.add(Issuer(id="claim-race-iss", name="Claim Race Co"))
        run = Run(issuer_id="claim-race-iss", analyst_id="t")
        s.add(run)
        await s.commit()
        run_id = run.id

    try:
        w1, w2 = QueueWorker(), QueueWorker()
        claim1 = await w1._claim_one()
        claim2 = await w2._claim_one()
        claimed = [x for x in (claim1, claim2) if x and x[0] == run_id]
        assert len(claimed) == 1, "exactly one worker may claim the run"
    finally:
        # _claim_one leaves the run "running" (claimed, never executed) —
        # migrations/0034's active-run unique index means that would otherwise
        # permanently block every later test's active-run insert on the shared
        # REFERENCE_ISSUER_ID (same posture as
        # test_active_run_unique_index_fires_at_db_level's own finally above).
        async with AsyncSessionLocal() as s:
            row = await s.get(Run, run_id)
            row.status = "failed"
            await s.commit()


@requires_pg
@pytest.mark.asyncio
async def test_reaper_fails_exhausted_orphan(seeded_db):
    from database import AsyncSessionLocal, Issuer, Run
    from run_executor import QueueWorker
    from datetime import datetime, timedelta, timezone

    # Dedicated issuer (see test_two_workers_claim_one_run_once): the pg lane
    # accumulates runs across tests, so this insert must not share an issuer with
    # any other active run or it trips the active-run partial unique index.
    past = datetime.now(timezone.utc) - timedelta(hours=1)
    async with AsyncSessionLocal() as s:
        # Dedicated issuer, not REFERENCE_ISSUER_ID: migrations/0035's active-run
        # unique index means a stray queued/running row left on the shared
        # reference issuer by another test (module-order dependent in the
        # shared Postgres test DB) would collide with this one on INSERT —
        # same posture as test_inprocess_start_sweeps_stranded_runs above.
        issuer = Issuer(name="Reaper Orphan Test Co")
        s.add(issuer)
        await s.flush()
        run = Run(issuer_id=issuer.id, analyst_id="t",
                  status="running", attempts=3, lease_expires_at=past)
        s.add(run)
        await s.commit()
        run_id = run.id

    await QueueWorker()._reap_orphans()

    async with AsyncSessionLocal() as s:
        run = await s.get(Run, run_id)
        assert run.status == "failed"
        assert "max attempts" in (run.error or "")
        from database import NotificationEvent
        event = (await s.execute(select(NotificationEvent).where(
            NotificationEvent.subject_id == run_id
        ))).scalar_one()
        assert event.kind == "run_failed"


from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def api_client():
    from main import app
    with TestClient(app) as c:
        yield c


def test_post_runs_returns_queued_fast(api_client):
    # pipeline-36 — creation returns a durable queued run before execution drains.
    from conftest import wait_for_run
    from engine.fixtures import REFERENCE_ISSUER_ID
    r = api_client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID})
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "queued"
    wait_for_run(api_client, r.json()["id"])  # drain so the dedup guard doesn't 409 later tests


def test_post_runs_then_polls_to_complete(api_client):
    # pipeline-38 — polling GET /api/runs/{runId} returns terminal run detail.
    from conftest import wait_for_run
    from engine.fixtures import REFERENCE_ISSUER_ID
    r = api_client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID})
    body = wait_for_run(api_client, r.json()["id"])
    assert body["status"] == "complete"
    assert body["error"] is None


def test_list_runs_is_bounded(api_client):
    # pipeline-37 — list pagination enforces both truncation and input bounds.
    """list_runs must clamp page size — an unbounded SELECT grows into a DoS as
    runs accumulate (P4). Validate the bounds and that limit truncates."""
    from conftest import wait_for_run
    from engine.fixtures import REFERENCE_ISSUER_ID

    # Two terminal runs so there is something to truncate (drain each past the
    # dedup guard before re-running the same issuer).
    for _ in range(2):
        r = api_client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID})
        wait_for_run(api_client, r.json()["id"])

    assert len(api_client.get("/api/runs?limit=1").json()) == 1
    assert api_client.get("/api/runs?limit=0").status_code == 422       # ge=1
    assert api_client.get("/api/runs?limit=5000").status_code == 422    # le=1000
    assert api_client.get("/api/runs?offset=-1").status_code == 422     # ge=0


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


def test_runs_are_analyst_private_by_default(api_client):
    """Foreign analyst runs are non-enumerable unless desk sharing is explicit."""
    import asyncio

    from conftest import wait_for_run
    from database import AsyncSessionLocal, Run
    from engine.fixtures import REFERENCE_ISSUER_ID

    created = api_client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID})
    assert created.status_code == 201, created.text
    run_id = created.json()["id"]
    wait_for_run(api_client, run_id)

    # Reassign ownership to someone other than the caller (the dev identity is
    # "local-dev"); a per-caller filter would now hide the run.
    async def _reassign():
        async with AsyncSessionLocal() as s:
            run = await s.get(Run, run_id)
            run.analyst_id = "someone-else@firm.com"
            await s.commit()

    asyncio.run(_reassign())

    got = api_client.get(f"/api/runs/{run_id}")
    assert got.status_code == 404
    assert api_client.get(f"/api/runs/{run_id}/qa").status_code == 404
    listed = api_client.get("/api/runs").json()
    assert all(r["id"] != run_id for r in listed)


def test_export_to_vault_rejects_foreign_run(api_client, tmp_path, monkeypatch):
    """A foreign run cannot be mirrored or assembled for committee export."""
    import asyncio

    from conftest import wait_for_run
    from config import get_settings
    from database import AsyncSessionLocal, Run
    from engine.fixtures import REFERENCE_ISSUER_ID

    # Override just this one field on the real (lru_cache'd) settings singleton —
    # create_run in the same module needs its other fields intact.
    monkeypatch.setattr(get_settings(), "vault_export_dir", str(tmp_path))

    created = api_client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID})
    assert created.status_code == 201, created.text
    run_id = created.json()["id"]
    wait_for_run(api_client, run_id)

    async def _reassign():
        async with AsyncSessionLocal() as s:
            run = await s.get(Run, run_id)
            run.analyst_id = "someone-else@firm.com"
            await s.commit()

    asyncio.run(_reassign())

    resp = api_client.post(f"/api/runs/{run_id}/vault")
    assert resp.status_code == 404
    assert api_client.post(f"/api/runs/{run_id}/report").status_code == 404


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


# ── Idempotency-Key (#17) ────────────────────────────────────────────────────
# The active-run 409 only dedupes WHILE a run is active — a client retrying
# create_run after the response was lost (but the request already committed),
# or after a genuinely fast run already reached a terminal state, sees no
# active run and would otherwise create a real duplicate.

def test_idempotency_key_returns_same_run_on_retry(api_client):
    from conftest import wait_for_run
    from engine.fixtures import REFERENCE_ISSUER_ID

    headers = {"Idempotency-Key": "test-key-1"}
    r1 = api_client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID}, headers=headers)
    assert r1.status_code == 201, r1.text
    run_id = r1.json()["id"]
    wait_for_run(api_client, run_id)  # now terminal — the active-run check alone can't dedupe

    r2 = api_client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID}, headers=headers)
    assert r2.status_code == 201, r2.text
    assert r2.json()["id"] == run_id  # same run returned, not a new one


def test_no_idempotency_key_creates_a_new_run_each_time(api_client):
    from conftest import wait_for_run
    from engine.fixtures import REFERENCE_ISSUER_ID

    r1 = api_client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID})
    run_id_1 = r1.json()["id"]
    wait_for_run(api_client, run_id_1)

    r2 = api_client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID})
    run_id_2 = r2.json()["id"]
    wait_for_run(api_client, run_id_2)
    assert run_id_2 != run_id_1


def test_idempotency_key_reuse_for_different_request_conflicts(api_client):
    from conftest import wait_for_run
    from engine.fixtures import REFERENCE_ISSUER_ID

    headers = {"Idempotency-Key": "different-request-key"}
    first = api_client.post(
        "/api/runs",
        json={"issuer_id": REFERENCE_ISSUER_ID, "as_of_date": "2026-01-01"},
        headers=headers,
    )
    assert first.status_code == 201, first.text
    wait_for_run(api_client, first.json()["id"])

    conflict = api_client.post(
        "/api/runs",
        json={"issuer_id": REFERENCE_ISSUER_ID, "as_of_date": "2026-01-02"},
        headers=headers,
    )
    assert conflict.status_code == 409
    assert "different run request" in conflict.text


def test_idempotency_key_is_bounded_and_validated(api_client):
    from engine.fixtures import REFERENCE_ISSUER_ID

    response = api_client.post(
        "/api/runs",
        json={"issuer_id": REFERENCE_ISSUER_ID},
        headers={"Idempotency-Key": "contains spaces"},
    )
    assert response.status_code == 422


def test_run_model_has_durable_idempotency_columns():
    cols = Run.__table__.columns
    assert "idempotency_key" in cols
    assert "idempotency_request_hash" in cols
    assert any(index.name == "uq_runs_analyst_idempotency" for index in Run.__table__.indexes)
