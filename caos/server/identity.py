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
path to the app; see caos/docs/SECURITY.md §1.
"""

from __future__ import annotations

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
    email = request.headers.get("x-forwarded-email")
    user = request.headers.get("x-forwarded-user")
    if not email and not user:
        # Fail closed: reject a header-less (un-proxied) request in any deployed
        # context; fall back to the dev identity only for a genuine local run.
        if get_settings().environment == "production" or _LEGACY_PLATFORM_PORT:
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
