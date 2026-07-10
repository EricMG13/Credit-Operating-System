"""Durable Issuer Research Report execution.

The Research Report is a multi-thousand-token LLM synthesis call. Running it
inside the POST request would hold the HTTP connection open for the whole run,
so a dropped client/proxy connection would lose the work and its token spend.
Instead the POST persists an ``IssuerResearchReport`` row and spawns a background
task here; the client polls ``GET /api/issuers/{id}/research-report``.

In-process tasks + sweep-on-boot, mirroring ``ResearchExecutor`` in
[research_executor.py] and ``InProcessExecutor`` in [run_executor.py]: the app
is a single container behind Caddy/oauth2-proxy, the same single-process
assumption ``rate_limit.py`` makes. A process restart marks stranded ``running``
reports failed and the analyst re-submits — no zombie ``running`` that never
completes.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select, update

from config import get_settings
from database import AsyncSessionLocal, IssuerResearchReport, Issuer, ModuleOutput, Run
from research_report import (
    ResearchReportResult,
    build_module_digest,
    synthesize_research_report,
    validate_report_figures,
)

logger = logging.getLogger("caos.research_report")

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
            ratings = []
            if issuer.rating_sp:
                ratings.append(("S&P", issuer.rating_sp))
            if issuer.rating_moody:
                ratings.append(("Moody's", issuer.rating_moody))
            if issuer.rating_fitch:
                ratings.append(("Fitch", issuer.rating_fitch))

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


class ResearchReportExecutor:
    """In-process background tasks for issuer research report jobs.

    ponytail: in-process + sweep-on-boot — sound for one app container. If ever
    scaled to multiple replicas, give report jobs the QueueWorker's claim/lease
    treatment so one replica can't sweep another replica's in-flight job.
    """

    name = "research_report_in_process"

    def __init__(self) -> None:
        self._tasks: set[asyncio.Task] = set()

    async def start(self) -> None:
        # Hard-crash recovery: a SIGKILL/restart skips stop()'s cancel handler,
        # stranding a report in 'running' forever. Sweep them to failed on boot.
        async with AsyncSessionLocal() as session:
            await session.execute(
                update(IssuerResearchReport)
                .where(IssuerResearchReport.status == "running")
                .values(
                    status="failed",
                    error="abandoned (process restart)",
                    completed_at=_now(),
                )
            )
            await session.commit()

    async def stop(self) -> None:
        tasks = list(self._tasks)
        for t in tasks:
            t.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        self._tasks.clear()

    def enqueue(self, report_id: str) -> None:
        task = asyncio.create_task(execute_report_by_id(report_id))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)