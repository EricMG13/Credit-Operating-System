"""Caller identity from Databricks Apps forwarded headers.

Databricks Apps authenticates every request at the platform edge (workspace
OAuth) and forwards the verified identity to the app:

  X-Forwarded-User                user id
  X-Forwarded-Email               email
  X-Forwarded-Preferred-Username  display username

There is no in-app login. Outside Databricks (local dev) the headers are
absent and a stable local analyst identity is returned so the UI works
unchanged. In production a header-less request means the platform edge was
bypassed, so it is rejected rather than given the dev identity.
"""

from __future__ import annotations

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


def get_identity(request: Request) -> CallerIdentity:
    """FastAPI dependency: resolve the caller from forwarded headers."""
    email = request.headers.get("x-forwarded-email")
    user = request.headers.get("x-forwarded-user")
    if not email and not user:
        if get_settings().environment == "production":
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
