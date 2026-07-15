"""Out-of-band run execution.

`execute_run_by_id` is the shared core: load the run in its OWN session, run the
slice, and on any error mark the run `failed` (never strand it). Two executors are
defined below — InProcessExecutor (SQLite/local) and QueueWorker (Postgres) — and
`get_executor()` picks one by DB dialect.
"""
from __future__ import annotations

import asyncio
import logging
import socket
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, or_, select, update

from config import get_settings
from database import AsyncSessionLocal, Run, engine
from engine import budget
from engine.runner import execute_run
from executor_base import InProcessTaskExecutor
from notification_service import (
    emit_run_terminal_notification,
    emit_run_terminal_notification_fallback,
)

logger = logging.getLogger("caos.executor")


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _emit_terminal_notification(session, run: Run) -> None:
    """Keep a rendering/helper fault from stranding an otherwise terminal run."""
    try:
        await emit_run_terminal_notification(session, run)
    except Exception:  # noqa: BLE001 — fallback is deliberately minimal
        logger.exception(
            "rich terminal notification failed for run %s; using minimal event",
            run.id,
        )
        await emit_run_terminal_notification_fallback(session, run)


async def execute_run_by_id(
    run_id: str,
    *,
    expected_attempt: int | None = None,
    expected_worker_id: str | None = None,
) -> None:
    """Run one claimed attempt in its own session.

    Queue workers pass the immutable ``(attempts, worker_id)`` claim token. A
    lease-expired worker may finish after another worker has reclaimed the row;
    the token prevents that stale attempt from committing or marking the newer
    attempt failed. Local in-process execution has no claim token because it is
    single-process and has no reclaimer.
    """
    async with AsyncSessionLocal() as session:
        run = await session.get(Run, run_id)
        if run is None:
            logger.warning("execute_run_by_id: run %s vanished", run_id)
            return
        if expected_attempt is not None and (
            run.status != "running"
            or run.attempts != expected_attempt
            or run.worker_id != expected_worker_id
        ):
            logger.warning(
                "discarding stale run claim %s attempt=%s worker=%s",
                run_id,
                expected_attempt,
                expected_worker_id,
            )
            return
        committed = False
        try:
            await execute_run(session, run)
            if expected_attempt is not None:
                # Read scalar columns directly so the identity map cannot hide a
                # lease re-claim committed by another worker.
                with session.no_autoflush:
                    owner = (await session.execute(
                        select(Run.attempts, Run.worker_id).where(Run.id == run_id)
                    )).one_or_none()
                if owner != (expected_attempt, expected_worker_id):
                    await session.rollback()
                    logger.warning(
                        "discarding stale run result %s attempt=%s worker=%s",
                        run_id,
                        expected_attempt,
                        expected_worker_id,
                    )
                    return
            await _emit_terminal_notification(session, run)
            await session.commit()
            committed = True
            await _maybe_export_to_vault(session, run_id)
        except asyncio.CancelledError:
            # Shutdown cancellation. CancelledError is BaseException, not Exception,
            # so the guard below would miss it and strand the run in 'running'
            # (fatal on SQLite/InProcessExecutor, which has no reaper). Mark it
            # failed, then re-raise so the task still cancels cleanly. But a
            # cancellation AFTER the commit — during the best-effort vault export,
            # whose `except Exception` cannot catch CancelledError — must NOT
            # rewrite the already-persisted COMPLETE run to failed.
            if committed:
                logger.warning("run %s cancelled after commit (vault export interrupted) — run unaffected", run_id)
                raise
            logger.warning("run %s cancelled during shutdown — marking failed", run_id)
            await _mark_run_failed(
                session,
                run_id,
                "worker shutdown during execution",
                expected_attempt=expected_attempt,
                expected_worker_id=expected_worker_id,
            )
            raise
        except Exception as e:  # noqa: BLE001 — last-resort guard so a run is never stranded
            logger.exception("run %s failed in executor", run_id)
            await _mark_run_failed(
                session,
                run_id,
                str(e)[:2000],
                expected_attempt=expected_attempt,
                expected_worker_id=expected_worker_id,
            )


async def _maybe_export_to_vault(session, run_id: str) -> None:
    """After a run finishes, mirror it to the Obsidian vault iff auto-export is on
    and the run came out Committee Ready. Best-effort: an export failure is logged
    and swallowed so it can never fail an otherwise-good run."""
    # The whole body is guarded: this runs after the run is committed, so ANY
    # error here (incl. the settings read / gate query) must be swallowed —
    # otherwise it escapes to execute_run_by_id's handler and marks an
    # already-successful run failed. Best-effort: the run is the source of truth.
    try:
        settings = get_settings()
        if not (settings.vault_export_auto and settings.vault_export_dir):
            return
        run = await session.get(Run, run_id)
        if run is None or run.committee_status != "Committee Ready":
            return
        import vault_export

        paths = await vault_export.export_run(session, run_id, settings.vault_export_dir)
        logger.info("run %s exported to vault (%s)", run_id, ", ".join(p.name for p in paths))
    except Exception:  # noqa: BLE001 — export is derived; never fail the run on it
        logger.exception("vault export failed for run %s (run unaffected)", run_id)


async def _mark_run_failed(
    session,
    run_id: str,
    reason: str,
    *,
    expected_attempt: int | None = None,
    expected_worker_id: str | None = None,
) -> None:
    """Roll back and mark a run failed; never raises (last-resort recovery)."""
    try:
        await session.rollback()
        run = (await session.execute(
            select(Run).where(Run.id == run_id).with_for_update()
        )).scalar_one_or_none()
        if run is not None:
            if run.status in {"complete", "failed"}:
                return
            if expected_attempt is not None and (
                run.attempts != expected_attempt
                or run.worker_id != expected_worker_id
            ):
                logger.warning(
                    "stale attempt cannot fail run %s attempt=%s worker=%s",
                    run_id,
                    expected_attempt,
                    expected_worker_id,
                )
                return
            run.status = "failed"
            run.error = reason
            run.lease_expires_at = None
            # H-1: the rollback above discarded the runner's own tokens_used write,
            # so recover this attempt's spend from the active budget contextvar
            # (rehydrated from run.tokens_used at attempt start, so .used is the
            # cumulative total). Persisting it here keeps run_token_budget a true
            # per-run cap across re-claims; max() stays monotonic if unavailable.
            spent = budget.current_budget()
            if spent is not None:
                run.tokens_used = max(run.tokens_used or 0, spent.used)
            await _emit_terminal_notification(session, run)
            await session.commit()
    except Exception:  # noqa: BLE001
        logger.exception("could not mark run %s failed", run_id)


class InProcessExecutor(InProcessTaskExecutor):
    """SQLite/local: one fire-and-forget asyncio task per enqueued run.

    Task references are retained in `_tasks` so the loop can't GC them
    mid-flight; `execute_run_by_id`'s own try/except guarantees the run reaches
    a terminal state even if the task body raises.
    """

    name = "in_process"

    def __init__(self) -> None:
        super().__init__()
        self._sem: asyncio.Semaphore | None = None

    async def start(self) -> None:  # no background loop needed
        self._sem = asyncio.Semaphore(get_settings().caos_run_concurrency)
        # Hard-crash recovery. A SIGKILL/power-loss skips stop()'s mark-failed
        # handler, stranding a run in 'running' (or 'queued') forever — SQLite
        # has no reaper (the Postgres QueueWorker self-heals via _reap_orphans).
        # start() runs in lifespan before any request is served and this executor
        # has no in-flight tasks yet, so every non-terminal run is provably such a
        # strand. Sweep them so they don't zombie.
        # ponytail: sweep-on-boot, not a heartbeat — sound for one process.
        async with AsyncSessionLocal() as session:
            stranded = list((await session.execute(
                select(Run).where(Run.status.in_(("running", "queued")))
            )).scalars().all())
            for run in stranded:
                run.status = "failed"
                run.error = "abandoned (process restart)"
                run.lease_expires_at = None
                await _emit_terminal_notification(session, run)
            await session.commit()

    async def enqueue(self, run_id: str) -> None:
        async def _run_with_sem():
            assert self._sem is not None
            async with self._sem:
                await execute_run_by_id(run_id)
        self._spawn(_run_with_sem())


class QueueWorker:
    """Postgres: claim queued (and truly-orphaned) runs via FOR UPDATE SKIP
    LOCKED, execute up to `concurrency` at once, and reap attempts-exhausted
    orphans. Lease is a generous fixed window (no heartbeat); re-claim fires
    only on genuine worker death.

        queued ──claim──► running ──execute_run──► complete / failed
        running & lease<now & attempts<MAX ──re-claim──► running
        running & lease<now & attempts>=MAX ──reap──► failed

    Multi-worker claim safety relies on Postgres row locking (FOR UPDATE SKIP
    LOCKED). On the SQLite dev default that clause is a no-op, so concurrent
    workers would NOT be safe there — dev is single-process, which is why it's
    fine. Do not run multiple workers against SQLite.
    """

    name = "queue_worker"

    def __init__(self) -> None:
        self._settings = get_settings()
        self._worker_id = f"{socket.gethostname()}:{id(self)}"
        self._inflight: set[asyncio.Task] = set()
        # Run ids currently executing on THIS worker. _claim_one excludes them:
        # a run whose wall clock legitimately exceeds the lease must not be
        # re-claimed by its own worker and executed twice concurrently (double
        # LLM spend, then a uq_run_module IntegrityError flipping the first
        # attempt's committed result to 'failed').
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
            # Await so each task's cancellation handler (mark-failed) commits
            # before the event loop tears down.
            await asyncio.gather(*tasks, return_exceptions=True)

    async def enqueue(self, run_id: str) -> None:
        # The row already exists as 'queued'; the loop will pick it up. No-op.
        return None

    async def _reap_orphans(self) -> None:
        async with AsyncSessionLocal() as s:
            orphans = list((await s.execute(
                select(Run).where(
                    Run.status == "running",
                    Run.lease_expires_at < _now(),
                    Run.attempts >= self._settings.caos_run_max_attempts,
                )
            )).scalars().all())
            for run in orphans:
                run.status = "failed"
                run.error = "abandoned after max attempts"
                run.lease_expires_at = None
                await _emit_terminal_notification(s, run)
            await s.commit()

    async def _heartbeat(self) -> None:
        """Extend the lease on this worker's live runs each poll tick, so a run
        whose wall clock legitimately exceeds the fixed lease window is not
        re-claimed (by any worker) and executed twice concurrently."""
        if not self._inflight_ids:
            return
        lease = timedelta(seconds=self._settings.caos_run_lease_seconds)
        async with AsyncSessionLocal() as s:
            await s.execute(
                update(Run)
                .where(
                    Run.id.in_(tuple(self._inflight_ids)),
                    Run.worker_id == self._worker_id,
                    Run.status == "running",
                )
                .values(lease_expires_at=_now() + lease)
            )
            await s.commit()

    async def _claim_one(self) -> tuple[str, int, str] | None:
        max_attempts = self._settings.caos_run_max_attempts
        lease = timedelta(seconds=self._settings.caos_run_lease_seconds)
        async with AsyncSessionLocal() as s:
            async with s.begin():
                stmt = (
                    select(Run)
                    .where(
                        or_(
                            Run.status == "queued",
                            and_(
                                Run.status == "running",
                                Run.lease_expires_at < _now(),
                                Run.attempts < max_attempts,
                            ),
                        )
                    )
                    .order_by(Run.created_at)
                    .limit(1)
                    .with_for_update(skip_locked=True)
                )
                if self._inflight_ids:
                    # Never re-claim a run this worker is still executing.
                    stmt = stmt.where(Run.id.notin_(tuple(self._inflight_ids)))
                row = (await s.execute(stmt)).scalar_one_or_none()
                if row is None:
                    return None
                row.status = "running"
                row.attempts += 1
                row.claimed_at = _now()
                row.lease_expires_at = _now() + lease
                row.worker_id = self._worker_id
                return row.id, row.attempts, self._worker_id

    async def _run_loop(self) -> None:
        poll = self._settings.caos_run_poll_seconds
        cap = self._settings.caos_run_concurrency
        fails = 0
        while not self._stop.is_set():
            try:
                await self._heartbeat()
                await self._reap_orphans()
                while len(self._inflight) < cap:
                    claim = await self._claim_one()
                    if claim is None:
                        break
                    run_id, attempt, worker_id = claim
                    task = asyncio.create_task(execute_run_by_id(
                        run_id,
                        expected_attempt=attempt,
                        expected_worker_id=worker_id,
                    ))
                    self._inflight.add(task)
                    self._inflight_ids.add(run_id)
                    task.add_done_callback(self._inflight.discard)
                    task.add_done_callback(
                        lambda _t, rid=run_id: self._inflight_ids.discard(rid)
                    )
                fails = 0
            except Exception:  # noqa: BLE001 — never let the loop die
                fails += 1
                # A loop that throws every tick (e.g. DB unreachable) is alive but
                # silently idle — queued runs never execute. Escalate to error so a
                # stalled queue is distinguishable from an empty one (no APM here). C6.
                if fails >= 3:
                    logger.error(
                        "worker loop failing repeatedly (%d consecutive ticks) — queue stalled", fails
                    )
                else:
                    logger.exception("worker loop tick failed")
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=poll)
            except asyncio.TimeoutError:
                pass


def get_executor():
    """Pick the executor by DB dialect: in-process on SQLite, queue on Postgres."""
    if engine.dialect.name == "postgresql":
        return QueueWorker()
    return InProcessExecutor()
