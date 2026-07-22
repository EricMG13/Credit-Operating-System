"""GDPR right-to-erasure (erase_analyst_data): the data subject's private research
and profile are deleted, their attribution on shared runs/documents is anonymized,
and other analysts' data is left untouched."""
from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_erase_removes_owned_c3_graph_and_redacts_retained_audit_rows(
    seeded_db,
) -> None:
    from datetime import datetime, timezone

    from sqlalchemy import func, select

    from database import (
        AlertDeliveryIntent,
        AlertEvent,
        AlertEventContext,
        AlertState,
        Analyst,
        AsyncSessionLocal,
        WatchRule,
        WatchRuleEvaluation,
        WatchRuleVersion,
        erase_analyst_data,
    )

    subject_id = "gdpr-c3-subject"
    subject_email = "Gdpr-C3-Subject@Test.Local"
    retained_subject_email = "gDPR-c3-sUBJECT@tEST.lOCAL"
    bystander_id = "gdpr-c3-bystander"
    bystander_email = "gdpr-c3-bystander@test.local"
    now = datetime(2026, 7, 21, 12, tzinfo=timezone.utc)

    async with AsyncSessionLocal() as session:
        session.add_all(
            [
                Analyst(id=subject_id, name="Erase C3", email=subject_email),
                Analyst(id=bystander_id, name="Keep C3", email=bystander_email),
            ]
        )
        for index, (owner, email, suffix) in enumerate(
            (
                (subject_id, subject_email, "subject"),
                (bystander_id, bystander_email, "bystander"),
            ),
            start=1,
        ):
            rule_id = f"91000000-0000-0000-0000-00000000000{index}"
            version_id = f"92000000-0000-0000-0000-00000000000{index}"
            evaluation_id = f"93000000-0000-0000-0000-00000000000{index}"
            event_id = f"gdpr-c3-event-{suffix}"
            context_id = f"94000000-0000-0000-0000-00000000000{index}"
            intent_id = f"95000000-0000-0000-0000-00000000000{index}"
            correlation_id = f"96000000-0000-0000-0000-00000000000{index}"
            alert_key = f"c3:{str(index) * 64}"
            session.add(
                WatchRule(
                    id=rule_id,
                    tenant_id="gdpr-c3-tenant",
                    owner_user_id=owner,
                    team_id_snapshot="gdpr-c3-team",
                    name=f"C3 {suffix}",
                    signal_type="run_finding",
                    enabled=True,
                    paused=False,
                    current_version=1,
                    schedule_kind="event_driven",
                    claim_attempt_count=0,
                    config_json={"owner": owner},
                    created_at=now,
                    updated_at=now,
                )
            )
            session.add(
                AlertEvent(
                    id=event_id,
                    alert_key=alert_key,
                    kind=f"finding:{owner}",
                    title=f"C3 {suffix} by {email}",
                    impact=f"Retained institutional alert for {owner}",
                    evidence={
                        "owner": owner,
                        "nested": [f"evidence:{email}"],
                        "identity_keys": {
                            owner: "id-key-value",
                            email: "email-key-value",
                        },
                    },
                    authority={"actor": {"id": owner, "email": email}},
                    created_by=owner,
                    created_at=now,
                    updated_at=now,
                )
            )
            session.add(
                AlertState(
                    id=f"gdpr-c3-state-{suffix}",
                    alert_key=alert_key,
                    state="resolved",
                    assignee=f"desk:{owner}",
                    note=f"Assigned by {email}",
                    analyst_id=owner,
                    created_at=now,
                    resolved_at=now,
                    resolution_note=f"Resolved for {owner} / {email}",
                )
            )
            await session.flush()
            session.add(
                WatchRuleVersion(
                    id=version_id,
                    watch_rule_id=rule_id,
                    version=1,
                    owner_user_id=owner,
                    team_id_snapshot="gdpr-c3-team",
                    signal_type="run_finding",
                    config_json={"owner": owner},
                    created_at=now,
                )
            )
            await session.flush()
            session.add(
                WatchRuleEvaluation(
                    id=evaluation_id,
                    tenant_id="gdpr-c3-tenant",
                    owner_user_id=owner,
                    team_id_snapshot="gdpr-c3-team",
                    watch_rule_id=rule_id,
                    rule_version=1,
                    signal_type="run_finding",
                    subject_scope_json={
                        "tenant_id": "gdpr-c3-tenant",
                        "issuer_id": None,
                        "portfolio_id": None,
                    },
                    source_identity=f"manual:{owner}",
                    observation_key=str(index) * 64,
                    outcome="matched",
                    correlation_id=correlation_id,
                    correlation_root_id=correlation_id,
                    hop_count=0,
                    evaluated_at=now,
                    detail_json={"owner": owner},
                )
            )
            await session.flush()
            session.add(
                AlertEventContext(
                    id=context_id,
                    tenant_id="gdpr-c3-tenant",
                    owner_user_id=owner,
                    team_id_snapshot="gdpr-c3-team",
                    alert_event_id=event_id,
                    watch_rule_evaluation_id=evaluation_id,
                    watch_rule_id=rule_id,
                    rule_version=1,
                    signal_type="run_finding",
                    correlation_root_id=correlation_id,
                    hop_count=0,
                    context_json={"owner": owner},
                    created_at=now,
                )
            )
            await session.flush()
            session.add(
                AlertDeliveryIntent(
                    id=intent_id,
                    tenant_id="gdpr-c3-tenant",
                    owner_user_id=owner,
                    team_id_snapshot="gdpr-c3-team",
                    alert_event_id=event_id,
                    alert_event_context_id=context_id,
                    channel="email",
                    destination_ref=(
                        f"route:{retained_subject_email}"
                        if suffix == "bystander"
                        else email
                    ),
                    status=("rendered_intent" if suffix == "bystander" else "pending"),
                    attempt_count=0,
                    max_attempts=5,
                    available_at=now,
                    rendered_intent=(
                        {
                            "subject": f"Escalation for {retained_subject_email}",
                            "case_variant_id": subject_id.upper(),
                            "identity_keys": {
                                subject_id: "id-key-value",
                                retained_subject_email: "email-key-value",
                            },
                        }
                        if suffix == "bystander"
                        else None
                    ),
                    correlation_root_id=correlation_id,
                    created_at=now,
                    updated_at=now,
                )
            )
        # Retained bystander-owned terminal payloads can duplicate subject PII
        # independently of the parent event that erasure already redacts.
        session.add(
            AlertDeliveryIntent(
                id="95000000-0000-0000-0000-000000000098",
                tenant_id="gdpr-c3-tenant",
                owner_user_id=bystander_id,
                team_id_snapshot="gdpr-c3-team",
                alert_event_id="gdpr-c3-event-bystander",
                alert_event_context_id=(
                    "94000000-0000-0000-0000-000000000002"
                ),
                channel="in_app",
                destination_ref=f"inbox:{subject_id}",
                status="not_sent",
                attempt_count=1,
                max_attempts=3,
                available_at=now,
                not_sent_reason=f"render failed for {retained_subject_email}",
                correlation_root_id="96000000-0000-0000-0000-000000000002",
                created_at=now,
                updated_at=now,
            )
        )
        # A malformed direct owner stamp must be erased even when its parent
        # context belongs to a bystander; the clean bystander graph survives.
        session.add(
            AlertDeliveryIntent(
                id="95000000-0000-0000-0000-000000000099",
                tenant_id="gdpr-c3-tenant",
                owner_user_id=subject_id,
                team_id_snapshot="gdpr-c3-team",
                alert_event_id="gdpr-c3-event-bystander",
                alert_event_context_id=(
                    "94000000-0000-0000-0000-000000000002"
                ),
                channel="email",
                destination_ref=subject_email,
                status="pending",
                attempt_count=0,
                max_attempts=5,
                available_at=now,
                correlation_root_id="96000000-0000-0000-0000-000000000002",
                created_at=now,
                updated_at=now,
            )
        )
        await session.commit()

    async with AsyncSessionLocal() as session:
        summary = await erase_analyst_data(
            session,
            analyst_id=subject_id,
            email=subject_email,
        )

    assert summary["alert_delivery_intents_deleted"] == 2
    assert summary["alert_delivery_intent_payloads_redacted"] == 2
    assert summary["alert_event_contexts_deleted"] == 1
    assert summary["watch_rule_evaluations_deleted"] == 1
    assert summary["watch_rule_versions_deleted"] == 1
    assert summary["watch_rules_deleted"] == 1
    assert summary["alert_events_anonymized"] == 1
    assert summary["alert_event_payloads_redacted"] == 1
    assert summary["alert_states_anonymized"] == 1
    assert summary["alert_state_text_redacted"] == 1

    async with AsyncSessionLocal() as session:
        bystander_rows = (
            (AlertDeliveryIntent, "95000000-0000-0000-0000-000000000002"),
            (AlertDeliveryIntent, "95000000-0000-0000-0000-000000000098"),
            (AlertEventContext, "94000000-0000-0000-0000-000000000002"),
            (WatchRuleEvaluation, "93000000-0000-0000-0000-000000000002"),
            (WatchRuleVersion, "92000000-0000-0000-0000-000000000002"),
            (WatchRule, "91000000-0000-0000-0000-000000000002"),
        )
        for model, row_id in bystander_rows:
            assert await session.scalar(
                select(func.count()).select_from(model).where(
                    model.owner_user_id.in_([subject_id, subject_email])
                )
            ) == 0
            row = await session.get(model, row_id)
            assert row is not None
            assert row.owner_user_id == bystander_id

        retained_intents = (
            (
                await session.execute(
                    select(AlertDeliveryIntent).where(
                        AlertDeliveryIntent.owner_user_id == bystander_id
                    )
                )
            )
            .scalars()
            .all()
        )
        assert len(retained_intents) == 2
        retained_intent_audit = repr(
            [
                (
                    intent.destination_ref,
                    intent.rendered_intent,
                    intent.not_sent_reason,
                )
                for intent in retained_intents
            ]
        )
        assert subject_id not in retained_intent_audit
        assert subject_email.casefold() not in retained_intent_audit.casefold()
        rendered = next(
            intent for intent in retained_intents if intent.rendered_intent is not None
        )
        assert rendered.rendered_intent["case_variant_id"] == subject_id.upper()
        redacted_intent_keys = rendered.rendered_intent["identity_keys"]
        assert len(redacted_intent_keys) == 2
        assert set(redacted_intent_keys.values()) == {
            "id-key-value",
            "email-key-value",
        }

        assert await session.scalar(
            select(func.count()).select_from(WatchRule).where(
                WatchRule.enabled.is_(True),
                WatchRule.owner_user_id.in_([subject_id, subject_email]),
            )
        ) == 0

        subject_event = await session.get(AlertEvent, "gdpr-c3-event-subject")
        subject_state = await session.get(AlertState, "gdpr-c3-state-subject")
        assert subject_event is not None and subject_state is not None
        assert subject_event.created_by.startswith("erased:")
        retained_subject_audit = repr(
            (
                subject_event.kind,
                subject_event.title,
                subject_event.impact,
                subject_event.evidence,
                subject_event.authority,
                subject_state.analyst_id,
                subject_state.assignee,
                subject_state.note,
                subject_state.resolution_note,
            )
        )
        assert subject_id not in retained_subject_audit
        assert subject_email not in retained_subject_audit
        redacted_identity_keys = subject_event.evidence["identity_keys"]
        assert len(redacted_identity_keys) == 2
        assert set(redacted_identity_keys.values()) == {
            "id-key-value",
            "email-key-value",
        }
        assert subject_state.state == "resolved"
        assert subject_state.resolved_at == now.replace(tzinfo=None)

        bystander_event = await session.get(AlertEvent, "gdpr-c3-event-bystander")
        bystander_state = await session.get(AlertState, "gdpr-c3-state-bystander")
        assert bystander_event is not None and bystander_state is not None
        assert bystander_event.created_by == bystander_id
        assert bystander_event.kind == f"finding:{bystander_id}"
        assert bystander_event.title == f"C3 bystander by {bystander_email}"
        assert bystander_event.impact == (
            f"Retained institutional alert for {bystander_id}"
        )
        assert bystander_event.evidence == {
            "owner": bystander_id,
            "nested": [f"evidence:{bystander_email}"],
            "identity_keys": {
                bystander_id: "id-key-value",
                bystander_email: "email-key-value",
            },
        }
        assert bystander_event.authority == {
            "actor": {"id": bystander_id, "email": bystander_email}
        }
        assert bystander_state.assignee == f"desk:{bystander_id}"
        assert bystander_state.note == f"Assigned by {bystander_email}"
        assert bystander_state.resolution_note == (
            f"Resolved for {bystander_id} / {bystander_email}"
        )


@pytest.mark.asyncio
async def test_erase_deletes_private_anonymizes_shared_spares_others(seeded_db):
    from database import (
        Analyst, AnalysisContextRecord, AnalysisInsight, AsyncSessionLocal,
        Document, Issuer, IssuerReportingProfile, LineageEdge, Portfolio,
        NotificationEvent, PortfolioStressRun, ResearchJob, Run,
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
        s.add(NotificationEvent(
            id="gdpr-notification", analyst_id=subj_id, kind="run_complete",
            subject_kind="run", subject_id="gdpr-run", issuer_id="gdpr-issuer",
            title="Private completion", idempotency_key="run:gdpr-run:complete",
        ))
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
        s.add(NotificationEvent(
            id="gdpr-notification-other", analyst_id=other_id, kind="run_complete",
            subject_kind="run", subject_id="gdpr-run-other", issuer_id="gdpr-issuer",
            title="Bystander completion", idempotency_key="run:gdpr-run-other:complete",
        ))
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
        "alert_delivery_intents_deleted": 0,
        "alert_delivery_intent_payloads_redacted": 0,
        "alert_event_contexts_deleted": 0,
        "watch_rule_evaluations_deleted": 0,
        "watch_rule_versions_deleted": 0,
        "watch_rules_deleted": 0,
        "alert_events_anonymized": 0,
        "alert_event_payloads_redacted": 0,
        "alert_states_anonymized": 0,
        "alert_state_text_redacted": 0,
        "research_jobs_deleted": 1,
        "source_manifests_deleted": 0,
        "model_checkpoints_deleted": 0,
        "report_drafts_deleted": 0,
        "report_versions_deleted": 0,
        "analysis_insights_deleted": 1,
        "notification_events_deleted": 1,
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
        assert await s.get(NotificationEvent, "gdpr-notification") is None
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
        assert await s.get(NotificationEvent, "gdpr-notification-other") is not None
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
async def test_erase_by_email_resolves_mixed_case_to_canonical_identity(seeded_db):
    """Operator CLI path (erase_analyst.erase_by_email): looks the departed analyst
    up by email, then erases by their id so runs stamped with the uuid are scrubbed."""
    from database import Analyst, AsyncSessionLocal, Document, Issuer, Run
    from erase_analyst import erase_by_email

    async with AsyncSessionLocal() as s:
        s.add(Issuer(id="gdpr-cli-issuer", name="CLI Co"))
        s.add(Analyst(id="gdpr-cli-id", name="Departed One", email="Gone@Test.Local"))
        s.add(Run(id="gdpr-cli-run", issuer_id="gdpr-cli-issuer", analyst_id="gdpr-cli-id"))
        s.add(
            Document(
                id="gdpr-cli-document",
                issuer_id="gdpr-cli-issuer",
                doc_type="10-K",
                file_name="gdpr-cli.pdf",
                storage_key="gdpr/gdpr-cli.pdf",
                uploaded_by="Gone@Test.Local",
            )
        )
        await s.commit()

    summary = await erase_by_email("gOnE@tEsT.lOcAl")
    assert summary["profile_deleted"] == 1
    assert summary["runs_anonymized"] == 1
    assert summary["documents_anonymized"] == 1

    async with AsyncSessionLocal() as s:
        assert await s.get(Analyst, "gdpr-cli-id") is None
        run = await s.get(Run, "gdpr-cli-run")
        assert run is not None and run.analyst_id is None
        document = await s.get(Document, "gdpr-cli-document")
        assert document is not None and document.uploaded_by is None
