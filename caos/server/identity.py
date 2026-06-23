"""Caller identity: in-app analyst profile, layered on the edge auth proxy.

Two layers, resolved in this order (after the edge-origin check):
  1. In-app profile — a signed `caos_analyst` cookie minted by the code-gated
     login (routes/auth.py). This is the app-level identity: initials in the UI,
     stamped on Run.analyst_id. Behind SSO the profile is bound to the verified
     X-Forwarded-Email, so it can only name the user's own profile.
  2. Edge proxy — oauth2-proxy + Caddy (Google Workspace OIDC) authenticates
     every request and forwards the verified identity:
       X-Forwarded-User / -Email / -Preferred-Username
     Used when no profile cookie is present, and always as the security principal
     in the access log (access_log.py).

The edge proxy is still the network gate (the app publishes no port; only the
proxy can reach it — docker-compose.yml). Outside a deployed context (local dev)
the headers are absent and a stable local analyst identity is returned so the UI
works unchanged. A header-less, cookie-less request in any deployed context means
the edge was bypassed, so it is rejected (401) — enforced when ENVIRONMENT is
"production" or the legacy DATABRICKS_APP_PORT is set.

Trusting these headers is safe only because the edge proxy is the sole network
path to the app; see caos/docs/SECURITY.md §1. As defense-in-depth, set
EDGE_PROXY_SECRET (and have the proxy inject X-Edge-Authorization) to *enforce*
that every deployed-context request actually came through the proxy, rather than
relying on network isolation alone.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
from dataclasses import dataclass

from fastapi import HTTPException, Request

from access_log import sanitize_field
from config import get_settings

# In-app login: the analyst profile id+name are signed into this cookie so the
# identity is self-contained (no per-request DB lookup). See routes/auth.py.
COOKIE_NAME = "caos_analyst"


@dataclass(frozen=True)
class CallerIdentity:
    id: str
    email: str
    full_name: str
    role: str = "analyst"
    is_active: bool = True
    # Where the identity came from: "profile" (in-app login), "proxy" (edge SSO),
    # or "local" (dev fallback). The frontend gates the login landing on this.
    source: str = "local"


def _sig(raw: str, secret: str) -> str:
    mac = hmac.new(secret.encode("utf-8"), raw.encode("utf-8"), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(mac).decode("ascii").rstrip("=")


def make_session_token(payload: dict, secret: str) -> str:
    """Sign a small JSON payload into a `<b64>.<hmac>` cookie value (stdlib only)."""
    raw = base64.urlsafe_b64encode(json.dumps(payload).encode("utf-8")).decode("ascii").rstrip("=")
    return f"{raw}.{_sig(raw, secret)}"


def read_session_token(token: str, secret: str) -> dict | None:
    """Verify and decode a token from make_session_token; None if tampered/garbage."""
    try:
        raw, sig = token.rsplit(".", 1)
    except ValueError:
        return None
    if not hmac.compare_digest(sig, _sig(raw, secret)):
        return None
    try:
        padded = raw + "=" * (-len(raw) % 4)
        return json.loads(base64.urlsafe_b64decode(padded))
    except (ValueError, json.JSONDecodeError):
        return None


_LOCAL_DEV = CallerIdentity(
    id="local-dev", email="analyst@local.dev", full_name="Local Analyst", source="local"
)

# Legacy: the old Databricks Apps platform injected DATABRICKS_APP_PORT. Kept as
# a belt-and-suspenders "deployed context" signal so the gate still fails closed
# even if ENVIRONMENT was left unset; the self-hosted stack sets
# ENVIRONMENT=production instead.
_LEGACY_PLATFORM_PORT = os.environ.get("DATABRICKS_APP_PORT") is not None


def get_identity(request: Request) -> CallerIdentity:
    """FastAPI dependency: resolve the caller.

    Precedence: an in-app analyst-profile cookie (signed) wins everywhere; else
    the edge proxy's forwarded identity; else the local-dev fallback (or 401 in a
    deployed context). The profile is the app-level identity stamped on runs; the
    edge proxy still governs network access.
    """
    settings = get_settings()
    deployed = settings.environment == "production" or _LEGACY_PLATFORM_PORT

    # Edge-proxy origin check FIRST — before any identity is resolved — so that a
    # cookie-bearing request must ALSO prove it transited the proxy. (Earlier this
    # sat after the cookie branch, letting a cookie request skip the check.) The
    # X-Forwarded-* identity and the profile cookie are both only trustworthy
    # because the edge proxy is the sole network path to the app; when an edge
    # secret is configured, require it on every deployed-context request, proving
    # the request didn't reach the app port directly. Constant-time compare.
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

    # 1. In-app login: a valid signed profile cookie is the identity. Forgery is
    # gated by SESSION_SECRET (fail-closed in prod, see main.py); the profile is
    # bound to the verified SSO email at creation (routes/auth.py), so the cookie
    # can only ever name the user's own profile.
    token = request.cookies.get(COOKIE_NAME)
    if token:
        data = read_session_token(token, settings.session_secret)
        if data and data.get("id") and data.get("name"):
            # Sanitize before use: caller.email is persisted as Document.uploaded_by
            # and all three fields can reach the plain-text exception logger. S7.
            return CallerIdentity(
                id=sanitize_field(data["id"]),
                email=sanitize_field(data.get("email", "")),
                full_name=sanitize_field(data["name"]),
                source="profile",
            )

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
    # Forwarded headers are attacker-influenced off-proxy; sanitize before they
    # become caller.email (→ Document.uploaded_by) or hit the exception logger. S7.
    return CallerIdentity(
        id=sanitize_field(user or email or "unknown"),
        email=sanitize_field(email or (user or "unknown")),
        full_name=sanitize_field(username or "Authenticated User"),
        source="proxy",
    )
