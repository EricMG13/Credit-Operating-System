"""Autonomous-pipeline routes — read the latest draft or request a refresh.

``GET /api/autonomy/draft`` is strictly read-only. An analyst requests a cycle
with ``POST /api/autonomy/draft``; that route requires write authority and a
custom action header so browser form/prefetch traffic cannot initiate external
LLM spend. The client then polls GET until the durable worker completes.

Change-driven, never schedule-driven: a cycle is enqueued only when (a) no
cycle is already non-terminal (single-flight — a concurrent POST serves the latest
draft instead of double-enqueueing), AND (b) there is no ``complete`` draft, OR
the latest is stale. The cycle's own Sentinel
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

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from engine import locks, pipeline
from identity import CallerIdentity, get_identity, get_write_identity

logger = logging.getLogger("caos.autonomy_route")

router = APIRouter()

# Enqueue a cycle at most this often. The cycle's Sentinel handles real
# change-detection; this also bounds external spend when analysts revisit pages.
_STALE_AFTER = timedelta(hours=1)
_CYCLE_LOCK_KEY = locks.key_from_str("autonomy-cycle-enqueue")
_ACTION_HEADER = "autonomy-refresh"


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


async def _latest_draft_envelope(db: AsyncSession) -> dict:
    draft = await pipeline.latest_draft(db)
    refreshing = await pipeline.latest_running(db) is not None
    if draft is None:
        return {
            **_empty_draft("autonomy cycle not yet available"),
            "refreshing": refreshing,
        }
    return {**draft, "refreshing": refreshing}


@router.get("/draft")
async def get_autonomy_draft(
    db: AsyncSession = Depends(get_db, scope="function"),
    _caller: CallerIdentity = Depends(get_identity),
):
    """Return the latest draft without creating work or mutating state."""
    try:
        return await _latest_draft_envelope(db)
    except Exception:  # noqa: BLE001 — fault-isolated: never 500 the page
        logger.exception("autonomy read failed — returning empty draft")
        return _empty_draft()


@router.post("/draft")
async def refresh_autonomy_draft(
    request: Request,
    db: AsyncSession = Depends(get_db, scope="function"),
    _caller: CallerIdentity = Depends(get_write_identity),
    action: str = Header(default="", alias="X-CAOS-Action"),
):
    """Request a stale/missing autonomy refresh and return the current envelope."""
    if action != _ACTION_HEADER:
        raise HTTPException(403, "Missing or invalid autonomy action header.")
    try:
        # The advisory lock guards the single-flight decision+write only; the
        # continuous executor owns the durable queued row after commit.
        async with locks.advisory_lock(db, _CYCLE_LOCK_KEY) as acquired:
            if acquired:
                running = await pipeline.latest_running(db)
                if running is None:
                    complete = await pipeline.latest_complete(db)
                    if complete is None or _is_stale(complete):
                        prior = complete.current_fingerprints if complete else None
                        job_id = await pipeline.enqueue_cycle(db, prior_fingerprints=prior)
                        executor = getattr(getattr(request, "app", None), "state", None)
                        pipeline_executor = getattr(executor, "pipeline_executor", None)
                        if pipeline_executor is not None:
                            pipeline_executor.enqueue(job_id)
                        else:
                            logger.warning("no pipeline_executor on app.state — job %s queued but not run", job_id)
        return await _latest_draft_envelope(db)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("autonomy refresh failed")
        raise HTTPException(503, "Autonomy refresh is temporarily unavailable.") from exc
