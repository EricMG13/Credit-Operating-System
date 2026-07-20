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


def test_tenancy_isolates_analyst_qa_flags(monkeypatch):
    from config import get_settings
    from identity import get_identity
    from main import app

    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)

    with TestClient(app) as c:
        app.dependency_overrides[get_identity] = _as_team("qa-team-a")
        issuer_id = c.post(
            "/api/issuers/", json={"name": "QA Team A Secret Co"}
        ).json()["id"]
        run = c.post("/api/runs", json={"issuer_id": issuer_id})
        assert run.status_code == 201, run.text
        run_id = run.json()["id"]
        created = c.post(
            "/api/qa/flags",
            json={
                "module_id": "CP-5",
                "run_id": run_id,
                "note": "Team A finding text",
            },
        )
        assert created.status_code == 201, created.text
        assert created.json()["issuer_id"] == issuer_id

        app.dependency_overrides[get_identity] = _as_team("qa-team-b")
        assert c.post(
            "/api/qa/flags",
            json={"module_id": "CP-5", "issuer_id": issuer_id},
        ).status_code == 404
        assert c.get(
            "/api/qa/flags", params={"issuer_id": issuer_id}
        ).status_code == 404
        assert c.post(
            "/api/qa/flags",
            json={"module_id": "CP-5", "run_id": run_id},
        ).status_code == 404
        assert all(
            flag["issuer_id"] != issuer_id for flag in c.get("/api/qa/flags").json()
        )

    app.dependency_overrides.clear()


def test_tenancy_isolates_research_reports_watchlists_and_accepted_links(monkeypatch):
    """Relationship artifacts inherit visibility from every issuer endpoint."""
    import asyncio

    from config import get_settings
    from database import AsyncSessionLocal, IssuerResearchReport, Run
    from identity import get_identity
    from main import app

    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)

    async def _seed_report(issuer_id: str) -> tuple[str, str]:
        async with AsyncSessionLocal() as db:
            run = Run(
                issuer_id=issuer_id,
                analyst_id="analyst-team-a",
                status="complete",
            )
            db.add(run)
            await db.flush()
            report = IssuerResearchReport(
                issuer_id=issuer_id,
                run_id=run.id,
                analyst_id="analyst-team-a",
                status="complete",
                payload={"summary": "team-a only"},
            )
            db.add(report)
            await db.commit()
            return run.id, report.id

    try:
        with TestClient(app) as c:
            app.dependency_overrides[get_identity] = _as_team("team-a")
            issuer_a = c.post(
                "/api/issuers/", json={"name": "Tenant Link A"}
            ).json()["id"]
            issuer_b = c.post(
                "/api/issuers/", json={"name": "Tenant Link B"}
            ).json()["id"]
            _, report_id = asyncio.run(_seed_report(issuer_a))

            accepted = c.post(
                "/api/query/links",
                json={
                    "source_issuer_id": issuer_a,
                    "target_issuer_id": issuer_b,
                    "capability_id": "peer-set",
                },
            )
            assert accepted.status_code == 200, accepted.text
            link_id = accepted.json()["id"]
            watchlist = c.put(
                "/api/query/watchlist", json={"issuer_ids": [issuer_a, issuer_b]}
            )
            assert watchlist.status_code == 200, watchlist.text

            assert c.get(f"/api/issuers/{issuer_a}/research-report").status_code == 200
            assert c.get(f"/api/issuers/{issuer_a}/research-report/{report_id}").status_code == 200
            assert any(
                row["id"] == link_id for row in c.get("/api/query/links").json()["links"]
            )

            app.dependency_overrides[get_identity] = _as_team("team-b")
            assert c.get(f"/api/issuers/{issuer_a}/research-report").status_code == 404
            assert c.get(
                f"/api/issuers/{issuer_a}/research-report/{report_id}"
            ).status_code == 404
            assert c.post(
                f"/api/issuers/{issuer_a}/research-report"
            ).status_code == 404
            assert all(
                row["id"] != link_id for row in c.get("/api/query/links").json()["links"]
            )
            assert c.delete(f"/api/query/links/{link_id}").status_code == 404
            assert c.post(
                "/api/query/links",
                json={
                    "source_issuer_id": issuer_a,
                    "target_issuer_id": issuer_b,
                    "capability_id": "peer-set",
                },
            ).status_code == 404
            assert c.put(
                "/api/query/watchlist", json={"issuer_ids": [issuer_a]}
            ).status_code == 422
            assert issuer_a not in c.get("/api/query/watchlist").json()["issuer_ids"]

            app.dependency_overrides[get_identity] = _as_team("team-a")
            assert c.delete(f"/api/query/links/{link_id}").status_code == 200
    finally:
        app.dependency_overrides.clear()
