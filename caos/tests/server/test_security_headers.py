"""The security-headers middleware (main.py) stamps every response."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    from main import app

    with TestClient(app) as c:
        yield c


def test_security_headers_present(client):
    h = client.get("/api/health").headers
    assert h["X-Frame-Options"] == "SAMEORIGIN"
    assert "camera=()" in h["Permissions-Policy"]
    assert "microphone=()" in h["Permissions-Policy"]
    assert h["X-Content-Type-Options"] == "nosniff"
    assert "frame-ancestors 'self'" in h["Content-Security-Policy"]
    assert "script-src 'self' 'unsafe-inline'" not in h["Content-Security-Policy"]
    assert "script-src 'self' 'sha256-" in h["Content-Security-Policy"]
    # HSTS present but intentionally without `preload` (internal / self-signed CA).
    assert "max-age=" in h["Strict-Transport-Security"]
    assert "preload" not in h["Strict-Transport-Security"]
    assert h["Cache-Control"] == "private, no-store"
