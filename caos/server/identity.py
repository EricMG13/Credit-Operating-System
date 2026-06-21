"""Caller identity from the edge auth proxy's forwarded headers.

The edge auth proxy — oauth2-proxy + Caddy on the self-hosted stack (the
Databricks Apps platform previously) — authenticates every request and forwards
the verified identity to the app:

  X-Forwarded-User                user id
  X-Forwarded-Email               email
  X-Forwarded-Preferred-Username  display username

There is no in-app login. Outside a deployed context (local dev) the headers are
absent and a stable local analyst identity is returned so the UI works
unchanged. A header-less request in any deployed context means the edge was
bypassed, so it is rejected (401) — enforced when ENVIRONMENT is "production"
(the self-hosted stack bakes this in) or the legacy DATABRICKS_APP_PORT is set
(a vestigial belt-and-suspenders trigger from the old Databricks path).

Trusting these headers is safe only because the edge proxy is the sole network
path to the app; see caos/docs/SECURITY.md §1. As defense-in-depth, set
EDGE_PROXY_SECRET (and have the proxy inject X-Edge-Authorization) to *enforce*
that every deployed-context request actually came through the proxy, rather than
relying on network isolation alone.
"""

from __future__ import annotations

import hmac
import os
from dataclasses import dataclass

from fastapi import HTTPException, Request

from config import get_settings


@dataclass(frozen=True)
class CallerIdentity:
    id: str
    email: str
    full_name: str
    role: str = "analyst"
    is_active: bool = True


_LOCAL_DEV = CallerIdentity(
    id="local-dev", email="analyst@local.dev", full_name="Local Analyst"
)

# Legacy: the old Databricks Apps platform injected DATABRICKS_APP_PORT. Kept as
# a belt-and-suspenders "deployed context" signal so the gate still fails closed
# even if ENVIRONMENT was left unset; the self-hosted stack sets
# ENVIRONMENT=production instead.
_LEGACY_PLATFORM_PORT = os.environ.get("DATABRICKS_APP_PORT") is not None


def get_identity(request: Request) -> CallerIdentity:
    """FastAPI dependency: resolve the caller from forwarded headers."""
    settings = get_settings()
    deployed = settings.environment == "production" or _LEGACY_PLATFORM_PORT

    # Defense-in-depth: the X-Forwarded-* identity below is only trustworthy
    # because the edge proxy is the sole network path to the app. When an edge
    # secret is configured, require it on every deployed-context request — this
    # proves the request actually transited the proxy and didn't reach the app
    # port directly with forged X-Forwarded-* headers. Constant-time compare.
    # Empty secret = enforcement off (main.py logs a startup warning in prod);
    # identity then rests on network isolation alone. See SECURITY.md §1.
    if deployed and settings.edge_proxy_secret:
        presented = request.headers.get("x-edge-authorization", "")
        # Compare as bytes: header values decode latin-1, so a non-ASCII presented
        # secret would make compare_digest raise TypeError on str (→ 500 not 401).
        if not hmac.compare_digest(
            presented.encode("utf-8", "ignore"), settings.edge_proxy_secret.encode("utf-8")
        ):
            raise HTTPException(401, "Request did not carry a valid edge credential.")

    email = request.headers.get("x-forwarded-email")
    user = request.headers.get("x-forwarded-user")
    if not email and not user:
        # Fail closed: reject a header-less (un-proxied) request in any deployed
        # context; fall back to the dev identity only for a genuine local run.
        if deployed:
            raise HTTPException(
                401, "No forwarded identity — request did not pass the auth proxy / edge."
            )
        return _LOCAL_DEV
    username = request.headers.get("x-forwarded-preferred-username") or email or user
    return CallerIdentity(
        id=user or email or "unknown",
        email=email or (user or "unknown"),
        full_name=username or "Authenticated User",
    )
