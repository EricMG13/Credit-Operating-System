"""Out-of-band run execution.

`execute_run_by_id` is the shared core: load the run in its OWN session, run the
slice, and on any error mark the run `failed` (never strand it). Two executors
(InProcessExecutor, QueueWorker) are added in later tasks; `get_executor()` will
pick one by DB dialect.
"""
from __future__ import annotations

import asyncio
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


class InProcessExecutor:
    """SQLite/local: one fire-and-forget asyncio task per enqueued run.

    Task references are retained in `_tasks` so the loop can't GC them
    mid-flight; `execute_run_by_id`'s own try/except guarantees the run reaches
    a terminal state even if the task body raises.
    """

    name = "in_process"

    def __init__(self) -> None:
        self._tasks: set[asyncio.Task] = set()

    async def start(self) -> None:  # no background loop needed
        return None

    async def stop(self) -> None:
        for t in list(self._tasks):
            t.cancel()
        self._tasks.clear()

    async def enqueue(self, run_id: str) -> None:
        task = asyncio.create_task(execute_run_by_id(run_id))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
