"""Focused contracts for the additive, authorization-preserving lineage v2 slice."""

from __future__ import annotations

import asyncio
import os
import sqlite3
import uuid
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import func, select

ALL_ARTIFACT_KINDS = (
    "issuer_run", "source_manifest", "research_job", "model_checkpoint",
    "report_version", "alert_event", "sponsor", "portfolio", "decision",
    "insight", "document", "document_chunk", "market_snapshot",
)


def _identity(analyst_id: str, team_id: str | None = None):
    from identity import CallerIdentity

    return lambda: CallerIdentity(
        id=analyst_id,
        email=f"{analyst_id}@firm.test",
        full_name=analyst_id,
        source="profile",
        team_id=team_id,
    )


def test_artifact_ref_contract_is_closed_bounded_and_scalar_compatible() -> None:
    from analysis_contracts import AnalysisArtifactRefs, ArtifactRef

    legacy = AnalysisArtifactRefs(issuer_run_id="run-1")
    assert legacy.model_dump(mode="json") == {
        "issuer_run_id": "run-1",
        "source_manifest_id": None,
        "research_job_id": None,
        "model_checkpoint_id": None,
        "report_version_id": None,
        "alert_event_id": None,
        "sponsor_id": None,
        "portfolio_id": None,
        "decision_id": None,
        "insight_id": None,
    }
    assert ArtifactRef(kind="report_version", id="report-1", version="v2").model_dump() == {
        "kind": "report_version", "id": "report-1", "version": "v2"
    }
    with pytest.raises(ValidationError):
        ArtifactRef(kind="arbitrary_table", id="row-1")
    with pytest.raises(ValidationError):
        ArtifactRef(kind="report_version", id="ambiguous:id")
    with pytest.raises(ValidationError):
        ArtifactRef(kind="report_version", id="x" * 97)
    explicit_empty = AnalysisArtifactRefs(artifact_refs=[])
    assert explicit_empty.model_dump(mode="json")["artifact_refs"] == []


def test_lineage_insert_sql_is_conflict_safe_for_both_supported_dialects() -> None:
    from sqlalchemy.dialects import postgresql, sqlite

    from lineage_service import lineage_insert_statement

    values = {
        "artifact_id": "document:doc-1",
        "parent_id": "issuer_run:run-1",
        "transform": "extract",
        "transform_version": "1",
        "v2_idempotency_key": "c" * 64,
    }
    postgres_sql = str(lineage_insert_statement("postgresql", values).compile(
        dialect=postgresql.dialect()
    ))
    sqlite_sql = str(lineage_insert_statement("sqlite", values).compile(
        dialect=sqlite.dialect()
    ))
    assert "ON CONFLICT (v2_idempotency_key) DO NOTHING" in postgres_sql
    assert "ON CONFLICT (v2_idempotency_key) DO NOTHING" in sqlite_sql
    with pytest.raises(RuntimeError):
        lineage_insert_statement("unsupported", values)


@pytest.mark.asyncio
async def test_lineage_writer_is_flag_gated_idempotent_and_never_commits(seeded_db) -> None:
    from analysis_contracts import ArtifactRef
    from database import AnalysisContextRecord, AsyncSessionLocal, LineageEdge
    from lineage_service import canonical_artifact_id, write_lineage_edge

    artifact = ArtifactRef(kind="report_version", id="report-id", version="3")
    parent = ArtifactRef(kind="model_checkpoint", id="checkpoint-id", version="2")
    assert canonical_artifact_id(artifact) == "report_version:report-id"

    async with AsyncSessionLocal() as db:
        db.add(AnalysisContextRecord(
            id="lineage-service-context",
            analyst_id="lineage-service-owner",
            name="Lineage service",
        ))
        await db.flush()
        assert await write_lineage_edge(
            db,
            context_id="lineage-service-context",
            analyst_id="lineage-service-owner",
            artifact=artifact,
            parent=parent,
            transform="publish",
            transform_version="1",
            enabled=False,
        ) is None
        commit = AsyncMock()
        with patch.object(db, "commit", commit):
            first = await write_lineage_edge(
                db, context_id="lineage-service-context",
                analyst_id="lineage-service-owner", artifact=artifact, parent=parent,
                transform="publish", transform_version="1", enabled=True,
            )
            second = await write_lineage_edge(
                db, context_id="lineage-service-context",
                analyst_id="lineage-service-owner", artifact=artifact, parent=parent,
                transform="publish", transform_version="1", enabled=True,
            )
            commit.assert_not_awaited()
        assert first.id == second.id
        assert (await db.execute(
            select(func.count()).select_from(LineageEdge).where(
                LineageEdge.context_id == "lineage-service-context"
            )
        )).scalar_one() == 1
        db.add_all([
            LineageEdge(
                artifact_id="legacy-artifact", parent_id="legacy-parent",
                transform="extract", transform_version="1",
            ),
            LineageEdge(
                artifact_id="legacy-artifact", parent_id="legacy-parent",
                transform="extract", transform_version="1",
            ),
        ])
        await db.flush()


@pytest.mark.asyncio
async def test_lineage_context_fk_is_enforced_and_cascades(seeded_db) -> None:
    from sqlalchemy import delete, text

    from database import AnalysisContextRecord, AsyncSessionLocal, LineageEdge

    async with AsyncSessionLocal() as db:
        await db.execute(text("PRAGMA foreign_keys=ON"))
        assert (await db.execute(text("PRAGMA foreign_keys"))).scalar_one() == 1
        db.add(AnalysisContextRecord(
            id="lineage-fk-context", analyst_id="lineage-fk-owner", name="FK"
        ))
        await db.flush()
        db.add(LineageEdge(
            id="lineage-fk-edge", artifact_id="document:doc",
            parent_id="issuer_run:run", transform="extract", transform_version="1",
            context_id="lineage-fk-context", analyst_id="lineage-fk-owner",
            artifact_kind="document", parent_kind="issuer_run",
            v2_idempotency_key="d" * 64,
        ))
        await db.flush()
        await db.execute(delete(AnalysisContextRecord).where(
            AnalysisContextRecord.id == "lineage-fk-context"
        ))
        await db.flush()
        assert await db.get(LineageEdge, "lineage-fk-edge") is None


def test_0051_duplicate_lineage_rows_survive_0052_upgrade_downgrade_reupgrade(tmp_path) -> None:
    from test_migrations import _alembic

    db_path = tmp_path / "lineage-preservation.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"
    result = _alembic("upgrade", "0051", db_url=db_url)
    assert result.returncode == 0, result.stderr
    with sqlite3.connect(db_path) as connection:
        for edge_id in ("legacy-duplicate-a", "legacy-duplicate-b"):
            connection.execute(
                "INSERT INTO lineage_edges "
                "(id, artifact_id, parent_id, transform, transform_version, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (edge_id, "legacy-artifact", "legacy-parent", "extract", "1",
                 "2026-07-13 00:00:00"),
            )
        connection.commit()

    for command, revision, has_v2 in (
        ("upgrade", "0052", True),
        ("downgrade", "0051", False),
        ("upgrade", "0052", True),
    ):
        result = _alembic(command, revision, db_url=db_url)
        assert result.returncode == 0, result.stderr
        with sqlite3.connect(db_path) as connection:
            rows = connection.execute(
                "SELECT id, artifact_id, parent_id, transform, transform_version "
                "FROM lineage_edges WHERE id LIKE 'legacy-duplicate-%' ORDER BY id"
            ).fetchall()
            assert rows == [
                ("legacy-duplicate-a", "legacy-artifact", "legacy-parent", "extract", "1"),
                ("legacy-duplicate-b", "legacy-artifact", "legacy-parent", "extract", "1"),
            ]
            columns = {row[1] for row in connection.execute("PRAGMA table_info(lineage_edges)")}
            assert ("v2_idempotency_key" in columns) is has_v2
            if has_v2:
                assert connection.execute(
                    "SELECT COUNT(*) FROM lineage_edges "
                    "WHERE id LIKE 'legacy-duplicate-%' AND v2_idempotency_key IS NULL"
                ).fetchone()[0] == 2


def test_lineage_api_roundtrips_flag_off_then_returns_only_owned_bound_edges(monkeypatch) -> None:
    from analysis_contracts import ArtifactRef
    from config import get_settings
    from database import AsyncSessionLocal, SourceManifest
    from identity import get_identity
    from lineage_service import write_lineage_edge
    from main import app

    async def _seed_manifests() -> None:
        async with AsyncSessionLocal() as db:
            common = {
                "issuer_id": "a71f0000-0000-0000-0000-000000000001",
                "origin": "test",
                "method": "fixture",
                "status": "ready",
                "files": [],
                "authority": {},
            }
            db.add(SourceManifest(
                id="lineage-manifest-parent", analyst_id="lineage-api-owner", **common
            ))
            db.add(SourceManifest(
                id="lineage-manifest-child", analyst_id="lineage-api-owner", **common
            ))
            db.add(SourceManifest(
                id="lineage-manifest-foreign", analyst_id="lineage-api-other", **common
            ))
            await db.commit()

    async def _write_edges(context_id: str) -> None:
        async with AsyncSessionLocal() as db:
            await write_lineage_edge(
                db,
                context_id=context_id,
                analyst_id="lineage-api-owner",
                artifact=ArtifactRef(kind="source_manifest", id="lineage-manifest-child"),
                parent=ArtifactRef(kind="source_manifest", id="lineage-manifest-parent"),
                transform="normalize",
                transform_version="1",
                enabled=True,
            )
            # Correct context/owner but not explicitly bound: endpoint must not
            # traverse or reveal it.
            await write_lineage_edge(
                db,
                context_id=context_id,
                analyst_id="lineage-api-owner",
                artifact=ArtifactRef(kind="source_manifest", id="lineage-manifest-child"),
                parent=ArtifactRef(kind="source_manifest", id="lineage-manifest-foreign"),
                transform="forged-parent",
                transform_version="1",
                enabled=True,
            )
            await db.commit()

    with TestClient(app) as client:
        asyncio.run(_seed_manifests())
        app.dependency_overrides[get_identity] = _identity("lineage-api-owner")
        monkeypatch.setattr(get_settings(), "caos_lineage_v2_enabled", False)
        created = client.post("/api/analysis/contexts", json={
            "name": "Lineage API",
            "artifacts": {"artifact_refs": [
                {"kind": "source_manifest", "id": "lineage-manifest-parent"},
                {"kind": "source_manifest", "id": "lineage-manifest-child"},
            ]},
        })
        assert created.status_code == 201, created.text
        context = created.json()
        assert len(context["artifacts"]["artifact_refs"]) == 2
        assert client.get(
            f"/api/analysis/contexts/{context['id']}/lineage"
        ).status_code == 404

        foreign_ref = client.post("/api/analysis/contexts", json={
            "name": "Foreign ref",
            "artifacts": {"artifact_refs": [{
                "kind": "source_manifest", "id": "lineage-manifest-foreign"
            }]},
        })
        assert foreign_ref.status_code == 404
        assert foreign_ref.json()["detail"] == "Artifact not found."

        asyncio.run(_write_edges(context["id"]))
        monkeypatch.setattr(get_settings(), "caos_lineage_v2_enabled", True)
        response = client.get(f"/api/analysis/contexts/{context['id']}/lineage")
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["context_id"] == context["id"]
        assert len(body["artifact_refs"]) == 2
        assert [edge["transform"] for edge in body["edges"]] == ["normalize"]

        cleared = client.patch(f"/api/analysis/contexts/{context['id']}", json={
            "artifacts": {"artifact_refs": []},
        })
        assert cleared.status_code == 200, cleared.text
        assert cleared.json()["artifacts"]["artifact_refs"] == []
        fetched = client.get(f"/api/analysis/contexts/{context['id']}")
        assert fetched.status_code == 200
        assert fetched.json()["artifacts"]["artifact_refs"] == []
        cleared_lineage = client.get(f"/api/analysis/contexts/{context['id']}/lineage")
        assert cleared_lineage.status_code == 200
        assert cleared_lineage.json()["artifact_refs"] == []
        assert cleared_lineage.json()["edges"] == []

        app.dependency_overrides[get_identity] = _identity("lineage-api-other")
        assert client.get(
            f"/api/analysis/contexts/{context['id']}/lineage"
        ).status_code == 404

    app.dependency_overrides.clear()


def test_unsupported_kind_is_uniform_404_on_create_and_patch_but_other_validation_is_422() -> None:
    from identity import get_identity
    from main import app

    with TestClient(app) as client:
        app.dependency_overrides[get_identity] = _identity("lineage-kind-owner")
        created = client.post("/api/analysis/contexts", json={"name": "Kind boundary"})
        assert created.status_code == 201, created.text
        context_id = created.json()["id"]
        for method, path in (
            (client.post, "/api/analysis/contexts"),
            (client.patch, f"/api/analysis/contexts/{context_id}"),
        ):
            response = method(path, json={
                "artifacts": {"artifact_refs": [{"kind": "arbitrary_table", "id": "row-1"}]}
            })
            assert response.status_code == 404
            assert response.json() == {"detail": "Artifact not found."}
            assert "issuer_run" not in response.text
        for method, path in (
            (client.post, "/api/analysis/contexts"),
            (client.patch, f"/api/analysis/contexts/{context_id}"),
        ):
            unrelated = method(path, json={"name": ""})
            assert unrelated.status_code == 422

    app.dependency_overrides.clear()


@pytest.mark.parametrize(
    "ref",
    [
        pytest.param({"id": "row-1"}, id="missing"),
        pytest.param({"kind": None, "id": "row-1"}, id="null"),
        pytest.param({"kind": 7, "id": "row-1"}, id="integer"),
        pytest.param({"kind": True, "id": "row-1"}, id="boolean"),
        pytest.param({"kind": [], "id": "row-1"}, id="list"),
        pytest.param({"kind": {}, "id": "row-1"}, id="dict"),
    ],
)
def test_malformed_non_string_kind_is_ordinary_422_on_create_and_patch(ref: dict) -> None:
    from identity import get_identity
    from main import app

    with TestClient(app) as client:
        app.dependency_overrides[get_identity] = _identity("lineage-kind-malformed")
        context = client.post("/api/analysis/contexts", json={"name": "Malformed kind"})
        # Bare creates find-or-create: the first param sees 201, later params
        # reuse the same analyst's context with 200 — either provides the row.
        assert context.status_code in (200, 201), context.text
        context_id = context.json()["id"]
        for method, path in (
            (client.post, "/api/analysis/contexts"),
            (client.patch, f"/api/analysis/contexts/{context_id}"),
        ):
            response = method(path, json={
                "artifacts": {"artifact_refs": [ref]},
            })
            assert response.status_code == 422, response.text
            assert response.json()["detail"]

    app.dependency_overrides.clear()


@pytest.mark.parametrize("kind", ALL_ARTIFACT_KINDS)
def test_missing_typed_artifact_is_uniform_404_for_every_kind_on_post_and_patch(kind: str) -> None:
    from identity import get_identity
    from main import app

    analyst_id = f"lineage-missing-{kind}"
    with TestClient(app) as client:
        app.dependency_overrides[get_identity] = _identity(analyst_id)
        context = client.post("/api/analysis/contexts", json={"name": kind}).json()
        payload = {"artifacts": {"artifact_refs": [{"kind": kind, "id": "missing"}]}}
        created = client.post("/api/analysis/contexts", json={"name": kind, **payload})
        patched = client.patch(f"/api/analysis/contexts/{context['id']}", json=payload)
        assert created.status_code == 404
        assert patched.status_code == 404
        assert created.json() == patched.json() == {"detail": "Artifact not found."}
    app.dependency_overrides.clear()


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", ALL_ARTIFACT_KINDS)
async def test_existing_foreign_typed_artifact_is_404_across_ownership_and_tenancy(
    kind: str, seeded_db, monkeypatch,
) -> None:
    from datetime import datetime, timezone

    from analysis_contracts import ArtifactRef
    from config import get_settings
    from database import (
        AlertEvent, AnalysisContextRecord, AnalysisInsight, AsyncSessionLocal,
        Decision, Document, DocumentChunk, Issuer, MarketInstrument, MarketSnapshot,
        ModelCheckpoint, Portfolio, ReportVersion, ResearchJob, Run, SourceManifest,
    )
    from routes.analysis import _validate_typed_artifact_ref, get_context_lineage

    prefix = f"lna-{kind.replace('_', '-')[:18]}"
    owner = f"{prefix}-owner"
    issuer_id = f"{prefix}-issuer"
    owned_context_id = f"{prefix}-ctx"
    foreign_context_id = f"{prefix}-foreign"
    run_id = f"{prefix}-run"
    checkpoint_id = f"{prefix}-checkpoint"
    document_id = f"{prefix}-doc"
    snapshot_id = f"{prefix}-snapshot"
    artifact_ids = {
        "issuer_run": run_id,
        "source_manifest": f"{prefix}-manifest",
        "research_job": f"{prefix}-research",
        "model_checkpoint": checkpoint_id,
        "report_version": f"{prefix}-report",
        "alert_event": f"{prefix}-alert",
        "sponsor": f"{prefix}-sponsor",
        "portfolio": f"{prefix}-portfolio",
        "decision": f"{prefix}-decision",
        "insight": f"{prefix}-insight",
        "document": document_id,
        "document_chunk": f"{prefix}-chunk",
        "market_snapshot": snapshot_id,
    }

    async with AsyncSessionLocal() as db:
        db.add_all([
            Issuer(id=issuer_id, name=prefix, sponsor=artifact_ids["sponsor"], team_id="team-a"),
            AnalysisContextRecord(
                id=owned_context_id, analyst_id=owner, name="Owned",
                artifacts={"artifact_refs": [{"kind": kind, "id": artifact_ids[kind]}]},
            ),
            AnalysisContextRecord(id=foreign_context_id, analyst_id=f"{prefix}-other", name="Foreign"),
            Portfolio(
                id=artifact_ids["portfolio"], name=prefix, created_by=owner, team_id="team-a"
            ),
            MarketSnapshot(
                id=snapshot_id, as_of=datetime.now(timezone.utc), source_label=prefix,
                origin="live", method="reported", status="ready",
                payload_hash=(prefix + "0" * 64)[:64],
            ),
        ])
        await db.flush()
        db.add_all([
            Run(id=run_id, issuer_id=issuer_id, analyst_id=owner, status="complete"),
            SourceManifest(
                id=artifact_ids["source_manifest"], analyst_id=owner, issuer_id=issuer_id,
                origin="test", method="fixture", status="ready", files=[], authority={},
            ),
            ResearchJob(
                id=artifact_ids["research_job"], analyst_id=f"{prefix}-other",
                context_id=foreign_context_id, status="complete",
            ),
            Document(
                id=document_id, issuer_id=issuer_id, doc_type="test",
                file_name="test.pdf", storage_key=f"{prefix}/test.pdf", uploaded_by=owner,
            ),
            MarketInstrument(
                id=f"{prefix}-instrument", snapshot_id=snapshot_id,
                instrument_key=f"{prefix}:1", issuer_id=issuer_id,
                borrower=prefix, payload={},
            ),
        ])
        await db.flush()
        db.add_all([
            ModelCheckpoint(
                id=checkpoint_id, issuer_id=issuer_id, analyst_id=owner,
                context_id=owned_context_id, issuer_run_id=run_id, label="Foreign team",
                payload_hash="1" * 64, payload={}, authority={},
            ),
            DocumentChunk(
                id=artifact_ids["document_chunk"], document_id=document_id,
                seq=0, text="foreign team evidence",
            ),
        ])
        await db.flush()
        db.add_all([
            ReportVersion(
                id=artifact_ids["report_version"], context_id=foreign_context_id,
                analyst_id=f"{prefix}-other", run_id=run_id,
                model_checkpoint_id=checkpoint_id, status="published", payload={},
                document_sha256="2" * 64, authority={},
            ),
            AlertEvent(
                id=artifact_ids["alert_event"], alert_key=f"{prefix}-key",
                context_id=owned_context_id, issuer_id=issuer_id, run_id=run_id,
                kind="test", title="Foreign team", impact="", created_by=owner,
            ),
            Decision(
                id=artifact_ids["decision"], issuer_id=issuer_id, run_id=run_id,
                action="hold", status="active", conditions=[], snapshot={},
                snapshot_sha256="3" * 64, created_by=owner,
            ),
            AnalysisInsight(
                id=artifact_ids["insight"], analyst_id=f"{prefix}-other",
                context_id=foreign_context_id, surface="query", kind="test", status="ready",
                subject_refs={}, summary="Foreign", claims=[], recommended_actions=[],
                missing_dependencies=[], authority={}, source_fingerprint=f"{prefix}-fp",
                version=0,
            ),
        ])
        await db.flush()
        monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)
        caller = _identity(owner, team_id="team-b")()
        with pytest.raises(HTTPException) as caught:
            await _validate_typed_artifact_ref(
                db, ArtifactRef(kind=kind, id=artifact_ids[kind]),
                context_id=owned_context_id, caller=caller,
            )
        assert getattr(caught.value, "status_code", None) == 404
        assert getattr(caught.value, "detail", None) == "Artifact not found."
        monkeypatch.setattr(get_settings(), "caos_lineage_v2_enabled", True)
        with pytest.raises(HTTPException) as lineage_caught:
            await get_context_lineage(
                owned_context_id, db=db, caller=caller
            )
        assert lineage_caught.value.status_code == 404
        assert lineage_caught.value.detail == "Artifact not found."


@pytest.mark.asyncio
@pytest.mark.skipif(
    not os.environ.get("CAOS_LINEAGE_TEST_POSTGRES_URL"),
    reason="set CAOS_LINEAGE_TEST_POSTGRES_URL to a dedicated migrated PostgreSQL test DB",
)
async def test_postgres_independent_transaction_contention_commit_and_rollback() -> None:
    from sqlalchemy import delete
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from analysis_contracts import ArtifactRef
    from database import AnalysisContextRecord, LineageEdge
    from lineage_service import write_lineage_edge
    from test_migrations import _alembic

    db_url = os.environ["CAOS_LINEAGE_TEST_POSTGRES_URL"]
    migrated = _alembic("upgrade", "head", db_url=db_url)
    assert migrated.returncode == 0, migrated.stderr
    engine = create_async_engine(db_url, pool_pre_ping=True)
    sessions = async_sessionmaker(engine, expire_on_commit=False)

    async def run_race(*, commit_winner: bool) -> None:
        suffix = uuid.uuid4().hex
        context_id = str(uuid.uuid4())
        analyst_id = f"lineage-pg-{suffix}"
        async with sessions() as seed:
            seed.add(AnalysisContextRecord(
                id=context_id, analyst_id=analyst_id, name="Postgres contention"
            ))
            await seed.commit()
        artifact = ArtifactRef(kind="document", id=f"doc-{suffix}")
        parent = ArtifactRef(kind="issuer_run", id=f"run-{suffix}")
        kwargs = {
            "context_id": context_id,
            "analyst_id": analyst_id,
            "artifact": artifact,
            "parent": parent,
            "transform": "contention",
            "transform_version": "1",
            "enabled": True,
        }
        async with sessions() as winner, sessions() as contender:
            first = await write_lineage_edge(winner, **kwargs)
            blocked = asyncio.create_task(write_lineage_edge(contender, **kwargs))
            await asyncio.sleep(0.15)
            assert not blocked.done(), "contender should wait on the uncommitted unique key"
            if commit_winner:
                await winner.commit()
            else:
                await winner.rollback()
            second = await asyncio.wait_for(blocked, timeout=10)
            await contender.commit()
            if commit_winner:
                assert first is not None and second is not None and first.id == second.id
            else:
                assert first is not None and second is not None and first.id != second.id

        async with sessions() as verify:
            assert (await verify.execute(
                select(func.count()).select_from(LineageEdge).where(
                    LineageEdge.context_id == context_id
                )
            )).scalar_one() == 1
            await verify.execute(delete(AnalysisContextRecord).where(
                AnalysisContextRecord.id == context_id
            ))
            await verify.commit()
            assert (await verify.execute(
                select(func.count()).select_from(LineageEdge).where(
                    LineageEdge.context_id == context_id
                )
            )).scalar_one() == 0

    try:
        await run_race(commit_winner=True)
        await run_race(commit_winner=False)
    finally:
        await engine.dispose()
