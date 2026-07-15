"""Canonical freshness policy, intake metadata and authorized read contracts."""

from __future__ import annotations

import asyncio
import json
import sqlite3
from datetime import date, datetime, timedelta, timezone

import pytest
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


@pytest.mark.parametrize(
    "cadence,period,now,state",
    [
        ("quarterly", date(2026, 3, 31), datetime(2026, 6, 29, tzinfo=timezone.utc), "current"),
        ("quarterly", date(2026, 3, 31), datetime(2026, 6, 30, tzinfo=timezone.utc), "due"),
        ("quarterly", date(2026, 3, 31), datetime(2026, 8, 21, tzinfo=timezone.utc), "due"),
        ("quarterly", date(2026, 3, 31), datetime(2026, 8, 22, tzinfo=timezone.utc), "stale"),
        ("semiannual", date(2024, 8, 31), datetime(2025, 2, 28, tzinfo=timezone.utc), "due"),
        ("annual", date(2024, 2, 29), datetime(2025, 2, 28, tzinfo=timezone.utc), "due"),
        ("private", date(2026, 3, 31), datetime(2026, 8, 23, tzinfo=timezone.utc), "unknown"),
        ("unknown", date(2026, 3, 31), datetime(2026, 8, 23, tzinfo=timezone.utc), "unknown"),
    ],
)
def test_reporting_policy_calendar_boundaries(cadence, period, now, state) -> None:
    from freshness import evaluate_freshness

    result = evaluate_freshness(
        source_kind="reported_financials",
        now=now,
        effective_period_end=period,
        cadence=cadence,
    )
    assert result.state == state
    assert result.policy_version == "caos-freshness-v1"


def test_independent_clocks_unknowns_and_source_invalidation() -> None:
    from freshness import evaluate_freshness

    now = datetime(2026, 7, 14, 12, tzinfo=timezone.utc)
    assert evaluate_freshness(
        source_kind="price", now=now, observed_at=now - timedelta(days=1)
    ).state == "current"
    assert evaluate_freshness(
        source_kind="price", now=now, observed_at=now - timedelta(days=2)
    ).state == "due"
    assert evaluate_freshness(
        source_kind="price", now=now, observed_at=now - timedelta(days=4)
    ).state == "stale"
    assert evaluate_freshness(
        source_kind="run", now=now, observed_at=now - timedelta(days=31)
    ).state == "due"
    assert evaluate_freshness(
        source_kind="derived_artifact", now=now, observed_at=now,
        source_version_state="changed",
    ).reason == "source_version_changed"
    assert evaluate_freshness(
        source_kind="derived_artifact", now=now, observed_at=now,
        source_version_state="unknown",
    ).state == "unknown"
    assert evaluate_freshness(
        source_kind="rating", now=now, observed_at=None,
        source_version_state="unknown",
    ).state == "unknown"
    assert evaluate_freshness(
        source_kind="legal_document", now=now,
        observed_at=now + timedelta(days=1),
    ).reason == "future_observation"
    assert evaluate_freshness(
        source_kind="price", now=now,
        observed_at=now + timedelta(seconds=1),
    ).reason == "future_observation"
    assert evaluate_freshness(
        source_kind="reported_financials", now=now,
        effective_period_end=now.date() + timedelta(days=1), cadence="quarterly",
    ).reason == "future_effective_period"
    assert evaluate_freshness(
        source_kind="price", now=now, observed_at="not-a-date"
    ).reason == "invalid_observed_at"
    # Naive values are documented UTC and evaluate identically.
    assert evaluate_freshness(
        source_kind="run", now=now.replace(tzinfo=None),
        observed_at=(now - timedelta(days=46)).replace(tzinfo=None),
    ).state == "stale"


def test_0053_upgrade_downgrade_reupgrade_is_additive(tmp_path) -> None:
    from test_migrations import _alembic

    db_path = tmp_path / "freshness.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"
    assert _alembic("upgrade", "0052", db_url=db_url).returncode == 0
    for command, revision, present in (
        ("upgrade", "0053", True),
        ("downgrade", "0052", False),
        ("upgrade", "0053", True),
    ):
        result = _alembic(command, revision, db_url=db_url)
        assert result.returncode == 0, result.stderr
        with sqlite3.connect(db_path) as connection:
            tables = {row[0] for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )}
            issuer_columns = {row[1] for row in connection.execute("PRAGMA table_info(issuers)")}
            document_columns = {row[1] for row in connection.execute("PRAGMA table_info(documents)")}
            assert ("issuer_reporting_profiles" in tables) is present
            assert ("ratings_observed_at" in issuer_columns) is present
            assert ("effective_period_end" in document_columns) is present


def test_0054_backfills_legacy_report_current_to_policy_unknown(tmp_path) -> None:
    from test_migrations import _alembic

    db_path = tmp_path / "report-freshness.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"
    assert _alembic("upgrade", "0053", db_url=db_url).returncode == 0
    with sqlite3.connect(db_path) as connection:
        connection.execute(
            """INSERT INTO report_versions
            (id, context_id, analyst_id, run_id, model_checkpoint_id, thesis_version_id,
             status, payload, document_sha256, authority, created_at)
            VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)""",
            (
                "legacy-report", "legacy-context", "legacy-owner", "legacy-run",
                "legacy-checkpoint", "published", "{}", "f" * 64,
                '{"origin":"live","freshness":"current"}', "2026-07-14T00:00:00Z",
            ),
        )
        connection.commit()

    assert _alembic("upgrade", "0054", db_url=db_url).returncode == 0
    with sqlite3.connect(db_path) as connection:
        authority = json.loads(connection.execute(
            "SELECT authority FROM report_versions WHERE id = 'legacy-report'"
        ).fetchone()[0])
    assert authority["freshness"] == "unknown"
    assert authority["freshness_evaluation"]["state"] == "unknown"
    assert authority["freshness_evaluation"]["reason"] == "legacy_report_freshness_unverified"

    assert _alembic("downgrade", "0053", db_url=db_url).returncode == 0
    with sqlite3.connect(db_path) as connection:
        downgraded = json.loads(connection.execute(
            "SELECT authority FROM report_versions WHERE id = 'legacy-report'"
        ).fetchone()[0])
    assert downgraded["freshness"] == "unknown"
    assert "freshness_evaluation" not in downgraded

    assert _alembic("upgrade", "0054", db_url=db_url).returncode == 0
    with sqlite3.connect(db_path) as connection:
        reupgraded = json.loads(connection.execute(
            "SELECT authority FROM report_versions WHERE id = 'legacy-report'"
        ).fetchone()[0])
    assert reupgraded["freshness_evaluation"]["state"] == "unknown"


def test_0054_postgres_offline_sql_emits_fail_closed_backfill() -> None:
    from test_migrations import _alembic

    result = _alembic(
        "upgrade", "0053:0054", "--sql",
        db_url="postgresql+asyncpg://offline:offline@localhost/caos",
    )
    assert result.returncode == 0, result.stderr
    assert "UPDATE report_versions" in result.stdout
    assert "WHERE NOT COALESCE((" in result.stdout
    assert '"freshness":"unknown"' in result.stdout
    assert '"observed_at": null' in result.stdout
    assert "legacy_report_freshness_unverified" in result.stdout


def test_reporting_profile_flag_validation_intake_and_unknown_defaults(monkeypatch) -> None:
    import ingest
    from config import get_settings
    from identity import get_identity
    from main import app

    with TestClient(app) as client:
        app.dependency_overrides[get_identity] = _identity("freshness-owner")
        issuer_id = client.get("/api/issuers/").json()[0]["id"]
        monkeypatch.setattr(get_settings(), "caos_lineage_v2_enabled", False)
        assert client.get(f"/api/issuers/{issuer_id}/reporting-profile").status_code == 404
        malformed_flag_off = client.put(
            f"/api/issuers/{issuer_id}/reporting-profile", json={"cadence": "bogus"}
        )
        assert malformed_flag_off.status_code == 404
        assert client.get(f"/api/issuers/{issuer_id}/freshness").status_code == 404

        monkeypatch.setattr(get_settings(), "caos_lineage_v2_enabled", True)
        default = client.get(f"/api/issuers/{issuer_id}/reporting-profile")
        assert default.status_code == 200
        assert default.json()["configured"] is False
        assert default.json()["cadence"] == "unknown"
        freshness = client.get(f"/api/issuers/{issuer_id}/freshness").json()
        assert {row["source_kind"] for row in freshness["evaluations"]} == {
            "reported_financials", "price", "rating", "legal_document", "run", "derived_artifact"
        }
        assert next(
            row for row in freshness["evaluations"] if row["source_kind"] == "reported_financials"
        )["state"] == "unknown"

        assert client.put(f"/api/issuers/{issuer_id}/reporting-profile", json={
            "cadence": "quarterly", "fiscal_year_end_month": 2,
            "fiscal_year_end_day": 30, "grace_days": 7,
        }).status_code == 422
        saved = client.put(f"/api/issuers/{issuer_id}/reporting-profile", json={
            "cadence": "quarterly", "fiscal_year_end_month": 12,
            "fiscal_year_end_day": 31, "reporting_lag_days": 45, "grace_days": 7,
        })
        assert saved.status_code == 200, saved.text
        assert saved.json()["configured"] is True
        assert saved.json()["updated_by"] == "freshness-owner"

        monkeypatch.setattr(ingest, "extract_pdf_text", lambda *_args, **_kwargs: ("reported facts " * 40, False))
        pdf = b"%PDF-1.4\n%%EOF"
        uploaded = client.post(
            "/api/ingestion/upload/document",
            data={
                "issuer_id": issuer_id,
                "source_kind": "reported_financials",
                "fiscal_period": "Q2 2026",
                "effective_period_end": "2026-06-30",
                "source_published_at": "2026-07-10T08:30:00Z",
            },
            files={"file": ("results.pdf", pdf, "application/pdf")},
        )
        assert uploaded.status_code == 200, uploaded.text
        document = next(
            row for row in client.get(f"/api/issuers/{issuer_id}/documents").json()
            if row["id"] == uploaded.json()["document_id"]
        )
        assert document["source_kind"] == "reported_financials"
        assert document["effective_period_end"] == "2026-06-30"
        assert document["source_published_at"].startswith("2026-07-10T08:30:00")

        app.dependency_overrides[get_identity] = _identity("freshness-other")
        # Single-team mode shares issuers, so the object is intentionally visible;
        # the server actor stamp changes only on a write by that authenticated user.
        assert client.get(f"/api/issuers/{issuer_id}/freshness").status_code == 200

    app.dependency_overrides.clear()


def test_rating_observation_and_edgar_filed_date_are_persisted(monkeypatch) -> None:
    from conftest import ratings_xlsx
    from config import get_settings
    from database import AsyncSessionLocal, Document, Issuer
    from identity import get_identity
    from main import app
    import edgar
    import ingest

    with TestClient(app) as client:
        app.dependency_overrides[get_identity] = _identity("fresh-source-owner")
        monkeypatch.setattr(get_settings(), "caos_lineage_v2_enabled", True)
        created = client.post("/api/issuers/", json={"name": "Fresh Rating Co"})
        assert created.status_code == 201, created.text
        issuer_id = created.json()["id"]
        workbook = ratings_xlsx([("Fresh Rating Co", "B1 / B+")])
        pricing = client.post(
            "/api/ingestion/upload/pricing-sheet",
            data={"issuer_id": issuer_id, "source_kind": "rating"},
            files={"file": (
                "ratings.xlsx", workbook,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )},
        )
        assert pricing.status_code == 200, pricing.text
        assert pricing.json()["ratings_updated"] == 1

        async def load_issuer() -> Issuer:
            async with AsyncSessionLocal() as db:
                return await db.get(Issuer, issuer_id)

        rated = asyncio.run(load_issuer())
        assert rated is not None and rated.ratings_observed_at is not None

        monkeypatch.setattr(get_settings(), "edgar_user_agent", "CAOS tests ops@example.test")
        monkeypatch.setattr(edgar, "fetch_exhibit", lambda _url: b"<html>credit agreement text</html>")
        monkeypatch.setattr(ingest, "extract_text", lambda *_args, **_kwargs: "credit agreement " * 40)
        vaulted = client.post("/api/edgar/vault-url", json={
            "issuer_id": issuer_id,
            "exhibit_url": "https://www.sec.gov/Archives/example.htm",
            "filed_date": "2026-06-18",
        })
        assert vaulted.status_code == 200, vaulted.text

        async def load_document() -> Document:
            async with AsyncSessionLocal() as db:
                return await db.get(Document, vaulted.json()["document_id"])

        legal = asyncio.run(load_document())
        assert legal is not None and legal.source_kind == "legal_document"
        assert legal.source_published_at.date().isoformat() == "2026-06-18"

    app.dependency_overrides.clear()


def test_team_foreign_issuer_freshness_routes_are_non_enumerable(monkeypatch) -> None:
    from config import get_settings
    from database import AsyncSessionLocal, Issuer
    from identity import get_identity
    from main import app

    async def seed_foreign() -> None:
        async with AsyncSessionLocal() as db:
            db.add(Issuer(id="fresh-team-a", name="Team A Freshness", team_id="team-a"))
            await db.commit()

    with TestClient(app) as client:
        asyncio.run(seed_foreign())
        monkeypatch.setattr(get_settings(), "caos_lineage_v2_enabled", True)
        monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)
        app.dependency_overrides[get_identity] = _identity("fresh-team-b-user", "team-b")
        assert client.get("/api/issuers/fresh-team-a/reporting-profile").status_code == 404
        assert client.get("/api/issuers/fresh-team-a/freshness").status_code == 404
        assert client.put("/api/issuers/fresh-team-a/reporting-profile", json={
            "cadence": "quarterly"
        }).status_code == 404

    app.dependency_overrides.clear()


def test_context_freshness_marks_replaced_bound_source_stale(monkeypatch) -> None:
    from analysis_contracts import ArtifactRef
    from config import get_settings
    from database import AnalysisInsight, AsyncSessionLocal, Document, SourceManifest
    from identity import get_identity
    from lineage_service import write_lineage_edge
    from main import app

    with TestClient(app) as client:
        monkeypatch.setattr(get_settings(), "caos_lineage_v2_enabled", True)
        app.dependency_overrides[get_identity] = _identity("fresh-context-owner")
        # Create the context before its insight because of the FK.
        context = client.post("/api/analysis/contexts", json={"name": "Fresh context"})
        assert context.status_code == 201, context.text
        context_id = context.json()["id"]
        monkeypatch.setattr(get_settings(), "caos_lineage_v2_enabled", False)
        assert client.get(f"/api/analysis/contexts/{context_id}/freshness").status_code == 404
        monkeypatch.setattr(get_settings(), "caos_lineage_v2_enabled", True)

        async def seed_for_context() -> None:
            async with AsyncSessionLocal() as db:
                issuer_id = "a71f0000-0000-0000-0000-000000000001"
                common = dict(
                    analyst_id="fresh-context-owner", issuer_id=issuer_id,
                    origin="live", method="reported", status="ready", files=[], authority={},
                )
                db.add_all([
                    Document(
                        id="fresh-document-v1", issuer_id=issuer_id,
                        doc_type="Legal", run_mode="legal", file_name="v1.pdf",
                        storage_key="v1", source_kind="legal_document",
                        source_published_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
                    ),
                    Document(
                        id="fresh-document-v2", issuer_id=issuer_id,
                        doc_type="Legal", run_mode="legal", file_name="v2.pdf",
                        storage_key="v2", source_kind="legal_document",
                        source_published_at=datetime(2026, 7, 1, tzinfo=timezone.utc),
                    ),
                    SourceManifest(id="fresh-source-v1", **common),
                    SourceManifest(id="fresh-source-v2", **common),
                    AnalysisInsight(
                        id="fresh-derived", analyst_id="fresh-context-owner", context_id=context_id,
                        surface="command", kind="decision-brief", status="ready",
                        subject_refs={}, summary="Derived", claims=[], recommended_actions=[],
                        missing_dependencies=[], authority={}, source_fingerprint="f" * 64,
                        version=1, generated_at=datetime.now(timezone.utc),
                    ),
                ])
                await db.commit()

        asyncio.run(seed_for_context())
        bound = client.patch(f"/api/analysis/contexts/{context_id}", json={
            "artifacts": {"artifact_refs": [
                {"kind": "source_manifest", "id": "fresh-source-v1"},
                {"kind": "document", "id": "fresh-document-v1"},
                {"kind": "insight", "id": "fresh-derived", "version": "1"},
            ]},
        })
        assert bound.status_code == 200, bound.text

        async def link() -> None:
            async with AsyncSessionLocal() as db:
                await write_lineage_edge(
                    db, context_id=context_id, analyst_id="fresh-context-owner",
                    artifact=ArtifactRef(kind="source_manifest", id="fresh-source-v1"),
                    parent=ArtifactRef(kind="document", id="fresh-document-v1"),
                    transform="ingestion", transform_version="2", enabled=True,
                )
                await write_lineage_edge(
                    db, context_id=context_id, analyst_id="fresh-context-owner",
                    artifact=ArtifactRef(kind="insight", id="fresh-derived", version="1"),
                    parent=ArtifactRef(kind="source_manifest", id="fresh-source-v1"),
                    transform="synthesize", transform_version="1", enabled=True,
                )
                await db.commit()

        asyncio.run(link())
        current = client.get(f"/api/analysis/contexts/{context_id}/freshness")
        assert current.status_code == 200, current.text
        insight = next(row for row in current.json()["artifacts"] if row["artifact"]["kind"] == "insight")
        assert insight["evaluation"]["state"] == "current"

        async def producer_rebind() -> None:
            from context_lineage import bind_context_artifacts

            async with AsyncSessionLocal() as db:
                await bind_context_artifacts(
                    db,
                    context_id=context_id,
                    analyst_id="fresh-context-owner",
                    refs=[ArtifactRef(kind="source_manifest", id="fresh-source-v2")],
                    legacy_updates={"source_manifest_id": "fresh-source-v2"},
                )
                await bind_context_artifacts(
                    db,
                    context_id=context_id,
                    analyst_id="fresh-context-owner",
                    refs=[ArtifactRef(kind="document", id="fresh-document-v2")],
                )
                await write_lineage_edge(
                    db, context_id=context_id, analyst_id="fresh-context-owner",
                    artifact=ArtifactRef(kind="source_manifest", id="fresh-source-v2"),
                    parent=ArtifactRef(kind="document", id="fresh-document-v2"),
                    transform="ingestion", transform_version="2", enabled=True,
                )
                await db.commit()

        # The normal producer merge retains v1 for history and adds v2. The
        # current source-set comparison must still invalidate the v1-derived view.
        asyncio.run(producer_rebind())

        async def add_incomplete_parent() -> None:
            async with AsyncSessionLocal() as db:
                await write_lineage_edge(
                    db, context_id=context_id, analyst_id="fresh-context-owner",
                    artifact=ArtifactRef(kind="insight", id="fresh-derived", version="1"),
                    parent=ArtifactRef(kind="document", id="unbound-source"),
                    transform="synthesize", transform_version="1", enabled=True,
                )
                await db.commit()

        # Incomplete lineage must not mask the already-proven v1 -> v2 mismatch.
        asyncio.run(add_incomplete_parent())
        stale = client.get(f"/api/analysis/contexts/{context_id}/freshness").json()
        insight = next(row for row in stale["artifacts"] if row["artifact"]["kind"] == "insight")
        assert insight["evaluation"]["state"] == "stale"
        assert insight["evaluation"]["reason"] == "source_version_changed"

        async def derive_after_rebind() -> None:
            from context_lineage import bind_context_artifacts

            async with AsyncSessionLocal() as db:
                db.add(AnalysisInsight(
                    id="fresh-derived-v2", analyst_id="fresh-context-owner", context_id=context_id,
                    surface="command", kind="decision-brief", status="ready",
                    subject_refs={}, summary="Derived after rebind", claims=[],
                    recommended_actions=[], missing_dependencies=[], authority={},
                    source_fingerprint="e" * 64, version=2,
                    generated_at=datetime.now(timezone.utc),
                ))
                await db.flush()
                await bind_context_artifacts(
                    db, context_id=context_id, analyst_id="fresh-context-owner",
                    refs=[ArtifactRef(kind="insight", id="fresh-derived-v2", version="2")],
                    legacy_updates={"insight_id": "fresh-derived-v2"},
                )
                await write_lineage_edge(
                    db, context_id=context_id, analyst_id="fresh-context-owner",
                    artifact=ArtifactRef(kind="insight", id="fresh-derived-v2", version="2"),
                    parent=ArtifactRef(kind="source_manifest", id="fresh-source-v2"),
                    transform="synthesize", transform_version="2", enabled=True,
                )
                await db.commit()

        asyncio.run(derive_after_rebind())
        refreshed = client.get(f"/api/analysis/contexts/{context_id}/freshness").json()
        current_v2 = next(
            row for row in refreshed["artifacts"]
            if row["artifact"]["id"] == "fresh-derived-v2"
        )
        assert current_v2["evaluation"]["state"] == "current"

        app.dependency_overrides[get_identity] = _identity("fresh-context-other")
        assert client.get(f"/api/analysis/contexts/{context_id}/freshness").status_code == 404

    app.dependency_overrides.clear()


def test_stale_run_propagates_to_bound_checkpoint(monkeypatch) -> None:
    from analysis_contracts import ArtifactRef
    from config import get_settings
    from context_lineage import bind_context_artifacts
    from database import AsyncSessionLocal, Document, ModelCheckpoint, Run
    from identity import get_identity
    from lineage_service import write_lineage_edge
    from main import app

    owner = "fresh-propagation-owner"
    issuer_id = "a71f0000-0000-0000-0000-000000000001"
    now = datetime.now(timezone.utc)
    with TestClient(app) as client:
        monkeypatch.setattr(get_settings(), "caos_lineage_v2_enabled", True)
        app.dependency_overrides[get_identity] = _identity(owner)
        created = client.post("/api/analysis/contexts", json={"name": "Propagation"})
        assert created.status_code == 201, created.text
        context_id = created.json()["id"]

        async def seed_graph() -> None:
            async with AsyncSessionLocal() as db:
                db.add_all([
                    Document(
                        id="fresh-prop-doc-v1", issuer_id=issuer_id, doc_type="Legal",
                        file_name="v1.pdf", storage_key="prop-v1",
                        source_kind="legal_document", source_published_at=now - timedelta(days=2),
                    ),
                    Document(
                        id="fresh-prop-doc-v2", issuer_id=issuer_id, doc_type="Legal",
                        file_name="v2.pdf", storage_key="prop-v2",
                        source_kind="legal_document", source_published_at=now - timedelta(days=1),
                    ),
                    Run(
                        id="fresh-prop-run", issuer_id=issuer_id, analyst_id=owner,
                        status="complete", created_at=now, completed_at=now,
                    ),
                    ModelCheckpoint(
                        id="fresh-prop-checkpoint", issuer_id=issuer_id, analyst_id=owner,
                        context_id=context_id, issuer_run_id="fresh-prop-run", label="Base",
                        payload_hash="a" * 64, payload={}, authority={}, created_at=now,
                    ),
                ])
                await db.flush()
                await bind_context_artifacts(
                    db, context_id=context_id, analyst_id=owner,
                    refs=[
                        ArtifactRef(kind="document", id="fresh-prop-doc-v1"),
                        ArtifactRef(kind="issuer_run", id="fresh-prop-run"),
                        ArtifactRef(
                            kind="model_checkpoint", id="fresh-prop-checkpoint", version="a" * 64
                        ),
                    ],
                    legacy_updates={
                        "issuer_run_id": "fresh-prop-run",
                        "model_checkpoint_id": "fresh-prop-checkpoint",
                    },
                )
                await write_lineage_edge(
                    db, context_id=context_id, analyst_id=owner,
                    artifact=ArtifactRef(kind="issuer_run", id="fresh-prop-run"),
                    parent=ArtifactRef(kind="document", id="fresh-prop-doc-v1"),
                    transform="run-creation", transform_version="2", enabled=True,
                )
                await write_lineage_edge(
                    db, context_id=context_id, analyst_id=owner,
                    artifact=ArtifactRef(
                        kind="model_checkpoint", id="fresh-prop-checkpoint", version="a" * 64
                    ),
                    parent=ArtifactRef(kind="issuer_run", id="fresh-prop-run"),
                    transform="model-checkpoint", transform_version="2", enabled=True,
                )
                await db.commit()

        asyncio.run(seed_graph())
        initial = client.get(f"/api/analysis/contexts/{context_id}/freshness").json()
        assert next(
            row for row in initial["artifacts"] if row["artifact"]["kind"] == "issuer_run"
        )["evaluation"]["state"] == "current"
        assert next(
            row for row in initial["artifacts"] if row["artifact"]["kind"] == "model_checkpoint"
        )["evaluation"]["state"] == "current"

        async def add_source() -> None:
            async with AsyncSessionLocal() as db:
                await bind_context_artifacts(
                    db, context_id=context_id, analyst_id=owner,
                    refs=[ArtifactRef(kind="document", id="fresh-prop-doc-v2")],
                )
                await db.commit()

        asyncio.run(add_source())
        changed = client.get(f"/api/analysis/contexts/{context_id}/freshness").json()
        run_eval = next(
            row for row in changed["artifacts"] if row["artifact"]["kind"] == "issuer_run"
        )["evaluation"]
        checkpoint_eval = next(
            row for row in changed["artifacts"] if row["artifact"]["kind"] == "model_checkpoint"
        )["evaluation"]
        assert run_eval["state"] == "stale" and run_eval["reason"] == "source_version_changed"
        assert checkpoint_eval["state"] == "stale"
        assert checkpoint_eval["reason"] == "bound_source_stale"

    app.dependency_overrides.clear()
