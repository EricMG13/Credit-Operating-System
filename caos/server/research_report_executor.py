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

from sqlalchemy import or_, select, update

from config import get_settings
from database import AsyncSessionLocal, IssuerResearchReport, Issuer, ModuleOutput, Run
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
            report.completed_at = _now()
            await session.commit()
    except Exception:  # noqa: BLE001
        logger.exception("could not mark research report %s failed", report_id)


class ResearchReportExecutor(InProcessTaskExecutor):
    """In-process background tasks for issuer research report jobs.

    Multi-replica safe: enqueue() still spawns same-process (mirrors
    ResearchExecutor), but start()'s boot sweep is lease-expiry gated like
    QueueWorker._reap_orphans, so one replica can't kill another replica's
    still-live report on a rolling redeploy.
    """

    name = "research_report_in_process"

    async def start(self) -> None:
        # Hard-crash recovery: a SIGKILL/restart skips stop()'s cancel handler,
        # stranding a report in 'running' forever. Gated on lease_expires_at
        # (not unconditional) so a rolling multi-replica redeploy can't kill a
        # report still live on a sibling. A NULL lease is reapable (legacy rows,
        # or a crash before the lease-set commit) — see
        # migrations/0038_background_job_leases and redteam RT-2026-07-11-03.
        async with AsyncSessionLocal() as session:
            await session.execute(
                update(IssuerResearchReport)
                .where(
                    IssuerResearchReport.status == "running",
                    or_(
                        IssuerResearchReport.lease_expires_at.is_(None),
                        IssuerResearchReport.lease_expires_at < _now(),
                    ),
                )
                .values(
                    status="failed",
                    error="abandoned (lease expired)",
                    completed_at=_now(),
                    lease_expires_at=None,
                )
            )
            await session.commit()

    def enqueue(self, report_id: str) -> None:
        self._spawn(execute_report_by_id(report_id))