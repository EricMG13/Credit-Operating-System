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
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, or_, select, update

from config import get_settings
from database import AsyncSessionLocal, IssuerResearchReport, Issuer, ModuleOutput, Run, engine
from research_report import (
    ResearchReportResult,
    build_module_digest,
    render_validated_research_report,
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


@dataclass(frozen=True)
class ReportClaim:
    report_id: str
    owner_token: str
    attempt: int


class ReportOwnershipLost(RuntimeError):
    """The report attempt no longer owns its durable queue row."""


def _new_owner_token(prefix: str) -> str:
    """Return an attempt-unique token that fits the model's VARCHAR(64)."""
    return f"{prefix[:27]}:{uuid.uuid4().hex}"


def _owned_attempt(claim: ReportClaim):
    return and_(
        IssuerResearchReport.id == claim.report_id,
        IssuerResearchReport.worker_id == claim.owner_token,
        IssuerResearchReport.attempts == claim.attempt,
        IssuerResearchReport.status == "running",
    )


def _bounded_failure(reason: object) -> str:
    text = str(reason).strip() or "research report synthesis failed"
    return text[:512]


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


async def _run_report(
    report_id: str,
    *,
    owner_token: str | None = None,
    attempt: int | None = None,
) -> None:
    async with AsyncSessionLocal() as session:
        report = await session.get(IssuerResearchReport, report_id)
        if report is None:
            logger.warning("execute_report_by_id: report %s vanished", report_id)
            return

        claim: ReportClaim | None = None

        async def _save_progress(p: dict) -> None:
            if claim is None:
                raise ReportOwnershipLost(
                    f"report {report_id} progress arrived before an attempt was claimed"
                )
            result = await session.execute(
                update(IssuerResearchReport)
                .where(_owned_attempt(claim))
                .values(progress=p)
            )
            await session.commit()
            if result.rowcount != 1:
                raise ReportOwnershipLost(
                    f"report {report_id} ownership lost while saving progress"
                )

        try:
            if owner_token is None:
                next_attempt = int(report.attempts or 0) + 1
                claim = ReportClaim(
                    report_id=report_id,
                    owner_token=_new_owner_token(_WORKER_ID),
                    attempt=next_attempt,
                )
                report.worker_id = claim.owner_token
                report.attempts = claim.attempt
                report.claimed_at = _now()
                report.lease_expires_at = _now() + timedelta(seconds=1)
                report.status = "running"
                await session.commit()
                lease_seconds = get_settings().caos_report_lease_seconds
                lease_result = await session.execute(
                    update(IssuerResearchReport)
                    .where(_owned_attempt(claim))
                    .values(lease_expires_at=_now() + timedelta(seconds=lease_seconds))
                )
                await session.commit()
                if lease_result.rowcount != 1:
                    raise ReportOwnershipLost(
                        f"report {report_id} ownership lost while establishing lease"
                    )
            else:
                if attempt is None:
                    raise ValueError("pre-claimed report execution requires an attempt")
                claim = ReportClaim(report_id, owner_token, attempt)
                if (
                    report.status != "running"
                    or report.worker_id != claim.owner_token
                    or report.attempts != claim.attempt
                ):
                    raise ReportOwnershipLost(
                        f"report {report_id} was reclaimed before execution started"
                    )

            # Load the run + issuer
            run = await session.get(Run, report.run_id)
            if run is None or run.status != "complete":
                await _mark_failed(session, claim, "run not found or not complete")
                return

            issuer = await session.get(Issuer, report.issuer_id)
            if issuer is None:
                await _mark_failed(session, claim, "issuer not found")
                return

            # Load module outputs for this run
            mod_rows = list((await session.execute(
                select(ModuleOutput).where(ModuleOutput.run_id == run.id)
            )).scalars().all())
            mods = {m.module_id: m for m in mod_rows}

            if len(mods) < 3:
                await _mark_failed(
                    session, claim,
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
            markdown = (
                result.markdown
                if result.demo
                else render_validated_research_report(
                    result.payload, truncated=result.truncated
                )
            )

            completion = await session.execute(
                update(IssuerResearchReport)
                .where(_owned_attempt(claim))
                .values(
                    payload=result.payload,
                    markdown=markdown,
                    validation={
                        "checked": validation.checked,
                        "verified": validation.verified,
                        "dropped": validation.dropped,
                        "unverified": validation.unverified,
                    },
                    digest={
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
                    },
                    prompt_version=run.prompt_version,
                    model_id=None,
                    tokens_used=result.tokens_used,
                    demo=result.demo,
                    truncated=result.truncated,
                    status="complete",
                    lease_expires_at=None,
                    completed_at=_now(),
                )
            )
            await session.commit()
            if completion.rowcount != 1:
                raise ReportOwnershipLost(
                    f"report {report_id} ownership lost before completion"
                )

        except ReportOwnershipLost:
            await session.rollback()
            logger.warning("research report %s stopped after ownership loss", report_id)
        except asyncio.CancelledError:
            logger.warning(
                "research report %s cancelled during shutdown — marking failed", report_id,
            )
            if claim is not None:
                await _mark_failed(session, claim, "worker shutdown during synthesis")
            raise
        except Exception as e:  # noqa: BLE001 — last-resort guard
            logger.exception("research report %s failed", report_id)
            if claim is not None:
                await _mark_failed(session, claim, _bounded_failure(e))


async def _mark_failed(session, claim: ReportClaim, reason: str) -> None:
    """Fence terminal failure to one owner attempt; never raises."""
    try:
        await session.rollback()
        result = await session.execute(
            update(IssuerResearchReport)
            .where(_owned_attempt(claim))
            .values(
                status="failed",
                error=_bounded_failure(reason),
                lease_expires_at=None,
                completed_at=_now(),
            )
        )
        await session.commit()
        if result.rowcount != 1:
            logger.warning(
                "research report %s failure write rejected after ownership loss",
                claim.report_id,
            )
    except Exception:  # noqa: BLE001
        logger.exception("could not mark research report %s failed", claim.report_id)


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
        self._worker_prefix = f"{socket.gethostname()}:{id(self)}"
        self._inflight: set[asyncio.Task] = set()
        self._inflight_claims: dict[str, ReportClaim] = {}
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

    def enqueue(self, report_id: str) -> None:
        # The row already exists as 'queued'; the loop will pick it up. No-op.
        # NOT async: routes/issuers.py calls this without awaiting (matching
        # ResearchReportExecutor.enqueue's sync signature — the two are
        # interchangeable behind get_report_executor()'s dialect switch).
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
            async with s.begin():
                rows = list((await s.execute(
                    select(IssuerResearchReport)
                    .where(
                        IssuerResearchReport.status == "running",
                        IssuerResearchReport.lease_expires_at < _now(),
                        IssuerResearchReport.attempts >= self._settings.caos_report_max_attempts,
                    )
                    .with_for_update(skip_locked=True)
                )).scalars().all())
                for row in rows:
                    claim = ReportClaim(row.id, row.worker_id, row.attempts)
                    await s.execute(
                        update(IssuerResearchReport)
                        .where(_owned_attempt(claim))
                        .values(
                            status="failed",
                            error="abandoned after max attempts",
                            lease_expires_at=None,
                            completed_at=_now(),
                        )
                    )

    async def _heartbeat(self) -> None:
        """Extend exact attempts and cancel stale tasks after ownership loss."""
        claims = list(self._inflight_claims.values())
        if not claims:
            return
        lease = timedelta(seconds=self._settings.caos_report_lease_seconds)
        lost: list[ReportClaim] = []
        async with AsyncSessionLocal() as s:
            for claim in claims:
                result = await s.execute(
                    update(IssuerResearchReport)
                    .where(_owned_attempt(claim))
                    .values(lease_expires_at=_now() + lease)
                )
                if result.rowcount != 1:
                    lost.append(claim)
            await s.commit()
        for claim in lost:
            logger.warning(
                "research report %s heartbeat lost ownership for attempt %d",
                claim.report_id, claim.attempt,
            )
            task = self._inflight_tasks.get(claim.report_id)
            if task is not None and not task.done():
                task.cancel()

    async def _claim_one(self) -> ReportClaim | None:
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
                if self._inflight_claims:
                    stmt = stmt.where(
                        IssuerResearchReport.id.notin_(tuple(self._inflight_claims))
                    )
                row = (await s.execute(stmt)).scalar_one_or_none()
                if row is None:
                    return None
                attempt = int(row.attempts or 0) + 1
                claim = ReportClaim(
                    report_id=row.id,
                    owner_token=_new_owner_token(self._worker_prefix),
                    attempt=attempt,
                )
                row.status = "running"
                row.attempts = claim.attempt
                row.claimed_at = _now()
                row.lease_expires_at = _now() + lease
                row.worker_id = claim.owner_token
                return claim

    async def _run_loop(self) -> None:
        poll = self._settings.caos_report_poll_seconds
        cap = self._settings.caos_research_concurrency
        while not self._stop.is_set():
            try:
                await self._heartbeat()
                await self._reap_orphans()
                while len(self._inflight) < cap:
                    claim = await self._claim_one()
                    if claim is None:
                        break
                    task = asyncio.create_task(_run_report(
                        claim.report_id,
                        owner_token=claim.owner_token,
                        attempt=claim.attempt,
                    ))
                    self._inflight.add(task)
                    self._inflight_claims[claim.report_id] = claim
                    self._inflight_tasks[claim.report_id] = task

                    def _discard(done: asyncio.Task, rid: str = claim.report_id) -> None:
                        self._inflight.discard(done)
                        self._inflight_claims.pop(rid, None)
                        self._inflight_tasks.pop(rid, None)

                    task.add_done_callback(_discard)
                self._consecutive_failures = 0
            except Exception:  # noqa: BLE001 — never let the loop die
                self._consecutive_failures += 1
                if self._consecutive_failures >= 3:
                    logger.error(
                        "report worker loop failing repeatedly (%d consecutive ticks) — queue stalled",
                        self._consecutive_failures,
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
