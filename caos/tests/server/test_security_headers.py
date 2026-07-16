"""The security-headers middleware (main.py) stamps every response."""
from __future__ import annotations

import base64
import hashlib
from pathlib import Path

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
    # The sha256- hash allowlist is only non-empty once a built static Next
    # export exists to hash (this pytest run has none — that's exercised
    # directly against the hashing function below).
    assert "script-src 'self'" in h["Content-Security-Policy"]
    # HSTS present but intentionally without `preload` (internal / self-signed CA).
    assert "max-age=" in h["Strict-Transport-Security"]
    assert "preload" not in h["Strict-Transport-Security"]
    assert h["Cache-Control"] == "private, no-store"


def test_static_inline_script_hashes_matches_a_real_script_block(tmp_path):
    from main import _static_inline_script_hashes

    script = b'console.log("boot")'
    (tmp_path / "index.html").write_bytes(
        b"<!doctype html><html><body><script>" + script + b"</script></body></html>"
    )
    expected = "'sha256-" + base64.b64encode(hashlib.sha256(script).digest()).decode("ascii") + "'"
    assert _static_inline_script_hashes(Path(tmp_path)) == (expected,)


def test_static_inline_script_hashes_ignores_missing_and_external_scripts(tmp_path):
    from main import _static_inline_script_hashes

    assert _static_inline_script_hashes(tmp_path / "does-not-exist") == ()

    (tmp_path / "index.html").write_bytes(
        b'<!doctype html><html><body><script src="/app.js"></script></body></html>'
    )
    assert _static_inline_script_hashes(Path(tmp_path)) == ()
