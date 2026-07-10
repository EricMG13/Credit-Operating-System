"""Durable Deep Research execution (M-3 + redeploy durability).

Deep research is a multi-minute, web-grounded LLM call. It is a pure function of its
persisted ``ResearchJob.brief`` (``run_deep_research(ResearchBrief(**brief))``), so it
is re-executable — which is what lets a job survive a redeploy.

Two executors, picked by DB dialect (mirroring [run_executor.py]):

  * ``InProcessResearchExecutor`` (SQLite / local): fire-and-forget asyncio task per
    job, bounded by a concurrency semaphore; ``start()`` sweeps jobs stranded by a
    hard crash. Single-process — no cross-restart durability (documented, dev only).
  * ``ResearchQueueWorker`` (Postgres): claims ``queued`` and truly-orphaned
    ``running`` jobs via ``FOR UPDATE SKIP LOCKED``, re-executes them from the brief,
    and reaps attempts-exhausted orphans — so a redeploy / replica death re-claims an
    in-flight job instead of losing it and its token spend.

A streamed run can't resume mid-flight, so a re-claim RE-EXECUTES the whole brief
(bounded by ``caos_research_max_attempts``); the client polls ``GET /api/research/{id}``
throughout.
"""
from __future__ import annotations

import asyncio
import logging
import socket
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, or_, select, update

from config import get_settings
from database import AsyncSessionLocal, ResearchJob, engine
from deepresearch import ResearchBrief, run_deep_research

logger = logging.getLogger("caos.research")

# Bound concurrent multi-minute runs (cost guard) on the in-process path. Lazy-init:
# on py3.9 asyncio.Semaphore() binds the loop at construction, which fails at import
# time (no running loop). First call builds it in the app loop.
_sem: "asyncio.Semaphore | None" = None


def _semaphore() -> "asyncio.Semaphore":
    global _sem
    if _sem is None:
        _sem = asyncio.Semaphore(max(1, get_settings().caos_research_concurrency))
    return _sem


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _run_research(job_id: str) -> None:
    """Run one research job in its own session; set running, then complete/failed.

    Re-executes from the persisted brief, so it is safe to call on a re-claimed job."""
    async with AsyncSessionLocal() as session:
        job = await session.get(ResearchJob, job_id)
        if job is None:
            logger.warning("run_research: job %s vanished", job_id)
            return
        async def _save_progress(p: dict) -> None:
            # Persist the live counts so the polling GET can surface them. A fresh
            # dict each call so SQLAlchemy detects the change; commit is cheap and
            # only fires a handful of times (once per continuation turn).
            job.progress = p
            await session.commit()

        try:
            job.status = "running"  # visible to the client's poll; idempotent on re-claim
            await session.commit()
            result = await run_deep_research(
                ResearchBrief(**(job.brief or {})), on_progress=_save_progress
            )
            job.report = result.report
            job.sources = [s.model_dump() for s in result.sources]
            job.demo = result.demo
            job.truncated = result.truncated
            job.status = "complete"
            job.lease_expires_at = None
            job.completed_at = _now()
            await session.commit()
        except asyncio.CancelledError:
            # Shutdown cancellation (BaseException, not Exception) — don't strand the
            # job in 'running'; mark failed then re-raise so the task cancels cleanly.
            logger.warning("research job %s cancelled during shutdown — marking failed", job_id)
            await _mark_failed(session, job_id, "worker shutdown during research")
            raise
        except Exception as e:  # noqa: BLE001 — last-resort guard so a job is never stranded
            logger.exception("research job %s failed", job_id)
            await _mark_failed(session, job_id, str(e)[:2000])


async def execute_research_by_id(job_id: str) -> None:
    """In-process entry: bound concurrent research with the semaphore, acquired BEFORE
    opening the DB session so a queued job doesn't hold a connection while it waits."""
    async with _semaphore():
        await _run_research(job_id)


async def _mark_failed(session, job_id: str, reason: str) -> None:
    """Roll back and mark a job failed; never raises (last-resort recovery)."""
    try:
        await session.rollback()
        job = await session.get(ResearchJob, job_id)
        if job is not None:
            job.status = "failed"
            job.error = reason
            job.lease_expires_at = None
            job.completed_at = _now()
            await session.commit()
    except Exception:  # noqa: BLE001
        logger.exception("could not mark research job %s failed", job_id)


class InProcessResearchExecutor:
    """SQLite/local: one fire-and-forget task per enqueued job (mirrors
    run_executor.InProcessExecutor)."""

    name = "research_in_process"

    def __init__(self) -> None:
        self._tasks: set[asyncio.Task] = set()

    async def start(self) -> None:
        # Hard-crash recovery: a SIGKILL/restart skips stop()'s cancel handler,
        # stranding a job in 'running'/'queued' forever (a stream can't be resumed and
        # SQLite has no reaper). start() runs in lifespan before any request, with no
        # in-flight tasks yet, so every non-terminal row is provably a strand — sweep
        # them to failed. (Postgres uses the ResearchQueueWorker's re-claim instead.)
        async with AsyncSessionLocal() as session:
            await session.execute(
                update(ResearchJob)
                .where(ResearchJob.status.in_(("running", "queued")))
                .values(status="failed", error="abandoned (process restart)", completed_at=_now())
            )
            await session.commit()

    async def stop(self) -> None:
        tasks = list(self._tasks)
        for t in tasks:
            t.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        self._tasks.clear()

    def enqueue(self, job_id: str) -> None:
        task = asyncio.create_task(execute_research_by_id(job_id))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)


class ResearchQueueWorker:
    """Postgres: claim queued (and truly-orphaned) jobs via FOR UPDATE SKIP LOCKED,
    execute up to `concurrency` at once, and reap attempts-exhausted orphans. Mirrors
    run_executor.QueueWorker; multi-worker claim safety relies on Postgres row locking
    (a no-op on SQLite, which is why SQLite uses the in-process executor instead)."""

    name = "research_queue_worker"

    def __init__(self) -> None:
        self._settings = get_settings()
        self._worker_id = f"{socket.gethostname()}:{id(self)}"
        self._inflight: set[asyncio.Task] = set()
        self._loop_task: asyncio.Task | None = None
        self._stop = asyncio.Event()

    async def start(self) -> None:
        self._stop.clear()
        self._loop_task = asyncio.create_task(self._run_loop())

    async def stop(self) -> None:
        self._stop.set()
        if self._loop_task:
            await self._loop_task
        tasks = list(self._inflight)
        for t in tasks:
            t.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    def enqueue(self, job_id: str) -> None:
        # The row already exists as 'queued'; the loop will pick it up. No-op.
        return None

    async def _reap_orphans(self) -> None:
        async with AsyncSessionLocal() as s:
            await s.execute(
                update(ResearchJob)
                .where(
                    ResearchJob.status == "running",
                    ResearchJob.lease_expires_at < _now(),
                    ResearchJob.attempts >= self._settings.caos_research_max_attempts,
                )
                .values(status="failed", error="abandoned after max attempts", lease_expires_at=None)
            )
            await s.commit()

    async def _claim_one(self) -> str | None:
        max_attempts = self._settings.caos_research_max_attempts
        lease = timedelta(seconds=self._settings.caos_research_lease_seconds)
        async with AsyncSessionLocal() as s:
            async with s.begin():
                row = (
                    await s.execute(
                        select(ResearchJob)
                        .where(
                            or_(
                                ResearchJob.status == "queued",
                                and_(
                                    ResearchJob.status == "running",
                                    ResearchJob.lease_expires_at < _now(),
                                    ResearchJob.attempts < max_attempts,
                                ),
                            )
                        )
                        .order_by(ResearchJob.created_at)
                        .limit(1)
                        .with_for_update(skip_locked=True)
                    )
                ).scalar_one_or_none()
                if row is None:
                    return None
                row.status = "running"
                row.attempts += 1
                row.claimed_at = _now()
                row.lease_expires_at = _now() + lease
                row.worker_id = self._worker_id
                return row.id

    async def _run_loop(self) -> None:
        poll = self._settings.caos_research_poll_seconds
        cap = max(1, self._settings.caos_research_concurrency)
        fails = 0
        while not self._stop.is_set():
            try:
                await self._reap_orphans()
                while len(self._inflight) < cap:
                    job_id = await self._claim_one()
                    if job_id is None:
                        break
                    task = asyncio.create_task(_run_research(job_id))
                    self._inflight.add(task)
                    task.add_done_callback(self._inflight.discard)
                fails = 0
            except Exception:  # noqa: BLE001 — never let the loop die
                fails += 1
                if fails >= 3:
                    logger.error(
                        "research worker loop failing repeatedly (%d ticks) — queue stalled", fails
                    )
                else:
                    logger.exception("research worker loop tick failed")
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=poll)
            except asyncio.TimeoutError:
                pass


def get_research_executor():
    """Pick the executor by DB dialect: in-process on SQLite, queue on Postgres."""
    if engine.dialect.name == "postgresql":
        return ResearchQueueWorker()
    return InProcessResearchExecutor()
