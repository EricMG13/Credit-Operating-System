"""
Redis-backed sliding-window rate limiter.

Used by /api/auth/login to slow credential brute-force across all worker
processes (the previous in-memory deque only worked single-process).

Algorithm: fixed-window counter on a key with TTL = window. Resets every
window — simple, atomic via INCR/EXPIRE pipeline, no Lua script needed.
Falls back to an allow-everything stub if Redis is unreachable so the API
stays available during a cache outage (rate limiting is best-effort).
"""

from __future__ import annotations

import structlog
from redis import asyncio as aioredis

from core.config import get_settings

logger = structlog.get_logger()
_settings = get_settings()

_client: aioredis.Redis | None = None


def _get_client() -> aioredis.Redis:
    global _client
    if _client is None:
        _client = aioredis.from_url(
            _settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=1,
            socket_timeout=1,
        )
    return _client


class RateLimitUnavailable(RuntimeError):
    """Raised when fail_open=False and Redis cannot answer."""


async def hit(
    key: str,
    *,
    max_attempts: int,
    window_seconds: int,
    fail_open: bool = True,
) -> bool:
    """
    Record one attempt against `key`. Returns True if the caller is still
    inside the budget; False if the window is exhausted.

    Redis errors: with `fail_open=True` (default — throttling paths) the
    request is allowed so a cache outage cannot lock everyone out. Paths
    where silently skipping the check is unsafe (e.g. webhook replay
    dedup) must pass `fail_open=False`, which raises RateLimitUnavailable
    so the caller can reject and let the sender retry.
    """
    redis = _get_client()
    try:
        async with redis.pipeline(transaction=True) as pipe:
            pipe.incr(key)
            pipe.expire(key, window_seconds)
            count, _ = await pipe.execute()
        return int(count) <= max_attempts
    except Exception as e:
        if not fail_open:
            logger.error("rate_limit Redis error — failing closed", key=key, error=str(e))
            raise RateLimitUnavailable(str(e)) from e
        logger.warning("rate_limit Redis error — allowing request", error=str(e))
        return True
