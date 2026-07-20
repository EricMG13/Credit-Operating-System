"""Cross-site mutation and signed double-submit CSRF enforcement."""

from __future__ import annotations

import time

from starlette.requests import Request

import csrf
from config import Settings
from identity import COOKIE_NAME, make_session_token


def _request(*, headers: dict[str, str] | None = None, cookie: str = "") -> Request:
    raw_headers = [(key.lower().encode(), value.encode()) for key, value in (headers or {}).items()]
    if cookie:
        raw_headers.append((b"cookie", cookie.encode()))
    return Request({
        "type": "http",
        "method": "POST",
        "scheme": "https",
        "path": "/api/runs",
        "raw_path": b"/api/runs",
        "query_string": b"",
        "headers": raw_headers,
        "client": ("127.0.0.1", 1234),
        "server": ("caos.example", 443),
    })


def test_cross_site_fetch_metadata_rejected_in_every_environment(monkeypatch):
    monkeypatch.setattr(
        csrf, "get_settings", lambda: Settings(environment="development")
    )
    request = _request(headers={"host": "caos.example", "sec-fetch-site": "cross-site"})
    assert csrf.csrf_rejection(request) == "Cross-site API mutation rejected."


def test_deployed_profile_session_requires_matching_bound_token(monkeypatch):
    settings = Settings(environment="production", session_secret="test-secret")
    monkeypatch.setattr(csrf, "get_settings", lambda: settings)
    token = make_session_token(
        {"id": "a", "csrf": "bound-token", "exp": int(time.time()) + 60},
        settings.session_secret,
    )
    cookie = f"{COOKIE_NAME}={token}; {csrf.CSRF_COOKIE_NAME}=bound-token"

    missing = _request(headers={"host": "caos.example"}, cookie=cookie)
    assert csrf.csrf_rejection(missing) == "Missing CSRF token."

    valid = _request(
        headers={
            "host": "caos.example",
            "origin": "https://caos.example",
            csrf.CSRF_HEADER_NAME: "bound-token",
        },
        cookie=cookie,
    )
    assert csrf.csrf_rejection(valid) is None

    non_ascii = _request(
        headers={
            "host": "caos.example",
            "origin": "https://caos.example",
            csrf.CSRF_HEADER_NAME: "invalid-é",
        },
        cookie=cookie,
    )
    assert csrf.csrf_rejection(non_ascii) == "Invalid CSRF token."

    oversized = _request(
        headers={
            "host": "caos.example",
            "origin": "https://caos.example",
            csrf.CSRF_HEADER_NAME: "x" * 257,
        },
        cookie=cookie,
    )
    assert csrf.csrf_rejection(oversized) == "Invalid CSRF token."


def test_origin_authority_must_match_even_without_profile_cookie(monkeypatch):
    monkeypatch.setattr(
        csrf, "get_settings", lambda: Settings(environment="development")
    )
    request = _request(
        headers={"host": "caos.example", "origin": "https://evil.example"}
    )
    assert csrf.csrf_rejection(request) == "Request Origin does not match this application."
