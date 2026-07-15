"""Shared analysis insight persistence, ownership, and governance contracts."""

import asyncio
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient


def _identity(analyst_id: str, *, role: str = "analyst", team_id: str | None = None):
    from identity import CallerIdentity

    return lambda: CallerIdentity(
        id=analyst_id,
        email=f"{analyst_id}@firm.test",
        full_name=analyst_id,
        role=role,
        source="profile",
        team_id=team_id,
    )


def test_shared_insight_reuse_force_ownership_and_governance():
    from identity import get_identity
    from main import app

    with TestClient(app) as client:
        app.dependency_overrides[get_identity] = _identity("insight-owner")
        context = client.post("/api/analysis/contexts", json={
            "name": "Portfolio posture",
            "issuer_ids": ["a71f0000-0000-0000-0000-000000000001"],
            "surface_state": {"portfolio-lab": {"view": "risk"}, "ic-book": {"view": "agenda"}},
        })
        assert context.status_code == 201, context.text
        context_id = context.json()["id"]

        first_response = client.post(f"/api/analysis/contexts/{context_id}/insights", json={
            "surface": "portfolio-lab",
            "kind": "portfolio-posture",
        })
        assert first_response.status_code == 201, first_response.text
        first = first_response.json()
        assert first["status"] == "ready"
        assert first["model"] is None
        assert first["claims"]
        assert all(claim["evidence_ids"] for claim in first["claims"])
        assert all("numeric_facts" in claim for claim in first["claims"])
        assert all(not evidence_id.startswith(("context:", "artifact:"))
                   for claim in first["claims"] for evidence_id in claim["evidence_ids"])
        assert first["authority"]["origin"] == "deterministic"
        assert first["authority"]["approval_state"] == "draft"

        reused = client.post(f"/api/analysis/contexts/{context_id}/insights", json={
            "surface": "portfolio-lab",
            "kind": "portfolio-posture",
        })
        assert reused.status_code == 200, reused.text
        assert reused.json()["id"] == first["id"]

        forced = client.post(f"/api/analysis/contexts/{context_id}/insights", json={
            "surface": "portfolio-lab",
            "kind": "portfolio-posture",
            "force": True,
        })
        assert forced.status_code == 201, forced.text
        assert forced.json()["id"] != first["id"]
        assert forced.json()["source_fingerprint"] == first["source_fingerprint"]

        listed = client.get(
            f"/api/analysis/contexts/{context_id}/insights",
            params={"surface": "portfolio-lab", "kind": "portfolio-posture"},
        )
        assert listed.status_code == 200, listed.text
        assert {item["id"] for item in listed.json()["items"]} >= {first["id"], forced.json()["id"]}

        app.dependency_overrides[get_identity] = _identity("insight-reader", role="viewer")
        assert client.post(f"/api/analysis/contexts/{context_id}/insights", json={
            "surface": "portfolio-lab", "kind": "portfolio-posture",
        }).status_code == 404
        assert client.post(f"/api/analysis/insights/{first['id']}/ratify").status_code == 404

        app.dependency_overrides[get_identity] = _identity("insight-owner", role="viewer")
        assert client.get(f"/api/analysis/contexts/{context_id}/insights").status_code == 200
        assert client.post(f"/api/analysis/contexts/{context_id}/insights", json={
            "surface": "portfolio-lab", "kind": "portfolio-posture",
        }).status_code == 403
        assert client.post(f"/api/analysis/insights/{first['id']}/ratify").status_code == 403

        app.dependency_overrides[get_identity] = _identity("insight-owner")
        ratified = client.post(f"/api/analysis/insights/{first['id']}/ratify")
        assert ratified.status_code == 200, ratified.text
        assert ratified.json()["status"] == "ratified"
        assert ratified.json()["ratified_at"] is not None
        assert ratified.json()["authority"]["approval_state"] == "ratified"

        reject_target = client.post(f"/api/analysis/contexts/{context_id}/insights", json={
            "surface": "ic-book", "kind": "agenda-risk",
        }).json()
        app.dependency_overrides[get_identity] = _identity("insight-owner", role="viewer")
        assert client.post(f"/api/analysis/insights/{reject_target['id']}/reject").status_code == 403
        app.dependency_overrides[get_identity] = _identity("insight-owner")
        rejected = client.post(f"/api/analysis/insights/{reject_target['id']}/reject")
        assert rejected.status_code == 200, rejected.text
        assert rejected.json()["status"] == "rejected"
        assert rejected.json()["rejected_at"] is not None

    app.dependency_overrides.clear()


def test_partial_refresh_preserves_prior_ratified_and_artifact_refs_are_owned():
    from identity import get_identity
    from main import app

    with TestClient(app) as client:
        app.dependency_overrides[get_identity] = _identity("preserve-owner")
        context = client.post("/api/analysis/contexts", json={
            "name": "Preserve approved view",
            "issuer_ids": ["a71f0000-0000-0000-0000-000000000001"],
        }).json()
        ready = client.post(f"/api/analysis/contexts/{context['id']}/insights", json={
            "surface": "ic-book", "kind": "committee-brief",
        }).json()
        assert client.post(f"/api/analysis/insights/{ready['id']}/ratify").status_code == 200

        cleared = client.patch(f"/api/analysis/contexts/{context['id']}", json={"issuer_ids": []})
        assert cleared.status_code == 200, cleared.text
        partial = client.post(f"/api/analysis/contexts/{context['id']}/insights", json={
            "surface": "ic-book", "kind": "committee-brief", "force": True,
        })
        assert partial.status_code == 201, partial.text
        assert partial.json()["status"] == "partial"
        assert partial.json()["missing_dependencies"]

        versions = client.get(
            f"/api/analysis/contexts/{context['id']}/insights",
            params={"surface": "ic-book", "kind": "committee-brief"},
        ).json()
        assert versions["items"][0]["id"] == partial.json()["id"]
        assert versions["current"]["id"] == ready["id"]
        assert client.post(
            f"/api/analysis/insights/{partial.json()['id']}/reject"
        ).status_code == 200
        after_reject = client.get(
            f"/api/analysis/contexts/{context['id']}/insights",
            params={"surface": "ic-book", "kind": "committee-brief"},
        ).json()
        assert after_reject["items"][0]["status"] == "rejected"
        assert after_reject["current"]["id"] == ready["id"]

        assert client.patch(f"/api/analysis/contexts/{context['id']}", json={
            "issuer_ids": ["a71f0000-0000-0000-0000-000000000001"],
        }).status_code == 200
        newer_ready = client.post(f"/api/analysis/contexts/{context['id']}/insights", json={
            "surface": "ic-book", "kind": "committee-brief", "force": True,
        })
        assert newer_ready.status_code == 201, newer_ready.text
        advanced = client.get(
            f"/api/analysis/contexts/{context['id']}/insights",
            params={"surface": "ic-book", "kind": "committee-brief", "limit": 1},
        ).json()
        assert advanced["current"]["id"] == newer_ready.json()["id"]
        older_history = client.get(
            f"/api/analysis/contexts/{context['id']}/insights",
            params={
                "surface": "ic-book",
                "kind": "committee-brief",
                "limit": 1,
                "cursor": advanced["next_cursor"],
            },
        ).json()
        assert older_history["items"][0]["id"] != newer_ready.json()["id"]
        assert older_history["current"]["id"] == newer_ready.json()["id"]

        versions = client.get(
            f"/api/analysis/contexts/{context['id']}/insights",
            params={"surface": "ic-book", "kind": "committee-brief"},
        ).json()["items"]
        approved = next(item for item in versions if item["id"] == ready["id"])
        assert approved["status"] == "ratified"
        assert approved["ratified_at"] is not None

        linked = client.patch(f"/api/analysis/contexts/{context['id']}", json={
            "artifacts": {"insight_id": ready["id"]},
        })
        assert linked.status_code == 200, linked.text
        assert linked.json()["artifacts"]["insight_id"] == ready["id"]

        app.dependency_overrides[get_identity] = _identity("preserve-other")
        foreign_context = client.post("/api/analysis/contexts", json={"name": "Other"}).json()
        foreign_link = client.patch(f"/api/analysis/contexts/{foreign_context['id']}", json={
            "artifacts": {"insight_id": ready["id"]},
        })
        assert foreign_link.status_code == 404

    app.dependency_overrides.clear()


def test_query_surface_adapts_deterministic_query_cards(monkeypatch):
    from engine import queryinsights
    from engine.queryinsights import PackEntry
    from identity import get_identity
    from main import app

    async def _pack(_db, issuer_ids=None):
        assert issuer_ids == ["a71f0000-0000-0000-0000-000000000001"]
        return [PackEntry(
            id="delta:issuer:net_leverage",
            kind="delta",
            label="Issuer leverage",
            text="Issuer leverage moved from 4.0x to 4.4x.",
            numbers=[4.0, 4.4],
            issuer_id=issuer_ids[0],
            walk="metric-trend",
        )]

    async def _no_model(*_args, **_kwargs):
        raise AssertionError("shared deterministic generation must not call the Query model lane")

    monkeypatch.setattr(queryinsights, "build_pack", _pack)
    monkeypatch.setattr(queryinsights, "_generate", _no_model)

    with TestClient(app) as client:
        app.dependency_overrides[get_identity] = _identity("query-insight-owner")
        context = client.post("/api/analysis/contexts", json={
            "name": "Query insight",
            "issuer_ids": ["a71f0000-0000-0000-0000-000000000001"],
        }).json()
        response = client.post(f"/api/analysis/contexts/{context['id']}/insights", json={
            "surface": "query", "kind": "desk-brief",
        })
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["summary"] == "Issuer leverage"
        assert body["claims"][0]["evidence_ids"] == ["delta:issuer:net_leverage"]
        assert body["claims"][0]["numeric_facts"] == [
            {"label": "value_1", "value": 4.0, "unit": None},
            {"label": "value_2", "value": 4.4, "unit": None},
        ]

    app.dependency_overrides.clear()


def test_portfolio_and_decision_refs_follow_domain_access(monkeypatch):
    from config import get_settings
    from database import AsyncSessionLocal, Decision, Issuer, Portfolio, Run
    from identity import get_identity
    from main import app

    async def _seed_owned_refs():
        async with AsyncSessionLocal() as db:
            run = Run(
                id="insight-owned-run",
                issuer_id="a71f0000-0000-0000-0000-000000000001",
                status="complete",
                model_id="deterministic",
                prompt_version="test",
            )
            db.add(run)
            db.add(Portfolio(
                id="insight-owned-portfolio",
                name="Owned portfolio",
                created_by="artifact-owner",
                team_id="team-a",
            ))
            db.add(Issuer(id="insight-team-a-issuer", name="Team A Insight", team_id="team-a"))
            db.add(Run(
                id="insight-team-a-run", issuer_id="insight-team-a-issuer",
                status="complete", model_id="deterministic", prompt_version="test",
            ))
            db.add(Decision(
                id="insight-owned-decision",
                issuer_id=run.issuer_id,
                run_id=run.id,
                action="revisit",
                status="active",
                conditions=[],
                snapshot={},
                snapshot_sha256="0" * 64,
                created_by="artifact-owner",
            ))
            db.add(Decision(
                id="insight-team-a-decision",
                issuer_id="insight-team-a-issuer",
                run_id="insight-team-a-run",
                action="revisit",
                status="active",
                conditions=[],
                snapshot={},
                snapshot_sha256="1" * 64,
                created_by="artifact-owner",
            ))
            await db.commit()

    with TestClient(app) as client:
        asyncio.run(_seed_owned_refs())
        app.dependency_overrides[get_identity] = _identity("artifact-owner")
        owned = client.post("/api/analysis/contexts", json={"name": "Owned refs"}).json()
        portfolio_link = client.patch(f"/api/analysis/contexts/{owned['id']}", json={
            "artifacts": {"portfolio_id": "insight-owned-portfolio"},
        })
        assert portfolio_link.status_code == 200, portfolio_link.text
        decision_link = client.patch(f"/api/analysis/contexts/{owned['id']}", json={
            "artifacts": {"decision_id": "insight-owned-decision"},
        })
        assert decision_link.status_code == 200, decision_link.text
        assert decision_link.json()["artifacts"]["portfolio_id"] == "insight-owned-portfolio"

        # Single-desk mode follows the domain routes: portfolios and decisions
        # are desk-visible, not creator-owned.
        app.dependency_overrides[get_identity] = _identity("artifact-other")
        other = client.post("/api/analysis/contexts", json={"name": "Foreign refs"}).json()
        assert client.patch(f"/api/analysis/contexts/{other['id']}", json={
            "artifacts": {"portfolio_id": "insight-owned-portfolio"},
        }).status_code == 200
        assert client.patch(f"/api/analysis/contexts/{other['id']}", json={
            "artifacts": {"decision_id": "insight-owned-decision"},
        }).status_code == 200

        monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)
        # Portfolio references now use the domain's exact-team access helper.
        assert client.patch(f"/api/analysis/contexts/{other['id']}", json={
            "artifacts": {"portfolio_id": "insight-owned-portfolio"},
        }).status_code == 404
        # Decision access follows its linked issuer; team B cannot link team A's.
        app.dependency_overrides[get_identity] = _identity(
            "artifact-team-b", team_id="team-b"
        )
        team_b = client.post("/api/analysis/contexts", json={"name": "Team B refs"}).json()
        assert client.patch(f"/api/analysis/contexts/{team_b['id']}", json={
            "artifacts": {"decision_id": "insight-team-a-decision"},
        }).status_code == 404

    app.dependency_overrides.clear()


def test_context_subject_ids_must_exist_and_respect_tenancy_before_query_or_insight(monkeypatch):
    from config import get_settings
    from database import (
        AnalysisContextRecord, AsyncSessionLocal, Issuer, MarketInstrument, MarketSnapshot,
    )
    from identity import get_identity
    from main import app

    async def _seed_subjects():
        async with AsyncSessionLocal() as db:
            db.add(Issuer(id="insight-subject-team-a", name="Secret Subject", team_id="team-a"))
            db.add(MarketSnapshot(
                id="insight-subject-snapshot",
                as_of=datetime.now(timezone.utc),
                source_label="Test snapshot",
                origin="live",
                method="reported",
                status="ready",
                payload_hash="2" * 64,
            ))
            db.add(MarketInstrument(
                id="insight-subject-instrument",
                snapshot_id="insight-subject-snapshot",
                instrument_key="SUBJECT:1",
                issuer_id="insight-subject-team-a",
                borrower="Secret Subject",
                payload={"price": 98.5},
            ))
            db.add(MarketInstrument(
                id="insight-unanchored-instrument",
                snapshot_id="insight-subject-snapshot",
                instrument_key="UNANCHORED:1",
                issuer_id=None,
                borrower="Unanchored",
                payload={"price": 99.0},
            ))
            db.add(AnalysisContextRecord(
                id="insight-invalid-existing-context",
                analyst_id="subject-team-b",
                name="Legacy guessed context",
                issuer_ids=["does-not-exist"],
            ))
            await db.commit()

    with TestClient(app) as client:
        asyncio.run(_seed_subjects())
        app.dependency_overrides[get_identity] = _identity("subject-team-b", team_id="team-b")
        assert client.post("/api/analysis/contexts", json={
            "name": "Guessed issuer", "issuer_ids": ["does-not-exist"],
        }).status_code == 404
        assert client.post("/api/analysis/contexts", json={
            "name": "Guessed instrument", "instrument_ids": ["does-not-exist"],
        }).status_code == 404

        monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)
        assert client.post("/api/analysis/contexts", json={
            "name": "Cross-team issuer", "issuer_ids": ["insight-subject-team-a"],
        }).status_code == 404
        assert client.post("/api/analysis/contexts", json={
            "name": "Cross-team instrument", "instrument_ids": ["insight-subject-instrument"],
        }).status_code == 404
        assert client.post("/api/analysis/contexts", json={
            "name": "Unanchored instrument", "instrument_ids": ["insight-unanchored-instrument"],
        }).status_code == 404
        # Existing legacy/guessed contexts are revalidated before both Query and insight use.
        assert client.post("/api/query/runs", json={
            "context_id": "insight-invalid-existing-context",
            "question": "What changed?",
            "selected_lane": "grounded",
        }).status_code == 404
        assert client.post(
            "/api/analysis/contexts/insight-invalid-existing-context/insights",
            json={"surface": "query", "kind": "desk-brief"},
        ).status_code == 404

        app.dependency_overrides[get_identity] = _identity("subject-team-a", team_id="team-a")
        allowed = client.post("/api/analysis/contexts", json={
            "name": "Owned subjects",
            "issuer_ids": ["insight-subject-team-a"],
            "instrument_ids": ["insight-subject-instrument"],
        })
        assert allowed.status_code == 201, allowed.text

    app.dependency_overrides.clear()


def test_real_source_mutation_changes_fingerprint_and_empty_context_stays_partial():
    from database import AsyncSessionLocal, Portfolio
    from identity import get_identity
    from main import app

    async def _seed_portfolio():
        async with AsyncSessionLocal() as db:
            db.add(Portfolio(
                id="insight-fingerprint-portfolio",
                name="Fingerprint portfolio",
                mandate={"limit": 10},
                created_by="someone-else",
                updated_at=datetime.now(timezone.utc),
            ))
            await db.commit()

    async def _mutate_portfolio():
        async with AsyncSessionLocal() as db:
            row = await db.get(Portfolio, "insight-fingerprint-portfolio")
            assert row is not None
            row.mandate = {"limit": 12}
            row.updated_at = datetime.now(timezone.utc) + timedelta(seconds=1)
            await db.commit()

    with TestClient(app) as client:
        asyncio.run(_seed_portfolio())
        app.dependency_overrides[get_identity] = _identity("fingerprint-analyst")
        context = client.post("/api/analysis/contexts", json={
            "name": "Fingerprint context",
            "artifacts": {"portfolio_id": "insight-fingerprint-portfolio"},
        }).json()
        first = client.post(f"/api/analysis/contexts/{context['id']}/insights", json={
            "surface": "portfolio-lab", "kind": "risk-posture",
        }).json()
        assert first["status"] == "ready"
        assert first["claims"][0]["evidence_ids"] == ["portfolio:insight-fingerprint-portfolio"]
        asyncio.run(_mutate_portfolio())
        second = client.post(f"/api/analysis/contexts/{context['id']}/insights", json={
            "surface": "portfolio-lab", "kind": "risk-posture",
        }).json()
        assert second["id"] != first["id"]
        assert second["source_fingerprint"] != first["source_fingerprint"]

        empty = client.post("/api/analysis/contexts", json={"name": "No evidence"}).json()
        partial = client.post(f"/api/analysis/contexts/{empty['id']}/insights", json={
            "surface": "ic-book", "kind": "agenda",
        }).json()
        assert partial["status"] == "partial"
        assert partial["claims"] == []
        assert partial["authority"]["source_ids"] == []
        assert partial["missing_dependencies"]

    app.dependency_overrides.clear()


def test_insight_list_cursor_pagination_and_rate_guards(monkeypatch):
    import rate_limit
    import routes.analysis as analysis_routes
    from identity import get_identity
    from main import app

    with TestClient(app) as client:
        app.dependency_overrides[get_identity] = _identity("page-rate-owner")
        context = client.post("/api/analysis/contexts", json={
            "name": "Paged insight",
            "issuer_ids": ["a71f0000-0000-0000-0000-000000000001"],
        }).json()
        generated_ids = []
        for _ in range(4):
            response = client.post(f"/api/analysis/contexts/{context['id']}/insights", json={
                "surface": "ic-book", "kind": "paged", "force": True,
            })
            assert response.status_code == 201, response.text
            generated_ids.append(response.json()["id"])
        first_page = client.get(
            f"/api/analysis/contexts/{context['id']}/insights", params={"limit": 2}
        ).json()
        assert len(first_page["items"]) == 2
        assert first_page["next_cursor"]
        second_page = client.get(
            f"/api/analysis/contexts/{context['id']}/insights",
            params={"limit": 2, "cursor": first_page["next_cursor"]},
        ).json()
        assert len(second_page["items"]) == 2
        assert {item["id"] for item in first_page["items"]}.isdisjoint(
            {item["id"] for item in second_page["items"]}
        )
        assert client.get(
            f"/api/analysis/contexts/{context['id']}/insights", params={"cursor": "a"}
        ).status_code == 422

        rate_limit.reset()
        monkeypatch.setattr(analysis_routes, "_READ_MAX_PER_MINUTE", 1)
        assert client.get(f"/api/analysis/contexts/{context['id']}/insights").status_code == 200
        assert client.get(f"/api/analysis/contexts/{context['id']}/insights").status_code == 429
        rate_limit.reset()
        monkeypatch.setattr(analysis_routes, "_WRITE_MAX_PER_MINUTE", 1)
        assert client.post(f"/api/analysis/contexts/{context['id']}/insights", json={
            "surface": "ic-book", "kind": "rate-guarded", "force": True,
        }).status_code == 201
        assert client.post(f"/api/analysis/contexts/{context['id']}/insights", json={
            "surface": "ic-book", "kind": "rate-guarded", "force": True,
        }).status_code == 429
        rate_limit.reset()
        assert client.post(
            f"/api/analysis/insights/{generated_ids[0]}/ratify"
        ).status_code == 200
        assert client.post(
            f"/api/analysis/insights/{generated_ids[1]}/ratify"
        ).status_code == 429
        rate_limit.reset()
        assert client.post(
            f"/api/analysis/insights/{generated_ids[2]}/reject"
        ).status_code == 200
        assert client.post(
            f"/api/analysis/insights/{generated_ids[3]}/reject"
        ).status_code == 429

    app.dependency_overrides.clear()


def test_insight_rate_guards_run_before_resource_lookup(monkeypatch):
    import rate_limit
    import routes.analysis as analysis_routes
    from identity import get_identity
    from main import app

    with TestClient(app) as client:
        app.dependency_overrides[get_identity] = _identity("prelookup-rate-owner")
        monkeypatch.setattr(analysis_routes, "_READ_MAX_PER_MINUTE", 1)
        assert client.get("/api/analysis/contexts/random-context/insights").status_code == 404
        assert client.get("/api/analysis/contexts/another-context/insights").status_code == 429

        monkeypatch.setattr(analysis_routes, "_WRITE_MAX_PER_MINUTE", 1)
        for action, method in (
            ("create", lambda: client.post(
                "/api/analysis/contexts/random-context/insights",
                json={"surface": "ic-book", "kind": "missing"},
            )),
            ("ratify", lambda: client.post("/api/analysis/insights/random-insight/ratify")),
            ("reject", lambda: client.post("/api/analysis/insights/random-insight/reject")),
        ):
            rate_limit.reset()
            assert method().status_code == 404, action
            assert method().status_code == 429, action

    app.dependency_overrides.clear()


def test_integrity_error_generation_retries_once(monkeypatch):
    from identity import get_identity
    from main import app
    from routes import analysis_insights
    from sqlalchemy.exc import IntegrityError

    calls = 0
    real_flush = analysis_insights._flush_new_insight

    async def _flaky_flush(db, row):
        nonlocal calls
        calls += 1
        if calls == 1:
            raise IntegrityError("INSERT", {}, RuntimeError("simulated uniqueness race"))
        return await real_flush(db, row)

    monkeypatch.setattr(analysis_insights, "_flush_new_insight", _flaky_flush)
    with TestClient(app) as client:
        app.dependency_overrides[get_identity] = _identity("retry-owner")
        context = client.post("/api/analysis/contexts", json={
            "name": "Retry insight",
            "issuer_ids": ["a71f0000-0000-0000-0000-000000000001"],
        }).json()
        response = client.post(f"/api/analysis/contexts/{context['id']}/insights", json={
            "surface": "ic-book", "kind": "retry",
        })
        assert response.status_code == 201, response.text
        assert calls == 2

    app.dependency_overrides.clear()
