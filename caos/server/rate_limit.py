"""In-process fixed-window rate limiter.

A Databricks App runs as a single process, so an in-memory counter is
sufficient — no Redis. Used by the chat endpoint to keep rapid-fire
questions from burning model quota.
"""

from __future__ import annotations

import time
from collections import defaultdict
from threading import Lock
from typing import DefaultDict, Tuple

_lock = Lock()
_windows: DefaultDict[str, Tuple[float, int]] = defaultdict(lambda: (0.0, 0))

_SWEEP_THRESHOLD = 1024  # keep the map bounded — one entry per caller otherwise


def hit(key: str, *, max_attempts: int, window_seconds: int) -> bool:
    """Record one attempt. True while the caller is inside the budget."""
    now = time.monotonic()
    with _lock:
        if len(_windows) > _SWEEP_THRESHOLD:
            for k in [k for k, (start, _) in _windows.items() if now - start >= window_seconds]:
                del _windows[k]
        start, count = _windows[key]
        if now - start >= window_seconds:
            _windows[key] = (now, 1)
            return True
        _windows[key] = (start, count + 1)
        return count + 1 <= max_attempts
