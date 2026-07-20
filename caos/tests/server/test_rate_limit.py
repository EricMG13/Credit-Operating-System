"""Rate limiter: budget enforcement + bounded memory under key-spray (S6)."""

from __future__ import annotations

import multiprocessing

import pytest

import rate_limit


def _shared_attempts(path: str, attempts: int) -> list[bool]:
    rate_limit._SHARED_PATH = path
    return [
        rate_limit.shared_hit("login:*", max_attempts=10, window_seconds=60)
        for _ in range(attempts)
    ]


def test_budget_enforced():
    rate_limit.reset()
    got = [rate_limit.hit("c", max_attempts=3, window_seconds=60) for _ in range(4)]
    assert got == [True, True, True, False]
    rate_limit.reset()


def test_map_bounded_under_key_spray():
    # Distinct keys (e.g. spoofed X-Forwarded-For) must not grow the map without
    # bound — the hard ceiling evicts oldest down to the sweep threshold. S6.
    rate_limit.reset()
    for i in range(rate_limit._MAX_ENTRIES + 500):
        rate_limit.hit(f"k{i}", max_attempts=5, window_seconds=60)
    assert len(rate_limit._windows) <= rate_limit._MAX_ENTRIES
    rate_limit.reset()


def test_shared_budget_is_one_budget_across_worker_processes(tmp_path, monkeypatch):
    path = str(tmp_path / "rate-limit.sqlite3")
    monkeypatch.setattr(rate_limit, "_SHARED_PATH", path)
    rate_limit.reset()
    context = multiprocessing.get_context("spawn")
    with context.Pool(2) as pool:
        results = pool.starmap(_shared_attempts, [(path, 6), (path, 6)])
    assert sum(value for worker in results for value in worker) == 10
    assert rate_limit.shared_hit("login:*", max_attempts=10, window_seconds=60) is False


def test_shared_store_rejects_symlink(tmp_path, monkeypatch):
    target = tmp_path / "attacker-controlled.sqlite3"
    target.write_bytes(b"")
    path = tmp_path / "rate-limit.sqlite3"
    path.symlink_to(target)
    monkeypatch.setattr(rate_limit, "_SHARED_PATH", str(path))

    with pytest.raises(RuntimeError, match="regular file"):
        rate_limit.shared_hit("login:*", max_attempts=10, window_seconds=60)


def test_shared_store_rejects_permissive_existing_file(tmp_path, monkeypatch):
    path = tmp_path / "rate-limit.sqlite3"
    path.write_bytes(b"")
    path.chmod(0o644)
    monkeypatch.setattr(rate_limit, "_SHARED_PATH", str(path))

    with pytest.raises(RuntimeError, match="mode 0600"):
        rate_limit.shared_hit("login:*", max_attempts=10, window_seconds=60)
