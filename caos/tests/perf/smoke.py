#!/usr/bin/env python3
"""Performance smoke test — single-process baseline (Phase-6 launch gate).

Fires N requests at the deployed stack with C concurrency and asserts p95
latency stays under a threshold. Stdlib only (urllib + ThreadPoolExecutor) —
no locust/k6 to install. This is a baseline sanity check for the single-process
pilot, not a load-characterisation rig.

  python caos/tests/perf/smoke.py --url https://caos.example/api/health
  python caos/tests/perf/smoke.py --selftest   # CI-safe: checks the math only

ponytail: nearest-rank percentile + thread pool; swap for k6/locust if/when the
stack scales out and real load-characterisation matters.
"""
from __future__ import annotations

import argparse
import math
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor


def percentile(samples: list[float], pct: float) -> float:
    """Nearest-rank percentile (well-defined for small N)."""
    if not samples:
        raise ValueError("no samples")
    s = sorted(samples)
    rank = max(1, math.ceil(pct / 100 * len(s)))
    return s[rank - 1]


def _time_one(url: str, timeout: float) -> tuple[float, bool]:
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            r.read()
            ok = r.status < 400
    except Exception:
        ok = False
    return (time.perf_counter() - start) * 1000, ok


def run(url: str, n: int, concurrency: int, p95_ms: float, timeout: float) -> int:
    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        results = list(pool.map(lambda _: _time_one(url, timeout), range(n)))
    lat = [ms for ms, _ in results]
    errors = sum(1 for _, ok in results if not ok)
    p50, p95 = percentile(lat, 50), percentile(lat, 95)
    print(f"{url}\n  n={n} concurrency={concurrency} errors={errors}")
    print(f"  p50={p50:.0f}ms  p95={p95:.0f}ms  (threshold p95<{p95_ms:.0f}ms)")
    if errors:
        print(f"FAIL: {errors} request(s) errored")
        return 1
    if p95 > p95_ms:
        print("FAIL: p95 over threshold")
        return 1
    print("PASS")
    return 0


def _selftest() -> int:
    assert percentile(list(range(1, 101)), 95) == 95
    assert percentile(list(range(1, 101)), 50) == 50
    assert percentile([42], 95) == 42
    print("selftest OK")
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:8000/api/health")
    ap.add_argument("--n", type=int, default=200)
    ap.add_argument("--concurrency", type=int, default=20)
    ap.add_argument("--p95-ms", type=float, default=500.0)
    ap.add_argument("--timeout", type=float, default=10.0)
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    sys.exit(_selftest() if a.selftest else run(a.url, a.n, a.concurrency, a.p95_ms, a.timeout))
