"""Durable Issuer Research Report execution.

The Research Report is a multi-thousand-token LLM synthesis call. Running it
inside the POST request would hold the HTTP connection open for the whole run,
so a dropped client/proxy connection would lose the work and its token spend.
Instead the POST persists an ``IssuerResearchReport`` row and spawns a background
task here; the client polls ``GET /api/issuers/{id}/research-report``.

In-process tasks, mirroring ``ResearchExecutor`` in [research_executor.py] and
``InProcessExecutor`` in [run_executor.py]: a report is bound to whichever
replica's request handler took the POST. The boot sweep that recovers a stranded
report is lease-expiry gated (migrations/0038_background_job_leases), not
unconditional, so one replica's boot can't kill a report genuinely still
running on a sibling. A lease-expired ``running`` report is marked failed and
the analyst re-submits — no zombie ``running`` that never completes.
"""

from __future__ import annotations

import asyncio
import logging
import os
import socket
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, or_, select, update

from config import get_settings
from database import AsyncSessionLocal, IssuerResearchReport, Issuer, ModuleOutput, Run, engine
from research_report import (
    ResearchReportResult,
    build_module_digest,
    synthesize_research_report,
    validate_report_figures,
)
from executor_base import InProcessTaskExecutor

logger = logging.getLogger("caos.research_report")

_WORKER_ID = f"{socket.gethostname()}:{os.getpid()}"

# Bound concurrent synthesis runs (cost guard). POST fires a background task per
# report, so without this a sustained submission rate accumulates unbounded
# overlapping opus calls. Jobs past the cap queue on this semaphore.
# Lazy-init: on py3.9 asyncio.Semaphore() binds the loop at construction.
_sem: "asyncio.Semaphore | None" = None


def _semaphore() -> "asyncio.Semaphore":
    global _sem
    if _sem is None:
        _sem = asyncio.Semaphore(max(1, get_settings().caos_research_concurrency))
    return _sem


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _ratings_for(issuer: Issuer) -> list[tuple[str, str]]:
    """(agency, rating) pairs for whichever of S&P/Moody's/Fitch the issuer has."""
    ratings = []
    if issuer.rating_sp:
        ratings.append(("S&P", issuer.rating_sp))
    if issuer.rating_moody:
        ratings.append(("Moody's", issuer.rating_moody))
    if issuer.rating_fitch:
        ratings.append(("Fitch", issuer.rating_fitch))
    return ratings


async def execute_report_by_id(report_id: str) -> None:
    """Run one research report job in its own session; mark it failed on any error.

    Gated by the concurrency semaphore — acquired BEFORE opening the DB session so
    a queued job doesn't hold a connection while it waits its turn."""
    async with _semaphore():
        await _run_report(report_id)


async def _run_report(report_id: str) -> None:
    async with AsyncSessionLocal() as session:
        report = await session.get(IssuerResearchReport, report_id)
        if report is None:
            logger.warning("execute_report_by_id: report %s vanished", report_id)
            return

        async def _save_progress(p: dict) -> None:
            # Constraint: only report.progress may be dirty when this is called.
            # A commit here flushes ALL pending ORM state on the session — do not
            # mutate report fields before the synthesis call.
            report.progress = p
            await session.commit()

        try:
            # Lease this report before doing any real work, committed on its own
            # so a sibling replica's boot sweep can see it durably right away.
            # Gates ResearchReportExecutor.start()'s reap below. Inside the try:
            # a commit failure here must still reach the except-Exception guard
            # below and mark the report failed, not strand it in 'running' with
            # the lease never set. (Also satisfies _save_progress's dirty-state
            # constraint above — this commit clears it before synthesis starts.)
            report.worker_id = _WORKER_ID
            report.lease_expires_at = _now() + timedelta(
                seconds=get_settings().caos_background_job_lease_seconds
            )
            report.status = "running"  # visible to the client's poll; idempotent on re-claim
            await session.commit()

            # Load the run + issuer
            run = await session.get(Run, report.run_id)
            if run is None or run.status != "complete":
                await _mark_failed(session, report_id, "run not found or not complete")
                return

            issuer = await session.get(Issuer, report.issuer_id)
            if issuer is None:
                await _mark_failed(session, report_id, "issuer not found")
                return

            # Load module outputs for this run
            mod_rows = list((await session.execute(
                select(ModuleOutput).where(ModuleOutput.run_id == run.id)
            )).scalars().all())
            mods = {m.module_id: m for m in mod_rows}

            if len(mods) < 3:
                await _mark_failed(
                    session, report_id,
                    f"insufficient module coverage — {len(mods)} modules present, need ≥3",
                )
                return

            # Build the module digest
            digest = build_module_digest(mods)

            # Collect issuer context
            ratings = _ratings_for(issuer)

            # Synthesize
            result: ResearchReportResult = await synthesize_research_report(
                digest=digest,
                issuer_name=issuer.name,
                issuer_ticker=issuer.ticker,
                sector=issuer.industry,
                ratings=ratings,
                as_of_date=run.as_of_date,
                run_id=run.id,
                prompt_version=run.prompt_version or "",
                analyst_id=report.analyst_id,
                ai_mode="standard",  # v1: always standard; future: read from brief
                on_progress=_save_progress,
            )

            # Validate figures against actual module outputs
            validation = validate_report_figures(result.payload, mods)

            # Persist
            report.payload = result.payload
            report.markdown = result.markdown
            report.validation = {
                "checked": validation.checked,
                "verified": validation.verified,
                "dropped": validation.dropped,
                "unverified": validation.unverified,
            }
            report.digest = {
                "modules": [
                    {
                        "module_id": d.module_id,
                        "module_name": d.module_name,
                        "layer": d.layer,
                        "confidence": d.confidence,
                        "qa_status": d.qa_status,
                    }
                    for d in digest
                ],
                "module_count": len(digest),
            }
            report.prompt_version = run.prompt_version
            report.model_id = None  # the model is picked per-run; not persisted on Run
            report.tokens_used = result.tokens_used
            report.demo = result.demo
            report.truncated = result.truncated
            report.status = "complete"
            report.lease_expires_at = None
            report.completed_at = _now()
            await session.commit()

        except asyncio.CancelledError:
            logger.warning(
                "research report %s cancelled during shutdown — marking failed", report_id,
            )
            await _mark_failed(session, report_id, "worker shutdown during synthesis")
            raise
        except Exception as e:  # noqa: BLE001 — last-resort guard
            logger.exception("research report %s failed", report_id)
            await _mark_failed(session, report_id, str(e)[:2000])


async def _mark_failed(session, report_id: str, reason: str) -> None:
    """Roll back and mark a report failed; never raises (last-resort recovery)."""
    try:
        await session.rollback()
        report = await session.get(IssuerResearchReport, report_id)
        if report is not None:
            report.status = "failed"
            report.error = reason
            report.lease_expires_at = None
            report.completed_at = _now()
            await session.commit()
    except Exception:  # noqa: BLE001
        logger.exception("could not mark research report %s failed", report_id)


class ResearchReportExecutor(InProcessTaskExecutor):
    """In-process background tasks for issuer research report jobs.

    Multi-replica safe: enqueue() still spawns same-process (mirrors
    ResearchExecutor), but start()'s boot sweep is lease-expiry gated like
    QueueWorker._reap_orphans, so one replica can't kill another replica's
    still-live report on a rolling redeploy. On Postgres,
    ``get_report_executor`` picks ``ReportQueueWorker`` instead so one worker
    process dying doesn't strand a report until the next full restart.
    """

    name = "research_report_in_process"

    async def start(self) -> None:
        # Hard-crash recovery: a SIGKILL/restart skips stop()'s cancel handler,
        # stranding a report in 'running'/'queued' forever. Running rows are
        # gated on lease_expires_at (not unconditional) so a rolling
        # multi-replica redeploy can't kill a report still live on a sibling. A
        # NULL lease is reapable (legacy rows, or a crash before the lease-set commit) — see
        # migrations/0038_background_job_leases and redteam RT-2026-07-11-03.
        async with AsyncSessionLocal() as session:
            await session.execute(
                update(IssuerResearchReport)
                .where(
                    or_(
                        IssuerResearchReport.status == "queued",
                        and_(
                            IssuerResearchReport.status == "running",
                            or_(
                                IssuerResearchReport.lease_expires_at.is_(None),
                                IssuerResearchReport.lease_expires_at < _now(),
                            ),
                        ),
                    ),
                )
                .values(
                    status="failed",
                    error="abandoned (process restart)",
                    completed_at=_now(),
                    lease_expires_at=None,
                )
            )
            await session.commit()

    def enqueue(self, report_id: str) -> None:
        self._spawn(execute_report_by_id(report_id))


class ReportQueueWorker:
    """Postgres: claim queued (and truly-orphaned) research-report jobs via FOR
    UPDATE SKIP LOCKED, execute up to `concurrency` at once, and reap
    attempts-exhausted orphans. Mirrors ``run_executor.QueueWorker`` /
    ``research_executor.ResearchQueueWorker`` — see the former for the full
    state-machine diagram and the multi-worker claim-safety rationale (Postgres
    row locking; do not run multiple workers against SQLite). Concurrency cap
    reuses ``caos_research_concurrency`` (mirrors ``_semaphore()`` above).
    """

    name = "report_queue_worker"

    def __init__(self) -> None:
        self._settings = get_settings()
        self._worker_id = f"{socket.gethostname()}:{id(self)}"
        self._inflight: set[asyncio.Task] = set()
        # A report this worker is still executing must never be re-claimed by
        # itself even if its wall clock legitimately exceeds the lease.
        self._inflight_ids: set[str] = set()
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

    def enqueue(self, report_id: str) -> None:
        # The row already exists as 'queued'; the loop will pick it up. No-op.
        # NOT async: routes/issuers.py calls this without awaiting (matching
        # ResearchReportExecutor.enqueue's sync signature — the two are
        # interchangeable behind get_report_executor()'s dialect switch).
        return None

    async def _reap_orphans(self) -> None:
        async with AsyncSessionLocal() as s:
            await s.execute(
                update(IssuerResearchReport)
                .where(
                    IssuerResearchReport.status == "running",
                    IssuerResearchReport.lease_expires_at < _now(),
                    IssuerResearchReport.attempts >= self._settings.caos_report_max_attempts,
                )
                .values(status="failed", error="abandoned after max attempts", lease_expires_at=None)
            )
            await s.commit()

    async def _heartbeat(self) -> None:
        """Extend the lease on this worker's live reports each poll tick, so a
        report whose wall clock legitimately exceeds the fixed lease window is
        not re-claimed (by any worker) and executed twice concurrently."""
        if not self._inflight_ids:
            return
        lease = timedelta(seconds=self._settings.caos_report_lease_seconds)
        async with AsyncSessionLocal() as s:
            await s.execute(
                update(IssuerResearchReport)
                .where(
                    IssuerResearchReport.id.in_(tuple(self._inflight_ids)),
                    IssuerResearchReport.worker_id == self._worker_id,
                    IssuerResearchReport.status == "running",
                )
                .values(lease_expires_at=_now() + lease)
            )
            await s.commit()

    async def _claim_one(self) -> str | None:
        max_attempts = self._settings.caos_report_max_attempts
        lease = timedelta(seconds=self._settings.caos_report_lease_seconds)
        async with AsyncSessionLocal() as s:
            async with s.begin():
                stmt = (
                    select(IssuerResearchReport)
                    .where(
                        or_(
                            IssuerResearchReport.status == "queued",
                            and_(
                                IssuerResearchReport.status == "running",
                                IssuerResearchReport.lease_expires_at < _now(),
                                IssuerResearchReport.attempts < max_attempts,
                            ),
                        )
                    )
                    .order_by(IssuerResearchReport.created_at)
                    .limit(1)
                    .with_for_update(skip_locked=True)
                )
                if self._inflight_ids:
                    stmt = stmt.where(IssuerResearchReport.id.notin_(tuple(self._inflight_ids)))
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
        poll = self._settings.caos_report_poll_seconds
        cap = self._settings.caos_research_concurrency
        fails = 0
        while not self._stop.is_set():
            try:
                await self._heartbeat()
                await self._reap_orphans()
                while len(self._inflight) < cap:
                    report_id = await self._claim_one()
                    if report_id is None:
                        break
                    task = asyncio.create_task(_run_report(report_id))
                    self._inflight.add(task)
                    self._inflight_ids.add(report_id)
                    task.add_done_callback(self._inflight.discard)
                    task.add_done_callback(
                        lambda _t, rid=report_id: self._inflight_ids.discard(rid)
                    )
                fails = 0
            except Exception:  # noqa: BLE001 — never let the loop die
                fails += 1
                if fails >= 3:
                    logger.error(
                        "report worker loop failing repeatedly (%d consecutive ticks) — queue stalled",
                        fails,
                    )
                else:
                    logger.exception("report worker loop tick failed")
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=poll)
            except asyncio.TimeoutError:
                pass


def get_report_executor():
    """Pick the executor by DB dialect: in-process on SQLite, queue on Postgres."""
    if engine.dialect.name == "postgresql":
        return ReportQueueWorker()
    return ResearchReportExecutor()
