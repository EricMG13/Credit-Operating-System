"""Durable Deep Research execution (M-3).

Deep research is a multi-minute web-grounded LLM call. Running it inside the POST
request held the HTTP connection open for the whole run, so a dropped client/proxy
connection lost the work and its token spend. Instead the POST persists a
``ResearchJob`` and spawns a background task here; the client polls
``GET /api/research/{id}``. A dropped connection no longer aborts execution — the
result lands in the DB and the client re-polls.

In-process tasks + sweep-on-boot, mirroring ``InProcessExecutor`` in
[run_executor.py]: the app is a single container behind Caddy/oauth2-proxy, the
same single-process assumption ``rate_limit.py`` makes. A streamed research run
can't be resumed mid-flight, so a process restart marks stranded ``running`` jobs
failed and the analyst re-submits — no zombie ``running`` that never completes.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import update

from config import get_settings
from database import AsyncSessionLocal, ResearchJob
from deepresearch import ResearchBrief, run_deep_research

logger = logging.getLogger("caos.research")

# Bound concurrent multi-minute runs (cost guard). POST fires a background task per
# job, so without this a sustained submission rate accumulates unbounded overlapping
# opus web-search runs — the natural backpressure of the old synchronous call is
# gone. Jobs past the cap queue on this semaphore rather than all run at once.
# Lazy-init: on py3.9 asyncio.Semaphore() binds the loop at construction, which
# fails at import time (no running loop). First call builds it in the app loop.
# ponytail: per-process semaphore; if ever multi-replica, the cap is per replica.
_sem: "asyncio.Semaphore | None" = None


def _semaphore() -> "asyncio.Semaphore":
    global _sem
    if _sem is None:
        _sem = asyncio.Semaphore(max(1, get_settings().caos_research_concurrency))
    return _sem


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def execute_research_by_id(job_id: str) -> None:
    """Run one research job in its own session; mark it failed on any error.

    Gated by the concurrency semaphore — acquired BEFORE opening the DB session so a
    queued job doesn't hold a connection while it waits its turn."""
    async with _semaphore():
        await _run_research(job_id)


async def _run_research(job_id: str) -> None:
    async with AsyncSessionLocal() as session:
        job = await session.get(ResearchJob, job_id)
        if job is None:
            logger.warning("execute_research_by_id: job %s vanished", job_id)
            return
        async def _save_progress(p: dict) -> None:
            # Persist the live counts so the polling GET can surface them. A fresh
            # dict each call so SQLAlchemy detects the change; commit is cheap and
            # only fires a handful of times (once per continuation turn).
            job.progress = p
            await session.commit()

        try:
            result = await run_deep_research(
                ResearchBrief(**(job.brief or {})), on_progress=_save_progress
            )
            job.report = result.report
            job.sources = [s.model_dump() for s in result.sources]
            job.demo = result.demo
            job.truncated = result.truncated
            job.status = "complete"
            job.completed_at = _now()
            await session.commit()
        except asyncio.CancelledError:
            # Shutdown cancellation (BaseException, not Exception) — don't strand
            # the job in 'running'; mark failed then re-raise so the task cancels.
            logger.warning("research job %s cancelled during shutdown — marking failed", job_id)
            await _mark_failed(session, job_id, "worker shutdown during research")
            raise
        except Exception as e:  # noqa: BLE001 — last-resort guard so a job is never stranded
            logger.exception("research job %s failed", job_id)
            await _mark_failed(session, job_id, str(e)[:2000])


async def _mark_failed(session, job_id: str, reason: str) -> None:
    """Roll back and mark a job failed; never raises (last-resort recovery)."""
    try:
        await session.rollback()
        job = await session.get(ResearchJob, job_id)
        if job is not None:
            job.status = "failed"
            job.error = reason
            job.completed_at = _now()
            await session.commit()
    except Exception:  # noqa: BLE001
        logger.exception("could not mark research job %s failed", job_id)


class ResearchExecutor:
    """In-process background tasks for deep-research jobs (mirrors InProcessExecutor).

    ponytail: in-process + sweep-on-boot — sound for one app container. If ever
    scaled to multiple replicas, give research jobs the QueueWorker's claim/lease
    treatment so one replica can't sweep another replica's in-flight job.
    """

    name = "research_in_process"

    def __init__(self) -> None:
        self._tasks: set[asyncio.Task] = set()

    async def start(self) -> None:
        # Hard-crash recovery: a SIGKILL/restart skips stop()'s cancel handler,
        # stranding a job in 'running' forever (a stream can't be resumed). This
        # runs in lifespan before any request, with no in-flight tasks yet, so
        # every 'running' row is provably a strand — sweep them to failed.
        async with AsyncSessionLocal() as session:
            await session.execute(
                update(ResearchJob)
                .where(ResearchJob.status == "running")
                .values(status="failed", error="abandoned (process restart)", completed_at=_now())
            )
            await session.commit()

    async def stop(self) -> None:
        tasks = list(self._tasks)
        for t in tasks:
            t.cancel()
        if tasks:
            # Await so each task's cancel handler (mark-failed) commits before
            # the event loop tears down.
            await asyncio.gather(*tasks, return_exceptions=True)
        self._tasks.clear()

    def enqueue(self, job_id: str) -> None:
        task = asyncio.create_task(execute_research_by_id(job_id))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
