"""Durable execution for autonomous Sentinel→Analyst→Reporter cycles.

``pipeline.enqueue_cycle`` persists a ``queued`` row. This worker continuously
claims queued rows and expired ``running`` leases, heartbeats live claims, and
executes each cycle outside the request that requested it. PostgreSQL uses
``FOR UPDATE SKIP LOCKED``; SQLite relies on the launcher's enforced one-process
boundary. A hard crash therefore leaves a reclaimable lease instead of a
permanently stranded in-memory task.

No schema expansion is required: bounded attempt metadata lives in the job's
pre-terminal ``summary`` JSON and is replaced by the public result summary on
success. Terminal writes re-check ``worker_id`` so an expired, stale claimant
cannot overwrite a newer owner.
"""

from __future__ import annotations

import asyncio
import logging
import os
import socket
from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional

from sqlalchemy import and_, or_, select

from config import get_settings
from database import AsyncSessionLocal, PipelineRun, engine as db_engine
from engine import autonomy

logger = logging.getLogger("caos.pipeline_executor")

_WORKER_ID = f"{socket.gethostname()}:{os.getpid()}"

# Retained for backwards-compatible test isolation. Claim safety now comes from
# the durable queued/running transition, so there is no process-local claim set.
_sqlite_claimed: set[str] = set()


def _is_postgres() -> bool:
    return db_engine.dialect.name == "postgresql"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _sqlite_reset() -> None:
    """Clear legacy SQLite claim state. Test-isolation compatibility only."""
    _sqlite_claimed.clear()


def _attempt_count(row: PipelineRun) -> int:
    raw = (row.summary or {}).get("_attempts", 0)
    try:
        return max(0, int(raw))
    except (TypeError, ValueError):
        return 0


async def claim_next_job(
    db,
    worker_id: str,
    *,
    exclude_ids: Iterable[str] = (),
) -> Optional[PipelineRun]:
    """Claim one queued or expired autonomy job for ``worker_id``.

    PostgreSQL locks the selected row with ``SKIP LOCKED``. The launcher rejects
    multi-process SQLite, so the same state transition is sufficient there. A
    NULL lease is reclaimable for legacy rows and crashes before lease commit.
    """
    now = _utcnow()
    stmt = (
        select(PipelineRun)
        .where(
            PipelineRun.kind == "autonomy-cycle",
            or_(
                PipelineRun.status == "queued",
                and_(
                    PipelineRun.status == "running",
                    or_(
                        PipelineRun.lease_expires_at.is_(None),
                        PipelineRun.lease_expires_at < now,
                    ),
                ),
            ),
        )
        .order_by(PipelineRun.created_at)
        .limit(1)
    )
    excluded = tuple(exclude_ids)
    if excluded:
        stmt = stmt.where(PipelineRun.id.notin_(excluded))
    if _is_postgres():
        stmt = stmt.with_for_update(skip_locked=True)

    row = (await db.execute(stmt)).scalars().first()
    if row is None:
        return None

    settings = get_settings()
    attempts = _attempt_count(row)
    if attempts >= settings.caos_pipeline_max_attempts:
        row.status = "failed"
        row.error = "abandoned after max attempts"
        row.completed_at = now
        row.lease_expires_at = None
        await db.commit()
        return None

    row.status = "running"
    row.worker_id = worker_id
    row.lease_expires_at = now + timedelta(seconds=settings.caos_pipeline_lease_seconds)
    row.summary = {**(row.summary or {}), "_attempts": attempts + 1}
    await db.commit()
    return row


async def _mark_failed(
    db,
    job_id: str,
    reason: str,
    *,
    expected_worker_id: str | None = None,
) -> None:
    """Mark an owned attempt failed; never overwrite a reclaimed attempt."""
    try:
        await db.rollback()
        job = await db.get(PipelineRun, job_id)
        if job is None:
            return
        if expected_worker_id is not None and (
            job.status != "running" or job.worker_id != expected_worker_id
        ):
            logger.warning(
                "discarding stale pipeline failure %s worker=%s",
                job_id,
                expected_worker_id,
            )
            return
        job.status = "failed"
        job.error = reason
        job.completed_at = _utcnow()
        job.lease_expires_at = None
        await db.commit()
    except Exception:  # noqa: BLE001
        logger.exception("could not mark pipeline job %s failed", job_id)


async def execute_job(job_id: str, *, expected_worker_id: str | None = None) -> None:
    """Execute one claimed job and fence its terminal write by worker identity."""
    async with AsyncSessionLocal() as db:
        job = await db.get(PipelineRun, job_id)
        if job is None or job.status != "running":
            return
        if expected_worker_id is not None and job.worker_id != expected_worker_id:
            logger.warning(
                "discarding stale pipeline claim %s worker=%s",
                job_id,
                expected_worker_id,
            )
            return

        owner = expected_worker_id or job.worker_id or _WORKER_ID
        # A direct/local caller may not have persisted ownership yet. Until its
        # lease commit succeeds, failure cleanup must not require a fence value
        # that the database has never observed.
        fenced_owner = owner if expected_worker_id is not None or job.worker_id else None
        try:
            # Direct unit/local callers may enter without the poller's claim.
            # Persist an owner+lease before any LLM work so the same fencing rule
            # applies to every execution path.
            if job.worker_id is None:
                job.worker_id = owner
                job.lease_expires_at = _utcnow() + timedelta(
                    seconds=get_settings().caos_pipeline_lease_seconds
                )
                await db.commit()
                fenced_owner = owner

            result = await autonomy.run_cycle(
                db, prior_fingerprints=job.prior_fingerprints or None
            )

            # Read through the identity map to observe a reclaim committed by a
            # different process while this attempt was running.
            ownership = (
                await db.execute(
                    select(PipelineRun.status, PipelineRun.worker_id).where(
                        PipelineRun.id == job_id
                    )
                )
            ).one_or_none()
            if ownership is None or tuple(ownership) != ("running", owner):
                await db.rollback()
                logger.warning(
                    "discarding stale pipeline result %s worker=%s",
                    job_id,
                    owner,
                )
                return

            await db.refresh(job)
            draft = result.get("draft") or {}
            summary = draft.get("summary") or {}
            job.status = "complete"
            job.current_fingerprints = result.get("current_fingerprints") or {}
            job.draft = draft
            job.summary = {
                "n_changed": result.get("n_changed", 0),
                "n_anomalies": result.get("n_anomalies", 0),
                "n_claims": result.get("n_claims", 0),
                "n_sections": summary.get("n_sections", 0),
                "n_deterministic_bullets": summary.get("n_deterministic_bullets", 0),
            }
            job.completed_at = _utcnow()
            job.lease_expires_at = None
            await db.commit()
        except asyncio.CancelledError:
            logger.warning(
                "pipeline job %s cancelled during shutdown — marking failed", job_id
            )
            await _mark_failed(
                db,
                job_id,
                "worker shutdown during autonomy cycle",
                expected_worker_id=fenced_owner,
            )
            raise
        except Exception as exc:  # noqa: BLE001
            logger.exception("pipeline job %s failed", job_id)
            await _mark_failed(
                db,
                job_id,
                str(exc)[:2000],
                expected_worker_id=fenced_owner,
            )


class PipelineExecutor:
    """Continuous, lease-backed autonomy worker for PostgreSQL and local SQLite."""

    name = "autonomy_queue_worker"

    def __init__(self) -> None:
        self._settings = get_settings()
        self._worker_id = f"{socket.gethostname()}:{os.getpid()}:{id(self)}"
        self._inflight: set[asyncio.Task] = set()
        self._inflight_ids: set[str] = set()
        self._loop_task: asyncio.Task | None = None
        self._stop = asyncio.Event()
        self._wake = asyncio.Event()
        self._consecutive_failures = 0

    async def start(self) -> None:
        self._stop.clear()
        self._wake.clear()
        self._loop_task = asyncio.create_task(
            self._run_loop(), name="caos-autonomy-worker"
        )

    async def stop(self) -> None:
        self._stop.set()
        self._wake.set()
        if self._loop_task is not None:
            await self._loop_task
        tasks = list(self._inflight)
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        self._inflight.clear()
        self._inflight_ids.clear()

    def enqueue(self, job_id: str) -> None:
        """Wake the poller; the durable row, not this notification, owns work."""
        del job_id
        self._wake.set()

    def health(self) -> dict[str, object]:
        loop_live = self._loop_task is not None and not self._loop_task.done()
        healthy = loop_live and self._consecutive_failures < 3
        return {
            "status": "ok" if healthy else "degraded",
            "loop_live": loop_live,
            "consecutive_failures": self._consecutive_failures,
            "inflight": len(self._inflight),
        }

    async def _heartbeat(self) -> None:
        if not self._inflight_ids:
            return
        lease = timedelta(seconds=self._settings.caos_pipeline_lease_seconds)
        async with AsyncSessionLocal() as db:
            rows = (
                await db.execute(
                    select(PipelineRun).where(
                        PipelineRun.id.in_(tuple(self._inflight_ids)),
                        PipelineRun.worker_id == self._worker_id,
                        PipelineRun.status == "running",
                    )
                )
            ).scalars().all()
            expires = _utcnow() + lease
            for row in rows:
                row.lease_expires_at = expires
            await db.commit()

    async def _claim_one(self) -> str | None:
        async with AsyncSessionLocal() as db:
            row = await claim_next_job(
                db,
                self._worker_id,
                exclude_ids=self._inflight_ids,
            )
            return row.id if row is not None else None

    async def _run_loop(self) -> None:
        poll = self._settings.caos_pipeline_poll_seconds
        cap = max(1, self._settings.caos_pipeline_concurrency)
        while not self._stop.is_set():
            try:
                await self._heartbeat()
                while len(self._inflight) < cap:
                    job_id = await self._claim_one()
                    if job_id is None:
                        break
                    task = asyncio.create_task(
                        execute_job(job_id, expected_worker_id=self._worker_id),
                        name=f"caos-autonomy-{job_id}",
                    )
                    self._inflight.add(task)
                    self._inflight_ids.add(job_id)
                    task.add_done_callback(self._inflight.discard)
                    task.add_done_callback(
                        lambda _task, jid=job_id: self._inflight_ids.discard(jid)
                    )
                self._consecutive_failures = 0
            except Exception:  # noqa: BLE001 — worker loops must stay alive
                self._consecutive_failures += 1
                if self._consecutive_failures >= 3:
                    logger.error(
                        "autonomy worker loop failing repeatedly (%d ticks) — queue degraded",
                        self._consecutive_failures,
                        exc_info=True,
                    )
                else:
                    logger.exception("autonomy worker loop tick failed")

            self._wake.clear()
            if self._stop.is_set():
                break
            try:
                await asyncio.wait_for(self._wake.wait(), timeout=poll)
            except asyncio.TimeoutError:
                pass
