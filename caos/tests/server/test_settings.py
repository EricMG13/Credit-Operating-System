"""Settings snapshot endpoint — returns config and, importantly, leaks no secrets."""

from __future__ import annotations

import json

from fastapi.testclient import TestClient


def test_settings_returns_snapshot_without_secrets():
    from main import app

    with TestClient(app) as c:
        r = c.get("/api/settings")
    assert r.status_code == 200
    body = r.json()
    assert body["model"] and "governance" in body and "deep_research" in body

    # No secret material anywhere in the payload (key/db url/storage/EDGAR UA).
    blob = json.dumps(body).lower()
    for forbidden in ("sk-ant", "api_key", "anthropic_api_key", "database_url", "postgresql", "storage_dir", "edgar_user_agent"):
        assert forbidden not in blob, f"settings leaked: {forbidden}"


def test_api_404_detail_passes_through_spa_handler():
    """The SPA 404 exception handler must not mask an endpoint's own 404 detail
    ("Issuer not found") behind a generic {"detail": "Not Found"}."""
    from main import app

    with TestClient(app) as c:
        r = c.get("/api/issuers/does-not-exist-xyz")
    assert r.status_code == 404
    assert r.json() == {"detail": "Issuer not found"}
