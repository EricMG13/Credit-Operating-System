"""Pipeline executor — durable, multi-worker-safe execution of autonomous cycles.

Mirrors [research_executor.py]: a ``pipeline_runs`` row in ``running`` state is
claimed via ``SELECT FOR UPDATE SKIP LOCKED`` (Postgres) so two workers never
execute the same job; a process restart sweeps stranded ``running`` rows to
``failed`` (a cycle can't be resumed mid-flight — the Analyst LLM pass is not
idempotent-in-progress). No Redis — the claim lives inside the existing Postgres
transaction boundary, the same posture the codebase uses for pgvector and the
advisory locks. SQLite (the test dialect) has no ``SKIP LOCKED``; it falls back
to a module-level claimed-id set, correct under the one-process test assumption.

The route (routes/autonomy.py) currently runs the cycle synchronously; this
executor is the infrastructure for the async path — ``enqueue_cycle`` (in
engine/pipeline.py) writes a ``running`` row, the ``PipelineExecutor`` claims +
runs it off the request thread, and the client polls the ``complete`` draft. The
route wiring (sync → enqueue + poll) is a follow-on that needs the route-contract
sign-off; the claim/execute/sweep mechanism here is additive and inert until then.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, update

from database import AsyncSessionLocal, PipelineRun, engine as db_engine
from engine import autonomy

logger = logging.getLogger("caos.pipeline_executor")

# SQLite fallback: ids claimed in this process. Sync add (no await) so two
# coroutines can't interleave a double-claim. Cleared per test by _sqlite_reset.
_sqlite_claimed: set = set()


def _is_postgres() -> bool:
    return db_engine.dialect.name == "postgresql"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _sqlite_reset() -> None:
    """Clear the SQLite claimed set. Test isolation only."""
    _sqlite_claimed.clear()


async def claim_next_job(db, worker_id: str) -> Optional[PipelineRun]:
    """Claim one ``running`` autonomy-cycle job for this worker. Postgres uses
    ``FOR UPDATE SKIP LOCKED`` so a row another worker is locking is skipped (not
    blocked) — two workers each claim a distinct row, never the same one. SQLite
    falls back to the module-level claimed set. Returns the claimed row (with
    ``worker_id`` set) or None when no runnable job remains. Commits to release
    the Postgres row lock before the job runs (the row is ``running`` + claimed,
    so another worker's ``SKIP LOCKED`` skips it regardless)."""
    if _is_postgres():
        row = (await db.execute(
            select(PipelineRun)
            .where(PipelineRun.kind == "autonomy-cycle", PipelineRun.status == "running")
            .order_by(PipelineRun.created_at)
            .limit(1)
            .with_for_update(skip_locked=True)
        )).scalars().first()
        if row is None:
            return None
        row.worker_id = worker_id
        await db.commit()
        return row
    # SQLite fallback: first running row not already claimed in-process.
    rows = (await db.execute(
        select(PipelineRun)
        .where(PipelineRun.kind == "autonomy-cycle", PipelineRun.status == "running")
        .order_by(PipelineRun.created_at)
    )).scalars().all()
    for r in rows:
        if r.id in _sqlite_claimed:
            continue
        _sqlite_claimed.add(r.id)
        r.worker_id = worker_id
        await db.commit()
        return r
    return None


async def _mark_failed(db, job_id: str, reason: str) -> None:
    """Roll back and mark a job failed; never raises (last-resort recovery)."""
    try:
        await db.rollback()
        job = await db.get(PipelineRun, job_id)
        if job is not None:
            job.status = "failed"
            job.error = reason
            job.completed_at = _utcnow()
            await db.commit()
    except Exception:  # noqa: BLE001
        logger.exception("could not mark pipeline job %s failed", job_id)


async def execute_job(job_id: str) -> None:
    """Run one claimed autonomy-cycle job to ``complete`` (or ``failed``). Opens
    its own session so it outlives the request that enqueued it. The row is
    UPDATED in place (not a new row) so the audit trail is one-row-per-cycle."""
    async with AsyncSessionLocal() as db:
        job = await db.get(PipelineRun, job_id)
        if job is None or job.status != "running":
            return  # vanished, or already complete/failed (e.g. sweep beat us)
        try:
            result = await autonomy.run_cycle(
                db, prior_fingerprints=job.prior_fingerprints or None)
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
            await db.commit()
        except asyncio.CancelledError:
            logger.warning("pipeline job %s cancelled during shutdown — marking failed", job_id)
            await _mark_failed(db, job_id, "worker shutdown during autonomy cycle")
            raise
        except Exception as e:  # noqa: BLE001 — last-resort guard so a job is never stranded
            logger.exception("pipeline job %s failed", job_id)
            await _mark_failed(db, job_id, str(e)[:2000])


class PipelineExecutor:
    """In-process background tasks for autonomy-cycle jobs (mirrors
    ResearchExecutor). ponytail: in-process + sweep-on-boot — sound for one app
    container. The ``claim_next_job`` SKIP LOCKED path is the multi-worker-safe
    upgrade; this in-process executor is the single-worker default that stays."""

    name = "autonomy_in_process"

    def __init__(self) -> None:
        self._tasks: set = set()

    async def start(self) -> None:
        """Hard-crash recovery: a SIGKILL/restart skips stop()'s cancel handler,
        stranding a job in 'running' forever. Runs in lifespan before any request,
        so every 'running' row is provably a strand → sweep to 'failed'."""
        async with AsyncSessionLocal() as db:
            await db.execute(
                update(PipelineRun)
                .where(PipelineRun.status == "running")
                .values(status="failed", error="abandoned (process restart)",
                        completed_at=_utcnow())
            )
            await db.commit()

    async def stop(self) -> None:
        tasks = list(self._tasks)
        for t in tasks:
            t.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        self._tasks.clear()

    def enqueue(self, job_id: str) -> None:
        """Spawn a background task for one job. The task claims-via-execute (the
        row is already 'running' from enqueue_cycle; execute_job guards on
        status=='running' so a swept-to-failed row is a no-op)."""
        task = asyncio.create_task(execute_job(job_id))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
