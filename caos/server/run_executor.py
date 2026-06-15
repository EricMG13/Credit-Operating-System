"""Out-of-band run execution.

`execute_run_by_id` is the shared core: load the run in its OWN session, run the
slice, and on any error mark the run `failed` (never strand it). Two executors
(InProcessExecutor, QueueWorker) are added in later tasks; `get_executor()` will
pick one by DB dialect.
"""
from __future__ import annotations

import logging

from database import AsyncSessionLocal, Run
from engine.runner import execute_run

logger = logging.getLogger("caos.executor")


async def execute_run_by_id(run_id: str) -> None:
    """Run one run in its own session; mark it failed on any error."""
    async with AsyncSessionLocal() as session:
        run = await session.get(Run, run_id)
        if run is None:
            logger.warning("execute_run_by_id: run %s vanished", run_id)
            return
        try:
            await execute_run(session, run)
            await session.commit()
        except Exception as e:  # noqa: BLE001 — last-resort guard so a run is never stranded
            logger.exception("run %s failed in executor", run_id)
            await session.rollback()
            run = await session.get(Run, run_id)
            if run is not None:
                run.status = "failed"
                run.error = str(e)[:2000]
                run.lease_expires_at = None
                await session.commit()
