"""Pure-helper tests for the access-log feed (access_log.py). The middleware
that calls these lives in main.py; here we pin the branching logic that decides
the analyzer's `entity` (auth signal) and `source` (brute-force signal)."""

from __future__ import annotations

import re

from access_log import access_event, client_source, principal, sanitize_field


def test_principal_prefers_email_then_user_then_local_dev():
    assert principal({"x-forwarded-email": "a@b.co", "x-forwarded-user": "u1"}) == "a@b.co"
    assert principal({"x-forwarded-user": "u1"}) == "u1"  # email absent
    assert principal({}) == "local-dev"  # un-proxied local dev, never empty


def test_client_source_takes_first_xff_hop_else_socket_peer():
    # Edge proxy prepends the real client; chained proxies append — first hop wins.
    assert client_source({"x-forwarded-for": "203.0.113.7, 10.0.0.1"}, "10.0.0.1") == "203.0.113.7"
    assert client_source({}, "198.51.100.4") == "198.51.100.4"  # direct, no XFF
    assert client_source({}, None) == "?"  # no peer (e.g. test client)


def test_sanitize_field_strips_crlf_and_caps_length():
    # CRLF in a forged X-Forwarded-Email must not forge a new log line (S7).
    assert sanitize_field("ceo@firm.com\r\nINJECTED admin login") == "ceo@firm.comINJECTED admin login"
    assert "\n" not in sanitize_field("a\nb") and "\r" not in sanitize_field("a\rb")
    assert sanitize_field("\x00\x07\x1f\x7fclean") == "clean"  # NUL/BEL/US/DEL gone
    assert len(sanitize_field("x" * 1000)) == 256  # length cap


def test_principal_and_source_sanitize_injected_headers():
    assert "\n" not in principal({"x-forwarded-email": "a@b.co\r\nevil"})
    assert "\r" not in client_source({"x-forwarded-for": "1.2.3.4\r\nevil"}, None)


def test_access_event_shape_matches_analyzer_schema():
    ev = access_event(
        method="GET", path="/api/issuers", status=200,
        entity="a@b.co", source="203.0.113.7", volume=4096, dur_ms=12.3,
    )
    # analyzer events schema: {timestamp, entity, action, volume} (+ triage extras)
    assert {"timestamp", "entity", "action", "volume"} <= ev.keys()
    assert ev["action"] == "GET /api/issuers"
    assert ev["entity"] == "a@b.co" and ev["volume"] == 4096
    assert ev["status"] == 200 and ev["source"] == "203.0.113.7"
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", ev["timestamp"])
