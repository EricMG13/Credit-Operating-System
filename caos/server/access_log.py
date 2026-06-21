"""Structured per-request access log — the threat-detection app/auth feed.

main.py's `access_log` middleware emits one JSON line per /api request on the
`caos.access` logger. Fields are a superset of the threat_signal_analyzer
events schema ({timestamp, entity, action, volume}); `status` + `source` carry
the auth-brute / data-exfil triage signal. Extract analyzer input with:

    docker compose logs app | grep caos.access | sed 's/.*caos.access[^{]*//' \
      | jq -s 'map({timestamp, entity, action, volume})' > events.json

The helpers here are pure so they unit-test without booting the app.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Mapping, Optional


def principal(headers: Mapping[str, str]) -> str:
    """Caller id — mirrors identity.py's forwarded-header precedence.

    Local dev carries no X-Forwarded-* identity, so it maps to "local-dev"
    (matching identity._LOCAL_DEV.id) rather than an empty entity.
    """
    return (
        headers.get("x-forwarded-email")
        or headers.get("x-forwarded-user")
        or "local-dev"
    )


def client_source(headers: Mapping[str, str], client_host: Optional[str]) -> str:
    """Real client IP — first hop of X-Forwarded-For (set by the edge proxy),
    falling back to the socket peer when un-proxied."""
    xff = headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return client_host or "?"


def access_event(
    *,
    method: str,
    path: str,
    status: int,
    entity: str,
    source: str,
    volume: int,
    dur_ms: float,
) -> dict:
    """One access record. `action` = "<METHOD> <path>"; `volume` = response
    bytes (Content-Length) so bulk-pull / exfil shows up as a volume outlier."""
    return {
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "entity": entity,
        "action": f"{method} {path}",
        "status": status,
        "volume": volume,
        "source": source,
        "dur_ms": dur_ms,
    }
