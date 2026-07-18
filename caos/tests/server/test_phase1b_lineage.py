"""Phase 1B transactional producers and restartable reconciliation."""

from __future__ import annotations

import asyncio
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select

from conftest import wait_for_run


@pytest.fixture
def client():
    from main import app

    with TestClient(app) as value:
        yield value


def _pdf() -> bytes:
    return b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"


def _extract_lineage_pdf_text(content, filename="x.pdf"):
    """Spawn-safe parser double for upload-driven lineage tests."""
    del content, filename
    return "lineage source evidence " * 80, False


def test_artifact_merge_is_deterministic_and_preserves_extensions():
    from analysis_contracts import ArtifactRef
    from context_lineage import merge_artifact_refs

    original = {
        "issuer_run_id": "legacy-run",
        "extension": {"keep": True},
        "artifact_refs": [
            {"kind": "document", "id": "doc-1", "version": "v2"},
            {"kind": "document", "id": "doc-1", "version": "v1"},
        ],
    }
    merged = merge_artifact_refs(original, [
        ArtifactRef(kind="source_manifest", id="manifest-1"),
        ArtifactRef(kind="document", id="doc-1", version="v1"),
    ], legacy_updates={"source_manifest_id": "manifest-1"})
    assert merged["issuer_run_id"] == "legacy-run"
    assert merged["extension"] == {"keep": True}
    assert merged["source_manifest_id"] == "manifest-1"
    assert merged["artifact_refs"] == [
        {"kind": "document", "id": "doc-1", "version": "v1"},
        {"kind": "document", "id": "doc-1", "version": "v2"},
        {"kind": "source_manifest", "id": "manifest-1", "version": None},
    ]
    scalar_only = merge_artifact_refs(
        {"issuer_run_id": "legacy-run"}, [],
        legacy_updates={"source_manifest_id": "manifest-1"},
    )
    assert "artifact_refs" not in scalar_only


@pytest.mark.asyncio
async def test_context_binding_preserves_out_of_order_sibling_refs(seeded_db):
    from analysis_contracts import ArtifactRef
    from context_lineage import bind_context_artifacts
    from database import AnalysisContextRecord, AsyncSessionLocal

    context_id = f"p1b-merge-{uuid.uuid4().hex[:20]}"
    async with AsyncSessionLocal() as db:
        db.add(AnalysisContextRecord(
            id=context_id,
            analyst_id="p1b-merge-owner",
            name="Concurrent merge",
            artifacts={"issuer_run_id": "legacy", "extension": "keep"},
            surface_state={"upload": {"view": "result"}},
        ))
        await db.commit()
        await bind_context_artifacts(
            db, context_id=context_id, analyst_id="p1b-merge-owner",
            refs=[ArtifactRef(kind="document", id="doc-late")],
        )
        await db.commit()
        await bind_context_artifacts(
            db, context_id=context_id, analyst_id="p1b-merge-owner",
            refs=[ArtifactRef(kind="source_manifest", id="manifest-early")],
        )
        await db.commit()
        row = await db.get(AnalysisContextRecord, context_id)
        assert row.artifacts["issuer_run_id"] == "legacy"
        assert row.artifacts["extension"] == "keep"
        assert row.surface_state == {"upload": {"view": "result"}}
        assert {(ref["kind"], ref["id"]) for ref in row.artifacts["artifact_refs"]} == {
            ("document", "doc-late"), ("source_manifest", "manifest-early")
        }
        await db.execute(delete(AnalysisContextRecord).where(AnalysisContextRecord.id == context_id))
        await db.commit()


@pytest.mark.asyncio
async def test_checkpoint_bind_preserves_newer_locked_run_scalar(seeded_db):
    from analysis_contracts import ArtifactRef
    from context_lineage import bind_context_artifacts
    from database import AnalysisContextRecord, AsyncSessionLocal

    context_id = f"p1b-stale-{uuid.uuid4().hex[:20]}"
    owner = "p1b-stale-owner"
    async with AsyncSessionLocal() as seed:
        seed.add(AnalysisContextRecord(
            id=context_id, analyst_id=owner, name="Stale scalar",
            artifacts={"issuer_run_id": "run-r1"},
        ))
        await seed.commit()
    async with AsyncSessionLocal() as checkpoint_session, AsyncSessionLocal() as run_session:
        stale = await checkpoint_session.get(AnalysisContextRecord, context_id)
        assert stale.artifacts["issuer_run_id"] == "run-r1"
        await checkpoint_session.commit()
        await bind_context_artifacts(
            run_session, context_id=context_id, analyst_id=owner,
            refs=[ArtifactRef(kind="issuer_run", id="run-r2")],
            legacy_updates={"issuer_run_id": "run-r2"},
        )
        await run_session.commit()
        await bind_context_artifacts(
            checkpoint_session, context_id=context_id, analyst_id=owner,
            refs=[ArtifactRef(kind="model_checkpoint", id="checkpoint-new", version="hash")],
            legacy_updates={"model_checkpoint_id": "checkpoint-new"},
        )
        await checkpoint_session.commit()
    async with AsyncSessionLocal() as verify:
        row = await verify.get(AnalysisContextRecord, context_id)
        assert row.artifacts["issuer_run_id"] == "run-r2"
        assert row.artifacts["model_checkpoint_id"] == "checkpoint-new"
        await verify.delete(row)
        await verify.commit()


@pytest.mark.asyncio
@pytest.mark.skipif(
    not __import__("os").environ.get("CAOS_LINEAGE_TEST_POSTGRES_URL"),
    reason="set CAOS_LINEAGE_TEST_POSTGRES_URL to a dedicated migrated PostgreSQL test DB",
)
async def test_postgres_checkpoint_run_interleaving_preserves_newer_scalar():
    import os
    from sqlalchemy import delete
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from analysis_contracts import ArtifactRef
    from context_lineage import bind_context_artifacts
    from database import AnalysisContextRecord
    from test_migrations import _alembic

    db_url = os.environ["CAOS_LINEAGE_TEST_POSTGRES_URL"]
    migrated = _alembic("upgrade", "head", db_url=db_url)
    assert migrated.returncode == 0, migrated.stderr
    engine = create_async_engine(db_url, pool_pre_ping=True)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    context_id = str(uuid.uuid4())
    owner = f"p1b-interleave-{uuid.uuid4().hex}"
    loaded = asyncio.Event()
    run_committed = asyncio.Event()

    async def checkpoint_writer():
        async with sessions() as db:
            stale = await db.get(AnalysisContextRecord, context_id)
            assert stale.artifacts["issuer_run_id"] == "run-r1"
            await db.commit()
            loaded.set()
            await run_committed.wait()
            await bind_context_artifacts(
                db, context_id=context_id, analyst_id=owner,
                refs=[ArtifactRef(kind="model_checkpoint", id="checkpoint-pg", version="hash")],
                legacy_updates={"model_checkpoint_id": "checkpoint-pg"},
            )
            await db.commit()

    async def run_writer():
        await loaded.wait()
        async with sessions() as db:
            await bind_context_artifacts(
                db, context_id=context_id, analyst_id=owner,
                refs=[ArtifactRef(kind="issuer_run", id="run-r2")],
                legacy_updates={"issuer_run_id": "run-r2"},
            )
            await db.commit()
        run_committed.set()

    try:
        async with sessions() as seed:
            seed.add(AnalysisContextRecord(
                id=context_id, analyst_id=owner, name="PG interleave",
                artifacts={"issuer_run_id": "run-r1"},
            ))
            await seed.commit()
        await asyncio.gather(checkpoint_writer(), run_writer())
        async with sessions() as verify:
            row = await verify.get(AnalysisContextRecord, context_id)
            assert row.artifacts["issuer_run_id"] == "run-r2"
            assert row.artifacts["model_checkpoint_id"] == "checkpoint-pg"
            await verify.execute(delete(AnalysisContextRecord).where(
                AnalysisContextRecord.id == context_id
            ))
            await verify.commit()
    finally:
        await engine.dispose()


def test_ingestion_and_run_lineage_share_domain_transactions(client, monkeypatch):
    import ingest
    from config import get_settings

    monkeypatch.setattr(get_settings(), "caos_lineage_v2_enabled", True)
    monkeypatch.setattr(
        ingest, "extract_pdf_text",
        _extract_lineage_pdf_text,
    )
    issuer = client.post("/api/issuers/", json={
        "name": f"Phase 1B Producer {uuid.uuid4().hex[:8]}",
        "ticker": f"P{uuid.uuid4().hex[:5]}",
    }).json()
    context = client.post("/api/analysis/contexts", json={
        "name": "Producer transaction", "issuer_ids": [issuer["id"]],
    }).json()
    upload = client.post(
        "/api/ingestion/upload/document",
        data={"issuer_id": issuer["id"], "context_id": context["id"]},
        files={"file": ("producer.pdf", _pdf(), "application/pdf")},
    )
    assert upload.status_code == 200, upload.text
    uploaded = upload.json()
    linked = client.get(f"/api/analysis/contexts/{context['id']}").json()
    typed = {(ref["kind"], ref["id"]) for ref in linked["artifacts"]["artifact_refs"]}
    assert ("document", uploaded["document_id"]) in typed
    assert ("source_manifest", uploaded["source_manifest_id"]) in typed
    assert linked["artifacts"]["source_manifest_id"] == uploaded["source_manifest_id"]
    lineage = client.get(f"/api/analysis/contexts/{context['id']}/lineage").json()
    assert any(
        edge["artifact"]["id"] == uploaded["source_manifest_id"]
        and edge["parent"]["id"] == uploaded["document_id"]
        for edge in lineage["edges"]
    )

    run = client.post("/api/runs", json={
        "issuer_id": issuer["id"], "context_id": context["id"],
    })
    assert run.status_code == 201, run.text
    run_id = run.json()["id"]
    assert wait_for_run(client, run_id)["status"] == "complete"
    linked = client.get(f"/api/analysis/contexts/{context['id']}").json()
    assert linked["artifacts"]["issuer_run_id"] == run_id
    assert any(
        ref["kind"] == "issuer_run" and ref["id"] == run_id
        for ref in linked["artifacts"]["artifact_refs"]
    )
    stale_before_checkpoint = linked["artifacts"]
    lineage = client.get(f"/api/analysis/contexts/{context['id']}/lineage").json()
    parents = {
        (edge["parent"]["kind"], edge["parent"]["id"])
        for edge in lineage["edges"] if edge["artifact"]["id"] == run_id
    }
    assert ("document", uploaded["document_id"]) in parents
    assert ("source_manifest", uploaded["source_manifest_id"]) in parents

    saved = client.put(f"/api/models/{issuer['id']}", json={
        "payload": {"overrides": {"FY27:EBITDA": 420}},
    })
    assert saved.status_code == 200, saved.text
    checkpoint = client.post(f"/api/models/{issuer['id']}/checkpoints", json={
        "context_id": context["id"],
        "label": "Phase 1B checkpoint",
        "issuer_run_id": run_id,
    })
    assert checkpoint.status_code == 201, checkpoint.text
    checkpoint_id = checkpoint.json()["id"]
    # Reproduce the old Model client sequence: the checkpoint producer has
    # transactionally bound its typed ref, then a client PATCH arrives with the
    # full artifact object read before checkpoint creation. The route must union
    # typed refs rather than erase the newly committed identity.
    stale_checkpoint_patch = client.patch(
        f"/api/analysis/contexts/{context['id']}",
        json={"artifacts": {
            **stale_before_checkpoint,
            "model_checkpoint_id": checkpoint_id,
        }},
    )
    assert stale_checkpoint_patch.status_code == 200, stale_checkpoint_patch.text
    checkpoint_refs = {
        (ref["kind"], ref["id"])
        for ref in stale_checkpoint_patch.json()["artifacts"]["artifact_refs"]
    }
    assert ("model_checkpoint", checkpoint_id) in checkpoint_refs
    stale_before_report = stale_checkpoint_patch.json()["artifacts"]
    lineage = client.get(f"/api/analysis/contexts/{context['id']}/lineage").json()
    assert any(
        edge["artifact"]["id"] == checkpoint_id
        and edge["parent"]["id"] == run_id
        for edge in lineage["edges"]
    )

    async def mark_committee_ready():
        from database import AsyncSessionLocal, Run

        async with AsyncSessionLocal() as db:
            row = await db.get(Run, run_id)
            row.status = "complete"
            row.committee_status = "Committee Ready"
            await db.commit()

    asyncio.run(mark_committee_ready())
    report = client.post("/api/reports/versions", json={
        "context_id": context["id"],
        "run_id": run_id,
        "model_checkpoint_id": checkpoint_id,
        "payload": {"title": "Committee version"},
    })
    assert report.status_code == 201, report.text
    report_id = report.json()["id"]
    # The same stale-client sequence after report publication must preserve the
    # exact report ref used by freshness and PDF/XLSX authority evaluation.
    stale_report_patch = client.patch(
        f"/api/analysis/contexts/{context['id']}",
        json={"artifacts": {
            **stale_before_report,
            "report_version_id": report_id,
        }},
    )
    assert stale_report_patch.status_code == 200, stale_report_patch.text
    report_refs = {
        (ref["kind"], ref["id"])
        for ref in stale_report_patch.json()["artifacts"]["artifact_refs"]
    }
    assert ("model_checkpoint", checkpoint_id) in report_refs
    assert ("report_version", report_id) in report_refs
    report_authority = report.json()["authority"]
    assert report_authority["freshness"] in {"current", "due", "stale", "unknown"}
    assert report_authority["freshness_evaluation"]["state"] == report_authority["freshness"]
    assert report_authority["freshness_evaluation"]["policy_version"] == "caos-freshness-v1"
    lineage = client.get(f"/api/analysis/contexts/{context['id']}/lineage").json()
    report_parents = {
        (edge["parent"]["kind"], edge["parent"]["id"])
        for edge in lineage["edges"] if edge["artifact"]["id"] == report_id
    }
    assert report_parents == {
        ("issuer_run", run_id),
        ("model_checkpoint", checkpoint_id),
        ("source_manifest", uploaded["source_manifest_id"]),
    }

    insight = client.post(f"/api/analysis/contexts/{context['id']}/insights", json={
        "surface": "reports",
        "kind": "committee-brief",
        "subject_refs": {
            "issuer_run_id": run_id,
            "source_manifest_id": uploaded["source_manifest_id"],
        },
    })
    assert insight.status_code == 201, insight.text
    insight_body = insight.json()
    assert {(ref["kind"], ref["id"]) for ref in insight_body["subject_refs"]["artifact_refs"]} == {
        ("issuer_run", run_id),
        ("source_manifest", uploaded["source_manifest_id"]),
    }
    lineage = client.get(f"/api/analysis/contexts/{context['id']}/lineage").json()
    insight_parents = {
        (edge["parent"]["kind"], edge["parent"]["id"])
        for edge in lineage["edges"] if edge["artifact"]["id"] == insight_body["id"]
    }
    assert insight_parents == {
        ("issuer_run", run_id),
        ("source_manifest", uploaded["source_manifest_id"]),
    }

    # An omitted context remains a valid v1 upload and cannot acquire an
    # unscoped v2 producer edge.
    omitted = client.post(
        "/api/ingestion/upload/document",
        data={"issuer_id": issuer["id"]},
        files={"file": ("omitted.pdf", _pdf(), "application/pdf")},
    )
    assert omitted.status_code == 200, omitted.text
    lineage = client.get(f"/api/analysis/contexts/{context['id']}/lineage").json()
    assert all(
        edge["artifact"]["id"] != omitted.json()["source_manifest_id"]
        for edge in lineage["edges"]
    )


def test_flag_off_and_wrong_issuer_context_preserve_non_enumerable_v1(client, monkeypatch):
    import ingest
    from config import get_settings

    monkeypatch.setattr(
        ingest, "extract_pdf_text",
        _extract_lineage_pdf_text,
    )
    issuer_a = client.post("/api/issuers/", json={
        "name": f"Phase 1B Flag A {uuid.uuid4().hex[:8]}"
    }).json()
    issuer_b = client.post("/api/issuers/", json={
        "name": f"Phase 1B Flag B {uuid.uuid4().hex[:8]}"
    }).json()
    context = client.post("/api/analysis/contexts", json={
        "name": "Flag off", "issuer_ids": [issuer_a["id"]],
    }).json()

    monkeypatch.setattr(get_settings(), "caos_lineage_v2_enabled", False)
    legacy = client.post(
        "/api/ingestion/upload/document",
        data={"issuer_id": issuer_a["id"], "context_id": context["id"]},
        files={"file": ("legacy.pdf", _pdf(), "application/pdf")},
    )
    assert legacy.status_code == 200, legacy.text
    linked = client.get(f"/api/analysis/contexts/{context['id']}").json()
    assert linked["artifacts"].get("source_manifest_id") is None
    assert not linked["artifacts"].get("artifact_refs")

    monkeypatch.setattr(get_settings(), "caos_lineage_v2_enabled", True)
    wrong_scope = client.post(
        "/api/ingestion/upload/document",
        data={"issuer_id": issuer_b["id"], "context_id": context["id"]},
        files={"file": ("foreign.pdf", _pdf(), "application/pdf")},
    )
    assert wrong_scope.status_code == 404
    assert wrong_scope.json() == {"detail": "Analysis context not found."}


def test_flag_off_preserves_all_v1_producers_and_run_context_omission(client, monkeypatch):
    import ingest
    from config import get_settings

    monkeypatch.setattr(
        ingest, "extract_pdf_text",
        _extract_lineage_pdf_text,
    )
    monkeypatch.setattr(get_settings(), "caos_lineage_v2_enabled", False)
    issuer = client.post("/api/issuers/", json={
        "name": f"Phase 1B V1 matrix {uuid.uuid4().hex[:8]}"
    }).json()
    context = client.post("/api/analysis/contexts", json={
        "name": "V1 matrix", "issuer_ids": [issuer["id"]],
    }).json()
    upload = client.post(
        "/api/ingestion/upload/document",
        data={"issuer_id": issuer["id"], "context_id": context["id"]},
        files={"file": ("v1.pdf", _pdf(), "application/pdf")},
    )
    assert upload.status_code == 200, upload.text
    run = client.post("/api/runs", json={
        "issuer_id": issuer["id"], "context_id": context["id"],
    })
    assert run.status_code == 201, run.text
    run_id = run.json()["id"]
    assert wait_for_run(client, run_id)["status"] == "complete"
    before_checkpoint = client.get(f"/api/analysis/contexts/{context['id']}").json()
    assert before_checkpoint["artifacts"].get("issuer_run_id") is None
    assert not before_checkpoint["artifacts"].get("artifact_refs")

    assert client.put(f"/api/models/{issuer['id']}", json={
        "payload": {"overrides": {"FY27:EBITDA": 400}},
    }).status_code == 200
    checkpoint = client.post(f"/api/models/{issuer['id']}/checkpoints", json={
        "context_id": context["id"], "issuer_run_id": run_id,
    })
    assert checkpoint.status_code == 201, checkpoint.text
    checkpoint_id = checkpoint.json()["id"]
    legacy = client.patch(f"/api/analysis/contexts/{context['id']}", json={
        "artifacts": {"source_manifest_id": upload.json()["source_manifest_id"]},
    })
    assert legacy.status_code == 200, legacy.text

    async def ready():
        from database import AsyncSessionLocal, Run

        async with AsyncSessionLocal() as db:
            row = await db.get(Run, run_id)
            row.status = "complete"
            row.committee_status = "Committee Ready"
            await db.commit()

    asyncio.run(ready())
    report = client.post("/api/reports/versions", json={
        "context_id": context["id"], "run_id": run_id,
        "model_checkpoint_id": checkpoint_id, "payload": {},
    })
    assert report.status_code == 201, report.text
    insight = client.post(f"/api/analysis/contexts/{context['id']}/insights", json={
        "surface": "reports", "kind": "v1-brief",
        "subject_refs": {"issuer_run_id": run_id},
    })
    assert insight.status_code == 201, insight.text
    linked = client.get(f"/api/analysis/contexts/{context['id']}").json()
    assert linked["artifacts"]["issuer_run_id"] == run_id
    assert linked["artifacts"]["model_checkpoint_id"] == checkpoint_id
    assert linked["artifacts"]["report_version_id"] == report.json()["id"]
    assert linked["artifacts"].get("insight_id") is None
    assert not linked["artifacts"].get("artifact_refs")

    async def v2_edge_count():
        from database import AsyncSessionLocal, LineageEdge

        async with AsyncSessionLocal() as db:
            return (await db.execute(select(func.count(LineageEdge.id)).where(
                LineageEdge.context_id == context["id"]
            ))).scalar_one()

    assert asyncio.run(v2_edge_count()) == 0

    # With v2 enabled, a run that omits context remains valid and cannot write
    # a context-scoped ref or edge.
    monkeypatch.setattr(get_settings(), "caos_lineage_v2_enabled", True)
    omitted_issuer = client.post("/api/issuers/", json={
        "name": f"Phase 1B omitted run {uuid.uuid4().hex[:8]}"
    }).json()
    omitted = client.post("/api/runs", json={"issuer_id": omitted_issuer["id"]})
    assert omitted.status_code == 201, omitted.text
    assert wait_for_run(client, omitted.json()["id"])["status"] == "complete"
    async def omitted_edge_count():
        from database import AsyncSessionLocal, LineageEdge

        async with AsyncSessionLocal() as db:
            return (await db.execute(select(func.count(LineageEdge.id)).where(
                LineageEdge.artifact_id == f"issuer_run:{omitted.json()['id']}",
                LineageEdge.v2_idempotency_key.is_not(None),
            ))).scalar_one()

    assert asyncio.run(omitted_edge_count()) == 0


def test_forced_producer_failure_rolls_back_domain_context_and_edges(client, monkeypatch):
    import ingest
    import routes.ingestion as ingestion_route
    from config import get_settings

    monkeypatch.setattr(get_settings(), "caos_lineage_v2_enabled", True)
    monkeypatch.setattr(
        ingest, "extract_pdf_text",
        _extract_lineage_pdf_text,
    )
    issuer = client.post("/api/issuers/", json={
        "name": f"Phase 1B Rollback {uuid.uuid4().hex[:8]}",
    }).json()
    context = client.post("/api/analysis/contexts", json={
        "name": "Rollback", "issuer_ids": [issuer["id"]],
    }).json()
    before_docs = client.get(f"/api/issuers/{issuer['id']}/documents").json()

    async def fail_edge(*args, **kwargs):
        raise RuntimeError("forced lineage failure")

    monkeypatch.setattr(ingestion_route, "write_lineage_edge", fail_edge)
    with pytest.raises(RuntimeError, match="forced lineage failure"):
        client.post(
            "/api/ingestion/upload/document",
            data={"issuer_id": issuer["id"], "context_id": context["id"]},
            files={"file": ("rollback.pdf", _pdf(), "application/pdf")},
        )
    assert client.get(f"/api/issuers/{issuer['id']}/documents").json() == before_docs
    linked = client.get(f"/api/analysis/contexts/{context['id']}").json()
    assert not linked["artifacts"].get("artifact_refs")
    assert linked["artifacts"].get("source_manifest_id") is None
    assert client.get(f"/api/analysis/contexts/{context['id']}/lineage").json()["edges"] == []


def test_run_checkpoint_report_and_insight_failures_rollback_together(client, monkeypatch):
    import ingest
    import routes.analysis_insights as insight_route
    import routes.models as model_route
    import routes.reports as report_route
    import routes.runs as run_route
    from config import get_settings

    monkeypatch.setattr(get_settings(), "caos_lineage_v2_enabled", True)
    monkeypatch.setattr(
        ingest, "extract_pdf_text",
        _extract_lineage_pdf_text,
    )
    issuer = client.post("/api/issuers/", json={
        "name": f"Phase 1B Atomic {uuid.uuid4().hex[:8]}"
    }).json()
    context = client.post("/api/analysis/contexts", json={
        "name": "Atomic producers", "issuer_ids": [issuer["id"]],
    }).json()
    upload = client.post(
        "/api/ingestion/upload/document",
        data={"issuer_id": issuer["id"], "context_id": context["id"]},
        files={"file": ("atomic.pdf", _pdf(), "application/pdf")},
    )
    assert upload.status_code == 200, upload.text

    async def fail_edge(*args, **kwargs):
        raise RuntimeError("forced lineage failure")

    with monkeypatch.context() as scoped:
        scoped.setattr(run_route, "write_lineage_edge", fail_edge)
        with pytest.raises(RuntimeError, match="forced lineage failure"):
            client.post("/api/runs", json={
                "issuer_id": issuer["id"], "context_id": context["id"],
            })
    assert client.get("/api/runs", params={"issuer_id": issuer["id"]}).json() == []
    linked = client.get(f"/api/analysis/contexts/{context['id']}").json()
    assert linked["artifacts"].get("issuer_run_id") is None

    run = client.post("/api/runs", json={
        "issuer_id": issuer["id"], "context_id": context["id"],
    })
    assert run.status_code == 201, run.text
    run_id = run.json()["id"]
    assert client.put(f"/api/models/{issuer['id']}", json={
        "payload": {"overrides": {"FY27:EBITDA": 420}},
    }).status_code == 200

    with monkeypatch.context() as scoped:
        scoped.setattr(model_route, "write_lineage_edge", fail_edge)
        with pytest.raises(RuntimeError, match="forced lineage failure"):
            client.post(f"/api/models/{issuer['id']}/checkpoints", json={
                "context_id": context["id"], "issuer_run_id": run_id,
            })
    assert client.get(f"/api/models/{issuer['id']}/checkpoints").json() == []
    linked = client.get(f"/api/analysis/contexts/{context['id']}").json()
    assert linked["artifacts"].get("model_checkpoint_id") is None

    checkpoint = client.post(f"/api/models/{issuer['id']}/checkpoints", json={
        "context_id": context["id"], "issuer_run_id": run_id,
    })
    assert checkpoint.status_code == 201, checkpoint.text
    checkpoint_id = checkpoint.json()["id"]

    async def mark_committee_ready():
        from database import AsyncSessionLocal, Run

        async with AsyncSessionLocal() as db:
            row = await db.get(Run, run_id)
            row.status = "complete"
            row.committee_status = "Committee Ready"
            await db.commit()

    asyncio.run(mark_committee_ready())
    report_payload = {
        "context_id": context["id"], "run_id": run_id,
        "model_checkpoint_id": checkpoint_id, "payload": {},
    }
    with monkeypatch.context() as scoped:
        scoped.setattr(report_route, "write_lineage_edge", fail_edge)
        with pytest.raises(RuntimeError, match="forced lineage failure"):
            client.post("/api/reports/versions", json=report_payload)
    assert client.get("/api/reports/versions", params={"context_id": context["id"]}).json() == []
    linked = client.get(f"/api/analysis/contexts/{context['id']}").json()
    assert linked["artifacts"].get("report_version_id") is None

    insight_payload = {
        "surface": "reports", "kind": "atomic-brief",
        "subject_refs": {"issuer_run_id": run_id},
    }
    with monkeypatch.context() as scoped:
        scoped.setattr(insight_route, "write_lineage_edge", fail_edge)
        with pytest.raises(RuntimeError, match="forced lineage failure"):
            client.post(
                f"/api/analysis/contexts/{context['id']}/insights", json=insight_payload
            )
    insights = client.get(f"/api/analysis/contexts/{context['id']}/insights").json()
    assert insights["items"] == []
    linked = client.get(f"/api/analysis/contexts/{context['id']}").json()
    assert linked["artifacts"].get("insight_id") is None


def test_insight_uniqueness_loser_returns_winner_without_duplicate_lineage(
    client, monkeypatch
):
    import ingest
    import routes.analysis_insights as insight_route
    from config import get_settings

    monkeypatch.setattr(get_settings(), "caos_lineage_v2_enabled", True)
    monkeypatch.setattr(
        ingest, "extract_pdf_text",
        _extract_lineage_pdf_text,
    )
    issuer = client.post("/api/issuers/", json={
        "name": f"Phase 1B Insight Race {uuid.uuid4().hex[:8]}"
    }).json()
    context = client.post("/api/analysis/contexts", json={
        "name": "Insight uniqueness", "issuer_ids": [issuer["id"]],
    }).json()
    upload = client.post(
        "/api/ingestion/upload/document",
        data={"issuer_id": issuer["id"]},
        files={"file": ("uniqueness.pdf", _pdf(), "application/pdf")},
    )
    assert upload.status_code == 200, upload.text
    subject_id = upload.json()["source_manifest_id"]
    payload = {
        "surface": "reports", "kind": "uniqueness-race",
        # Exercise the legacy-to-typed conversion and the dependent edge, not
        # merely the insight row uniqueness constraint in isolation.
        "subject_refs": {"source_manifest_id": subject_id},
    }
    winner = client.post(
        f"/api/analysis/contexts/{context['id']}/insights", json=payload
    )
    assert winner.status_code == 201, winner.text

    async def lineage_state():
        from database import AnalysisContextRecord, AnalysisInsight, AsyncSessionLocal, LineageEdge

        async with AsyncSessionLocal() as db:
            row = await db.get(AnalysisContextRecord, context["id"])
            insight_refs = [
                ref for ref in row.artifacts.get("artifact_refs", [])
                if ref["kind"] == "insight"
            ]
            insight_ids = list((await db.execute(select(AnalysisInsight.id).where(
                AnalysisInsight.context_id == context["id"],
                AnalysisInsight.kind == "uniqueness-race",
            ))).scalars().all())
            insight_edges = list((await db.execute(select(LineageEdge).where(
                LineageEdge.context_id == context["id"],
                LineageEdge.artifact_kind == "insight",
            ))).scalars().all())
            return insight_refs, insight_ids, insight_edges

    before_refs, before_ids, before_edges = asyncio.run(lineage_state())
    assert before_ids == [winner.json()["id"]]
    assert before_refs == [{
        "kind": "insight", "id": winner.json()["id"], "version": "0",
    }]
    assert len(before_edges) == 1
    assert before_edges[0].artifact_id == f"insight:{winner.json()['id']}"
    assert before_edges[0].parent_id == f"source_manifest:{subject_id}"
    real_prior = insight_route._prior_generation
    calls = 0

    async def miss_then_resolve(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 1:
            return None
        return await real_prior(*args, **kwargs)

    monkeypatch.setattr(insight_route, "_prior_generation", miss_then_resolve)
    loser = client.post(
        f"/api/analysis/contexts/{context['id']}/insights", json=payload
    )
    assert loser.status_code == 200, loser.text
    assert loser.json()["id"] == winner.json()["id"]
    assert calls == 2
    after_refs, after_ids, after_edges = asyncio.run(lineage_state())
    assert after_ids == before_ids == [winner.json()["id"]]
    assert after_refs == before_refs
    assert len(after_edges) == len(before_edges) == 1
    assert after_edges[0].id == before_edges[0].id
    assert after_edges[0].artifact_id == f"insight:{winner.json()['id']}"
    assert after_edges[0].parent_id == f"source_manifest:{subject_id}"


def test_all_producers_reject_foreign_owner_and_foreign_team_scopes(
    client, monkeypatch
):
    import ingest
    from config import get_settings
    from identity import CallerIdentity, get_identity
    from main import app

    suffix = uuid.uuid4().hex[:8]
    owner_a = f"p1b-auth-a-{suffix}"
    owner_b = f"p1b-auth-b-{suffix}"
    issuer_a = f"p1b-auth-issuer-a-{suffix}"
    issuer_b = f"p1b-auth-issuer-b-{suffix}"
    context_owner_b = f"p1b-owner-context-{suffix}"
    context_team_b = f"p1b-team-context-{suffix}"
    run_b = f"p1b-team-run-{suffix}"

    async def seed():
        from database import Analyst, AnalysisContextRecord, AsyncSessionLocal, Issuer, Run

        async with AsyncSessionLocal() as db:
            db.add_all([
                Analyst(id=owner_a, name="Auth A", role="analyst", team_id="team-a"),
                Analyst(id=owner_b, name="Auth B", role="analyst", team_id="team-a"),
                Issuer(id=issuer_a, name="Auth issuer A", team_id="team-a"),
                Issuer(id=issuer_b, name="Auth issuer B", team_id="team-b"),
                AnalysisContextRecord(
                    id=context_owner_b, analyst_id=owner_b, name="Foreign owner",
                    issuer_ids=[issuer_a], artifacts={},
                ),
                AnalysisContextRecord(
                    id=context_team_b, analyst_id=owner_a, name="Foreign team",
                    issuer_ids=[issuer_b], artifacts={},
                ),
                Run(
                    id=run_b, issuer_id=issuer_b, analyst_id=owner_a,
                    status="complete", committee_status="Committee Ready",
                ),
            ])
            await db.commit()

    asyncio.run(seed())
    monkeypatch.setattr(get_settings(), "caos_lineage_v2_enabled", True)
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)
    monkeypatch.setattr(
        ingest, "extract_pdf_text",
        _extract_lineage_pdf_text,
    )

    async def identity_a():
        return CallerIdentity(
            id=owner_a, email=f"{owner_a}@example.test", full_name="Auth A",
            team_id="team-a",
        )

    app.dependency_overrides[get_identity] = identity_a
    try:
        owner_cases = [
            client.post(
                "/api/ingestion/upload/document",
                data={"issuer_id": issuer_a, "context_id": context_owner_b},
                files={"file": ("owner.pdf", _pdf(), "application/pdf")},
            ),
            client.post("/api/runs", json={
                "issuer_id": issuer_a, "context_id": context_owner_b,
            }),
            client.post(f"/api/models/{issuer_a}/checkpoints", json={
                "context_id": context_owner_b,
            }),
            client.post("/api/reports/versions", json={
                "context_id": context_owner_b, "run_id": "missing",
                "model_checkpoint_id": "missing", "payload": {},
            }),
            client.post(
                f"/api/analysis/contexts/{context_owner_b}/insights",
                json={"surface": "reports", "kind": "foreign-owner"},
            ),
        ]
        team_cases = [
            client.post(
                "/api/ingestion/upload/document",
                data={"issuer_id": issuer_b, "context_id": context_team_b},
                files={"file": ("team.pdf", _pdf(), "application/pdf")},
            ),
            client.post("/api/runs", json={
                "issuer_id": issuer_b, "context_id": context_team_b,
            }),
            client.post(f"/api/models/{issuer_b}/checkpoints", json={
                "context_id": context_team_b,
            }),
            client.post("/api/reports/versions", json={
                "context_id": context_team_b, "run_id": run_b,
                "model_checkpoint_id": "missing", "payload": {},
            }),
            client.post(
                f"/api/analysis/contexts/{context_team_b}/insights",
                json={"surface": "reports", "kind": "foreign-team"},
            ),
        ]
        assert [response.status_code for response in owner_cases] == [404] * 5
        assert [response.status_code for response in team_cases] == [404] * 5
    finally:
        app.dependency_overrides.pop(get_identity, None)


@pytest.mark.asyncio
async def test_reconciler_is_read_only_idempotent_restartable_and_verifies(
    seeded_db, capsys
):
    import argparse
    import json

    from context_lineage import merge_artifact_refs
    from database import (
        Analyst, AnalysisContextRecord, AnalysisInsight, AsyncSessionLocal, Document,
        Issuer, LineageEdge, ModelCheckpoint, ReportVersion, Run, SourceManifest,
    )
    from lineage_reconciliation import reconcile_lineage, verify_exit_code
    from scripts import reconcile_lineage as cli

    suffix = uuid.uuid4().hex[:8]
    analyst_id = f"p1b-owner-{suffix}"
    issuer_id = f"p1b-issuer-{suffix}"
    context_id = f"zzzz-p1b-context-{suffix}"
    next_context_id = f"zzzz-z-context-{suffix}"
    doc_id = f"p1b-doc-{suffix}"
    manifest_id = f"p1b-manifest-{suffix}"
    run_id = f"p1b-run-{suffix}"
    checkpoint_id = f"p1b-checkpoint-{suffix}"
    report_id = f"p1b-report-{suffix}"
    insight_id = f"p1b-insight-{suffix}"
    async with AsyncSessionLocal() as db:
        db.add_all([
            Analyst(id=analyst_id, name=f"P1B {suffix}", role="analyst"),
            Issuer(id=issuer_id, name=f"P1B Issuer {suffix}"),
            AnalysisContextRecord(
                id=context_id, analyst_id=analyst_id, name="Reconcile",
                issuer_ids=[issuer_id], artifacts={
                    "source_manifest_id": manifest_id,
                    "issuer_run_id": run_id,
                    "model_checkpoint_id": checkpoint_id,
                    "report_version_id": report_id,
                    "insight_id": insight_id,
                },
            ),
            AnalysisContextRecord(
                id=next_context_id, analyst_id=analyst_id, name="Resume target",
                issuer_ids=[issuer_id], artifacts={},
            ),
            Document(
                id=doc_id, issuer_id=issuer_id, doc_type="Document",
                file_name="reconcile.pdf", storage_key="test/reconcile.pdf",
            ),
            SourceManifest(
                id=manifest_id, analyst_id=analyst_id, issuer_id=issuer_id,
                origin="live", method="reported", status="ready",
                files=[{"document_id": doc_id}], authority={},
            ),
            Run(id=run_id, issuer_id=issuer_id, analyst_id=analyst_id, status="complete"),
            ModelCheckpoint(
                id=checkpoint_id, issuer_id=issuer_id, analyst_id=analyst_id,
                context_id=context_id, issuer_run_id=run_id, label="Frozen",
                payload_hash="a" * 64, payload={}, authority={},
            ),
            ReportVersion(
                id=report_id, context_id=context_id, analyst_id=analyst_id,
                run_id=run_id, model_checkpoint_id=checkpoint_id,
                status="published", payload={"source_manifest_id": manifest_id},
                document_sha256="b" * 64, authority={},
            ),
            AnalysisInsight(
                id=insight_id, analyst_id=analyst_id, context_id=context_id,
                surface="reports", kind="brief", status="ready",
                subject_refs={"issuer_run_id": run_id, "source_manifest_id": manifest_id},
                summary="Reconciled", claims=[], recommended_actions=[],
                missing_dependencies=[], authority={}, source_fingerprint="c" * 64,
                version=0,
            ),
        ])
        await db.commit()

        dry = await reconcile_lineage(
            db, mode="dry-run", limit=1, cursor="zzzy"
        )
        assert dry.scanned_contexts == 1
        assert dry.next_cursor == context_id
        assert dry.proposed_edges == 7
        assert dry.applied_edges == 0
        assert dry.proposed_typed_refs == 6
        assert dry.unresolved_historical_relationships == 1
        assert (await db.execute(select(func.count(LineageEdge.id)).where(
            LineageEdge.context_id == context_id
        ))).scalar_one() == 0
        assert "artifact_refs" not in (await db.get(AnalysisContextRecord, context_id)).artifacts

        applied = await reconcile_lineage(
            db, mode="apply", limit=1, cursor="zzzy"
        )
        assert applied.applied_edges == 7
        assert applied.applied_typed_refs == 6
        bound = (await db.get(AnalysisContextRecord, context_id)).artifacts["artifact_refs"]
        for kind, artifact_id in (
            ("model_checkpoint", checkpoint_id),
            ("report_version", report_id),
            ("insight", insight_id),
        ):
            matches = [
                ref for ref in bound
                if ref["kind"] == kind and ref["id"] == artifact_id
            ]
            assert len(matches) == 1
            assert matches[0]["version"] is not None
        async def domain_count() -> int:
            total = 0
            for model in (
                Document, SourceManifest, Run, ModelCheckpoint, ReportVersion, AnalysisInsight
            ):
                total += (await db.execute(select(func.count(model.id)))).scalar_one()
            return total

        before_domain_count = await domain_count()

        repeated = await reconcile_lineage(
            db, mode="apply", limit=1, cursor="zzzy"
        )
        assert repeated.applied_edges == 0
        assert repeated.applied_typed_refs == 0
        assert repeated.existing_edges == 7
        assert await domain_count() == before_domain_count

        context = await db.get(AnalysisContextRecord, context_id)
        context.artifacts = merge_artifact_refs(context.artifacts, [
            {"kind": "document", "id": f"missing-{suffix}"},
            {"kind": "report_version", "id": report_id, "version": "wrong-version"},
        ])
        await db.commit()
        db.add(LineageEdge(
            artifact_id=f"report_version:{report_id}",
            parent_id=f"issuer_run:{run_id}",
            transform="cross-owner-test",
            transform_version="2",
            context_id=context_id,
            analyst_id="different-owner",
            artifact_kind="report_version",
            artifact_version="b" * 64,
            parent_kind="issuer_run",
            v2_idempotency_key=f"cross-owner-{suffix}",
        ))
        db.add(LineageEdge(
            artifact_id=f"issuer_run:{report_id}",
            parent_id=f"issuer_run:{run_id}",
            transform="prefix-mismatch-test",
            transform_version="2",
            context_id=context_id,
            analyst_id=analyst_id,
            artifact_kind="report_version",
            artifact_version="b" * 64,
            parent_kind="issuer_run",
            v2_idempotency_key=f"prefix-mismatch-{suffix}",
        ))
        await db.commit()
        before_verify_artifacts = dict(context.artifacts)
        before_verify_edges = (await db.execute(select(func.count(LineageEdge.id)).where(
            LineageEdge.context_id == context_id
        ))).scalar_one()
        verified = await reconcile_lineage(
            db, mode="verify", limit=1, cursor="zzzy"
        )
        assert verified.dangling_refs >= 1
        assert verified.unauthorized_refs >= 1
        assert verified.malformed_edges >= 2
        assert verified.integrity_failures >= 2
        assert verify_exit_code(verified) == 1
        assert (await db.get(AnalysisContextRecord, context_id)).artifacts == before_verify_artifacts
        assert (await db.execute(select(func.count(LineageEdge.id)).where(
            LineageEdge.context_id == context_id
        ))).scalar_one() == before_verify_edges

        cli_code = await cli._run(argparse.Namespace(
            mode="verify", limit=1, cursor="zzzy"
        ))
        cli_output = json.loads(capsys.readouterr().out)
        assert cli_code == 1
        assert cli_output["malformed_edges"] >= 2
        assert cli_output["integrity_failures"] >= 2

        await db.execute(delete(LineageEdge).where(LineageEdge.context_id == context_id))
        await db.execute(delete(AnalysisInsight).where(AnalysisInsight.id == insight_id))
        await db.execute(delete(ReportVersion).where(ReportVersion.id == report_id))
        await db.execute(delete(ModelCheckpoint).where(ModelCheckpoint.id == checkpoint_id))
        await db.execute(delete(SourceManifest).where(SourceManifest.id == manifest_id))
        await db.execute(delete(Run).where(Run.id == run_id))
        await db.execute(delete(Document).where(Document.id == doc_id))
        await db.execute(delete(AnalysisContextRecord).where(
            AnalysisContextRecord.id == next_context_id
        ))
        await db.execute(delete(AnalysisContextRecord).where(AnalysisContextRecord.id == context_id))
        await db.execute(delete(Issuer).where(Issuer.id == issuer_id))
        await db.execute(delete(Analyst).where(Analyst.id == analyst_id))
        await db.commit()


@pytest.mark.asyncio
async def test_reconciler_missing_owner_modes_cursor_and_cli_exit(
    seeded_db, monkeypatch, capsys
):
    import argparse
    import json

    from config import get_settings
    from database import Analyst, AnalysisContextRecord, AsyncSessionLocal, Issuer, Portfolio, Run
    from lineage_reconciliation import reconcile_lineage, verify_exit_code
    from scripts import reconcile_lineage as cli

    suffix = uuid.uuid4().hex[:8]
    owner = f"missing-profile-{suffix}"
    issuer_id = f"missing-issuer-{suffix}"
    run_id = f"missing-run-{suffix}"
    context_id = f"zzzzzzz-a-missing-{suffix}"
    next_context_id = f"zzzzzzz-b-next-{suffix}"
    portfolio_context_id = f"zzzzzzz-c-portfolio-{suffix}"
    portfolio_owner = f"portfolio-owner-{suffix}"
    portfolio_id = f"foreign-portfolio-{suffix}"
    async with AsyncSessionLocal() as db:
        db.add_all([
            Issuer(id=issuer_id, name=f"Missing owner {suffix}"),
            Run(id=run_id, issuer_id=issuer_id, analyst_id=owner, status="complete"),
            AnalysisContextRecord(
                id=context_id, analyst_id=owner, name="Missing profile",
                issuer_ids=[issuer_id], artifacts={"issuer_run_id": run_id},
            ),
            AnalysisContextRecord(
                id=next_context_id, analyst_id=owner, name="Cursor successor",
                issuer_ids=[issuer_id], artifacts={},
            ),
            Analyst(
                id=portfolio_owner, name=f"Portfolio owner {suffix}", role="analyst",
                team_id="team-a",
            ),
            Portfolio(id=portfolio_id, name="Foreign portfolio", team_id="team-b"),
            AnalysisContextRecord(
                id=portfolio_context_id, analyst_id=portfolio_owner,
                name="Foreign portfolio scope", issuer_ids=[],
                portfolio_scope=portfolio_id, artifacts={},
            ),
        ])
        await db.commit()
        original_artifacts = dict((await db.get(AnalysisContextRecord, context_id)).artifacts)

        monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", False)
        shared = await reconcile_lineage(db, mode="dry-run", limit=1, cursor="zzzzzzy")
        assert shared.scanned_contexts == 1
        assert shared.next_cursor == context_id
        assert shared.unauthorized_refs == 0
        assert shared.integrity_failures == 0
        assert (await db.get(AnalysisContextRecord, context_id)).artifacts == original_artifacts

        monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)
        strict = await reconcile_lineage(db, mode="verify", limit=1, cursor="zzzzzzy")
        assert strict.scanned_contexts == 1
        assert strict.next_cursor == context_id
        assert strict.unauthorized_refs >= 1
        assert strict.integrity_failures >= 1
        assert verify_exit_code(strict) == 1
        assert (await db.get(AnalysisContextRecord, context_id)).artifacts == original_artifacts

        portfolio_strict = await reconcile_lineage(
            db, mode="verify", limit=1, cursor=next_context_id
        )
        assert portfolio_strict.scanned_contexts == 1
        assert portfolio_strict.next_cursor is None
        assert portfolio_strict.unauthorized_refs >= 1
        assert verify_exit_code(portfolio_strict) == 1

    code = await cli._run(argparse.Namespace(
        mode="verify", limit=1, cursor="zzzzzzy"
    ))
    output = json.loads(capsys.readouterr().out)
    assert code == 1
    assert output["scanned_contexts"] == 1
    assert output["integrity_failures"] >= 1
    assert output["next_cursor"] == context_id

    async with AsyncSessionLocal() as db:
        await db.execute(delete(AnalysisContextRecord).where(
            AnalysisContextRecord.id.in_([
                context_id, next_context_id, portfolio_context_id,
            ])
        ))
        await db.execute(delete(Run).where(Run.id == run_id))
        await db.execute(delete(Portfolio).where(Portfolio.id == portfolio_id))
        await db.execute(delete(Issuer).where(Issuer.id == issuer_id))
        await db.execute(delete(Analyst).where(Analyst.id == portfolio_owner))
        await db.commit()
@pytest.fixture(autouse=True)
def _verified_ingestion_scan(monkeypatch):
    """Publication tests model a deployment with a successful malware scan."""
    import routes.ingestion as ingestion_route

    async def clean_scan(_content: bytes):
        return "clean"

    monkeypatch.setattr(ingestion_route.avscan, "scan", clean_scan)
