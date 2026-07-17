"""Cross-coverage CP-5 finding aggregation."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import delete


@pytest.mark.asyncio
async def test_latest_findings_rank_after_analyst_scope(seeded_db, monkeypatch):
    from config import get_settings
    from database import AsyncSessionLocal, QAFinding, Run
    from identity import CallerIdentity
    from routes.qa import list_latest_findings

    monkeypatch.setenv("CAOS_CROSS_ANALYST_RUN_SHARING_ENABLED", "false")
    get_settings.cache_clear()
    issuer_id = "a71f0000-0000-0000-0000-000000000001"
    run_ids = ["qa-own-old", "qa-own-new", "qa-foreign-newer"]
    now = datetime.now(timezone.utc)
    caller = CallerIdentity(id="qa-analyst", email="qa@example.test", full_name="QA Analyst")

    async with AsyncSessionLocal() as session:
        try:
            session.add_all([
                Run(
                    id=run_ids[0], issuer_id=issuer_id, analyst_id=caller.id,
                    status="complete", as_of_date="2026-01-31",
                    created_at=now - timedelta(days=3), completed_at=now - timedelta(days=3),
                ),
                Run(
                    id=run_ids[1], issuer_id=issuer_id, analyst_id=caller.id,
                    status="complete", as_of_date="2026-02-28",
                    created_at=now - timedelta(days=2), completed_at=now - timedelta(days=2),
                ),
                Run(
                    id=run_ids[2], issuer_id=issuer_id, analyst_id="another-analyst",
                    status="complete", as_of_date="2026-03-31",
                    created_at=now - timedelta(days=1), completed_at=now - timedelta(days=1),
                ),
            ])
            session.add_all([
                QAFinding(
                    id="qa-old-finding", run_id=run_ids[0], finding_id="QA-OLD",
                    module_id="CP-1", severity="MINOR", lane=1,
                    description="Superseded own finding.",
                ),
                QAFinding(
                    id="qa-current-finding", run_id=run_ids[1], finding_id="QA-CURRENT",
                    module_id="CP-2B", severity="MATERIAL", lane=4,
                    description="Current own finding.", required_remediation="Supply the debt schedule.",
                ),
                QAFinding(
                    id="qa-secret-finding", run_id=run_ids[2], finding_id="QA-SECRET",
                    module_id="CP-4C", severity="CRITICAL", lane=8,
                    description="Foreign analyst finding text.",
                ),
            ])
            await session.commit()

            rows = await list_latest_findings(limit=500, db=session, caller=caller)

            assert [row.finding_id for row in rows] == ["QA-CURRENT"]
            assert rows[0].run_id == run_ids[1]
            assert rows[0].as_of == "2026-02-28"
            assert rows[0].required_remediation == "Supply the debt schedule."
        finally:
            await session.execute(delete(QAFinding).where(QAFinding.run_id.in_(run_ids)))
            await session.execute(delete(Run).where(Run.id.in_(run_ids)))
            await session.commit()
            get_settings.cache_clear()


@pytest.mark.asyncio
async def test_latest_findings_apply_issuer_tenancy_scope(seeded_db, monkeypatch):
    from config import get_settings
    from database import AsyncSessionLocal, Issuer, QAFinding, Run
    from identity import CallerIdentity
    from routes.qa import list_latest_findings

    monkeypatch.setenv("CAOS_TENANCY_ENABLED", "true")
    monkeypatch.setenv("CAOS_CROSS_ANALYST_RUN_SHARING_ENABLED", "true")
    get_settings.cache_clear()
    issuer_ids = ["qa-team-a-issuer", "qa-team-b-issuer"]
    run_ids = ["qa-team-a-run", "qa-team-b-run"]
    now = datetime.now(timezone.utc)
    caller = CallerIdentity(
        id="team-a-analyst", email="a@example.test", full_name="Team A Analyst", team_id="team-a",
    )

    async with AsyncSessionLocal() as session:
        try:
            session.add_all([
                Issuer(id=issuer_ids[0], name="QA Team A Issuer", team_id="team-a"),
                Issuer(id=issuer_ids[1], name="QA Team B Issuer", team_id="team-b"),
            ])
            session.add_all([
                Run(
                    id=run_ids[0], issuer_id=issuer_ids[0], analyst_id="shared-analyst",
                    status="complete", created_at=now, completed_at=now,
                ),
                Run(
                    id=run_ids[1], issuer_id=issuer_ids[1], analyst_id="shared-analyst",
                    status="complete", created_at=now, completed_at=now,
                ),
            ])
            session.add_all([
                QAFinding(
                    id="qa-team-a-pk", run_id=run_ids[0], finding_id="QA-TEAM-A",
                    module_id="CP-2", severity="MATERIAL", description="Visible team finding.",
                ),
                QAFinding(
                    id="qa-team-b-pk", run_id=run_ids[1], finding_id="QA-TEAM-B",
                    module_id="CP-2", severity="CRITICAL", description="Foreign team finding.",
                ),
            ])
            await session.commit()

            rows = await list_latest_findings(limit=500, db=session, caller=caller)
            finding_ids = {row.finding_id for row in rows}

            assert "QA-TEAM-A" in finding_ids
            assert "QA-TEAM-B" not in finding_ids
        finally:
            await session.execute(delete(QAFinding).where(QAFinding.run_id.in_(run_ids)))
            await session.execute(delete(Run).where(Run.id.in_(run_ids)))
            await session.execute(delete(Issuer).where(Issuer.id.in_(issuer_ids)))
            await session.commit()
            get_settings.cache_clear()
