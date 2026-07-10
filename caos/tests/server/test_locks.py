"""Tests for engine/locks.py — the cross-worker single-flight primitives.

The test DB is SQLite, so the SQLite fallback (module-level held-key set) is
exercised directly; a separate test monkeypatches the dialect check to exercise
the Postgres ``pg_try_advisory_lock`` code path with a mock session.
"""

from __future__ import annotations


import pytest

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
