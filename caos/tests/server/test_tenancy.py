"""Multi-team tenancy (CAOS_TENANCY_ENABLED) — the config-gated cross-team barrier.

Default OFF is covered by the rest of the suite (every route behaves as the shared
single-team desk). These tests flip it ON and prove the enforcement: the issuer is
the anchor, so scoping issuer access scopes runs/portfolio/query/uploads derived from
it, and the cross-issuer aggregate lanes fail closed.
"""
from __future__ import annotations

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient


def _enable(monkeypatch):
    from config import get_settings

    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)


# ── Unit: the tenancy primitives ────────────────────────────────────────────

def test_issuer_visible_rules(monkeypatch):
    from database import Issuer
    from identity import CallerIdentity
    from tenancy import issuer_visible

    a = CallerIdentity(id="a", email="", full_name="", team_id="A")
    shared = Issuer(id="s", name="s", team_id=None)
    team_a = Issuer(id="ia", name="ia", team_id="A")
    team_b = Issuer(id="ib", name="ib", team_id="B")

    # Tenancy OFF: everything is visible (single shared desk).
    assert issuer_visible(a, team_b) is True

    _enable(monkeypatch)
    assert issuer_visible(a, shared) is True    # NULL team = shared/global
    assert issuer_visible(a, team_a) is True     # own team
    assert issuer_visible(a, team_b) is False    # another team
    assert issuer_visible(a, None) is False      # missing


def test_require_issuer_404s_cross_team(monkeypatch):
    from database import Issuer
    from identity import CallerIdentity
    from tenancy import require_issuer

    a = CallerIdentity(id="a", email="", full_name="", team_id="A")
    _enable(monkeypatch)
    with pytest.raises(HTTPException) as ei:
        require_issuer(a, Issuer(id="ib", name="ib", team_id="B"))
    assert ei.value.status_code == 404  # 404 not 403 — never leak existence


def test_new_issuer_team_off_is_none():
    from identity import CallerIdentity
    from tenancy import new_issuer_team

    # Tenancy off (default): issuers created shared/global.
    assert new_issuer_team(CallerIdentity(id="a", email="", full_name="", team_id="A")) is None


def test_new_issuer_team_on_stamps_caller_team(monkeypatch):
    from identity import CallerIdentity
    from tenancy import new_issuer_team

    _enable(monkeypatch)
    assert new_issuer_team(CallerIdentity(id="a", email="", full_name="", team_id="A")) == "A"


def test_block_if_tenancy_unscoped(monkeypatch):
    from tenancy import block_if_tenancy_unscoped

    block_if_tenancy_unscoped()  # OFF: no-op
    _enable(monkeypatch)
    with pytest.raises(HTTPException) as ei:
        block_if_tenancy_unscoped()
    assert ei.value.status_code == 501


# ── Integration: cross-team isolation across the route spine ─────────────────

def _as_team(tid):
    from identity import CallerIdentity

    return lambda: CallerIdentity(
        id=f"analyst-{tid}", email=f"{tid}@firm.com", full_name=tid,
        source="profile", team_id=tid,
    )


def test_tenancy_isolates_issuers_runs_portfolio_and_query(monkeypatch):
    from config import get_settings
    from identity import get_identity
    from main import app

    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)

    with TestClient(app) as c:
        # Team A creates an issuer — stamped with team A.
        app.dependency_overrides[get_identity] = _as_team("team-a")
        r = c.post("/api/issuers/", json={"name": "Team A Secret Co"})
        assert r.status_code == 201, r.text
        iid = r.json()["id"]

        # Team A can see it (get + list) and run it.
        assert c.get(f"/api/issuers/{iid}").status_code == 200
        assert any(i["id"] == iid for i in c.get("/api/issuers/").json())
        created_run = c.post("/api/runs", json={"issuer_id": iid})
        assert created_run.status_code == 201
        run_id = created_run.json()["id"]

        # Team B cannot see it, list it, read its profile, or run it (404, never 403).
        app.dependency_overrides[get_identity] = _as_team("team-b")
        assert c.get(f"/api/issuers/{iid}").status_code == 404
        assert all(i["id"] != iid for i in c.get("/api/issuers/").json())
        assert c.get(f"/api/issuers/{iid}/profile").status_code == 404
        assert c.post("/api/runs", json={"issuer_id": iid}).status_code == 404
        assert c.get(f"/api/runs/{run_id}/modules").status_code == 404
        assert c.get(f"/api/runs/{run_id}/modules/CP-1").status_code == 404
        # Team B's portfolio never contains team A's issuer.
        assert all(row["issuer_id"] != iid for row in c.get("/api/portfolio").json()["rows"])
        # Cross-issuer aggregate lanes fail closed (not team-scoped).
        assert c.post("/api/query/nl", json={"question": "most levered issuer?"}).status_code == 501
        assert c.post("/api/query/graph", json={"capability_id": "peer-set"}).status_code == 501

        # A team B issuer with the SAME name is allowed (names are per-team now).
        assert c.post("/api/issuers/", json={"name": "Team A Secret Co"}).status_code == 201

    app.dependency_overrides.clear()


def test_issuer_name_uniqueness_uses_exact_tenancy_scope(monkeypatch):
    from config import get_settings
    from identity import get_identity
    from main import app

    settings = get_settings()
    monkeypatch.setattr(settings, "caos_tenancy_enabled", False)
    name = "Exact Issuer Scope Proof"

    with TestClient(app) as c:
        # Tenancy-off creation belongs to the shared/global empty scope.
        assert c.post("/api/issuers/", json={"name": name}).status_code == 201

        monkeypatch.setattr(settings, "caos_tenancy_enabled", True)
        app.dependency_overrides[get_identity] = _as_team("scope-team-a")
        assert c.post("/api/issuers/", json={"name": name}).status_code == 201

        app.dependency_overrides[get_identity] = _as_team("scope-team-b")
        assert c.post("/api/issuers/", json={"name": name}).status_code == 201
        assert c.post("/api/issuers/", json={"name": name}).status_code == 409

    app.dependency_overrides.clear()
