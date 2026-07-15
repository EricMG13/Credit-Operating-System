"""Postgres advisory locks — cross-worker single-flight primitives (Phase 3).

Replaces the module-level ``_regen_inflight`` flag (single-worker) with a Postgres
advisory lock so only one worker regenerates / runs a pipeline stage at a time
across a multi-worker deploy. No Redis, no new dependency — the lock lives inside
the existing Postgres transaction boundary (the same posture the codebase uses
for pgvector-over-a-separate-vector-DB: a second datastore means dual-write
consistency bugs; one store inside the transaction is strictly safer).

Dialect-split: the Postgres path uses ``pg_try_advisory_lock`` /
``pg_advisory_unlock`` (session-level — auto-released when the DB connection
closes, so a crashed worker cannot strand the lock; the next worker's try
succeeds). The SQLite path (the test suite's dialect) falls back to a
module-level held-key set — correct under the one-process test assumption, the
same posture as the flag it replaces. The fallback is sync between the check and
the add (no ``await``), so two coroutines cannot interleave a double-acquire.

``advisory_lock(db, key)`` is an async context manager that acquires on enter and
releases on exit (including on exception). Callers that only want the try-acquire
semantics (skip if another worker holds it) call ``try_advisory_lock`` directly.
"""

from __future__ import annotations

import hashlib
import logging
import sys
from contextlib import asynccontextmanager
from typing import AsyncIterator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from database import engine as db_engine

logger = logging.getLogger("caos.engine.locks")

# SQLite fallback: the set of held keys in this process. Sync between check and
# add (no await) so two coroutines can't interleave a double-acquire. Correct
# under the single-process test assumption; the Postgres path is the real
# cross-worker lock.
_sqlite_held: set = set()


def key_from_str(label: str) -> int:
    """Stable non-negative int64 key for an advisory lock, derived from a label.
    Postgres advisory-lock keys are int64; a content hash keeps distinct lanes
    from colliding while staying stable across processes (so two workers hashing
    "desk-brief-regen" derive the same key)."""
    # Not a security hash — SHA-1 only maps a label to a stable int64 lock key;
    # usedforsecurity=False documents that and clears the SAST weak-hash flag.
    h = hashlib.sha1(label.encode("utf-8"), usedforsecurity=False).digest()
    # Mask to 63 bits so the int is non-negative even on drivers that sign-extend.
    return int.from_bytes(h[:8], "big", signed=False) & ((1 << 63) - 1)


def _is_postgres() -> bool:
    return db_engine.dialect.name == "postgresql"


async def try_advisory_lock(db: AsyncSession, key: int) -> bool:
    """Acquire a session-level advisory lock without blocking. True if this
    session now holds it; False if another session/worker already does (the
    single-flight skip). On SQLite, the module-level set provides the same
    semantics within one process."""
    if _is_postgres():
        row = (await db.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": key})).scalar()
        return bool(row)
    if key in _sqlite_held:
        return False
    _sqlite_held.add(key)
    return True


async def release_advisory_lock(db: AsyncSession, key: int) -> None:
    """Release a session-level advisory lock. No-op if not held (a crashed-task
    path may release without having acquired). On SQLite, removes from the
    module-level set."""
    if _is_postgres():
        await db.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": key})
    else:
        _sqlite_held.discard(key)


def _sqlite_reset() -> None:
    """Clear the SQLite fallback's held set. Test isolation only — the held set is
    process-global so a prior test's un-released lock would block the next."""
    _sqlite_held.clear()


@asynccontextmanager
async def advisory_lock(db: AsyncSession, key: int) -> AsyncIterator[bool]:
    """Acquire an advisory lock for a critical section; release on exit (even on
    exception). Yields ``True`` if the lock was acquired, ``False`` if another
    worker holds it (the caller may skip the section). The release is best-effort
    on the exception path — a crashed session auto-releases the Postgres lock."""
    acquired = await try_advisory_lock(db, key)
    try:
        yield acquired
    finally:
        if acquired:
            body_error_active = sys.exc_info()[0] is not None
            try:
                await release_advisory_lock(db, key)
            except Exception:  # noqa: BLE001 — invalidate the physical lock-owning session
                release_error = sys.exc_info()[1]
                logger.exception("Failed to release PostgreSQL advisory lock key=%s", key)
                if _is_postgres():
                    try:
                        connection = await db.connection()
                        await connection.invalidate()
                    except Exception:  # noqa: BLE001 — retain the original unlock error
                        logger.exception(
                            "Failed to invalidate connection after advisory unlock failure key=%s",
                            key,
                        )
                # Never replace an exception already leaving the protected body.
                # With a successful body, expose the release failure after the
                # tainted physical connection has been invalidated.
                if not body_error_active and release_error is not None:
                    raise release_error
