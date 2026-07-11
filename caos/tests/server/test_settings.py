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


def test_analyst_settings_roundtrip_with_profile_cookie():
    """model_lanes/email_intelligence persist per-analyst once a profile exists."""
    from main import app

    with TestClient(app) as c:
        login = c.post("/api/auth/profile", json={"code": "131113", "name": "Lane Router"})
        assert login.status_code in (200, 201), login.text

        body = {
            "model_lanes": {"module_synthesis": "claude-opus-4-8"},
            "email_intelligence": {"approved_senders": ["ir@issuer.com"]},
        }
        r = c.put("/api/settings/analyst", json=body)
        assert r.status_code == 200, r.text
        # An omitted role_view defaults to the analyst presentation view.
        assert r.json() == {**body, "role_view": "analyst"}

        r2 = c.get("/api/settings/analyst")
        assert r2.status_code == 200
        assert r2.json()["model_lanes"] == {"module_synthesis": "claude-opus-4-8"}
        assert r2.json()["email_intelligence"]["approved_senders"] == ["ir@issuer.com"]


def test_role_view_roundtrip_validation_and_legacy_coercion():
    """role_view is a presentation preference: valid values round-trip alongside
    the lane maps, invalid values 422 (never persist), and a legacy two-field
    blob (or junk already in the DB) reads back as the analyst default."""
    from main import app

    with TestClient(app) as c:
        login = c.post("/api/auth/profile", json={"code": "131113", "name": "Role Viewer"})
        assert login.status_code in (200, 201), login.text

        # Valid value round-trips and preserves the sibling maps.
        body = {"model_lanes": {"module_synthesis": "claude-opus-4-8"}, "email_intelligence": {}, "role_view": "pm"}
        r = c.put("/api/settings/analyst", json=body)
        assert r.status_code == 200, r.text
        assert r.json()["role_view"] == "pm"
        assert c.get("/api/settings/analyst").json() == body

        # Invalid value is rejected, and the stored preference is untouched.
        bad = {**body, "role_view": "admin"}
        assert c.put("/api/settings/analyst", json=bad).status_code == 422
        assert c.get("/api/settings/analyst").json()["role_view"] == "pm"


def test_role_view_junk_in_stored_blob_coerces_to_analyst():
    """Junk written around the model (legacy clients, manual edits) must read
    back as 'analyst' — a GET never 500s or echoes junk for a preference."""
    import asyncio

    from main import app

    with TestClient(app) as c:
        login = c.post("/api/auth/profile", json={"code": "131113", "name": "Legacy Blob"})
        assert login.status_code in (200, 201), login.text
        analyst_id = c.get("/api/settings").json()["analyst"]

        async def corrupt() -> None:
            from database import Analyst, AsyncSessionLocal

            async with AsyncSessionLocal() as db:
                a = await db.get(Analyst, analyst_id)
                a.settings = {"model_lanes": {}, "role_view": 42}
                await db.commit()

        asyncio.get_event_loop().run_until_complete(corrupt())

        r = c.get("/api/settings/analyst")
        assert r.status_code == 200
        assert r.json()["role_view"] == "analyst"
