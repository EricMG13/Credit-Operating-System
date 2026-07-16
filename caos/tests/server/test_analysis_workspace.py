"""Shared analysis context and Findings Tray ownership contracts."""

import pytest

from fastapi.testclient import TestClient


def _identity(analyst_id: str):
    from identity import CallerIdentity

    return lambda: CallerIdentity(
        id=analyst_id,
        email=f"{analyst_id}@firm.test",
        full_name=analyst_id,
        source="profile",
        team_id=None,
    )


def test_context_and_findings_are_analyst_owned():
    from identity import get_identity
    from main import app

    with TestClient(app) as client:
        app.dependency_overrides[get_identity] = _identity("analysis-a")
        created = client.post("/api/analysis/contexts", json={
            "name": "Telecom weekly",
            "sector_id": "Telecommunications",
            "issuer_ids": ["a71f0000-0000-0000-0000-000000000001"] * 2,
            "filters": {"rating": "B"},
        })
        assert created.status_code == 201, created.text
        context = created.json()
        assert context["sector_id"] == "telecom"
        assert context["issuer_ids"] == ["a71f0000-0000-0000-0000-000000000001"]

        source_run = client.post("/api/query/runs", json={
            "context_id": context["id"],
            "question": "What source evidence supports the current view?",
            "selected_lane": "grounded",
        }).json()
        forged_authority = {
            "origin": "live",
            "method": "grounded-answer",
            "freshness": "current",
            "source_ids": ["chunk-1"],
            "confidence": 0.82,
            "approval_state": "draft",
        }
        finding_response = client.post("/api/analysis/findings", json={
            "context_id": context["id"],
            "kind": "query-answer",
            "title": "Fiber capex remains the principal downside risk",
            "body": "Pinned from the selected cited answer.",
            "source_surface": "query",
            "source_run_id": source_run["id"],
            "evidence": {"claim_ids": ["claim-1"]},
            # This legacy extra field is intentionally ignored. Authority is
            # resolved from the owned source run on the server.
            "authority": forged_authority,
        })
        assert finding_response.status_code == 201, finding_response.text
        finding = finding_response.json()
        assert finding["status"] == "draft"
        assert finding["authority"]["source_ids"] == []
        assert client.patch(
            f"/api/analysis/findings/{finding['id']}", json={"status": "ratified"}
        ).status_code == 409
        assert client.get(f"/api/analysis/contexts/{context['id']}").status_code == 200
        assert len(client.get(
            "/api/analysis/findings", params={"context_id": context["id"]}
        ).json()) == 1

        app.dependency_overrides[get_identity] = _identity("analysis-b")
        assert client.get(f"/api/analysis/contexts/{context['id']}").status_code == 404
        assert client.patch(
            f"/api/analysis/contexts/{context['id']}", json={"name": "stolen"}
        ).status_code == 404
        assert client.get(
            "/api/analysis/findings", params={"context_id": context["id"]}
        ).status_code == 404
        assert client.patch(
            f"/api/analysis/findings/{finding['id']}", json={"status": "ratified"}
        ).status_code == 404

    app.dependency_overrides.clear()


def test_unknown_sector_is_rejected_and_taxonomy_is_canonical():
    from identity import get_identity
    from main import app

    with TestClient(app) as client:
        app.dependency_overrides[get_identity] = _identity("analysis-taxonomy")
        taxonomy = client.get("/api/analysis/taxonomy")
        assert taxonomy.status_code == 200, taxonomy.text
        assert {row["id"] for row in taxonomy.json()["sectors"]} >= {
            "industrials", "software", "telecom"
        }
        rejected = client.post("/api/analysis/contexts", json={
            "name": "Unknown sector",
            "sector_id": "not-a-real-sector",
        })
        assert rejected.status_code == 422

    app.dependency_overrides.clear()


def test_query_failure_preserves_question_and_names_recovery_lanes():
    from identity import get_identity
    from main import app

    with TestClient(app) as client:
        app.dependency_overrides[get_identity] = _identity("analysis-query")
        context = client.post("/api/analysis/contexts", json={
            "name": "Software investigation",
            "sector_id": "software",
        }).json()
        question = "Which software credits have weakening renewal evidence?"
        response = client.post("/api/query/runs", json={
            "context_id": context["id"],
            "question": question,
            "selected_lane": "grounded",
        })
        assert response.status_code == 201, response.text
        run = response.json()
        assert run["question"] == question
        assert run["selected_lane"] == "grounded"
        assert run["status"] == "partial"
        assert run["result"]["missing_dependencies"] == ["model_provider"]
        assert set(run["result"]["available_lanes"]) == {"metric", "graph"}

        fetched = client.get(f"/api/query/runs/{run['id']}")
        assert fetched.status_code == 200
        assert fetched.json()["question"] == question

        app.dependency_overrides[get_identity] = _identity("analysis-query-other")
        assert client.get(f"/api/query/runs/{run['id']}").status_code == 404

    app.dependency_overrides.clear()


def test_query_authority_lifts_nested_metric_citations():
    from routes.query import _result_source_ids

    result = {
        "rows": [{
            "issuer": {"id": "issuer-1", "name": "Example Credit"},
            "metrics": {
                "net_leverage": {
                    "value": 5.8,
                    "citation": {
                        "claim_id": "claim-7",
                        "evidence_id": "evidence-4",
                        "chunk_id": "chunk-2",
                    },
                },
            },
        }],
    }

    assert _result_source_ids(result) == ["chunk-2", "claim-7", "evidence-4"]


def test_sector_review_is_versioned_complete_and_reference_gated():
    from identity import get_identity
    from main import app

    with TestClient(app) as client:
        app.dependency_overrides[get_identity] = _identity("analysis-sector")
        context = client.post("/api/analysis/contexts", json={
            "name": "Telecom sector view",
            "sector_id": "telecom",
        }).json()
        first_response = client.post("/api/sector/reviews", json={
            "context_id": context["id"],
            "timeframe": "weekly",
        })
        assert first_response.status_code == 201, first_response.text
        first = first_response.json()
        assert first["version"] == 1
        assert first["status"] == "partial"
        assert first["authority"]["origin"] == "reference"
        assert first["authority"]["approval_state"] == "draft"
        assert len(first["sections"]) == 7
        assert len(first["dimension_scores"]) == 6
        assert all(score["score"] is None for score in first["dimension_scores"])
        assert first["downstream_readiness"]["ready"] is False
        assert "live source-backed sector signals" in first["missing_dependencies"]

        ratifications = [{"section_id": section["id"], "decision": "ratified"}
                         for section in first["sections"]]
        ratified = client.post(
            f"/api/sector/reviews/{first['id']}/ratifications",
            json={"sections": ratifications},
        )
        assert ratified.status_code == 200, ratified.text
        # Analysts may review incomplete sections, but incomplete reference data
        # cannot become a ratified decision artifact.
        assert ratified.json()["authority"]["approval_state"] == "draft"
        publish = client.post(f"/api/sector/reviews/{first['id']}/publish")
        assert publish.status_code == 409
        assert "reference/demo evidence cannot be published" in publish.text

        second = client.post("/api/sector/reviews", json={
            "context_id": context["id"],
            "timeframe": "weekly",
        }).json()
        assert second["version"] == 2
        assert client.get(f"/api/sector/reviews/{first['id']}").status_code == 200

        app.dependency_overrides[get_identity] = _identity("analysis-sector-other")
        assert client.get(f"/api/sector/reviews/{first['id']}").status_code == 404

    app.dependency_overrides.clear()


def test_reference_rv_snapshot_is_never_actionable_without_recovery():
    from identity import get_identity
    from main import app

    with TestClient(app) as client:
        app.dependency_overrides[get_identity] = _identity("analysis-rv")
        context = client.post("/api/analysis/contexts", json={
            "name": "Telecom RV",
            "sector_id": "telecom",
        }).json()
        response = client.post("/api/rv/screens", json={
            "context_id": context["id"],
            "filters": {"sector_id": "telecom"},
        })
        assert response.status_code == 201, response.text
        screen = response.json()
        assert screen["status"] == "ready"
        assert screen["authority"]["origin"] == "reference"
        assert screen["counts"]["actionable"] == 0
        assert screen["candidates"]
        assert all(candidate["classification"] != "actionable" for candidate in screen["candidates"])
        assert all(candidate["recommendation"] != "Add" for candidate in screen["candidates"])
        first = screen["candidates"][0]
        assert "live market origin" in first["missing_gates"]
        assert "recovery evidence" in first["missing_gates"]
        assert set(first["pitch"]) >= {
            "market_relative_value", "instrument_mispricing", "portfolio_implementation"
        }

        ratify = client.post(
            f"/api/rv/screens/{screen['id']}/ratifications",
            json={"candidate_id": first["id"]},
        )
        assert ratify.status_code == 409

        app.dependency_overrides[get_identity] = _identity("analysis-rv-other")
        assert client.get(f"/api/rv/screens/{screen['id']}").status_code == 404

    app.dependency_overrides.clear()


def test_rv_gate_classification_blocks_stale_and_incomplete_candidates():
    from routes.rv import classify_candidate

    assert classify_candidate(
        market_current=False,
        has_exact_identity=True,
        missing_gates=["current market snapshot"],
    ) == "unavailable"
    assert classify_candidate(
        market_current=True,
        has_exact_identity=True,
        missing_gates=["recovery evidence"],
    ) == "screen-only"
    assert classify_candidate(
        market_current=True,
        has_exact_identity=True,
        missing_gates=[],
    ) == "actionable"


def test_context_artifact_and_surface_patches_merge_without_erasing_siblings():
    from identity import get_identity
    from main import app

    with TestClient(app) as client:
        app.dependency_overrides[get_identity] = _identity("analysis-merge")
        context = client.post("/api/analysis/contexts", json={"name": "Concurrent instruments"}).json()
        first = client.patch(f"/api/analysis/contexts/{context['id']}", json={
            "artifacts": {"sponsor_id": "sponsor-1"},
            "surface_state": {"issuers": {"query": "telecom"}},
        })
        assert first.status_code == 200, first.text
        second = client.patch(f"/api/analysis/contexts/{context['id']}", json={
            "artifacts": {"research_job_id": None},
            "surface_state": {"pipeline": {"view": "graph"}},
        })
        assert second.status_code == 200, second.text
        body = second.json()
        assert body["artifacts"]["sponsor_id"] == "sponsor-1"
        assert body["surface_state"]["issuers"]["query"] == "telecom"
        assert body["surface_state"]["pipeline"]["view"] == "graph"

        nested = client.patch(f"/api/analysis/contexts/{context['id']}", json={
            "surface_state": {"issuers": {
                "view": "coverage", "filters": {"rating": "B"},
            }},
            "filters": {"lane": "credit"},
            "selected": {"issuer": "issuer-1"},
        })
        assert nested.status_code == 200, nested.text
        issuer_state = nested.json()["surface_state"]["issuers"]
        assert issuer_state["query"] == "telecom"
        assert issuer_state["view"] == "coverage"
        next_nested = client.patch(f"/api/analysis/contexts/{context['id']}", json={
            "surface_state": {"issuers": {"filters": {"sector": "telecom"}}},
            "filters": {"basis": "adjusted"},
            "selected": {"run": "run-1"},
        })
        assert next_nested.status_code == 200, next_nested.text
        next_body = next_nested.json()
        assert next_body["surface_state"]["issuers"]["filters"] == {
            "rating": "B", "sector": "telecom",
        }
        assert next_body["filters"] == {"lane": "credit", "basis": "adjusted"}
        assert next_body["selected"] == {"issuer": "issuer-1", "run": "run-1"}

    app.dependency_overrides.clear()


def test_context_patch_rejects_stale_revision():
    from identity import get_identity
    from main import app

    with TestClient(app) as client:
        app.dependency_overrides[get_identity] = _identity("analysis-cas")
        context = client.post(
            "/api/analysis/contexts", json={"name": "Concurrent context"}
        ).json()
        assert context["revision"] == 1

        first = client.patch(
            f"/api/analysis/contexts/{context['id']}",
            json={"name": "First writer", "expected_revision": 1},
        )
        assert first.status_code == 200, first.text
        assert first.json()["revision"] == 2

        stale = client.patch(
            f"/api/analysis/contexts/{context['id']}",
            json={"name": "Stale writer", "expected_revision": 1},
        )
        assert stale.status_code == 409
        assert stale.json()["detail"]["current_revision"] == 2
        assert client.get(
            f"/api/analysis/contexts/{context['id']}"
        ).json()["name"] == "First writer"

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_postgres_two_session_disjoint_context_patches_survive(seeded_db):
    """The production row lock must merge both writers, not last-write a JSON column."""
    import asyncio

    from database import AnalysisContextRecord, AsyncSessionLocal, engine
    from identity import CallerIdentity
    from routes.analysis import ContextPatch, patch_context

    if engine.dialect.name != "postgresql":
        pytest.skip("requires PostgreSQL SELECT FOR UPDATE semantics")

    caller = CallerIdentity(
        id="analysis-two-session",
        email="analysis-two-session@example.test",
        full_name="Analysis Two Session",
    )
    async with AsyncSessionLocal() as session:
        row = AnalysisContextRecord(analyst_id=caller.id, name="Concurrent context")
        session.add(row)
        await session.commit()
        context_id = row.id

    async def write(body: ContextPatch):
        async with AsyncSessionLocal() as session:
            await patch_context(context_id, body, db=session, caller=caller)
            await session.commit()

    await asyncio.gather(
        write(ContextPatch(
            artifacts={"sponsor_id": "sponsor-concurrent"},
            surface_state={"command": {
                "active_id": "issuer-1", "filters": {"rating": "B"},
            }},
            filters={"lane": "credit"},
        )),
        write(ContextPatch(
            artifacts={"research_job_id": None},
            surface_state={"command": {
                "view": "portfolio", "filters": {"sector": "telecom"},
            }},
            filters={"basis": "adjusted"},
        )),
    )

    async with AsyncSessionLocal() as session:
        row = await session.get(AnalysisContextRecord, context_id)
        assert row.artifacts["sponsor_id"] == "sponsor-concurrent"
        assert row.surface_state["command"]["active_id"] == "issuer-1"
        assert row.surface_state["command"]["view"] == "portfolio"
        assert row.surface_state["command"]["filters"] == {
            "rating": "B", "sector": "telecom",
        }
        assert row.filters == {"lane": "credit", "basis": "adjusted"}


def test_report_draft_is_owned_revision_checked_and_not_publishable_without_checkpoint():
    from identity import get_identity
    from main import app

    with TestClient(app) as client:
        app.dependency_overrides[get_identity] = _identity("analysis-report")
        context = client.post("/api/analysis/contexts", json={"name": "Committee draft"}).json()
        first = client.put(f"/api/reports/drafts/{context['id']}", json={
            "payload": {"active_id": "snapshot", "edits": {"snapshot": {"thesis": "Hold"}}},
        })
        assert first.status_code == 200, first.text
        assert first.json()["revision"] == 1
        second = client.put(f"/api/reports/drafts/{context['id']}", json={
            "payload": {"active_id": "model"},
            "expected_revision": 1,
        })
        assert second.status_code == 200, second.text
        assert second.json()["revision"] == 2
        assert client.put(f"/api/reports/drafts/{context['id']}", json={
            "payload": {"active_id": "stale-tab"},
            "expected_revision": 1,
        }).status_code == 409
        publish = client.post("/api/reports/versions", json={
            "context_id": context["id"],
            "run_id": "missing-run",
            "model_checkpoint_id": "missing-checkpoint",
            "payload": {},
        })
        assert publish.status_code in {404, 409}

        app.dependency_overrides[get_identity] = _identity("analysis-report-other")
        assert client.get(f"/api/reports/drafts/{context['id']}").status_code == 404

    app.dependency_overrides.clear()


def test_model_checkpoint_is_immutable_owned_and_restorable():
    from identity import get_identity
    from main import app
    reference_issuer_id = "a71f0000-0000-0000-0000-000000000001"

    with TestClient(app) as client:
        app.dependency_overrides[get_identity] = _identity("analysis-model")
        context = client.post("/api/analysis/contexts", json={
            "name": "Model checkpoint",
            "issuer_ids": [reference_issuer_id],
        }).json()
        saved = client.put(f"/api/models/{reference_issuer_id}", json={
            "payload": {"overrides": {"FY27:EBITDA": 420}},
        })
        assert saved.status_code == 200, saved.text
        checkpoint = client.post(f"/api/models/{reference_issuer_id}/checkpoints", json={
            "context_id": context["id"],
            "label": "Downside before committee",
        })
        assert checkpoint.status_code == 201, checkpoint.text
        checkpoint_body = checkpoint.json()
        assert checkpoint_body["payload"]["overrides"]["FY27:EBITDA"] == 420
        assert client.put(f"/api/models/{reference_issuer_id}", json={
            "payload": {"overrides": {"FY27:EBITDA": 300}},
        }).status_code == 200
        restored = client.post(f"/api/models/checkpoints/{checkpoint_body['id']}/restore", json={})
        assert restored.status_code == 200, restored.text
        assert restored.json()["payload"]["overrides"]["FY27:EBITDA"] == 420

        app.dependency_overrides[get_identity] = _identity("analysis-model-other")
        assert client.post(f"/api/models/checkpoints/{checkpoint_body['id']}/restore", json={}).status_code == 404

    app.dependency_overrides.clear()
