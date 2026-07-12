"""GDPR right-to-erasure (erase_analyst_data): the data subject's private research
and profile are deleted, their attribution on shared runs/documents is anonymized,
and other analysts' data is left untouched."""
from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_erase_deletes_private_anonymizes_shared_spares_others(seeded_db):
    from database import (
        Analyst, AsyncSessionLocal, AuditLog, Document, Issuer, ResearchJob, Run, SavedModel,
        erase_analyst_data,
    )

    subj_id, subj_email = "gdpr-subject", "erase-me@test.local"
    other_id, other_email = "gdpr-bystander", "keep-me@test.local"

    async with AsyncSessionLocal() as s:
        s.add(Issuer(id="gdpr-issuer", name="GDPR Co"))
        s.add(Analyst(id=subj_id, name="Erase Me", email=subj_email))
        s.add(Analyst(id=other_id, name="Keep Me", email=other_email))
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
        # E3: an audit_log row the subject actioned — must be ANONYMIZED (kept,
        # analyst_id scrubbed), not deleted — it's compliance history.
        s.add(AuditLog(id="gdpr-audit-subj", analyst_id=subj_id, action="issuer.create",
                       target_type="issuer", target_id="gdpr-issuer", after={"name": "GDPR Co"}))
        # Bystander's data — must survive untouched
        s.add(Run(id="gdpr-run-other", issuer_id="gdpr-issuer", analyst_id=other_id, status="complete"))
        s.add(ResearchJob(id="gdpr-job-other", status="complete", analyst_id=other_id))
        s.add(SavedModel(issuer_id="gdpr-issuer", analyst_id=other_id, payload={"o": 2}))
        s.add(AuditLog(id="gdpr-audit-other", analyst_id=other_id, action="issuer.create",
                       target_type="issuer", target_id="gdpr-issuer", after={"name": "GDPR Co"}))
        await s.commit()

    async with AsyncSessionLocal() as s:
        summary = await erase_analyst_data(s, analyst_id=subj_id, email=subj_email)

    assert summary == {
        "research_jobs_deleted": 1,
        "saved_models_deleted": 1,
        "runs_anonymized": 1,
        "documents_anonymized": 1,
        "audit_log_anonymized": 1,
        "profile_deleted": 1,
    }

    async with AsyncSessionLocal() as s:
        # Private data + PII gone.
        assert await s.get(Analyst, subj_id) is None
        assert await s.get(ResearchJob, "gdpr-job") is None
        # Shared work product retained, attribution scrubbed.
        run = await s.get(Run, "gdpr-run")
        assert run is not None and run.analyst_id is None
        doc = await s.get(Document, "gdpr-doc")
        assert doc is not None and doc.uploaded_by is None
        # Bystander untouched.
        other = await s.get(Analyst, other_id)
        assert other is not None and other.email == other_email
        run_other = await s.get(Run, "gdpr-run-other")
        assert run_other is not None and run_other.analyst_id == other_id
        assert await s.get(ResearchJob, "gdpr-job-other") is not None
        # Saved models: subject's deleted, bystander's kept.
        from sqlalchemy import select
        kept = (await s.execute(select(SavedModel.analyst_id))).scalars().all()
        assert kept == [other_id]
        # E3: audit_log rows are RETAINED (compliance history), only the actor
        # link is scrubbed for the subject; the bystander's row is untouched;
        # the erasure event itself (analyst.gdpr_erase) is present and already
        # anonymized at write time.
        subj_audit = await s.get(AuditLog, "gdpr-audit-subj")
        assert subj_audit is not None
        assert subj_audit.analyst_id is None
        assert subj_audit.action == "issuer.create"
        assert subj_audit.target_id == "gdpr-issuer"
        other_audit = await s.get(AuditLog, "gdpr-audit-other")
        assert other_audit is not None and other_audit.analyst_id == other_id
        erase_events = (await s.execute(
            select(AuditLog).where(AuditLog.action == "analyst.gdpr_erase",
                                    AuditLog.target_id == subj_id)
        )).scalars().all()
        assert len(erase_events) == 1
        assert erase_events[0].analyst_id is None


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
