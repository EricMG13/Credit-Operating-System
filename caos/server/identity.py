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
the edge was bypassed, so it is rejected (401) — enforced in any deployed context,
i.e. whenever ENVIRONMENT is anything other than "development" (so a typo/unset
fails closed; config.is_deployed).

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
import time
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from access_log import sanitize_field
from config import get_settings, is_deployed
from database import Analyst, get_db

# In-app login: the analyst profile id+name+token_version are signed into this
# cookie. Resolution is mostly self-contained (HMAC + exp), plus one indexed
# Analyst lookup to enforce session revocation (token_version). See routes/auth.py.
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
    """Verify and decode a token from make_session_token; None if tampered, garbage,
    or expired.

    The browser cookie's max-age is only a client-side hint — a copied raw token
    value would otherwise be valid until SESSION_SECRET rotates. So an `exp` claim
    (epoch seconds, set at mint) is enforced here server-side: a token past its exp
    is rejected regardless of the cookie, and a token WITHOUT an exp (pre-#32
    legacy) is treated as expired — see the exp check below.
    """
    try:
        raw, sig = token.rsplit(".", 1)
    except ValueError:
        return None
    # Compare as bytes: the signature segment is attacker-controlled cookie data, so a
    # non-ASCII char would make compare_digest raise TypeError on str (→ 500, not a
    # clean reject). Same fix as the edge-credential compare in get_identity. (run-2 #B6)
    if not hmac.compare_digest(sig.encode("utf-8", "ignore"), _sig(raw, secret).encode("utf-8")):
        return None
    try:
        padded = raw + "=" * (-len(raw) % 4)
        data = json.loads(base64.urlsafe_b64decode(padded))
    except (ValueError, json.JSONDecodeError):
        return None
    # exp is mandatory (#32): every cookie minted since the claim shipped carries
    # one (auth._set_cookie), so a token without exp predates it — treat a missing
    # exp as expired rather than let a captured pre-exp cookie live until
    # SESSION_SECRET rotates.
    exp = data.get("exp")
    if exp is None or time.time() > exp:
        return None
    return data


_LOCAL_DEV = CallerIdentity(
    id="local-dev", email="analyst@local.dev", full_name="Local Analyst", source="local"
)

# The deployed-context predicate lives in config.is_deployed: any ENVIRONMENT other
# than "development" (typo/unset fail closed) counts as deployed.


async def get_identity(
    request: Request, db: AsyncSession = Depends(get_db)
) -> CallerIdentity:
    """FastAPI dependency: resolve the caller.

    Precedence: an in-app analyst-profile cookie (signed) wins everywhere; else
    the edge proxy's forwarded identity; else the local-dev fallback (or 401 in a
    deployed context). The profile is the app-level identity stamped on runs; the
    edge proxy still governs network access.

    A valid profile cookie now also costs one indexed Analyst lookup, to enforce
    session revocation (token_version) — see the cookie branch below.
    """
    settings = get_settings()
    # Fail closed: ANY environment other than "development" (typo/unset included)
    # counts as deployed. (config.is_deployed)
    deployed = is_deployed(settings)

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
            ident_id = sanitize_field(data["id"])
            # Session revocation: the cookie carries the analyst's token_version from
            # mint; logout bumps the row (routes/auth.py), so a stale or revoked
            # token no longer matches and the cookie is ignored (fall through). A
            # missing row — e.g. a GDPR-erased analyst — fails the check too. Legacy
            # tokens with no "v" default to 0, matching a never-logged-out row.
            analyst = await db.get(Analyst, ident_id)
            if analyst is not None and analyst.token_version == data.get("v", 0):
                cookie_email = sanitize_field(data.get("email", ""))
                # Principal cross-check: the cookie is minted bound to the user's
                # own SSO-verified email (routes/auth.py). If THIS request's SSO
                # principal (x-forwarded-email) names a different user, the cookie
                # is stale or cross-user (the 30-day app cookie outlives the 7-day
                # oauth2-proxy session), so ignore it and fall through to the proxy
                # identity rather than acting as the cookie's principal. Same-user
                # always matches; dev/un-proxied has no forwarded email so the
                # cookie stands. (#22)
                fwd_email = request.headers.get("x-forwarded-email")
                if not (deployed and fwd_email and cookie_email.lower() != fwd_email.strip().lower()):
                    return CallerIdentity(
                        id=ident_id,
                        email=cookie_email,
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
