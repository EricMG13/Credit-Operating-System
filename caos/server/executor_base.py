"""Shared base for in-process, fire-and-forget background-task executors.

Each in-process executor (run/research/research-report/pipeline) tracks its own
asyncio Tasks so the event loop can't GC them mid-flight, and on stop() cancels +
awaits each one so its own failure handler (mark run/job/report failed) commits
before the process tears down. Only the in-process executors share this — the
Postgres QueueWorker's loop+lease model is different enough to stay separate.
"""
from __future__ import annotations

import asyncio
from typing import Coroutine


class InProcessTaskExecutor:
    def __init__(self) -> None:
        self._tasks: "set[asyncio.Task]" = set()

    def _spawn(self, coro: Coroutine) -> None:
        task = asyncio.create_task(coro)
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def stop(self) -> None:
        tasks = list(self._tasks)
        for t in tasks:
            t.cancel()
        if tasks:
            # Await so each task's cancellation handler (mark-failed) commits
            # before the event loop tears down.
            await asyncio.gather(*tasks, return_exceptions=True)
        self._tasks.clear()
