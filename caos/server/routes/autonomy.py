"""Autonomous-pipeline route — exposes the Sentinel→Reporter DAG as one endpoint.

``GET /api/autonomy/draft`` enqueues an autonomous cycle (a ``running``
``pipeline_runs`` row) and returns the latest ``complete`` draft immediately —
the cycle runs OFF the request thread on the ``PipelineExecutor`` (wired in
main.py lifespan), so a GET never blocks on the Analyst's HEAVY LLM passes. The
client polls; the next GET after the cycle completes returns the fresh draft.

Change-driven, never schedule-driven: a cycle is enqueued only when (a) no
cycle is already ``running`` (single-flight — a concurrent GET serves the latest
draft instead of double-enqueueing), AND (b) there is no ``complete`` draft, OR
the latest is stale, OR the caller passed ``force``. The cycle's own Sentinel
diffs the prior (the last complete's ``current_fingerprints``) against the
current vault, so a no-change cycle is cheap (no anomalies → no Analyst spend).

The advisory lock (engine/locks.py) guards the enqueue check+write so two
concurrent requests cannot both enqueue; the ``running`` row + the executor's
``SELECT FOR UPDATE SKIP LOCKED`` claim guard the execution across workers.

The draft is ``AI-GENERATED, UNRATIFIED`` and export-gated until an analyst
ratifies it (the Reporter's ``ratify`` flywheel) — autonomous drafting, not
publishing. Fault-isolated: any failure returns a deterministic empty draft (the
LLM lane can never abort the page). Keyless deploys: the Analyst LLM stage is
skipped inside the cycle, the draft composes from deterministic anomaly bullets.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from engine import autonomy, locks, pipeline  # noqa: F401 — autonomy/pipeline used by executor; locks for the enqueue guard
from identity import CallerIdentity, get_identity

logger = logging.getLogger("caos.autonomy_route")

router = APIRouter()

# Enqueue a cycle at most this often per worker (the cycle's Sentinel handles
# real change-detection; this just bounds the fingerprint-loop work per GET).
_STALE_AFTER = timedelta(hours=1)
_CYCLE_LOCK_KEY = locks.key_from_str("autonomy-cycle-enqueue")


def _empty_draft(error: str = "autonomy cycle unavailable — deterministic surface unaffected") -> dict:
    return {
        "status": "draft", "ai_generated": True, "ratified": False,
        "export_allowed": False, "marking": "AI-GENERATED, UNRATIFIED",
        "sections": [], "summary": {"n_sections": 0, "n_claims": 0,
                                    "n_deterministic_bullets": 0, "n_anomalies": 0},
        "refreshing": False, "error": error,
    }


def _is_stale(row) -> bool:
    """True when the latest complete cycle is older than the staleness window."""
    completed = row.completed_at or row.created_at
    if completed is None:
        return True
    if completed.tzinfo is None:
        completed = completed.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - completed) > _STALE_AFTER


@router.get("/draft")
async def get_autonomy_draft(
    request: Request,
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
    force: bool = False,
):
    """Enqueue an autonomous cycle (if warranted) and return the latest complete
    draft. The cycle runs on the PipelineExecutor off this request thread; the
    client polls until ``refreshing`` is False. The draft is ``AI-GENERATED,
    UNRATIFIED`` and export-gated until ratified by an analyst."""
    try:
        # Single-flight enqueue: the advisory lock guards the check+write so two
        # concurrent requests cannot both enqueue. Held only for the brief
        # decision, NOT the cycle (the executor runs the cycle off-thread).
        async with locks.advisory_lock(db, _CYCLE_LOCK_KEY) as acquired:
            if acquired:
                running = await pipeline.latest_running(db)
                if running is None:
                    complete = await pipeline.latest_complete(db)
                    if force or complete is None or _is_stale(complete):
                        prior = complete.current_fingerprints if complete else None
                        job_id = await pipeline.enqueue_cycle(db, prior_fingerprints=prior)
                        executor = getattr(getattr(request, "app", None), "state", None)
                        pipeline_executor = getattr(executor, "pipeline_executor", None)
                        if pipeline_executor is not None:
                            pipeline_executor.enqueue(job_id)
                        else:
                            logger.warning("no pipeline_executor on app.state — job %s queued but not run", job_id)
        # Serve the latest complete draft (or a regenerating envelope).
        draft = await pipeline.latest_draft(db)
        running = await pipeline.latest_running(db)
        refreshing = running is not None
        if draft is None:
            return {**_empty_draft("autonomy cycle starting — no draft yet"),
                    "refreshing": refreshing}
        return {**draft, "refreshing": refreshing}
    except Exception:  # noqa: BLE001 — fault-isolated: never 500 the page
        logger.exception("autonomy route failed — returning empty draft")
        return _empty_draft()
