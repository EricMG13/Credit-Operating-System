"""In-process fixed-window rate limiter.

The app runs as a single process (self-hosted Docker, one app container behind
Caddy/oauth2-proxy), so an in-memory counter is sufficient — no Redis. Used by
the chat endpoint to keep rapid-fire questions from burning model quota.

Caveat: the window is per-process. If the deploy is ever scaled to multiple app
replicas, the effective limit multiplies by the replica count (each holds its
own `_windows`); move to a shared store (Redis) before horizontal scale-out.
"""

from __future__ import annotations

import time
from collections import defaultdict
from threading import Lock
from typing import DefaultDict, Tuple

_lock = Lock()
_windows: DefaultDict[str, Tuple[float, int]] = defaultdict(lambda: (0.0, 0))

_SWEEP_THRESHOLD = 1024  # sweep expired windows once the map grows past this
_MAX_ENTRIES = 4096      # hard ceiling so distinct-key spraying can't grow it unbounded


def reset() -> None:
    """Clear all windows. For test isolation — the limiter is process-global."""
    with _lock:
        _windows.clear()


def hit(key: str, *, max_attempts: int, window_seconds: int) -> bool:
    """Record one attempt. True while the caller is inside the budget."""
    now = time.monotonic()
    with _lock:
        if len(_windows) > _SWEEP_THRESHOLD:
            for k in [k for k, (start, _) in _windows.items() if now - start >= window_seconds]:
                del _windows[k]
        if len(_windows) > _MAX_ENTRIES:
            # Still over the ceiling after evicting expired windows → a caller is
            # spraying distinct keys (e.g. spoofed X-Forwarded-For off-proxy).
            # Evict oldest-start entries down to the sweep threshold so memory
            # stays bounded regardless of topology. Bounded downside: an active
            # window may reset early under spray (favours the sprayer slightly),
            # which beats unbounded growth. S6.
            overflow = len(_windows) - _SWEEP_THRESHOLD
            for k, _ in sorted(_windows.items(), key=lambda kv: kv[1][0])[:overflow]:
                del _windows[k]
        start, count = _windows[key]
        if now - start >= window_seconds:
            _windows[key] = (now, 1)
            return True
        _windows[key] = (start, count + 1)
        return count + 1 <= max_attempts
