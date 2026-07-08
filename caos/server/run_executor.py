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

logger = logging.getLogger("caos.executor")


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def execute_run_by_id(run_id: str) -> None:
    """Run one run in its own session; mark it failed on any error."""
    async with AsyncSessionLocal() as session:
        run = await session.get(Run, run_id)
        if run is None:
            logger.warning("execute_run_by_id: run %s vanished", run_id)
            return
        try:
            await execute_run(session, run)
            await session.commit()
            await _maybe_export_to_vault(session, run_id)
        except asyncio.CancelledError:
            # Shutdown cancellation. CancelledError is BaseException, not Exception,
            # so the guard below would miss it and strand the run in 'running'
            # (fatal on SQLite/InProcessExecutor, which has no reaper). Mark it
            # failed, then re-raise so the task still cancels cleanly.
            logger.warning("run %s cancelled during shutdown — marking failed", run_id)
            await _mark_run_failed(session, run_id, "worker shutdown during execution")
            raise
        except Exception as e:  # noqa: BLE001 — last-resort guard so a run is never stranded
            logger.exception("run %s failed in executor", run_id)
            await _mark_run_failed(session, run_id, str(e)[:2000])


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


async def _mark_run_failed(session, run_id: str, reason: str) -> None:
    """Roll back and mark a run failed; never raises (last-resort recovery)."""
    try:
        await session.rollback()
        run = await session.get(Run, run_id)
        if run is not None:
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
            await session.commit()
    except Exception:  # noqa: BLE001
        logger.exception("could not mark run %s failed", run_id)


class InProcessExecutor:
    """SQLite/local: one fire-and-forget asyncio task per enqueued run.

    Task references are retained in `_tasks` so the loop can't GC them
    mid-flight; `execute_run_by_id`'s own try/except guarantees the run reaches
    a terminal state even if the task body raises.
    """

    name = "in_process"

    def __init__(self) -> None:
        self._tasks: set[asyncio.Task] = set()
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
            await session.execute(
                update(Run)
                .where(Run.status.in_(("running", "queued")))
                .values(status="failed", error="abandoned (process restart)")
            )
            await session.commit()

    async def stop(self) -> None:
        tasks = list(self._tasks)
        for t in tasks:
            t.cancel()
        if tasks:
            # Await so each task's cancellation handler (mark-failed) commits
            # before the event loop tears down.
            await asyncio.gather(*tasks, return_exceptions=True)
        self._tasks.clear()

    async def enqueue(self, run_id: str) -> None:
        async def _run_with_sem():
            assert self._sem is not None
            async with self._sem:
                await execute_run_by_id(run_id)
        task = asyncio.create_task(_run_with_sem())
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)


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
            await s.execute(
                update(Run)
                .where(
                    Run.status == "running",
                    Run.lease_expires_at < _now(),
                    Run.attempts >= self._settings.caos_run_max_attempts,
                )
                .values(status="failed", error="abandoned after max attempts", lease_expires_at=None)
            )
            await s.commit()

    async def _claim_one(self) -> str | None:
        max_attempts = self._settings.caos_run_max_attempts
        lease = timedelta(seconds=self._settings.caos_run_lease_seconds)
        async with AsyncSessionLocal() as s:
            async with s.begin():
                row = (
                    await s.execute(
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
                ).scalar_one_or_none()
                if row is None:
                    return None
                row.status = "running"
                row.attempts += 1
                row.claimed_at = _now()
                row.lease_expires_at = _now() + lease
                row.worker_id = self._worker_id
                return row.id

    async def _run_loop(self) -> None:
        poll = self._settings.caos_run_poll_seconds
        cap = self._settings.caos_run_concurrency
        fails = 0
        while not self._stop.is_set():
            try:
                await self._reap_orphans()
                while len(self._inflight) < cap:
                    run_id = await self._claim_one()
                    if run_id is None:
                        break
                    task = asyncio.create_task(execute_run_by_id(run_id))
                    self._inflight.add(task)
                    task.add_done_callback(self._inflight.discard)
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
