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
        # Omitted role_view/workspace default to the analyst view / empty dict.
        assert r.json() == {**body, "role_view": "analyst", "workspace": {}, "revision": 1}

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
        assert c.get("/api/settings/analyst").json() == {**body, "workspace": {}, "revision": 1}

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

        # asyncio.run (fresh loop) — get_event_loop() inherits whatever loop
        # state earlier suite modules left behind and flakes under full-suite
        # ordering; a new loop per call is deterministic (shared-DB suite).
        asyncio.run(corrupt())

        r = c.get("/api/settings/analyst")
        assert r.status_code == 200
        assert r.json()["role_view"] == "analyst"


def test_workspace_field_roundtrips_and_junk_coerces_to_empty_dict():
    """workspace holds Deep-Dive pins/recents/affirmations (Phase-2 P2-WP-0) —
    a free dict, capped only by the overall 100KB blob limit. A non-dict value
    already in the DB (legacy client, manual edit) reads back as {}, never a
    500 or a leaked scalar."""
    import asyncio

    from main import app

    with TestClient(app) as c:
        login = c.post("/api/auth/profile", json={"code": "131113", "name": "Workspace Roundtrip"})
        assert login.status_code in (200, 201), login.text
        analyst_id = c.get("/api/settings").json()["analyst"]

        body = {
            "model_lanes": {},
            "email_intelligence": {},
            "role_view": "analyst",
            "workspace": {"deepdive_pins": ["CP-3B", "CP-2F"], "affirmations": []},
        }
        r = c.put("/api/settings/analyst", json=body)
        assert r.status_code == 200, r.text
        assert r.json()["workspace"] == body["workspace"]
        assert c.get("/api/settings/analyst").json()["workspace"] == body["workspace"]

        async def corrupt() -> None:
            from database import Analyst, AsyncSessionLocal

            async with AsyncSessionLocal() as db:
                a = await db.get(Analyst, analyst_id)
                a.settings = {**a.settings, "workspace": "not-a-dict"}
                await db.commit()

        asyncio.run(corrupt())
        r2 = c.get("/api/settings/analyst")
        assert r2.status_code == 200
        assert r2.json()["workspace"] == {}


def test_analyst_settings_patch_is_partial_and_revision_checked():
    from main import app

    with TestClient(app) as c:
        login = c.post("/api/auth/profile", json={"code": "131113", "name": "Revision Guard"})
        assert login.status_code in (200, 201), login.text
        initial = c.get("/api/settings/analyst").json()
        patched = c.patch("/api/settings/analyst", json={
            "expected_revision": initial["revision"],
            "workspace": {"query_model": "claude-sonnet-4-6"},
        })
        assert patched.status_code == 200, patched.text
        assert patched.json()["workspace"]["query_model"] == "claude-sonnet-4-6"
        assert patched.json()["model_lanes"] == initial["model_lanes"]
        conflict = c.patch("/api/settings/analyst", json={
            "expected_revision": initial["revision"],
            "role_view": "pm",
        })
        assert conflict.status_code == 409
