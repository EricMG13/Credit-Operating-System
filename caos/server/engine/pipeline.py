"""Pipeline-run persistence — the durable audit trail + shared prior for the
autonomous cycle (Phase 3 remainder).

``routes/autonomy`` calls ``persist_cycle`` after each successful cycle to write a
``pipeline_runs`` row (the committee-defensibility audit record: when the cycle
ran, what changed, what the model drafted — UNRATIFIED). ``latest_prior`` reads
the most recent ``complete`` row's ``current_fingerprints`` so a cold start (no
in-memory prior) or a second worker resumes from the last cycle rather than
re-doing a full scan — the multi-worker shared prior that replaces the route's
module-level ``_LAST_FINGERPRINTS`` on cold start. ``latest_draft`` serves the
last completed draft when the cycle advisory lock is held by another worker (the
"serve the prior while regenerating" pattern).

No LLM, no Redis — pure SQL on the existing Postgres / SQLite. The in-memory
``_LAST_FINGERPRINTS`` stays as a warm-worker fast path; the table is the durable
source of truth, read on cold start. This is not dual-write inconsistency: the
table is write-only-audit + read-on-cold-start; the in-memory cache is the
runtime prior.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import PipelineRun

logger = logging.getLogger("caos.pipeline")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def persist_cycle(
    db: AsyncSession,
    result: dict,
    *,
    prior_fingerprints: Optional[dict] = None,
    worker_id: Optional[str] = None,
) -> str:
    """Write one ``pipeline_runs`` row for a completed autonomous cycle. Returns
    the row id. ``result`` is the dict ``autonomy.run_cycle`` returns
    (``draft`` / ``current_fingerprints`` / ``n_changed`` / ``n_anomalies`` /
    ``n_claims``). Commits on the caller's session."""
    draft = result.get("draft") or {}
    summary = draft.get("summary") or {}
    row = PipelineRun(
        kind="autonomy-cycle",
        status="complete",
        prior_fingerprints=prior_fingerprints,
        current_fingerprints=result.get("current_fingerprints") or {},
        draft=draft,
        summary={
            "n_changed": result.get("n_changed", 0),
            "n_anomalies": result.get("n_anomalies", 0),
            "n_claims": result.get("n_claims", 0),
            "n_sections": summary.get("n_sections", 0),
            "n_deterministic_bullets": summary.get("n_deterministic_bullets", 0),
        },
        worker_id=worker_id,
        completed_at=_utcnow(),
    )
    db.add(row)
    await db.commit()
    return row.id


async def latest_prior(db: AsyncSession) -> Optional[dict]:
    """The most recent ``complete`` cycle's ``current_fingerprints`` — the shared
    prior for a cold start / second worker. None when no cycle has completed."""
    row = (await db.execute(
        select(PipelineRun)
        .where(PipelineRun.kind == "autonomy-cycle", PipelineRun.status == "complete")
        .order_by(PipelineRun.created_at.desc())
        .limit(1)
    )).scalars().first()
    return row.current_fingerprints if row else None


async def latest_draft(db: AsyncSession) -> Optional[dict]:
    """The most recent ``complete`` cycle's draft — served when the cycle
    advisory lock is held by another worker (serve-prior-while-regenerating)."""
    row = (await db.execute(
        select(PipelineRun)
        .where(PipelineRun.kind == "autonomy-cycle", PipelineRun.status == "complete")
        .order_by(PipelineRun.created_at.desc())
        .limit(1)
    )).scalars().first()
    return row.draft if row else None


async def latest_complete(db: AsyncSession) -> Optional[PipelineRun]:
    """The most recent ``complete`` cycle row (for staleness + the prior-fingerprint
    source). None when no cycle has completed."""
    return (await db.execute(
        select(PipelineRun)
        .where(PipelineRun.kind == "autonomy-cycle", PipelineRun.status == "complete")
        .order_by(PipelineRun.created_at.desc())
        .limit(1)
    )).scalars().first()


async def latest_running(db: AsyncSession) -> Optional[PipelineRun]:
    """The most recent non-terminal cycle row — the single-flight signal.

    ``queued`` is included because a durable job waiting for a worker is already
    in progress from the caller's perspective. Treating only ``running`` as live
    would let concurrent POSTs enqueue duplicates before the poller claims the
    first row.
    """
    return (await db.execute(
        select(PipelineRun)
        .where(
            PipelineRun.kind == "autonomy-cycle",
            PipelineRun.status.in_(("queued", "running")),
        )
        .order_by(PipelineRun.created_at.desc())
        .limit(1)
    )).scalars().first()


async def enqueue_cycle(db: AsyncSession,
                        prior_fingerprints: Optional[dict] = None) -> str:
    """Create one durable ``queued`` autonomy job and return its row id.

    ``PipelineExecutor`` claims it via ``SELECT FOR UPDATE SKIP LOCKED`` and
    transitions it to ``running`` with a lease. A hard crash leaves a reclaimable
    expired lease rather than an in-memory task that can disappear forever.
    ``prior_fingerprints`` is the snapshot the cycle will diff against
    (``None`` means a full scan).
    """
    row = PipelineRun(
        kind="autonomy-cycle",
        status="queued",
        prior_fingerprints=prior_fingerprints,
        current_fingerprints={},
        draft={},
        summary={},
    )
    db.add(row)
    await db.commit()
    return row.id
