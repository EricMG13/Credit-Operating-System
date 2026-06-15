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
