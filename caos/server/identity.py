"""Caller identity from Databricks Apps forwarded headers.

Databricks Apps authenticates every request at the platform edge (workspace
OAuth) and forwards the verified identity to the app:

  X-Forwarded-User                user id
  X-Forwarded-Email               email
  X-Forwarded-Preferred-Username  display username

There is no in-app login. Outside Databricks (local dev) the headers are
absent and a stable local analyst identity is returned so the UI works
unchanged. A header-less request in any deployed context means the platform
edge was bypassed, so it is rejected (401) — enforced when ENVIRONMENT is
"production" OR DATABRICKS_APP_PORT is set (the platform always injects the
latter), so the gate fails closed on-platform even if ENVIRONMENT is unset.

Trusting these headers is safe only because the edge is the sole network path
to the app; see caos/docs/SECURITY.md §1.
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

# Databricks Apps always injects DATABRICKS_APP_PORT. Treat its presence as a
# deployed context that must enforce identity even if ENVIRONMENT was left unset
# — so the gate fails closed on the platform, not only when env is tagged
# "production".
_UNDER_DATABRICKS = os.environ.get("DATABRICKS_APP_PORT") is not None


def get_identity(request: Request) -> CallerIdentity:
    """FastAPI dependency: resolve the caller from forwarded headers."""
    email = request.headers.get("x-forwarded-email")
    user = request.headers.get("x-forwarded-user")
    if not email and not user:
        # Fail closed: reject a header-less (un-proxied) request in any deployed
        # context; fall back to the dev identity only for a genuine local run.
        if get_settings().environment == "production" or _UNDER_DATABRICKS:
            raise HTTPException(
                401, "No platform identity — request did not pass the Databricks Apps edge."
            )
        return _LOCAL_DEV
    username = request.headers.get("x-forwarded-preferred-username") or email or user
    return CallerIdentity(
        id=user or email or "unknown",
        email=email or (user or "unknown"),
        full_name=username or "Databricks User",
    )
