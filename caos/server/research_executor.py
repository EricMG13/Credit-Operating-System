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
import os
import socket
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, or_, select, update

from config import get_settings
from database import AsyncSessionLocal, ResearchJob, engine
from deepresearch import ResearchBrief, run_deep_research
from executor_base import InProcessTaskExecutor
from research_figures import build_research_figures

logger = logging.getLogger("caos.research")

_WORKER_ID = f"{socket.gethostname()}:{os.getpid()}"

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


@dataclass(frozen=True)
class ResearchClaim:
    job_id: str
    owner_token: str
    attempt: int


class ResearchOwnershipLost(RuntimeError):
    """The research attempt no longer owns its durable queue row."""


def _new_owner_token(prefix: str) -> str:
    return f"{prefix[:27]}:{uuid.uuid4().hex}"


def _owned_attempt(claim: ResearchClaim):
    return and_(
        ResearchJob.id == claim.job_id,
        ResearchJob.worker_id == claim.owner_token,
        ResearchJob.attempts == claim.attempt,
        ResearchJob.status == "running",
    )


async def _claim_research_attempt(
    session,
    job,
    job_id: str,
    owner_token: str | None,
    attempt: int | None,
) -> ResearchClaim:
    if owner_token is None:
        claim = ResearchClaim(
            job_id=job_id,
            owner_token=_new_owner_token(_WORKER_ID),
            attempt=int(job.attempts or 0) + 1,
        )
        job.status = "running"
        job.worker_id = claim.owner_token
        job.attempts = claim.attempt
        job.claimed_at = _now()
        job.lease_expires_at = _now() + timedelta(
            seconds=get_settings().caos_research_lease_seconds
        )
        await session.commit()
        return claim

    if attempt is None:
        raise ValueError("pre-claimed research execution requires an attempt")
    claim = ResearchClaim(job_id, owner_token, attempt)
    if (
        job.status != "running"
        or job.worker_id != claim.owner_token
        or job.attempts != claim.attempt
    ):
        raise ResearchOwnershipLost(
            f"research job {job_id} was reclaimed before execution started"
        )
    return claim


async def _save_research_progress(session, claim: ResearchClaim, progress: dict) -> None:
    result = await session.execute(
        update(ResearchJob).where(_owned_attempt(claim)).values(progress=progress)
    )
    await session.commit()
    if result.rowcount != 1:
        raise ResearchOwnershipLost(
            f"research job {claim.job_id} ownership lost while saving progress"
        )


async def _complete_research(session, job, claim: ResearchClaim, result) -> None:
    # Keep research narrative and visual data separate: only construct exhibits
    # from explicit CAOS context + finite metric facts. A missing lineage simply
    # yields no chart; it never fails research.
    try:
        figures = await build_research_figures(session, job)
    except Exception:  # noqa: BLE001 — chart enrichment must not lose a report
        logger.exception("research job %s figure enrichment failed", job.id)
        figures = []
    completed_at = _now()
    authority = {
        "origin": "demo" if result.demo else "live",
        "method": "grounded-research",
        "freshness": "current",
        "as_of": completed_at.isoformat(),
        "source_ids": [source.url for source in result.sources if source.url],
        "run_id": job.id,
        "version_id": job.id,
        "confidence": None,
        "approval_state": "draft",
        "analyst_override": None,
    }
    completion = await session.execute(
        update(ResearchJob)
        .where(_owned_attempt(claim))
        .values(
            report=result.report,
            sources=[source.model_dump() for source in result.sources],
            demo=result.demo,
            truncated=result.truncated,
            figures=figures,
            status="complete",
            lease_expires_at=None,
            completed_at=completed_at,
            authority=authority,
        )
    )
    await session.commit()
    if completion.rowcount != 1:
        raise ResearchOwnershipLost(
            f"research job {claim.job_id} ownership lost before completion"
        )


async def _run_research(
    job_id: str,
    *,
    owner_token: str | None = None,
    attempt: int | None = None,
) -> None:
    """Run one research job in its own session; set running, then complete/failed.

    Re-executes from the persisted brief, so it is safe to call on a re-claimed job."""
    async with AsyncSessionLocal() as session:
        job = await session.get(ResearchJob, job_id)
        if job is None:
            logger.warning("run_research: job %s vanished", job_id)
            return
        claim: ResearchClaim | None = None

        try:
            claim = await _claim_research_attempt(
                session, job, job_id, owner_token, attempt
            )

            async def _save_progress(progress: dict) -> None:
                await _save_research_progress(session, claim, progress)

            result = await run_deep_research(
                ResearchBrief(**(job.brief or {})), on_progress=_save_progress
            )
            await _complete_research(session, job, claim, result)
        except ResearchOwnershipLost:
            await session.rollback()
            logger.warning("research job %s stopped after ownership loss", job_id)
        except asyncio.CancelledError:
            # Shutdown cancellation (BaseException, not Exception) — don't strand the
            # job in 'running'; mark failed then re-raise so the task cancels cleanly.
            logger.warning("research job %s cancelled during shutdown — marking failed", job_id)
            if claim is not None:
                await _mark_failed(session, claim, "worker shutdown during research")
            raise
        except Exception as e:  # noqa: BLE001 — last-resort guard so a job is never stranded
            logger.exception("research job %s failed", job_id)
            if claim is not None:
                await _mark_failed(session, claim, str(e)[:2000])


async def execute_research_by_id(job_id: str) -> None:
    """In-process entry: bound concurrent research with the semaphore, acquired BEFORE
    opening the DB session so a queued job doesn't hold a connection while it waits."""
    async with _semaphore():
        await _run_research(job_id)


async def _mark_failed(session, claim: ResearchClaim, reason: str) -> None:
    """Fence terminal failure to one owner attempt; never raises."""
    try:
        await session.rollback()
        completed_at = _now()
        current = await session.get(ResearchJob, claim.job_id)
        authority = {
            **((current.authority if current else None) or {}),
            "freshness": "unknown",
            "as_of": completed_at.isoformat(),
        }
        result = await session.execute(
            update(ResearchJob)
            .where(_owned_attempt(claim))
            .values(
                status="failed",
                error=reason,
                lease_expires_at=None,
                completed_at=completed_at,
                authority=authority,
            )
        )
        await session.commit()
        if result.rowcount != 1:
            logger.warning(
                "research job %s failure write rejected after ownership loss",
                claim.job_id,
            )
    except Exception:  # noqa: BLE001
        logger.exception("could not mark research job %s failed", claim.job_id)


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
        self._worker_prefix = f"{socket.gethostname()}:{id(self)}"
        self._inflight: set[asyncio.Task] = set()
        # Exact owner+attempt claims fence every progress/terminal write and let
        # heartbeat cancellation stop a task whose row was reclaimed elsewhere.
        self._inflight_claims: dict[str, ResearchClaim] = {}
        self._inflight_tasks: dict[str, asyncio.Task] = {}
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
            "inflight": len(self._inflight_tasks),
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
        claims = list(self._inflight_claims.values())
        if not claims:
            return
        lease = timedelta(seconds=self._settings.caos_research_lease_seconds)
        lost: list[ResearchClaim] = []
        async with AsyncSessionLocal() as s:
            for claim in claims:
                result = await s.execute(
                    update(ResearchJob)
                    .where(_owned_attempt(claim))
                    .values(lease_expires_at=_now() + lease)
                )
                if result.rowcount != 1:
                    lost.append(claim)
            await s.commit()
        for claim in lost:
            logger.warning(
                "research job %s heartbeat lost ownership for attempt %d",
                claim.job_id,
                claim.attempt,
            )
            task = self._inflight_tasks.get(claim.job_id)
            if task is not None and not task.done():
                task.cancel()

    async def _claim_one(self) -> ResearchClaim | None:
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
                if self._inflight_claims:
                    stmt = stmt.where(
                        ResearchJob.id.notin_(tuple(self._inflight_claims))
                    )
                row = (await s.execute(stmt)).scalar_one_or_none()
                if row is None:
                    return None
                claim = ResearchClaim(
                    job_id=row.id,
                    owner_token=_new_owner_token(self._worker_prefix),
                    attempt=int(row.attempts or 0) + 1,
                )
                row.status = "running"
                row.attempts = claim.attempt
                row.claimed_at = _now()
                row.lease_expires_at = _now() + lease
                row.worker_id = claim.owner_token
                return claim

    async def _run_loop(self) -> None:
        poll = self._settings.caos_research_poll_seconds
        cap = self._settings.caos_research_concurrency
        while not self._stop.is_set():
            try:
                await self._heartbeat()
                await self._reap_orphans()
                while len(self._inflight) < cap:
                    claim = await self._claim_one()
                    if claim is None:
                        break
                    task = asyncio.create_task(_run_research(
                        claim.job_id,
                        owner_token=claim.owner_token,
                        attempt=claim.attempt,
                    ))
                    self._inflight.add(task)
                    self._inflight_claims[claim.job_id] = claim
                    self._inflight_tasks[claim.job_id] = task

                    def _discard(done: asyncio.Task, jid: str = claim.job_id) -> None:
                        self._inflight.discard(done)
                        self._inflight_claims.pop(jid, None)
                        self._inflight_tasks.pop(jid, None)

                    task.add_done_callback(_discard)
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
