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

import re
from datetime import datetime, timezone
from typing import Mapping, Optional

# Identity/header values are attacker-influenced (a forged X-Forwarded-Email/-For
# off-proxy, an SSO email). Strip C0 control chars (incl. CR/LF) + DEL and cap
# length so they can't forge log lines (the plain-text exception logger in
# main.py interpolates these) or smuggle control bytes into stored audit fields.
# C1/Unicode line separators are left intact — none act as a newline to the
# plain-text log / docker logs / grep-sed pipeline that consumes these. S7.
_CTRL = re.compile(r"[\x00-\x1f\x7f]")


def sanitize_field(value: str, *, limit: int = 256) -> str:
    return _CTRL.sub("", value)[:limit]


def principal(headers: Mapping[str, str]) -> str:
    """Caller id — mirrors identity.py's forwarded-header precedence.

    Local dev carries no X-Forwarded-* identity, so it maps to "local-dev"
    (matching identity._LOCAL_DEV.id) rather than an empty entity.
    """
    return sanitize_field(
        headers.get("x-forwarded-email")
        or headers.get("x-forwarded-user")
        or "local-dev"
    )


def client_source(headers: Mapping[str, str], client_host: Optional[str]) -> str:
    """Real client IP — the LAST hop of X-Forwarded-For, falling back to the
    socket peer when un-proxied.

    Caddy (the sole edge/reverse-proxy hop — see deploy/Caddyfile) APPENDS the
    immediate peer's IP to any inbound X-Forwarded-For rather than replacing
    it; oauth2-proxy forwards the header unchanged. An external caller hitting
    Caddy directly can freely prepend an arbitrary value, so trusting the
    FIRST hop (the prior behavior) let an attacker rotate a fake IP per
    request to defeat the per-source login throttle (auth.py) and forge this
    audit log's source field. The LAST hop is always Caddy's own honest
    append — the only hop this deployment actually controls — so trust that
    one and nothing an external caller supplied before it."""
    xff = headers.get("x-forwarded-for")
    if xff:
        return sanitize_field(xff.split(",")[-1].strip())
    return sanitize_field(client_host or "?")


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
