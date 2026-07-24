"""Browser CSRF guard for mutating API requests.

Fetch Metadata and same-origin Origin/Referer checks reject cross-site browser
traffic. In deployed environments, profile-cookie sessions additionally require
a signed-session-bound double-submit token. Header-less service clients without a
browser session remain supported behind the edge credential.
"""

from __future__ import annotations

import hmac
from urllib.parse import urlsplit

from fastapi import Request

from config import get_settings, is_deployed
from identity import COOKIE_NAME, read_session_token

CSRF_COOKIE_NAME = "caos_csrf"
CSRF_HEADER_NAME = "x-csrf-token"
_MAX_CSRF_VALUE_BYTES = 256
_SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}
_CREDENTIAL_ENTRY_PATHS = {
    "/api/auth/profile",
    "/api/auth/register",
    "/api/auth/login",
    "/api/auth/recover",
}


def _public_authority(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-host", "").split(",", 1)[0].strip()
    return (forwarded or request.headers.get("host", "")).lower()


def _same_authority(value: str, expected: str) -> bool:
    try:
        return urlsplit(value).netloc.lower() == expected
    except ValueError:
        return False


def csrf_rejection(request: Request) -> str | None:
    """Return a rejection reason, or ``None`` when the request is permitted."""
    if request.method.upper() in _SAFE_METHODS or not request.url.path.startswith("/api/"):
        return None

    fetch_site = request.headers.get("sec-fetch-site", "").lower()
    if fetch_site in {"cross-site", "same-site"}:
        return "Cross-site API mutation rejected."

    authority = _public_authority(request)
    origin = request.headers.get("origin")
    if origin and (origin == "null" or not _same_authority(origin, authority)):
        return "Request Origin does not match this application."
    referer = request.headers.get("referer")
    if not origin and referer and not _same_authority(referer, authority):
        return "Request Referer does not match this application."

    settings = get_settings()
    # Credential entry can legitimately replace a stale/other profile session.
    # Fetch Metadata + Origin/Referer still protect these paths; requiring the
    # old session's token would lock a browser out of signing in again.
    if request.url.path in _CREDENTIAL_ENTRY_PATHS:
        return None

    session_token = request.cookies.get(COOKIE_NAME)
    if is_deployed(settings) and session_token:
        session = read_session_token(session_token, settings.session_secret)
        signed = session.get("csrf") if session else None
        cookie = request.cookies.get(CSRF_COOKIE_NAME)
        header = request.headers.get(CSRF_HEADER_NAME)
        # Checked per-name rather than via all(...) over the tuple: the generator
        # form is equivalent at runtime but narrows nothing, so every later
        # len()/encode() below reads as Optional to the type gate.
        if not (
            isinstance(signed, str) and signed
            and isinstance(cookie, str) and cookie
            and isinstance(header, str) and header
        ):
            return "Missing CSRF token."
        if any(
            len(value) > _MAX_CSRF_VALUE_BYTES
            or len(value.encode("utf-8", "ignore")) > _MAX_CSRF_VALUE_BYTES
            for value in (signed, cookie, header)
        ):
            return "Invalid CSRF token."
        if not (
            hmac.compare_digest(signed.encode("utf-8"), cookie.encode("utf-8"))
            and hmac.compare_digest(signed.encode("utf-8"), header.encode("utf-8"))
        ):
            return "Invalid CSRF token."
    return None
