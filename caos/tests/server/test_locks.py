"""Tests for engine/locks.py — the cross-worker single-flight primitives.

The test DB is SQLite, so the SQLite fallback (module-level held-key set) is
exercised directly; a separate test monkeypatches the dialect check to exercise
the Postgres ``pg_try_advisory_lock`` code path with a mock session.
"""

from __future__ import annotations


import pytest

from conftest import requires_pg
from engine import locks


@pytest.fixture(autouse=True)
def _reset_sqlite_held():
    locks._sqlite_reset()
    yield
    locks._sqlite_reset()


def test_key_from_str_stable_distinct_nonnegative():
    a = locks.key_from_str("desk-brief-regen")
    b = locks.key_from_str("desk-brief-regen")
    c = locks.key_from_str("autonomy-cycle")
    assert a == b  # stable across calls
    assert a != c  # distinct labels collide-resistant
    assert a >= 0 and c >= 0  # non-negative int64 (no sign-extension on drivers)


# ── SQLite fallback (the test-suite dialect) ─────────────────────────────────

@pytest.mark.asyncio
async def test_try_advisory_lock_acquires_then_blocks():
    k = locks.key_from_str("test-single-flight")
    assert await locks.try_advisory_lock(None, k) is True   # first acquire
    assert await locks.try_advisory_lock(None, k) is False  # second → single-flight skip


@pytest.mark.asyncio
async def test_release_then_reacquire():
    k = locks.key_from_str("test-release")
    assert await locks.try_advisory_lock(None, k) is True
    await locks.release_advisory_lock(None, k)
    assert await locks.try_advisory_lock(None, k) is True  # freed → re-acquire


@pytest.mark.asyncio
async def test_release_without_acquire_is_noop():
    # A crashed-task path may release without having acquired — must not raise.
    k = locks.key_from_str("test-noop-release")
    await locks.release_advisory_lock(None, k)  # no error


@pytest.mark.asyncio
async def test_advisory_lock_context_acquires_and_releases():
    k = locks.key_from_str("test-ctx")
    async with locks.advisory_lock(None, k) as acquired:
        assert acquired is True
        # Inside the section, a re-acquire is blocked (single-flight).
        assert await locks.try_advisory_lock(None, k) is False
    # After exit, the lock is released → re-acquire succeeds.
    assert await locks.try_advisory_lock(None, k) is True


@pytest.mark.asyncio
async def test_advisory_lock_releases_on_exception():
    k = locks.key_from_str("test-ctx-exc")
    with pytest.raises(RuntimeError, match="boom"):
        async with locks.advisory_lock(None, k):
            raise RuntimeError("boom")
    # The exception path still released the lock.
    assert await locks.try_advisory_lock(None, k) is True


@pytest.mark.asyncio
async def test_advisory_lock_yields_false_when_already_held():
    k = locks.key_from_str("test-ctx-blocked")
    assert await locks.try_advisory_lock(None, k) is True  # held by us first
    async with locks.advisory_lock(None, k) as acquired:
        assert acquired is False  # another holder → skip signal
    # The context manager must NOT release a lock it did not acquire.
    # The original holder still holds it → re-acquire by the ctx fails.
    assert await locks.try_advisory_lock(None, k) is False
    await locks.release_advisory_lock(None, k)  # cleanup


# ── Postgres code path (dialect monkeypatched + mock session) ────────────────

class _MockSession:
    """Records the raw SQL + params and returns a canned scalar (the lock result)."""
    def __init__(self, lock_results):
        self.calls = []
        self._results = list(lock_results)
        self._idx = 0

    async def execute(self, stmt, params=None):
        sql = str(stmt)
        self.calls.append({"sql": sql, "params": params})
        result = self._results[self._idx] if self._idx < len(self._results) else self._results[-1]
        self._idx += 1

        class _Scalar:
            def scalar(self):
                return result
        return _Scalar()


@pytest.mark.asyncio
async def test_postgres_path_uses_pg_try_advisory_lock(monkeypatch):
    monkeypatch.setattr(locks, "_is_postgres", lambda: True)
    sess = _MockSession([True])  # pg_try_advisory_lock returns true
    k = 12345
    assert await locks.try_advisory_lock(sess, k) is True
    assert "pg_try_advisory_lock" in sess.calls[0]["sql"]
    assert sess.calls[0]["params"] == {"k": k}


@pytest.mark.asyncio
async def test_postgres_path_single_flight_returns_false(monkeypatch):
    monkeypatch.setattr(locks, "_is_postgres", lambda: True)
    sess = _MockSession([False])  # another worker holds it
    assert await locks.try_advisory_lock(sess, 999) is False


@pytest.mark.asyncio
async def test_postgres_release_calls_pg_advisory_unlock(monkeypatch):
    monkeypatch.setattr(locks, "_is_postgres", lambda: True)
    sess = _MockSession([True, True])  # acquire true, then unlock returns true
    k = 777
    await locks.try_advisory_lock(sess, k)
    await locks.release_advisory_lock(sess, k)
    assert "pg_advisory_unlock" in sess.calls[1]["sql"]
    assert sess.calls[1]["params"] == {"k": k}


@pytest.mark.asyncio
async def test_unlock_failure_invalidates_connection_and_propagates(monkeypatch):
    monkeypatch.setattr(locks, "_is_postgres", lambda: True)

    class Connection:
        invalidated = False

        async def invalidate(self):
            self.invalidated = True

    class Session:
        def __init__(self):
            self.connection_object = Connection()
            self.calls = 0

        async def execute(self, _stmt, _params=None):
            self.calls += 1
            if self.calls == 1:
                return type("Result", (), {"scalar": lambda _self: True})()
            raise RuntimeError("unlock failed")

        async def connection(self):
            return self.connection_object

    session = Session()
    with pytest.raises(RuntimeError, match="unlock failed"):
        async with locks.advisory_lock(session, 42) as acquired:
            assert acquired is True
    assert session.connection_object.invalidated is True


@pytest.mark.asyncio
async def test_unlock_failure_does_not_mask_body_exception(monkeypatch):
    monkeypatch.setattr(locks, "_is_postgres", lambda: True)

    class Connection:
        async def invalidate(self):
            pass

    class Session:
        async def execute(self, stmt, _params=None):
            if "pg_try_advisory_lock" in str(stmt):
                return type("Result", (), {"scalar": lambda _self: True})()
            raise RuntimeError("unlock failed")

        async def connection(self):
            return Connection()

    with pytest.raises(ValueError, match="body failed"):
        async with locks.advisory_lock(Session(), 43):
            raise ValueError("body failed")


@pytest.mark.asyncio
async def test_unlock_and_connection_invalidation_failure_preserves_unlock_error(monkeypatch):
    monkeypatch.setattr(locks, "_is_postgres", lambda: True)

    class Connection:
        async def invalidate(self):
            raise RuntimeError("invalidate failed")

    class Session:
        async def execute(self, stmt, _params=None):
            if "pg_try_advisory_lock" in str(stmt):
                return type("Result", (), {"scalar": lambda _self: True})()
            raise ValueError("unlock failed")

        async def connection(self):
            return Connection()

    with pytest.raises(ValueError, match="unlock failed"):
        async with locks.advisory_lock(Session(), 44):
            pass


@pytest.mark.asyncio
async def test_non_postgres_release_failure_is_propagated(monkeypatch):
    async def acquire(_db, _key):
        return True

    async def fail_release(_db, _key):
        raise RuntimeError("release failed")

    monkeypatch.setattr(locks, "try_advisory_lock", acquire)
    monkeypatch.setattr(locks, "release_advisory_lock", fail_release)
    monkeypatch.setattr(locks, "_is_postgres", lambda: False)

    with pytest.raises(RuntimeError, match="release failed"):
        async with locks.advisory_lock(None, 45):
            pass


@requires_pg
@pytest.mark.asyncio
async def test_real_postgres_unlock_failure_invalidates_physical_connection(seeded_db):
    """Terminate the lock-owning backend while the critical section is active.
    The failed unlock must invalidate that physical connection before it can be
    returned to the pool, and PostgreSQL must release the dead session's lock."""
    import asyncio

    from sqlalchemy import event, text

    from database import AsyncSessionLocal, engine

    invalidated = asyncio.Event()

    def on_invalidate(_dbapi_connection, _connection_record, _exception):
        invalidated.set()

    event.listen(engine.sync_engine, "invalidate", on_invalidate)
    key = locks.key_from_str("real-unlock-invalidation")
    try:
        async with AsyncSessionLocal() as owner:
            with pytest.raises(Exception):  # driver-specific disconnect class
                async with locks.advisory_lock(owner, key) as acquired:
                    assert acquired is True
                    pid = (await owner.execute(text("SELECT pg_backend_pid()"))).scalar_one()
                    async with engine.begin() as killer:
                        terminated = (await killer.execute(
                            text("SELECT pg_terminate_backend(:pid)"), {"pid": pid}
                        )).scalar_one()
                    assert terminated is True

        await asyncio.wait_for(invalidated.wait(), timeout=2)
        async with AsyncSessionLocal() as replacement:
            assert await locks.try_advisory_lock(replacement, key) is True
            await locks.release_advisory_lock(replacement, key)
    finally:
        event.remove(engine.sync_engine, "invalidate", on_invalidate)
