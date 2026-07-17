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
import socket
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, or_, select, update

from config import get_settings
from database import AsyncSessionLocal, ResearchJob, engine
from deepresearch import ResearchBrief, run_deep_research
from executor_base import InProcessTaskExecutor
from research_figures import build_research_figures

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
            # Keep research narrative and visual data separate: only construct
            # exhibits from explicit CAOS context + finite metric facts. A
            # missing lineage simply yields no chart; it never fails research.
            try:
                job.figures = await build_research_figures(session, job)
            except Exception:  # noqa: BLE001 — chart enrichment must not lose a report
                logger.exception("research job %s figure enrichment failed", job.id)
                job.figures = []
            job.status = "complete"
            job.lease_expires_at = None
            job.completed_at = _now()
            job.authority = {
                "origin": "demo" if result.demo else "live",
                "method": "grounded-research",
                "freshness": "current",
                "as_of": job.completed_at.isoformat(),
                "source_ids": [source.url for source in result.sources if source.url],
                "run_id": job.id,
                "version_id": job.id,
                "confidence": None,
                "approval_state": "draft",
                "analyst_override": None,
            }
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
            job.authority = {
                **(job.authority or {}),
                "freshness": "unknown",
                "as_of": job.completed_at.isoformat(),
            }
            await session.commit()
    except Exception:  # noqa: BLE001
        logger.exception("could not mark research job %s failed", job_id)


class ResearchExecutor(InProcessTaskExecutor):
    """In-process background tasks for deep-research jobs (mirrors InProcessExecutor).

    ponytail: in-process + sweep-on-boot — sound for one app container. On
    Postgres, ``get_research_executor`` picks ``ResearchQueueWorker`` instead so
    one worker process dying doesn't strand a job until the next full restart.
    """

    name = "research_in_process"

    async def start(self) -> None:
        # Hard-crash recovery: a SIGKILL/restart skips stop()'s cancel handler,
        # stranding a job in 'running'/'queued' forever (a stream can't be resumed and
        # SQLite has no reaper). start() runs in lifespan before any request, with no
        # in-flight tasks yet, so every non-terminal row is provably a strand — sweep
        # them to failed.
        async with AsyncSessionLocal() as session:
            await session.execute(
                update(ResearchJob)
                .where(ResearchJob.status.in_(("running", "queued")))
                .values(status="failed", error="abandoned (process restart)", completed_at=_now())
            )
            await session.commit()

    def enqueue(self, job_id: str) -> None:
        self._spawn(execute_research_by_id(job_id))


class ResearchQueueWorker:
    """Postgres: claim queued (and truly-orphaned) research jobs via FOR UPDATE
    SKIP LOCKED, execute up to `concurrency` at once, and reap attempts-exhausted
    orphans. Mirrors ``run_executor.QueueWorker`` — see that class for the full
    state-machine diagram and the multi-worker claim-safety rationale (Postgres
    row locking; do not run multiple workers against SQLite).
    """

    name = "research_queue_worker"

    def __init__(self) -> None:
        self._settings = get_settings()
        self._worker_id = f"{socket.gethostname()}:{id(self)}"
        self._inflight: set[asyncio.Task] = set()
        # Mirrors run_executor.QueueWorker._inflight_ids: a job this worker is
        # still executing must never be re-claimed by itself even if its wall
        # clock legitimately exceeds the lease.
        self._inflight_ids: set[str] = set()
        self._loop_task: asyncio.Task | None = None
        self._stop = asyncio.Event()
        self._consecutive_failures = 0

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
        # NOT async: routes/research.py calls this without awaiting (matching
        # ResearchExecutor.enqueue's sync signature — the two are interchangeable
        # behind get_research_executor()'s dialect switch).
        return None

    def health(self) -> dict[str, object]:
        loop_live = self._loop_task is not None and not self._loop_task.done()
        healthy = loop_live and self._consecutive_failures < 3
        return {
            "status": "ok" if healthy else "degraded",
            "loop_live": loop_live,
            "consecutive_failures": self._consecutive_failures,
            "inflight": len(self._inflight),
        }

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

    async def _heartbeat(self) -> None:
        """Extend the lease on this worker's live jobs each poll tick, so a job
        whose wall clock legitimately exceeds the fixed lease window is not
        re-claimed (by any worker) and executed twice concurrently."""
        if not self._inflight_ids:
            return
        lease = timedelta(seconds=self._settings.caos_research_lease_seconds)
        async with AsyncSessionLocal() as s:
            await s.execute(
                update(ResearchJob)
                .where(
                    ResearchJob.id.in_(tuple(self._inflight_ids)),
                    ResearchJob.worker_id == self._worker_id,
                    ResearchJob.status == "running",
                )
                .values(lease_expires_at=_now() + lease)
            )
            await s.commit()

    async def _claim_one(self) -> str | None:
        max_attempts = self._settings.caos_research_max_attempts
        lease = timedelta(seconds=self._settings.caos_research_lease_seconds)
        async with AsyncSessionLocal() as s:
            async with s.begin():
                stmt = (
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
                if self._inflight_ids:
                    stmt = stmt.where(ResearchJob.id.notin_(tuple(self._inflight_ids)))
                row = (await s.execute(stmt)).scalar_one_or_none()
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
        cap = self._settings.caos_research_concurrency
        while not self._stop.is_set():
            try:
                await self._heartbeat()
                await self._reap_orphans()
                while len(self._inflight) < cap:
                    job_id = await self._claim_one()
                    if job_id is None:
                        break
                    task = asyncio.create_task(_run_research(job_id))
                    self._inflight.add(task)
                    self._inflight_ids.add(job_id)
                    task.add_done_callback(self._inflight.discard)
                    task.add_done_callback(
                        lambda _t, jid=job_id: self._inflight_ids.discard(jid)
                    )
                self._consecutive_failures = 0
            except Exception:  # noqa: BLE001 — never let the loop die
                self._consecutive_failures += 1
                if self._consecutive_failures >= 3:
                    logger.error(
                        "research worker loop failing repeatedly (%d consecutive ticks) — queue stalled",
                        self._consecutive_failures,
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
    return ResearchExecutor()
