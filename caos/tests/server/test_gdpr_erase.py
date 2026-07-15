"""GDPR right-to-erasure (erase_analyst_data): the data subject's private research
and profile are deleted, their attribution on shared runs/documents is anonymized,
and other analysts' data is left untouched."""
from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_erase_deletes_private_anonymizes_shared_spares_others(seeded_db):
    from database import (
        Analyst, AnalysisContextRecord, AnalysisInsight, AsyncSessionLocal,
        Document, Issuer, IssuerReportingProfile, LineageEdge, Portfolio,
        PortfolioStressRun, ResearchJob, Run,
        SavedModel, erase_analyst_data,
    )

    subj_id, subj_email = "gdpr-subject", "erase-me@test.local"
    other_id, other_email = "gdpr-bystander", "keep-me@test.local"

    async with AsyncSessionLocal() as s:
        s.add(Issuer(id="gdpr-issuer", name="GDPR Co"))
        s.add(Analyst(id=subj_id, name="Erase Me", email=subj_email))
        s.add(Analyst(id=other_id, name="Keep Me", email=other_email))
        await s.flush()
        # Subject's data. status="complete" on both runs — erasure/anonymization
        # is status-agnostic, and migrations/0035's active-run unique index
        # allows only one queued/running run per issuer at a time, which two
        # sibling runs for the SAME issuer (the point of this test) would trip.
        s.add(Run(id="gdpr-run", issuer_id="gdpr-issuer", analyst_id=subj_id, status="complete"))
        s.add(ResearchJob(id="gdpr-job", status="complete", analyst_id=subj_id))
        s.add(Document(id="gdpr-doc", issuer_id="gdpr-issuer", doc_type="10-K",
                       file_name="f.pdf", storage_key="k", uploaded_by=subj_email))
        # Private Model Builder state — personal work product, must be DELETED
        # (analyst_id is a loose string key; a re-registration mints a new uuid,
        # so an undeleted row would orphan while still holding subject data).
        s.add(SavedModel(issuer_id="gdpr-issuer", analyst_id=subj_id, payload={"o": 1}))
        s.add(Portfolio(id="gdpr-portfolio", name="GDPR Portfolio"))
        await s.flush()
        s.add(PortfolioStressRun(
            id="gdpr-stress", portfolio_id="gdpr-portfolio", created_by=subj_id,
            label="Private stress", inputs={}, output={}, source_fingerprint="2" * 64,
            authority={}, status="complete",
        ))
        s.add(AnalysisContextRecord(id="gdpr-context", analyst_id=subj_id, name="Private context"))
        s.add(IssuerReportingProfile(
            issuer_id="gdpr-issuer", cadence="quarterly", updated_by=subj_id,
            authority={"method": "analyst-provided"},
        ))
        await s.flush()
        s.add(AnalysisInsight(
            id="gdpr-insight", analyst_id=subj_id, context_id="gdpr-context",
            surface="query", kind="desk-brief", status="ready", subject_refs={},
            summary="Private cited view", claims=[], recommended_actions=[],
            missing_dependencies=[], authority={}, source_fingerprint="gdpr-fingerprint",
            version=0,
        ))
        s.add(LineageEdge(
            id="gdpr-lineage", artifact_id="document:gdpr-doc",
            parent_id="issuer_run:gdpr-run", transform="extract",
            transform_version="1", context_id="gdpr-context",
            analyst_id=subj_id, artifact_kind="document",
            parent_kind="issuer_run", v2_idempotency_key="a" * 64,
        ))
        # Bystander's data — must survive untouched
        s.add(Run(id="gdpr-run-other", issuer_id="gdpr-issuer", analyst_id=other_id, status="complete"))
        s.add(ResearchJob(id="gdpr-job-other", status="complete", analyst_id=other_id))
        s.add(SavedModel(issuer_id="gdpr-issuer", analyst_id=other_id, payload={"o": 2}))
        s.add(PortfolioStressRun(
            id="gdpr-stress-other", portfolio_id="gdpr-portfolio", created_by=other_id,
            label="Bystander stress", inputs={}, output={}, source_fingerprint="3" * 64,
            authority={}, status="complete",
        ))
        s.add(AnalysisContextRecord(
            id="gdpr-context-other", analyst_id=other_id, name="Bystander context"
        ))
        await s.flush()
        s.add(LineageEdge(
            id="gdpr-lineage-other", artifact_id="issuer_run:gdpr-run-other",
            parent_id="document:gdpr-doc", transform="cite", transform_version="1",
            context_id="gdpr-context-other", analyst_id=other_id,
            artifact_kind="issuer_run", parent_kind="document",
            v2_idempotency_key="b" * 64,
        ))
        await s.commit()

    async with AsyncSessionLocal() as s:
        summary = await erase_analyst_data(s, analyst_id=subj_id, email=subj_email)

    assert summary == {
        "research_jobs_deleted": 1,
        "source_manifests_deleted": 0,
        "model_checkpoints_deleted": 0,
        "report_drafts_deleted": 0,
        "report_versions_deleted": 0,
        "analysis_insights_deleted": 1,
        "lineage_edges_deleted": 1,
        "portfolio_stress_runs_deleted": 1,
        "model_workbook_imports_deleted": 0,
        "model_override_events_deleted": 0,
        "model_drafts_v2_deleted": 0,
        "committee_agenda_deleted": 0,
        "committee_agenda_anonymized": 0,
        "decisions_anonymized": 0,
        "decision_votes_anonymized": 0,
        "thesis_versions_anonymized": 0,
        "committee_snapshots_redacted": 0,
        "saved_models_deleted": 1,
        "runs_anonymized": 1,
        "reporting_profiles_anonymized": 1,
        "documents_anonymized": 1,
        "profile_deleted": 1,
    }

    async with AsyncSessionLocal() as s:
        # Private data + PII gone.
        assert await s.get(Analyst, subj_id) is None
        assert await s.get(ResearchJob, "gdpr-job") is None
        assert await s.get(AnalysisInsight, "gdpr-insight") is None
        assert await s.get(LineageEdge, "gdpr-lineage") is None
        assert await s.get(PortfolioStressRun, "gdpr-stress") is None
        # Shared work product retained, attribution scrubbed.
        run = await s.get(Run, "gdpr-run")
        assert run is not None and run.analyst_id is None
        doc = await s.get(Document, "gdpr-doc")
        assert doc is not None and doc.uploaded_by is None
        reporting_profile = await s.get(IssuerReportingProfile, "gdpr-issuer")
        assert reporting_profile is not None and reporting_profile.updated_by is None
        # Bystander untouched.
        other = await s.get(Analyst, other_id)
        assert other is not None and other.email == other_email
        run_other = await s.get(Run, "gdpr-run-other")
        assert run_other is not None and run_other.analyst_id == other_id
        assert await s.get(ResearchJob, "gdpr-job-other") is not None
        assert await s.get(PortfolioStressRun, "gdpr-stress-other") is not None
        kept_lineage = await s.get(LineageEdge, "gdpr-lineage-other")
        assert kept_lineage is not None and kept_lineage.analyst_id == other_id
        from sqlalchemy import or_, select
        leaked = (await s.execute(select(LineageEdge.id).where(or_(
            LineageEdge.analyst_id.in_([subj_id, subj_email]),
            LineageEdge.context_id == "gdpr-context",
        )))).scalars().all()
        assert leaked == []
        # Saved models: subject's deleted, bystander's kept.
        kept = set((await s.execute(select(SavedModel.analyst_id))).scalars().all())
        assert subj_id not in kept
        assert other_id in kept


@pytest.mark.asyncio
async def test_erase_deletes_model_v2_private_state_dependency_first(seeded_db):
    from database import (
        Analyst, AnalysisContextRecord, AsyncSessionLocal, Document, Issuer,
        ModelDraftV2, ModelOverrideEvent, ModelWorkbookImport, Run, SourceManifest,
        erase_analyst_data,
    )

    subject = "gdpr-model-v2-subject"
    bystander = "gdpr-model-v2-bystander"
    async with AsyncSessionLocal() as s:
        s.add(Issuer(id="gdpr-model-v2-issuer", name="Model V2 GDPR Co"))
        s.add(Analyst(id=subject, name="Erase V2", email="erase-v2@test.local"))
        s.add(Analyst(id=bystander, name="Keep V2", email="keep-v2@test.local"))
        await s.flush()
        for owner, suffix in ((subject, "subject"), (bystander, "bystander")):
            s.add(Run(
                id=f"gdpr-model-v2-run-{suffix}", issuer_id="gdpr-model-v2-issuer",
                analyst_id=owner, status="complete",
            ))
            s.add(Document(
                id=f"gdpr-model-v2-doc-{suffix}", issuer_id="gdpr-model-v2-issuer",
                doc_type="model-workbook", file_name=f"{suffix}.xlsx",
                storage_key=f"gdpr/{suffix}.xlsx", analyst_id=owner,
            ))
            s.add(AnalysisContextRecord(
                id=f"gdpr-model-v2-context-{suffix}", analyst_id=owner,
                name=f"Model V2 {suffix}",
            ))
            s.add(SourceManifest(
                id=f"gdpr-model-v2-manifest-{suffix}", analyst_id=owner,
                issuer_id="gdpr-model-v2-issuer", origin="live", method="uploaded",
                status="ready", files=[f"{suffix}.xlsx"], authority={"owner": owner},
            ))
        await s.flush()
        for owner, suffix in ((subject, "subject"), (bystander, "bystander")):
            draft_id = f"gdpr-model-v2-draft-{suffix}"
            s.add(ModelDraftV2(
                id=draft_id, issuer_id="gdpr-model-v2-issuer", analyst_id=owner,
                context_id=f"gdpr-model-v2-context-{suffix}",
                source_run_id=f"gdpr-model-v2-run-{suffix}", payload={"schema_version": 2},
                calculation={"status": "partial"}, source_fingerprint="1" * 64,
                input_fingerprint="2" * 64, engine_version="2.0.0",
                calculation_hash="3" * 64, revision=2,
            ))
        await s.flush()
        for owner, suffix in ((subject, "subject"), (bystander, "bystander")):
            draft_id = f"gdpr-model-v2-draft-{suffix}"
            s.add(ModelOverrideEvent(
                id=f"gdpr-model-v2-override-{suffix}", draft_id=draft_id,
                issuer_id="gdpr-model-v2-issuer", analyst_id=owner, action="set",
                node_id="input:FY2026:revenue", value_type="number",
                before_value={"value_type": "number", "value": 100},
                after_value={"value_type": "number", "value": 110},
                original_formula=None,
                original_value={"value_type": "number", "value": 100},
                reason="GDPR fixture", scope="draft", source="fixture",
                actor_id=owner, revision=2,
            ))
            s.add(ModelWorkbookImport(
                id=f"gdpr-model-v2-import-{suffix}", analyst_id=owner,
                issuer_id="gdpr-model-v2-issuer", draft_id=draft_id,
                document_id=f"gdpr-model-v2-doc-{suffix}",
                source_manifest_id=f"gdpr-model-v2-manifest-{suffix}",
                workbook_sha256=("a" if owner == subject else "b") * 64,
                import_fingerprint=("c" if owner == subject else "d") * 64,
                mapping={"rows": {}}, issues=[], committed_revision=2,
                calculation_hash="3" * 64,
            ))
        await s.commit()

    async with AsyncSessionLocal() as s:
        summary = await erase_analyst_data(
            s, analyst_id=subject, email="erase-v2@test.local"
        )

    assert summary["model_workbook_imports_deleted"] == 1
    assert summary["model_override_events_deleted"] == 1
    assert summary["model_drafts_v2_deleted"] == 1
    assert summary["source_manifests_deleted"] == 1
    async with AsyncSessionLocal() as s:
        assert await s.get(ModelWorkbookImport, "gdpr-model-v2-import-subject") is None
        assert await s.get(ModelOverrideEvent, "gdpr-model-v2-override-subject") is None
        assert await s.get(ModelDraftV2, "gdpr-model-v2-draft-subject") is None
        assert await s.get(SourceManifest, "gdpr-model-v2-manifest-subject") is None
        assert await s.get(ModelWorkbookImport, "gdpr-model-v2-import-bystander") is not None
        assert await s.get(ModelOverrideEvent, "gdpr-model-v2-override-bystander") is not None
        assert await s.get(ModelDraftV2, "gdpr-model-v2-draft-bystander") is not None
        assert await s.get(SourceManifest, "gdpr-model-v2-manifest-bystander") is not None


@pytest.mark.asyncio
async def test_erase_by_email_resolves_id_then_erases(seeded_db):
    """Operator CLI path (erase_analyst.erase_by_email): looks the departed analyst
    up by email, then erases by their id so runs stamped with the uuid are scrubbed."""
    from database import Analyst, AsyncSessionLocal, Issuer, Run
    from erase_analyst import erase_by_email

    async with AsyncSessionLocal() as s:
        s.add(Issuer(id="gdpr-cli-issuer", name="CLI Co"))
        s.add(Analyst(id="gdpr-cli-id", name="Departed One", email="gone@test.local"))
        s.add(Run(id="gdpr-cli-run", issuer_id="gdpr-cli-issuer", analyst_id="gdpr-cli-id"))
        await s.commit()

    summary = await erase_by_email("gone@test.local")
    assert summary["profile_deleted"] == 1
    assert summary["runs_anonymized"] == 1

    async with AsyncSessionLocal() as s:
        assert await s.get(Analyst, "gdpr-cli-id") is None
        run = await s.get(Run, "gdpr-cli-run")
        assert run is not None and run.analyst_id is None
