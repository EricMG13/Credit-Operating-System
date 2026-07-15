"""Phase 1D digest and exact-run freshness adapters."""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient


def _identity(analyst_id: str, team_id: str | None = None):
    from identity import CallerIdentity

    return lambda: CallerIdentity(
        id=analyst_id,
        email=f"{analyst_id}@firm.test",
        full_name=analyst_id,
        source="profile",
        team_id=team_id,
    )


def test_digest_flag_parity_four_states_and_exact_historical_run(monkeypatch) -> None:
    from analysis_contracts import ArtifactRef
    from config import get_settings
    from context_lineage import bind_context_artifacts
    from database import AnalysisContextRecord, AsyncSessionLocal, Document, Issuer, Run
    from identity import get_identity
    from lineage_service import write_lineage_edge
    from main import app

    now = datetime.now(timezone.utc)
    issuer_ids = {
        "current": "fresh-adapter-current",
        "due": "fresh-adapter-due",
        "stale": "fresh-adapter-stale",
        "unknown": "fresh-adapter-unknown",
    }

    async def seed() -> None:
        async with AsyncSessionLocal() as db:
            db.add_all([
                Issuer(id=value, name=f"Adapter {state}")
                for state, value in issuer_ids.items()
            ])
            db.add(Issuer(
                id="fresh-adapter-transition",
                name="Adapter retained historical run",
            ))
            db.add_all([
                Run(
                    id="fresh-adapter-run-current", issuer_id=issuer_ids["current"],
                    analyst_id="fresh-adapter-owner", status="complete",
                    created_at=now - timedelta(days=1), completed_at=now - timedelta(days=1),
                ),
                Run(
                    id="fresh-adapter-run-due", issuer_id=issuer_ids["due"],
                    analyst_id="fresh-adapter-owner", status="complete",
                    created_at=now - timedelta(days=31), completed_at=now - timedelta(days=31),
                ),
                Run(
                    id="fresh-adapter-run-stale", issuer_id=issuer_ids["stale"],
                    analyst_id="fresh-adapter-owner", status="complete",
                    created_at=now - timedelta(days=46), completed_at=now - timedelta(days=46),
                ),
                # Older historical run for the current issuer proves the exact
                # endpoint never substitutes its latest run.
                Run(
                    id="fresh-adapter-run-history", issuer_id=issuer_ids["current"],
                    analyst_id="fresh-adapter-owner", status="complete",
                    created_at=now - timedelta(days=60), completed_at=now - timedelta(days=60),
                ),
                Run(
                    id="fresh-adapter-run-unproved", issuer_id=issuer_ids["unknown"],
                    analyst_id="fresh-adapter-owner", status="complete",
                    created_at=now - timedelta(days=1), completed_at=now - timedelta(days=1),
                ),
                Run(
                    id="fresh-adapter-run-queued", issuer_id=issuer_ids["unknown"],
                    analyst_id="fresh-adapter-owner", status="queued", created_at=now,
                ),
                Run(
                    id="fresh-adapter-transition-old",
                    issuer_id="fresh-adapter-transition",
                    analyst_id="fresh-adapter-owner", status="complete",
                    created_at=now - timedelta(days=60),
                    completed_at=now - timedelta(days=60),
                ),
                Run(
                    id="fresh-adapter-transition-new",
                    issuer_id="fresh-adapter-transition",
                    analyst_id="fresh-adapter-owner", status="complete",
                    created_at=now - timedelta(days=1),
                    completed_at=now - timedelta(days=1),
                ),
            ])
            proved_runs = {
                "fresh-adapter-run-current": issuer_ids["current"],
                "fresh-adapter-run-due": issuer_ids["due"],
                "fresh-adapter-run-stale": issuer_ids["stale"],
                "fresh-adapter-run-history": issuer_ids["current"],
            }
            for run_id, issuer_id in proved_runs.items():
                suffix = run_id.removeprefix("fresh-adapter-run-")
                db.add_all([
                    Document(
                        id=f"fresh-adapter-doc-{suffix}", issuer_id=issuer_id,
                        doc_type="Credit agreement", file_name=f"{suffix}.pdf",
                        storage_key=f"fixtures/{suffix}.pdf", source_kind="legal_document",
                        source_published_at=now,
                    ),
                    AnalysisContextRecord(
                        id=f"fresh-adapter-context-{suffix}", analyst_id="fresh-adapter-owner",
                        name=f"Proof {suffix}", issuer_ids=[issuer_id], artifacts={},
                    ),
                ])
            await db.flush()
            for run_id in proved_runs:
                suffix = run_id.removeprefix("fresh-adapter-run-")
                run_ref = ArtifactRef(kind="issuer_run", id=run_id)
                document_ref = ArtifactRef(kind="document", id=f"fresh-adapter-doc-{suffix}")
                await bind_context_artifacts(
                    db,
                    context_id=f"fresh-adapter-context-{suffix}",
                    analyst_id="fresh-adapter-owner",
                    refs=[run_ref, document_ref],
                    legacy_updates={"issuer_run_id": run_id},
                )
                await write_lineage_edge(
                    db,
                    context_id=f"fresh-adapter-context-{suffix}",
                    analyst_id="fresh-adapter-owner",
                    artifact=run_ref,
                    parent=document_ref,
                    transform="freshness-adapter-fixture",
                    transform_version="1",
                    enabled=True,
                )
            # One real transition context retains run A's typed identity after
            # run B becomes the active scalar pointer. Exact-run freshness must
            # still find and evaluate A instead of degrading it to UNKNOWN.
            transition_context_id = "fresh-adapter-context-transition"
            db.add_all([
                Document(
                    id="fresh-adapter-transition-doc-old",
                    issuer_id="fresh-adapter-transition",
                    doc_type="Credit agreement", file_name="transition-old.pdf",
                    storage_key="fixtures/transition-old.pdf",
                    source_kind="legal_document", source_published_at=now,
                ),
                Document(
                    id="fresh-adapter-transition-doc-new",
                    issuer_id="fresh-adapter-transition",
                    doc_type="Credit agreement", file_name="transition-new.pdf",
                    storage_key="fixtures/transition-new.pdf",
                    source_kind="legal_document", source_published_at=now,
                ),
                AnalysisContextRecord(
                    id=transition_context_id,
                    analyst_id="fresh-adapter-owner",
                    name="Historical run transition",
                    issuer_ids=["fresh-adapter-transition"], artifacts={},
                ),
            ])
            await db.flush()
            old_run_ref = ArtifactRef(
                kind="issuer_run", id="fresh-adapter-transition-old"
            )
            old_doc_ref = ArtifactRef(
                kind="document", id="fresh-adapter-transition-doc-old"
            )
            await bind_context_artifacts(
                db, context_id=transition_context_id,
                analyst_id="fresh-adapter-owner",
                refs=[old_run_ref, old_doc_ref],
                legacy_updates={"issuer_run_id": old_run_ref.id},
            )
            await write_lineage_edge(
                db, context_id=transition_context_id,
                analyst_id="fresh-adapter-owner", artifact=old_run_ref,
                parent=old_doc_ref, transform="freshness-transition",
                transform_version="1", enabled=True,
            )
            new_run_ref = ArtifactRef(
                kind="issuer_run", id="fresh-adapter-transition-new"
            )
            new_doc_ref = ArtifactRef(
                kind="document", id="fresh-adapter-transition-doc-new"
            )
            await bind_context_artifacts(
                db, context_id=transition_context_id,
                analyst_id="fresh-adapter-owner",
                refs=[new_run_ref, new_doc_ref],
                legacy_updates={"issuer_run_id": new_run_ref.id},
            )
            await write_lineage_edge(
                db, context_id=transition_context_id,
                analyst_id="fresh-adapter-owner", artifact=new_run_ref,
                parent=new_doc_ref, transform="freshness-transition",
                transform_version="1", enabled=True,
            )
            await db.commit()

    with TestClient(app) as client:
        asyncio.run(seed())
        app.dependency_overrides[get_identity] = _identity("fresh-adapter-owner")

        monkeypatch.setattr(get_settings(), "caos_lineage_v2_enabled", False)
        legacy = client.get("/api/digest/daily?days=7")
        assert legacy.status_code == 200, legacy.text
        assert "freshness" not in legacy.json()
        assert legacy.json()["stale_threshold_days"] == 7
        assert client.get("/api/runs/fresh-adapter-run-history/freshness").status_code == 404

        monkeypatch.setattr(get_settings(), "caos_lineage_v2_enabled", True)
        response = client.get("/api/digest/daily?days=7")
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["stale_threshold_days"] == 7  # legacy lane stays intact
        assert body["freshness"]["policy_version"] == "caos-freshness-v1"
        states = {
            row["issuer_id"]: row["evaluation"]["state"]
            for row in body["freshness"]["rows"]
        }
        assert {state: states[issuer_id] for state, issuer_id in issuer_ids.items()} == {
            "current": "current", "due": "due", "stale": "stale", "unknown": "unknown",
        }
        assert sum(body["freshness"]["counts"].values()) == body["coverage"]["issuers"]

        historical = client.get("/api/runs/fresh-adapter-run-history/freshness")
        latest = client.get("/api/runs/fresh-adapter-run-current/freshness")
        assert historical.status_code == latest.status_code == 200
        assert historical.json()["run_id"] == "fresh-adapter-run-history"
        assert historical.json()["evaluation"]["state"] == "stale"
        assert latest.json()["evaluation"]["state"] == "current"
        queued = client.get("/api/runs/fresh-adapter-run-queued/freshness")
        assert queued.status_code == 200
        assert queued.json()["evaluation"]["state"] == "unknown"
        unproved = client.get("/api/runs/fresh-adapter-run-unproved/freshness")
        assert unproved.status_code == 200
        assert unproved.json()["evaluation"]["state"] == "unknown"
        assert unproved.json()["evaluation"]["reason"] == "source_version_unknown"
        retained = client.get("/api/runs/fresh-adapter-transition-old/freshness")
        assert retained.status_code == 200, retained.text
        assert retained.json()["evaluation"]["state"] == "stale"
        assert retained.json()["evaluation"]["reason"] != "source_version_unknown"

    app.dependency_overrides.clear()


def test_exact_run_freshness_foreign_team_is_non_enumerable(monkeypatch) -> None:
    from config import get_settings
    from database import AsyncSessionLocal, Issuer, Run
    from identity import get_identity
    from main import app

    async def seed() -> None:
        async with AsyncSessionLocal() as db:
            db.add(Issuer(id="fresh-adapter-team-a", name="Team A", team_id="team-a"))
            db.add(Run(
                id="fresh-adapter-team-a-run", issuer_id="fresh-adapter-team-a",
                analyst_id="team-a-owner", status="complete",
                completed_at=datetime.now(timezone.utc),
            ))
            await db.commit()

    with TestClient(app) as client:
        asyncio.run(seed())
        monkeypatch.setattr(get_settings(), "caos_lineage_v2_enabled", True)
        monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)
        app.dependency_overrides[get_identity] = _identity("team-b-reader", "team-b")
        assert client.get("/api/runs/fresh-adapter-team-a-run/freshness").status_code == 404

    app.dependency_overrides.clear()
