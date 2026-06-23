"""Rate limiter: budget enforcement + bounded memory under key-spray (S6)."""

from __future__ import annotations

import rate_limit


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
