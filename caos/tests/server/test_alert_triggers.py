"""Durable C3 completed-run and scheduled-trigger integration tests."""

from __future__ import annotations

import asyncio
import base64
import json
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
from sqlalchemy import func, select
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import alert_triggers
from alert_contracts import SignalObservation, SubjectScope
from alert_dispatch import MaterializationError
from alert_triggers import (
    APPROVED_TRIGGER_SINKS,
    SCHEDULE_FAILURE_BACKOFF_SECONDS,
    ScheduledRuleClaim,
    claim_scheduled_rule,
    complete_scheduled_rule,
    evaluate_scheduled_rule,
    fail_scheduled_rule,
    schedule_claim_update_statement,
    trigger_completed_run,
)
from alert_sinks import EmailSink, InAppSink
from config import get_settings
from database import (
    Analyst,
    AlertDeliveryIntent,
    AlertEvent,
    AlertEventContext,
    AlertState,
    Base,
    Issuer,
    Portfolio,
    PortfolioPosition,
    QAFinding,
    Run,
    WatchRule,
    WatchRuleEvaluation,
    WatchRuleVersion,
)
from watch_rules import (
    SHARED_TEAM_ID,
    SHARED_TENANT_ID,
    UNASSIGNED_TEAM_ID,
    UNASSIGNED_TENANT_ID,
)


NOW = datetime(2026, 7, 20, 12, tzinfo=timezone.utc)
RULE_CONFIG = {
    "operator": "eq",
    "threshold": "critical",
    "kind": "qa_change",
    "title": "QA changed",
    "impact": "Review the governed output.",
}


@pytest.fixture(autouse=True)
def _enable_alert_rules_boundary(monkeypatch):
    """Existing Task 6 trigger contracts explicitly exercise the flag-on seam."""
    monkeypatch.setitem(
        get_settings().__dict__, "caos_alert_rules_v1_enabled", True
    )


def _utc(value: datetime | None) -> datetime | None:
    if value is None or value.tzinfo is not None:
        return value
    return value.replace(tzinfo=timezone.utc)


async def _add_rule(
    session,
    *,
    signal_type: str = "qa_gate",
    schedule_kind: str = "event_driven",
    issuer_id: str | None = None,
    portfolio_id: str | None = None,
    next_evaluation_at: datetime | None = None,
    interval: int | None = None,
    enabled: bool = True,
    paused: bool = False,
    attempts: int = 0,
    claim_token: str | None = None,
    claim_expires_at: datetime | None = None,
    config: dict | None = None,
    tenant_id: str = "desk-a",
    team_id: str = "desk-a",
) -> WatchRule:
    rule_id = str(uuid4())
    payload = config or RULE_CONFIG
    rule = WatchRule(
        id=rule_id,
        tenant_id=tenant_id,
        owner_user_id="alice",
        team_id_snapshot=team_id,
        issuer_id=issuer_id,
        portfolio_id=portfolio_id,
        name=f"{signal_type} watch",
        signal_type=signal_type,
        enabled=enabled,
        paused=paused,
        current_version=1,
        schedule_kind=schedule_kind,
        schedule_interval_seconds=interval,
        next_evaluation_at=next_evaluation_at,
        schedule_cursor=None,
        claim_token=claim_token,
        claim_expires_at=claim_expires_at,
        last_evaluated_at=None,
        claim_attempt_count=attempts,
        config_json=payload,
        created_at=NOW - timedelta(days=1),
        updated_at=NOW - timedelta(days=1),
    )
    session.add_all(
        [
            rule,
            WatchRuleVersion(
                id=str(uuid4()),
                watch_rule_id=rule_id,
                version=1,
                owner_user_id="alice",
                team_id_snapshot=team_id,
                signal_type=signal_type,
                config_json=payload,
                created_at=NOW - timedelta(days=1),
            ),
        ]
    )
    await session.flush()
    return rule


@pytest_asyncio.fixture
async def trigger_store(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)
    engine = create_async_engine(
        f"sqlite+aiosqlite:///{tmp_path / 'alert-triggers.db'}",
        connect_args={"timeout": 10},
    )
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    try:
        yield sessions
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_completed_run_trigger_reads_only_after_commit(trigger_store) -> None:
    async with trigger_store() as setup:
        setup.add(
            Issuer(
                id="issuer-1",
                name="Issuer One",
                normalized_name="issuer one",
                team_id="desk-a",
                uniqueness_scope="desk-a",
                created_by="alice",
                created_at=NOW - timedelta(days=2),
            )
        )
        await _add_rule(setup, issuer_id="issuer-1")
        await setup.commit()

    async with trigger_store() as writer:
        run = Run(
            issuer_id="issuer-1",
            analyst_id="alice",
            status="complete",
            qa_status="critical",
            completed_at=NOW,
            created_at=NOW - timedelta(minutes=5),
        )
        writer.add(run)
        await writer.flush()
        run_id = run.id

        before = await trigger_completed_run(run_id, session_factory=trigger_store)
        assert before.status == "not_committed"
        async with trigger_store() as verify:
            assert await verify.scalar(select(func.count()).select_from(AlertEvent)) == 0

        await writer.commit()

    after = await trigger_completed_run(run_id, session_factory=trigger_store)
    assert after.status == "evaluated"
    assert after.observations == 1
    assert after.materialized == 1
    async with trigger_store() as verify:
        assert await verify.scalar(select(func.count()).select_from(AlertEvent)) == 1
        assert (
            await verify.scalar(select(func.count()).select_from(AlertEventContext))
            == 1
        )
        assert (
            await verify.scalar(select(func.count()).select_from(AlertDeliveryIntent))
            == 2
        )
        assert await verify.scalar(select(func.count()).select_from(AlertState)) == 0


@pytest.mark.asyncio
async def test_completed_run_never_applies_rules_created_or_edited_after_completion(
    trigger_store,
) -> None:
    async with trigger_store() as session:
        session.add(
            Issuer(
                id="issuer-historical-fence",
                name="Historical Fence Issuer",
                normalized_name="historical fence issuer",
                team_id="desk-a",
                uniqueness_scope="desk-a",
                created_by="alice",
                created_at=NOW - timedelta(days=2),
            )
        )
        created_late = await _add_rule(
            session, issuer_id="issuer-historical-fence"
        )
        created_late.created_at = NOW + timedelta(minutes=1)
        created_late.updated_at = NOW + timedelta(minutes=1)
        edited_late = await _add_rule(
            session, issuer_id="issuer-historical-fence"
        )
        edited_late.updated_at = NOW + timedelta(minutes=1)
        session.add(
            Run(
                id="run-before-current-rules",
                issuer_id="issuer-historical-fence",
                analyst_id="alice",
                status="complete",
                qa_status="critical",
                completed_at=NOW,
                created_at=NOW - timedelta(minutes=5),
            )
        )
        await session.commit()

    result = await trigger_completed_run(
        "run-before-current-rules", session_factory=trigger_store
    )

    assert result == alert_triggers.RunTriggerResult(status="evaluated")
    async with trigger_store() as verify:
        assert await verify.scalar(
            select(func.count()).select_from(WatchRuleEvaluation)
        ) == 0
        assert await verify.scalar(select(func.count()).select_from(AlertEvent)) == 0


@pytest.mark.asyncio
async def test_completed_run_uses_governed_finding_identity_and_replay_dedupes(
    trigger_store,
) -> None:
    async with trigger_store() as session:
        session.add(
            Issuer(
                id="issuer-2",
                name="Issuer Two",
                normalized_name="issuer two",
                team_id="desk-a",
                uniqueness_scope="desk-a",
                created_by="alice",
                created_at=NOW - timedelta(days=2),
            )
        )
        await _add_rule(
            session,
            signal_type="run_finding",
            issuer_id="issuer-2",
            config={**RULE_CONFIG, "threshold": "CRITICAL"},
        )
        run = Run(
            issuer_id="issuer-2",
            analyst_id="alice",
            status="complete",
            qa_status="Restricted",
            completed_at=NOW,
            created_at=NOW - timedelta(minutes=5),
        )
        session.add(run)
        await session.flush()
        finding = QAFinding(
            run_id=run.id,
            finding_id="CP5-001",
            severity="CRITICAL",
            module_id="CP-1",
            lane=2,
            description="Governed finding detail",
        )
        session.add(finding)
        await session.commit()
        run_id = run.id
        finding_row_id = finding.id

    first = await trigger_completed_run(run_id, session_factory=trigger_store)
    second = await trigger_completed_run(run_id, session_factory=trigger_store)
    assert first.materialized == 1
    assert second.materialized == 0
    async with trigger_store() as verify:
        evaluation = (
            await verify.execute(select(WatchRuleEvaluation))
        ).scalar_one()
        assert evaluation.source_identity == f"run:{run_id}:finding:{finding_row_id}"
        assert evaluation.detail_json == {
            "run_id": run_id,
            "finding_row_id": finding_row_id,
            "finding_id": "CP5-001",
            "severity": "CRITICAL",
            "module_id": "CP-1",
            "lane": 2,
            "affected_claim_id": None,
        }
        assert await verify.scalar(select(func.count()).select_from(AlertEvent)) == 1
        assert (
            await verify.scalar(select(func.count()).select_from(AlertDeliveryIntent))
            == 2
        )


@pytest.mark.asyncio
async def test_completed_run_evaluates_only_rules_visible_to_the_run_team(
    trigger_store,
) -> None:
    async with trigger_store() as session:
        session.add(
            Issuer(
                id="issuer-team-a",
                name="Team A Issuer",
                normalized_name="team a issuer",
                team_id="desk-a",
                uniqueness_scope="desk-a",
                created_by="alice",
                created_at=NOW,
            )
        )
        await _add_rule(session, issuer_id="issuer-team-a")
        await _add_rule(
            session,
            issuer_id="issuer-team-a",
            tenant_id="desk-b",
            team_id="desk-b",
        )
        run = Run(
            issuer_id="issuer-team-a",
            analyst_id="alice",
            status="complete",
            qa_status="critical",
            completed_at=NOW,
            created_at=NOW,
        )
        session.add(run)
        await session.commit()
        run_id = run.id

    result = await trigger_completed_run(run_id, session_factory=trigger_store)
    assert result.observations == 1
    async with trigger_store() as verify:
        assert (
            await verify.scalar(select(func.count()).select_from(WatchRuleEvaluation))
            == 1
        )


@pytest.mark.asyncio
async def test_portfolio_scoped_rule_snapshot_requires_exact_current_book_visibility(
    trigger_store,
) -> None:
    async with trigger_store() as session:
        session.add_all(
            [
                Issuer(
                    id="issuer-book",
                    name="Book Issuer",
                    normalized_name="book issuer",
                    team_id=None,
                    uniqueness_scope="shared",
                    created_by="seed",
                    created_at=NOW,
                ),
                Portfolio(
                    id="portfolio-a",
                    name="Portfolio A",
                    team_id="desk-a",
                    created_by="alice",
                    created_at=NOW,
                    updated_at=NOW,
                ),
            ]
        )
        await session.flush()
        session.add(
            PortfolioPosition(
                portfolio_id="portfolio-a",
                issuer_id="issuer-book",
                borrower_name="Book Issuer",
                par_usd=1_000_000,
                created_at=NOW,
            )
        )
        await _add_rule(
            session,
            portfolio_id="portfolio-a",
            tenant_id="desk-a",
            team_id="desk-a",
        )
        await _add_rule(
            session,
            portfolio_id="portfolio-a",
            tenant_id="desk-b",
            team_id="desk-b",
        )
        run = Run(
            issuer_id="issuer-book",
            portfolio_id="portfolio-a",
            analyst_id="missing-profile",
            status="complete",
            qa_status="critical",
            completed_at=NOW,
            created_at=NOW,
        )
        session.add(run)
        await session.commit()
        run_id = run.id

    result = await trigger_completed_run(run_id, session_factory=trigger_store)
    assert result.observations == 1
    assert result.materialized == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("late_state", ["position", "portfolio_update"])
async def test_completed_run_uses_historical_portfolio_authority(
    trigger_store,
    late_state: str,
) -> None:
    async with trigger_store() as session:
        session.add_all(
            [
                Issuer(
                    id=f"issuer-historical-{late_state}",
                    name="Historical Portfolio Issuer",
                    normalized_name=f"historical portfolio issuer {late_state}",
                    team_id=None,
                    uniqueness_scope="shared",
                    created_by="seed",
                    created_at=NOW - timedelta(days=2),
                ),
                Portfolio(
                    id=f"pf-historical-{late_state}",
                    name="Historical Portfolio",
                    team_id="desk-a",
                    created_by="alice",
                    created_at=NOW - timedelta(days=2),
                    updated_at=(
                        NOW + timedelta(minutes=1)
                        if late_state == "portfolio_update"
                        else NOW - timedelta(days=1)
                    ),
                ),
            ]
        )
        await session.flush()
        session.add(
            PortfolioPosition(
                portfolio_id=f"pf-historical-{late_state}",
                issuer_id=f"issuer-historical-{late_state}",
                borrower_name="Historical Portfolio Issuer",
                par_usd=1_000_000,
                created_at=(
                    NOW + timedelta(minutes=1)
                    if late_state == "position"
                    else NOW - timedelta(days=1)
                ),
            )
        )
        valid_rule = await _add_rule(
            session,
            issuer_id=f"issuer-historical-{late_state}",
        )
        await _add_rule(
            session,
            issuer_id=f"issuer-historical-{late_state}",
            portfolio_id=f"pf-historical-{late_state}",
        )
        session.add(
            Run(
                id=f"run-historical-{late_state}",
                issuer_id=f"issuer-historical-{late_state}",
                portfolio_id=f"pf-historical-{late_state}",
                analyst_id="alice",
                status="complete",
                qa_status="critical",
                completed_at=NOW,
                created_at=NOW - timedelta(minutes=5),
            )
        )
        await session.commit()

    result = await trigger_completed_run(
        f"run-historical-{late_state}", session_factory=trigger_store
    )

    assert result.observations == 1
    assert result.materialized == 1
    async with trigger_store() as verify:
        evaluations = (await verify.execute(select(WatchRuleEvaluation))).scalars().all()
        assert [evaluation.watch_rule_id for evaluation in evaluations] == [
            valid_rule.id
        ]
        assert await verify.scalar(select(func.count()).select_from(AlertEvent)) == 1


@pytest.mark.asyncio
async def test_completed_run_rejects_issuer_created_after_observation(
    trigger_store,
) -> None:
    async with trigger_store() as session:
        session.add(
            Issuer(
                id="issuer-created-after-run",
                name="Future Issuer",
                normalized_name="future issuer",
                team_id="desk-a",
                uniqueness_scope="desk-a",
                created_by="alice",
                created_at=NOW + timedelta(minutes=1),
            )
        )
        await _add_rule(session, issuer_id="issuer-created-after-run")
        session.add(
            Run(
                id="run-before-issuer",
                issuer_id="issuer-created-after-run",
                analyst_id="alice",
                status="complete",
                qa_status="critical",
                completed_at=NOW,
                created_at=NOW - timedelta(minutes=5),
            )
        )
        await session.commit()

    result = await trigger_completed_run(
        "run-before-issuer", session_factory=trigger_store
    )
    assert result == alert_triggers.RunTriggerResult(status="evaluated")
    async with trigger_store() as verify:
        assert await verify.scalar(
            select(func.count()).select_from(WatchRuleEvaluation)
        ) == 0
        assert await verify.scalar(select(func.count()).select_from(AlertEvent)) == 0


@pytest.mark.asyncio
async def test_shared_issuer_allows_each_valid_named_rule_snapshot_without_profile(
    trigger_store,
) -> None:
    async with trigger_store() as session:
        session.add(
            Issuer(
                id="issuer-shared",
                name="Shared Issuer",
                normalized_name="shared issuer",
                team_id=None,
                uniqueness_scope="shared",
                created_by="seed",
                created_at=NOW,
            )
        )
        await _add_rule(
            session, issuer_id="issuer-shared", tenant_id="desk-a", team_id="desk-a"
        )
        await _add_rule(
            session, issuer_id="issuer-shared", tenant_id="desk-b", team_id="desk-b"
        )
        run = Run(
            issuer_id="issuer-shared",
            analyst_id="proxy-principal-with-no-profile",
            status="complete",
            qa_status="critical",
            completed_at=NOW,
            created_at=NOW,
        )
        session.add(run)
        await session.commit()
        run_id = run.id

    result = await trigger_completed_run(run_id, session_factory=trigger_store)
    assert result.observations == 2
    assert result.materialized == 2


@pytest.mark.asyncio
async def test_unassigned_snapshot_requires_teamless_resources_and_malformed_fails_closed(
    trigger_store,
) -> None:
    async with trigger_store() as session:
        session.add(
            Issuer(
                id="issuer-unassigned",
                name="Unassigned Issuer",
                normalized_name="unassigned issuer",
                team_id=None,
                uniqueness_scope="shared",
                created_by="seed",
                created_at=NOW,
            )
        )
        await _add_rule(
            session,
            issuer_id="issuer-unassigned",
            tenant_id=UNASSIGNED_TENANT_ID,
            team_id=UNASSIGNED_TEAM_ID,
        )
        await _add_rule(
            session,
            issuer_id="issuer-unassigned",
            tenant_id=UNASSIGNED_TENANT_ID,
            team_id="desk-a",
        )
        run = Run(
            issuer_id="issuer-unassigned",
            analyst_id="missing-profile",
            status="complete",
            qa_status="critical",
            completed_at=NOW,
            created_at=NOW,
        )
        session.add(run)
        await session.commit()
        run_id = run.id

    result = await trigger_completed_run(run_id, session_factory=trigger_store)
    assert result.observations == 1
    assert result.materialized == 1


@pytest.mark.asyncio
async def test_analyst_team_change_does_not_reclassify_rule_snapshot_replay(
    trigger_store,
) -> None:
    async with trigger_store() as session:
        session.add_all(
            [
                Analyst(
                    id="analyst-replay",
                    name="Replay Analyst",
                    email="replay@example.test",
                    role="analyst",
                    team_id="desk-a",
                    created_at=NOW - timedelta(days=2),
                ),
                Issuer(
                    id="issuer-replay",
                    name="Replay Issuer",
                    normalized_name="replay issuer",
                    team_id="desk-a",
                    uniqueness_scope="desk-a",
                    created_by="analyst-replay",
                    created_at=NOW - timedelta(days=2),
                ),
            ]
        )
        await _add_rule(session, issuer_id="issuer-replay")
        run = Run(
            issuer_id="issuer-replay",
            analyst_id="analyst-replay",
            status="complete",
            qa_status="critical",
            completed_at=NOW,
            created_at=NOW,
        )
        session.add(run)
        await session.commit()
        run_id = run.id

    first = await trigger_completed_run(run_id, session_factory=trigger_store)
    async with trigger_store() as session:
        analyst = await session.get(Analyst, "analyst-replay")
        assert analyst is not None
        analyst.team_id = "desk-b"
        await session.commit()
    replay = await trigger_completed_run(run_id, session_factory=trigger_store)

    assert first.materialized == 1
    assert replay.observations == 1
    assert replay.materialized == 0
    async with trigger_store() as verify:
        assert (
            await verify.scalar(select(func.count()).select_from(WatchRuleEvaluation))
            == 1
        )


@pytest.mark.asyncio
async def test_tenancy_off_selects_only_shared_rule_snapshots(
    trigger_store, monkeypatch
) -> None:
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", False)
    async with trigger_store() as session:
        session.add(
            Issuer(
                id="issuer-shared-mode",
                name="Shared Mode Issuer",
                normalized_name="shared mode issuer",
                team_id="desk-a",
                uniqueness_scope="desk-a",
                created_by="alice",
                created_at=NOW,
            )
        )
        await _add_rule(
            session,
            issuer_id="issuer-shared-mode",
            tenant_id=SHARED_TENANT_ID,
            team_id=SHARED_TEAM_ID,
        )
        await _add_rule(session, issuer_id="issuer-shared-mode")
        run = Run(
            issuer_id="issuer-shared-mode",
            analyst_id="alice",
            status="complete",
            qa_status="critical",
            completed_at=NOW,
            created_at=NOW,
        )
        session.add(run)
        await session.commit()
        run_id = run.id

    result = await trigger_completed_run(run_id, session_factory=trigger_store)
    assert result.observations == 1
    assert result.materialized == 1


@pytest.mark.asyncio
async def test_completed_run_failure_isolated_per_observation_and_sanitized(
    trigger_store, monkeypatch, caplog
) -> None:
    async with trigger_store() as session:
        session.add(
            Issuer(
                id="issuer-isolation",
                name="Isolation Issuer",
                normalized_name="isolation issuer",
                team_id="desk-a",
                uniqueness_scope="desk-a",
                created_by="alice",
                created_at=NOW,
            )
        )
        first = await _add_rule(session, issuer_id="issuer-isolation")
        second = await _add_rule(session, issuer_id="issuer-isolation")
        run = Run(
            id="run-isolation",
            issuer_id="issuer-isolation",
            analyst_id="alice",
            status="complete",
            qa_status="critical",
            completed_at=NOW,
            created_at=NOW - timedelta(minutes=1),
        )
        session.add(run)
        await session.commit()

    failing_rule_id = min(first.id, second.id)
    original = alert_triggers._evaluate_completed_run_observation

    async def fail_first_rule(session_factory, rule, observation, *, now):
        if rule.id == failing_rule_id:
            raise RuntimeError("secret observation payload")
        return await original(
            session_factory,
            rule,
            observation,
            now=now,
        )

    monkeypatch.setattr(
        alert_triggers,
        "_evaluate_completed_run_observation",
        fail_first_rule,
    )
    caplog.set_level("WARNING", logger="caos.alert_triggers")

    result = await trigger_completed_run(
        "run-isolation", session_factory=trigger_store
    )

    assert result.status == "evaluated"
    assert result.observations == 2
    assert result.materialized == 1
    assert result.failures == 1
    assert "completed-run observation failed" in caplog.text
    assert "secret observation payload" not in caplog.text
    async with trigger_store() as verify:
        assert (
            await verify.scalar(select(func.count()).select_from(WatchRuleEvaluation))
            == 1
        )
        assert await verify.scalar(select(func.count()).select_from(AlertEvent)) == 1


@pytest.mark.asyncio
async def test_completed_run_observation_construction_failure_allows_later_rule(
    trigger_store, monkeypatch, caplog
) -> None:
    async with trigger_store() as session:
        session.add(
            Issuer(
                id="issuer-construction-isolation",
                name="Construction Isolation Issuer",
                normalized_name="construction isolation issuer",
                team_id="desk-a",
                uniqueness_scope="desk-a",
                created_by="alice",
                created_at=NOW,
            )
        )
        first = await _add_rule(
            session, issuer_id="issuer-construction-isolation"
        )
        second = await _add_rule(
            session, issuer_id="issuer-construction-isolation"
        )
        session.add(
            Run(
                id="run-construction-isolation",
                issuer_id="issuer-construction-isolation",
                analyst_id="alice",
                status="complete",
                qa_status="critical",
                completed_at=NOW,
                created_at=NOW - timedelta(minutes=1),
            )
        )
        await session.commit()

    failing_rule_id = min(first.id, second.id)
    original = alert_triggers._run_observations

    def fail_first_rule(run, rule, findings):
        if rule.id == failing_rule_id:
            raise RuntimeError("secret corrupt rule snapshot")
        return original(run, rule, findings)

    monkeypatch.setattr(alert_triggers, "_run_observations", fail_first_rule)
    caplog.set_level("WARNING", logger="caos.alert_triggers")

    result = await trigger_completed_run(
        "run-construction-isolation",
        session_factory=trigger_store,
    )

    assert result.observations == 1
    assert result.materialized == 1
    assert result.failures == 1
    assert "completed-run observation failed" in caplog.text
    assert "secret corrupt rule snapshot" not in caplog.text
    async with trigger_store() as verify:
        assert (
            await verify.scalar(select(func.count()).select_from(WatchRuleEvaluation))
            == 1
        )
        assert await verify.scalar(select(func.count()).select_from(AlertEvent)) == 1


@pytest.mark.asyncio
async def test_malformed_finding_does_not_drop_valid_sibling_observation(
    trigger_store, caplog
) -> None:
    async with trigger_store() as session:
        session.add(
            Issuer(
                id="issuer-finding-isolation",
                name="Finding Isolation Issuer",
                normalized_name="finding isolation issuer",
                team_id="desk-a",
                uniqueness_scope="desk-a",
                created_by="alice",
                created_at=NOW - timedelta(days=1),
            )
        )
        await _add_rule(
            session,
            issuer_id="issuer-finding-isolation",
            signal_type="run_finding",
        )
        session.add(
            Run(
                id="run-finding-isolation",
                issuer_id="issuer-finding-isolation",
                analyst_id="alice",
                status="complete",
                qa_status="critical",
                completed_at=NOW,
                created_at=NOW - timedelta(minutes=1),
            )
        )
        session.add_all(
            [
                QAFinding(
                    id="finding-invalid-shape",
                    run_id="run-finding-isolation",
                    finding_id="invalid",
                    severity="x" * 513,
                    description="malformed categorical value",
                ),
                QAFinding(
                    id="finding-valid-shape",
                    run_id="run-finding-isolation",
                    finding_id="valid",
                    severity="critical",
                    description="valid governed finding",
                ),
            ]
        )
        await session.commit()

    caplog.set_level("WARNING", logger="caos.alert_triggers")
    result = await trigger_completed_run(
        "run-finding-isolation", session_factory=trigger_store
    )

    assert result.observations == 1
    assert result.materialized == 1
    assert result.failures == 1
    assert "finding_row_id=finding-invalid-shape" in caplog.text
    assert "malformed categorical value" not in caplog.text
    async with trigger_store() as verify:
        assert await verify.scalar(
            select(func.count()).select_from(WatchRuleEvaluation)
        ) == 1
        assert await verify.scalar(select(func.count()).select_from(AlertEvent)) == 1


@pytest.mark.asyncio
async def test_completed_run_observation_cancellation_propagates(
    trigger_store, monkeypatch
) -> None:
    async with trigger_store() as session:
        session.add(
            Issuer(
                id="issuer-observation-cancel",
                name="Observation Cancel Issuer",
                normalized_name="observation cancel issuer",
                team_id="desk-a",
                uniqueness_scope="desk-a",
                created_by="alice",
                created_at=NOW,
            )
        )
        await _add_rule(session, issuer_id="issuer-observation-cancel")
        session.add(
            Run(
                id="run-observation-cancel",
                issuer_id="issuer-observation-cancel",
                analyst_id="alice",
                status="complete",
                qa_status="critical",
                completed_at=NOW,
                created_at=NOW,
            )
        )
        await session.commit()

    async def cancel_observation(*_args, **_kwargs):
        raise asyncio.CancelledError

    monkeypatch.setattr(
        alert_triggers,
        "_evaluate_completed_run_observation",
        cancel_observation,
    )

    with pytest.raises(asyncio.CancelledError):
        await trigger_completed_run(
            "run-observation-cancel", session_factory=trigger_store
        )


@pytest.mark.asyncio
async def test_completed_run_reconciler_catches_flag_off_restart_miss(
    trigger_store, monkeypatch
) -> None:
    async with trigger_store() as session:
        session.add(
            Issuer(
                id="issuer-reconcile-miss",
                name="Reconcile Miss Issuer",
                normalized_name="reconcile miss issuer",
                team_id="desk-a",
                uniqueness_scope="desk-a",
                created_by="alice",
                created_at=NOW - timedelta(days=1),
            )
        )
        await _add_rule(session, issuer_id="issuer-reconcile-miss")
        session.add(
            Run(
                id="run-reconcile-miss",
                issuer_id="issuer-reconcile-miss",
                analyst_id="alice",
                status="complete",
                qa_status="critical",
                completed_at=None,
                created_at=NOW - timedelta(hours=1),
            )
        )
        await session.commit()

    monkeypatch.setitem(
        get_settings().__dict__, "caos_alert_rules_v1_enabled", False
    )
    missed = await trigger_completed_run(
        "run-reconcile-miss", session_factory=trigger_store
    )
    assert missed.materialized == 0
    monkeypatch.setitem(
        get_settings().__dict__, "caos_alert_rules_v1_enabled", True
    )

    result = await alert_triggers.reconcile_completed_runs(
        session_factory=trigger_store,
        limit=10,
    )

    assert result.scanned == 1
    assert result.observations == 1
    assert result.materialized == 1
    assert result.failures == 0
    assert result.next_cursor is None


@pytest.mark.asyncio
async def test_completed_run_reconciler_paginates_and_replays_idempotently(
    trigger_store,
) -> None:
    async with trigger_store() as session:
        session.add(
            Issuer(
                id="issuer-reconcile-page",
                name="Reconcile Page Issuer",
                normalized_name="reconcile page issuer",
                team_id="desk-a",
                uniqueness_scope="desk-a",
                created_by="alice",
                created_at=NOW - timedelta(days=1),
            )
        )
        await _add_rule(session, issuer_id="issuer-reconcile-page")
        session.add_all(
            [
                Run(
                    id="run-page-a",
                    issuer_id="issuer-reconcile-page",
                    analyst_id="alice",
                    status="complete",
                    qa_status="critical",
                    completed_at=None,
                    created_at=NOW - timedelta(minutes=1),
                ),
                Run(
                    id="run-page-b",
                    issuer_id="issuer-reconcile-page",
                    analyst_id="alice",
                    status="complete",
                    qa_status="critical",
                    completed_at=NOW - timedelta(minutes=2),
                    created_at=NOW - timedelta(minutes=4),
                ),
                Run(
                    id="run-page-c",
                    issuer_id="issuer-reconcile-page",
                    analyst_id="alice",
                    status="complete",
                    qa_status="critical",
                    completed_at=NOW - timedelta(minutes=2),
                    created_at=NOW - timedelta(minutes=5),
                ),
            ]
        )
        await session.commit()

    first = await alert_triggers.reconcile_completed_runs(
        session_factory=trigger_store,
        limit=2,
    )
    assert first.scanned == 2
    assert first.observations == 2
    assert first.materialized == 2
    assert first.failures == 0
    assert isinstance(first.next_cursor, str)
    assert "run-page" not in first.next_cursor
    async with trigger_store() as verify:
        first_page_run_ids = set(
            (await verify.execute(select(AlertEvent.run_id))).scalars()
        )
    assert first_page_run_ids == {"run-page-b", "run-page-c"}

    second = await alert_triggers.reconcile_completed_runs(
        session_factory=trigger_store,
        limit=2,
        cursor=first.next_cursor,
    )
    assert second.scanned == 1
    assert second.observations == 1
    assert second.materialized == 1
    assert second.failures == 0
    assert second.next_cursor is None

    terminal_replay = await alert_triggers.reconcile_completed_runs(
        session_factory=trigger_store,
        limit=2,
        cursor=first.next_cursor,
    )
    assert terminal_replay.scanned == 1
    assert terminal_replay.observations == 1
    assert terminal_replay.materialized == 0
    assert terminal_replay.failures == 0
    assert terminal_replay.next_cursor is None

    replay = await alert_triggers.reconcile_completed_runs(
        session_factory=trigger_store,
        limit=2,
    )
    assert replay.scanned == 2
    assert replay.observations == 2
    assert replay.materialized == 0
    assert replay.failures == 0
    assert replay.next_cursor == first.next_cursor
    async with trigger_store() as verify:
        assert (
            await verify.scalar(select(func.count()).select_from(WatchRuleEvaluation))
            == 3
        )
        assert await verify.scalar(select(func.count()).select_from(AlertEvent)) == 3


@pytest.mark.asyncio
async def test_completed_run_reconciler_continues_across_failed_runs(
    trigger_store, monkeypatch, caplog
) -> None:
    async with trigger_store() as session:
        session.add(
            Issuer(
                id="issuer-reconcile-failure",
                name="Reconcile Failure Issuer",
                normalized_name="reconcile failure issuer",
                team_id="desk-a",
                uniqueness_scope="desk-a",
                created_by="alice",
                created_at=NOW,
            )
        )
        session.add_all(
            [
                Run(
                    id="run-reconcile-broken",
                    issuer_id="issuer-reconcile-failure",
                    analyst_id="alice",
                    status="complete",
                    completed_at=NOW - timedelta(minutes=2),
                    created_at=NOW - timedelta(minutes=3),
                ),
                Run(
                    id="run-reconcile-later",
                    issuer_id="issuer-reconcile-failure",
                    analyst_id="alice",
                    status="complete",
                    completed_at=NOW - timedelta(minutes=1),
                    created_at=NOW - timedelta(minutes=2),
                ),
                Run(
                    id="run-reconcile-next-page",
                    issuer_id="issuer-reconcile-failure",
                    analyst_id="alice",
                    status="complete",
                    completed_at=NOW,
                    created_at=NOW - timedelta(minutes=1),
                ),
            ]
        )
        await session.commit()

    calls: list[str] = []

    async def replay_one(run_id, *, session_factory):
        calls.append(run_id)
        if run_id == "run-reconcile-broken":
            raise RuntimeError("secret run payload")
        return alert_triggers.RunTriggerResult(
            status="evaluated", observations=1, materialized=1
        )

    monkeypatch.setattr(alert_triggers, "trigger_completed_run", replay_one)
    caplog.set_level("WARNING", logger="caos.alert_triggers")

    result = await alert_triggers.reconcile_completed_runs(
        session_factory=trigger_store,
        limit=2,
    )

    assert calls == ["run-reconcile-broken", "run-reconcile-later"]
    assert result.scanned == 2
    assert result.observations == 1
    assert result.materialized == 1
    assert result.failures == 1
    assert result.next_cursor is None
    assert "completed-run reconciliation failed" in caplog.text
    assert "secret run payload" not in caplog.text


@pytest.mark.asyncio
async def test_reconciler_rejects_invalid_cursor_before_database_work() -> None:
    calls = 0

    def forbidden_factory():
        nonlocal calls
        calls += 1
        raise AssertionError("database must not be opened")

    with pytest.raises(ValueError, match="invalid reconciliation cursor"):
        await alert_triggers.reconcile_completed_runs(
            session_factory=forbidden_factory,
            limit=10,
            cursor="not-an-opaque-versioned-cursor",
        )
    assert calls == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("version", [2, True])
async def test_reconciler_rejects_unknown_or_non_integer_cursor_version_before_db(
    version,
) -> None:
    payload = json.dumps(
        {"at": NOW.isoformat(), "id": "run-cursor", "v": version},
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    cursor = base64.urlsafe_b64encode(payload).decode("ascii").rstrip("=")
    calls = 0

    def forbidden_factory():
        nonlocal calls
        calls += 1
        raise AssertionError("database must not be opened")

    with pytest.raises(ValueError, match="invalid reconciliation cursor"):
        await alert_triggers.reconcile_completed_runs(
            session_factory=forbidden_factory,
            limit=10,
            cursor=cursor,
        )
    assert calls == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("limit", [0, 501, True])
async def test_reconciler_rejects_unbounded_page_size_before_database_work(
    limit,
) -> None:
    calls = 0

    def forbidden_factory():
        nonlocal calls
        calls += 1
        raise AssertionError("database must not be opened")

    with pytest.raises(ValueError, match="limit must be between 1 and 500"):
        await alert_triggers.reconcile_completed_runs(
            session_factory=forbidden_factory,
            limit=limit,
        )
    assert calls == 0


@pytest.mark.asyncio
async def test_reconciler_refuses_flag_off_before_database_work(monkeypatch) -> None:
    calls = 0

    def forbidden_factory():
        nonlocal calls
        calls += 1
        raise AssertionError("database must not be opened")

    monkeypatch.setitem(
        get_settings().__dict__, "caos_alert_rules_v1_enabled", False
    )
    with pytest.raises(
        alert_triggers.AlertRulesReconciliationDisabled,
        match="alert rules are disabled",
    ):
        await alert_triggers.reconcile_completed_runs(
            session_factory=forbidden_factory,
            limit=10,
        )
    assert calls == 0


def test_reconcile_alert_rules_cli_help_documents_one_page_cursor_contract(
    capsys,
) -> None:
    import reconcile_alert_rules

    assert "python -m reconcile_alert_rules" in (reconcile_alert_rules.__doc__ or "")
    with pytest.raises(SystemExit) as raised:
        reconcile_alert_rules.main(["--help"])
    assert raised.value.code == 0
    help_text = capsys.readouterr().out
    normalized_help = " ".join(help_text.split())
    assert "one bounded page" in normalized_help
    assert "--limit" in normalized_help
    assert "--cursor" in normalized_help
    assert "next_cursor=null" in normalized_help
    assert "retain the input cursor" in normalized_help
    assert "replay the terminal page" in normalized_help


def test_reconcile_alert_rules_cli_refuses_flag_off_without_replay(
    monkeypatch, capsys
) -> None:
    import reconcile_alert_rules

    monkeypatch.setitem(
        get_settings().__dict__, "caos_alert_rules_v1_enabled", False
    )
    called = False

    async def forbidden_reconcile(**_kwargs):
        nonlocal called
        called = True
        raise AssertionError("reconciliation must not run")

    monkeypatch.setattr(
        reconcile_alert_rules,
        "reconcile_completed_runs",
        forbidden_reconcile,
    )

    assert reconcile_alert_rules.main([]) == 2
    assert called is False
    assert "alert rules are disabled" in capsys.readouterr().err


def test_reconcile_alert_rules_cli_prints_contract_and_fails_on_page_errors(
    monkeypatch, capsys
) -> None:
    import reconcile_alert_rules

    monkeypatch.setitem(
        get_settings().__dict__, "caos_alert_rules_v1_enabled", True
    )
    calls: list[tuple[int, str | None]] = []

    async def failed_page(*, limit, cursor):
        calls.append((limit, cursor))
        return alert_triggers.CompletedRunReconcileResult(
            scanned=3,
            observations=4,
            materialized=2,
            failures=1,
            next_cursor="opaque-next",
        )

    monkeypatch.setattr(
        reconcile_alert_rules,
        "reconcile_completed_runs",
        failed_page,
    )

    assert (
        reconcile_alert_rules.main(["--limit", "3", "--cursor", "opaque-in"])
        == 1
    )
    assert calls == [(3, "opaque-in")]
    assert capsys.readouterr().out.strip() == (
        '{"failures": 1, "materialized": 2, "next_cursor": "opaque-next", '
        '"observations": 4, "scanned": 3}'
    )


@pytest.mark.asyncio
async def test_run_trigger_failure_preserves_terminal_status_and_vault_continuation(
    trigger_store, monkeypatch, caplog
) -> None:
    import run_executor

    async with trigger_store() as session:
        session.add(
            Issuer(
                id="issuer-3",
                name="Issuer Three",
                normalized_name="issuer three",
                team_id="desk-a",
                uniqueness_scope="desk-a",
                created_by="alice",
                created_at=NOW,
            )
        )
        run = Run(
            issuer_id="issuer-3",
            analyst_id="alice",
            status="running",
            created_at=NOW,
        )
        session.add(run)
        await session.commit()
        run_id = run.id

    async def finish(_session, run):
        run.status = "complete"
        run.qa_status = "Approved"
        run.completed_at = NOW

    async def no_notification(_session, _run):
        return None

    async def broken_trigger(trigger_run_id):
        assert trigger_run_id == run_id
        raise RuntimeError("secret observation content")

    vault_calls: list[str] = []

    async def record_vault(_session, vault_run_id):
        vault_calls.append(vault_run_id)

    monkeypatch.setattr(run_executor, "AsyncSessionLocal", trigger_store)
    monkeypatch.setattr(run_executor, "execute_run", finish)
    monkeypatch.setattr(run_executor, "_emit_terminal_notification", no_notification)
    monkeypatch.setattr(run_executor, "trigger_completed_run", broken_trigger)
    monkeypatch.setattr(run_executor, "_maybe_export_to_vault", record_vault)

    await run_executor.execute_run_by_id(run_id)

    async with trigger_store() as verify:
        persisted = await verify.get(Run, run_id)
        assert persisted is not None and persisted.status == "complete"
    assert vault_calls == [run_id]
    assert "post-commit alert trigger failed" in caplog.text
    assert "secret observation content" not in caplog.text


@pytest.mark.asyncio
async def test_run_trigger_cancellation_attempts_vault_once_then_propagates(
    trigger_store, monkeypatch
) -> None:
    import run_executor

    async with trigger_store() as session:
        session.add(
            Issuer(
                id="issuer-cancel",
                name="Issuer Cancel",
                normalized_name="issuer cancel",
                team_id="desk-a",
                uniqueness_scope="desk-a",
                created_by="alice",
                created_at=NOW,
            )
        )
        run = Run(
            issuer_id="issuer-cancel",
            analyst_id="alice",
            status="running",
            created_at=NOW,
        )
        session.add(run)
        await session.commit()
        run_id = run.id

    async def finish(_session, run):
        run.status = "complete"
        run.completed_at = NOW

    async def no_notification(_session, _run):
        return None

    async def cancel_trigger(_run_id):
        raise asyncio.CancelledError

    vault_calls: list[str] = []

    async def record_vault(_session, vault_run_id):
        vault_calls.append(vault_run_id)

    monkeypatch.setattr(run_executor, "AsyncSessionLocal", trigger_store)
    monkeypatch.setattr(run_executor, "execute_run", finish)
    monkeypatch.setattr(run_executor, "_emit_terminal_notification", no_notification)
    monkeypatch.setattr(run_executor, "trigger_completed_run", cancel_trigger)
    monkeypatch.setattr(run_executor, "_maybe_export_to_vault", record_vault)

    with pytest.raises(asyncio.CancelledError):
        await run_executor.execute_run_by_id(run_id)

    async with trigger_store() as verify:
        persisted = await verify.get(Run, run_id)
        assert persisted is not None and persisted.status == "complete"
    assert vault_calls == [run_id]


@pytest.mark.asyncio
async def test_vault_cancellation_after_trigger_still_preserves_complete_run(
    trigger_store, monkeypatch
) -> None:
    import run_executor

    async with trigger_store() as session:
        session.add(
            Issuer(
                id="issuer-vault-cancel",
                name="Issuer Vault Cancel",
                normalized_name="issuer vault cancel",
                team_id="desk-a",
                uniqueness_scope="desk-a",
                created_by="alice",
                created_at=NOW,
            )
        )
        run = Run(
            issuer_id="issuer-vault-cancel",
            analyst_id="alice",
            status="running",
            created_at=NOW,
        )
        session.add(run)
        await session.commit()
        run_id = run.id

    async def finish(_session, run):
        run.status = "complete"
        run.completed_at = NOW

    async def no_op(*_args):
        return None

    vault_calls: list[str] = []

    async def cancel_vault(_session, vault_run_id):
        vault_calls.append(vault_run_id)
        raise asyncio.CancelledError

    monkeypatch.setattr(run_executor, "AsyncSessionLocal", trigger_store)
    monkeypatch.setattr(run_executor, "execute_run", finish)
    monkeypatch.setattr(run_executor, "_emit_terminal_notification", no_op)
    monkeypatch.setattr(run_executor, "trigger_completed_run", no_op)
    monkeypatch.setattr(run_executor, "_maybe_export_to_vault", cancel_vault)

    with pytest.raises(asyncio.CancelledError):
        await run_executor.execute_run_by_id(run_id)

    async with trigger_store() as verify:
        persisted = await verify.get(Run, run_id)
        assert persisted is not None and persisted.status == "complete"
    assert vault_calls == [run_id]


def test_only_approved_intent_sinks_are_configured() -> None:
    assert APPROVED_TRIGGER_SINKS == (
        EmailSink(destination_ref="owner-email-route", max_attempts=5),
        InAppSink(destination_ref="monitor-inbox", max_attempts=3),
    )


def test_postgresql_claim_sql_is_atomic_returning_and_skip_locked() -> None:
    statement = schedule_claim_update_statement(
        NOW,
        claim_token=UUID("00000000-0000-0000-0000-000000000099"),
    )
    sql = str(
        statement.compile(
            dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}
        )
    ).upper()
    assert sql.startswith("UPDATE WATCH_RULES SET")
    assert "FOR UPDATE SKIP LOCKED" in sql
    assert "RETURNING" in sql
    assert "CLAIM_ATTEMPT_COUNT=(WATCH_RULES.CLAIM_ATTEMPT_COUNT + 1)" in sql

    reap_sql = str(
        alert_triggers.schedule_reap_update_statement(NOW).compile(
            dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}
        )
    ).upper()
    assert reap_sql.startswith("UPDATE WATCH_RULES SET")
    assert "FOR UPDATE SKIP LOCKED" in reap_sql
    assert "CLAIM_ATTEMPT_COUNT = 5" in reap_sql
    assert "RETURNING" in reap_sql


async def _seed_scheduled(
    sessions,
    *,
    signal_type: str = "qa_gate",
    schedule_kind: str = "interval",
    due: datetime = NOW - timedelta(minutes=5),
    attempts: int = 0,
    claim_token: str | None = None,
    claim_expires_at: datetime | None = None,
) -> str:
    async with sessions() as session:
        rule = await _add_rule(
            session,
            signal_type=signal_type,
            schedule_kind=schedule_kind,
            next_evaluation_at=due,
            interval=60,
            attempts=attempts,
            claim_token=claim_token,
            claim_expires_at=claim_expires_at,
        )
        await session.commit()
        return rule.id


@pytest.mark.asyncio
async def test_two_sqlite_workers_have_one_schedule_claim_winner(trigger_store) -> None:
    rule_id = await _seed_scheduled(trigger_store)
    ready = asyncio.Event()
    arrivals = 0
    arrival_lock = asyncio.Lock()

    async def worker():
        nonlocal arrivals
        async with trigger_store() as session:
            async with arrival_lock:
                arrivals += 1
                if arrivals == 2:
                    ready.set()
            await ready.wait()
            async with session.begin():
                return await claim_scheduled_rule(session, now=NOW, rule_id=rule_id)

    first, second = await asyncio.gather(worker(), worker())
    winners = [claim for claim in (first, second) if claim is not None]
    assert len(winners) == 1
    assert winners[0].attempt_count == 1
    async with trigger_store() as verify:
        row = await verify.get(WatchRule, rule_id)
        assert row is not None
        assert row.claim_attempt_count == 1
        assert row.claim_token == str(winners[0].claim_token)


@pytest.mark.asyncio
async def test_expired_schedule_lease_reclaims_through_same_transition(
    trigger_store,
) -> None:
    old_token = str(uuid4())
    rule_id = await _seed_scheduled(
        trigger_store,
        attempts=1,
        claim_token=old_token,
        claim_expires_at=NOW,
    )
    async with trigger_store() as session:
        async with session.begin():
            claim = await claim_scheduled_rule(session, now=NOW, rule_id=rule_id)
    assert claim is not None
    assert str(claim.claim_token) != old_token
    assert claim.claim_expires_at == NOW + timedelta(minutes=5)
    assert claim.attempt_count == 2


@pytest.mark.asyncio
async def test_completion_and_failure_require_matching_unexpired_token(
    trigger_store,
) -> None:
    rule_id = await _seed_scheduled(trigger_store)
    async with trigger_store() as session:
        async with session.begin():
            claim = await claim_scheduled_rule(session, now=NOW, rule_id=rule_id)
    assert claim is not None
    forged = replace(claim, claim_token=uuid4())

    async with trigger_store() as session:
        async with session.begin():
            assert not await complete_scheduled_rule(session, forged, now=NOW)
            assert not await fail_scheduled_rule(session, forged, now=NOW)

    async with trigger_store() as session:
        row = await session.get(WatchRule, rule_id)
        row.claim_expires_at = NOW
        await session.commit()
    async with trigger_store() as session:
        async with session.begin():
            assert not await complete_scheduled_rule(session, claim, now=NOW)
            assert not await fail_scheduled_rule(session, claim, now=NOW)


@pytest.mark.asyncio
async def test_success_advances_first_future_slot_and_bounds_cursor(
    trigger_store,
) -> None:
    rule_id = await _seed_scheduled(trigger_store)
    async with trigger_store() as session:
        async with session.begin():
            claim = await claim_scheduled_rule(session, now=NOW, rule_id=rule_id)
        assert claim is not None
        async with session.begin():
            assert await complete_scheduled_rule(
                session, claim, now=NOW, cursor="x" * 512
            )

    async with trigger_store() as verify:
        row = await verify.get(WatchRule, rule_id)
        assert row is not None
        assert _utc(row.next_evaluation_at) == NOW + timedelta(minutes=1)
        assert row.schedule_cursor == "x" * 512
        assert _utc(row.last_evaluated_at) == NOW
        assert row.claim_token is None and row.claim_expires_at is None
        assert row.claim_attempt_count == 0

    second_id = await _seed_scheduled(trigger_store)
    async with trigger_store() as session:
        async with session.begin():
            second = await claim_scheduled_rule(session, now=NOW, rule_id=second_id)
        assert second is not None
        with pytest.raises(ValueError, match="cursor"):
            await complete_scheduled_rule(
                session, second, now=NOW, cursor="🔥" * 129
            )
        await session.rollback()
    async with trigger_store() as verify:
        row = await verify.get(WatchRule, second_id)
        assert row is not None and row.claim_token is not None


@pytest.mark.asyncio
async def test_failure_backoff_is_exact_and_fifth_failure_pauses(
    trigger_store,
) -> None:
    assert SCHEDULE_FAILURE_BACKOFF_SECONDS == (60, 120, 240, 480)
    rule_id = await _seed_scheduled(trigger_store)
    async with trigger_store() as session:
        async with session.begin():
            claim = await claim_scheduled_rule(session, now=NOW, rule_id=rule_id)
        assert claim is not None and claim.attempt_count == 1
        async with session.begin():
            assert await fail_scheduled_rule(session, claim, now=NOW, cursor="cursor-1")
    async with trigger_store() as verify:
        row = await verify.get(WatchRule, rule_id)
        assert row is not None
        assert _utc(row.next_evaluation_at) == NOW + timedelta(seconds=60)
        assert row.schedule_cursor == "cursor-1"
        assert row.claim_attempt_count == 1
        assert not row.paused

    fifth_id = await _seed_scheduled(trigger_store, attempts=4)
    async with trigger_store() as session:
        async with session.begin():
            fifth = await claim_scheduled_rule(session, now=NOW, rule_id=fifth_id)
        assert fifth is not None and fifth.attempt_count == 5
        async with session.begin():
            assert await fail_scheduled_rule(session, fifth, now=NOW)
    async with trigger_store() as verify:
        row = await verify.get(WatchRule, fifth_id)
        assert row is not None
        assert row.paused is True
        assert row.next_evaluation_at is None
        assert row.claim_attempt_count == 5
        assert row.claim_token is None and row.claim_expires_at is None


@pytest.mark.asyncio
async def test_expired_fifth_claim_is_atomically_reaped_and_paused(
    trigger_store,
) -> None:
    rule_id = await _seed_scheduled(trigger_store, attempts=4)
    async with trigger_store() as session:
        async with session.begin():
            fifth = await claim_scheduled_rule(session, now=NOW, rule_id=rule_id)
    assert fifth is not None and fifth.attempt_count == 5

    exact_expiry = NOW + timedelta(minutes=5)
    async with trigger_store() as session:
        async with session.begin():
            replacement = await claim_scheduled_rule(
                session, now=exact_expiry, rule_id=rule_id
            )
    assert replacement is None
    async with trigger_store() as verify:
        row = await verify.get(WatchRule, rule_id)
        assert row is not None
        assert row.paused is True
        assert row.next_evaluation_at is None
        assert row.claim_attempt_count == 5
        assert row.claim_token is None and row.claim_expires_at is None
        assert _utc(row.last_evaluated_at) == exact_expiry


@pytest.mark.asyncio
async def test_global_worker_reaps_expired_fifth_then_claims_next_due_rule(
    trigger_store,
) -> None:
    expired_id = await _seed_scheduled(
        trigger_store,
        due=NOW - timedelta(minutes=5),
        attempts=5,
        claim_token=str(uuid4()),
        claim_expires_at=NOW,
    )
    due_id = await _seed_scheduled(
        trigger_store,
        due=NOW - timedelta(minutes=4),
    )

    async with trigger_store() as session:
        async with session.begin():
            claim = await claim_scheduled_rule(session, now=NOW)

    assert claim is not None
    assert str(claim.rule_id) == due_id
    assert claim.attempt_count == 1
    async with trigger_store() as verify:
        expired = await verify.get(WatchRule, expired_id)
        due = await verify.get(WatchRule, due_id)
        assert expired is not None
        assert expired.paused is True
        assert expired.next_evaluation_at is None
        assert expired.claim_token is None
        assert expired.claim_expires_at is None
        assert expired.claim_attempt_count == 5
        assert _utc(expired.last_evaluated_at) == NOW
        assert due is not None
        assert due.claim_token == str(claim.claim_token)
        assert _utc(due.claim_expires_at) == claim.claim_expires_at


def _scheduled_observation(*, source_identity: str = "watch:fact:1"):
    correlation = uuid4()
    return SignalObservation(
        signal_type="qa_gate",
        subject_scope=SubjectScope(
            tenant_id="desk-a", issuer_id=None, portfolio_id=None
        ),
        source_identity=source_identity,
        observed_at=NOW,
        categorical_value="critical",
        detail={"fact_id": "fact-1"},
        source_artifact_refs=("governed:fact-1",),
        correlation_id=correlation,
        correlation_root_id=correlation,
        hop_count=0,
    )


@pytest.mark.asyncio
async def test_reclaimed_worker_cannot_materialize_after_lease_expiry(
    trigger_store, monkeypatch
) -> None:
    rule_id = await _seed_scheduled(trigger_store)
    expiry = NOW + timedelta(minutes=5)
    original_fence = getattr(alert_triggers, "_lock_owned_scheduled_claim", None)
    replacement_claims: list[ScheduledRuleClaim] = []

    async def reclaim_before_fence(db, claim, *, now):
        async with trigger_store() as replacement_db:
            async with replacement_db.begin():
                replacement = await claim_scheduled_rule(
                    replacement_db, now=expiry, rule_id=rule_id
                )
        assert replacement is not None and replacement.attempt_count == 2
        replacement_claims.append(replacement)
        assert original_fence is not None
        return await original_fence(db, claim, now=now)

    monkeypatch.setattr(
        alert_triggers,
        "_lock_owned_scheduled_claim",
        reclaim_before_fence,
        raising=False,
    )
    result = await evaluate_scheduled_rule(
        session_factory=trigger_store,
        now=NOW,
        clock=lambda: expiry,
        rule_id=rule_id,
        trigger_kind="scheduled_watchlist",
        observation=_scheduled_observation(source_identity="watch:stale-worker"),
    )

    assert result.status == "lease_lost"
    assert len(replacement_claims) == 1
    async with trigger_store() as verify:
        row = await verify.get(WatchRule, rule_id)
        assert row is not None
        assert row.claim_token == str(replacement_claims[0].claim_token)
        assert (
            await verify.scalar(select(func.count()).select_from(WatchRuleEvaluation))
            == 0
        )
        assert await verify.scalar(select(func.count()).select_from(AlertEvent)) == 0


def test_next_interval_slot_fails_bounded_near_datetime_max() -> None:
    near_max = datetime.max.replace(tzinfo=timezone.utc) - timedelta(seconds=30)
    claim = ScheduledRuleClaim(
        rule_id=uuid4(),
        claim_token=uuid4(),
        claim_expires_at=datetime.max.replace(tzinfo=timezone.utc),
        scheduled_for=near_max,
        schedule_kind="interval",
        schedule_interval_seconds=60,
        signal_type="qa_gate",
        rule_version=1,
        attempt_count=1,
    )
    with pytest.raises(OverflowError, match="future interval slot"):
        alert_triggers._next_interval_slot(
            claim, datetime.max.replace(tzinfo=timezone.utc) - timedelta(seconds=1)
        )


@pytest.mark.asyncio
async def test_completion_overflow_routes_fifth_attempt_to_durable_pause(
    trigger_store, monkeypatch
) -> None:
    rule_id = await _seed_scheduled(trigger_store, attempts=4)

    async def overflow_completion(*_args, **_kwargs):
        raise OverflowError("no representable future interval slot")

    monkeypatch.setattr(
        alert_triggers, "complete_scheduled_rule", overflow_completion
    )
    result = await evaluate_scheduled_rule(
        session_factory=trigger_store,
        now=NOW,
        clock=lambda: NOW,
        rule_id=rule_id,
        trigger_kind="scheduled_watchlist",
        observation=_scheduled_observation(source_identity="watch:overflow"),
    )

    assert result.status == "failed"
    async with trigger_store() as verify:
        row = await verify.get(WatchRule, rule_id)
        assert row is not None
        assert row.paused is True
        assert row.next_evaluation_at is None
        assert row.claim_attempt_count == 5
        assert row.claim_token is None and row.claim_expires_at is None


@pytest.mark.asyncio
async def test_supported_scheduled_observation_uses_pipeline_then_completes(
    trigger_store,
) -> None:
    rule_id = await _seed_scheduled(trigger_store)
    result = await evaluate_scheduled_rule(
        session_factory=trigger_store,
        now=NOW,
        clock=lambda: NOW,
        rule_id=rule_id,
        trigger_kind="scheduled_watchlist",
        observation=_scheduled_observation(),
        cursor="cursor-ok",
    )
    assert result.status == "completed"
    assert result.outcome == "matched"
    async with trigger_store() as verify:
        row = await verify.get(WatchRule, rule_id)
        assert row is not None and row.claim_attempt_count == 0
        assert row.schedule_cursor == "cursor-ok"
        assert await verify.scalar(select(func.count()).select_from(AlertEvent)) == 1
        assert (
            await verify.scalar(select(func.count()).select_from(AlertDeliveryIntent))
            == 2
        )


@pytest.mark.asyncio
async def test_scheduled_success_uses_fresh_clock_for_each_fence_and_completion(
    trigger_store,
) -> None:
    rule_id = await _seed_scheduled(trigger_store)
    ticks = iter(
        (
            NOW + timedelta(seconds=1),
            NOW + timedelta(seconds=2),
            NOW + timedelta(seconds=3),
        )
    )
    calls: list[datetime] = []

    def advancing_clock() -> datetime:
        value = next(ticks)
        calls.append(value)
        return value

    result = await evaluate_scheduled_rule(
        session_factory=trigger_store,
        now=NOW,
        clock=advancing_clock,
        rule_id=rule_id,
        trigger_kind="scheduled_watchlist",
        observation=_scheduled_observation(source_identity="watch:fresh-clock"),
    )

    assert result.status == "completed"
    assert calls == [
        NOW + timedelta(seconds=1),
        NOW + timedelta(seconds=2),
        NOW + timedelta(seconds=3),
    ]
    async with trigger_store() as verify:
        row = await verify.get(WatchRule, rule_id)
        assert row is not None
        assert _utc(row.last_evaluated_at) == NOW + timedelta(seconds=3)
        assert _utc(row.next_evaluation_at) == NOW + timedelta(minutes=1)


@pytest.mark.asyncio
async def test_scheduled_materialization_failure_rolls_back_and_records_backoff(
    trigger_store, monkeypatch
) -> None:
    rule_id = await _seed_scheduled(trigger_store)

    async def broken_materialization(*_args, **_kwargs):
        raise MaterializationError("synthetic_failure")

    monkeypatch.setattr(alert_triggers, "materialize_alert", broken_materialization)
    result = await evaluate_scheduled_rule(
        session_factory=trigger_store,
        now=NOW,
        clock=lambda: NOW,
        rule_id=rule_id,
        trigger_kind="scheduled_watchlist",
        observation=_scheduled_observation(source_identity="watch:fact:rollback"),
    )
    assert result.status == "failed"
    async with trigger_store() as verify:
        row = await verify.get(WatchRule, rule_id)
        assert row is not None
        assert row.claim_attempt_count == 1
        assert _utc(row.next_evaluation_at) == NOW + timedelta(seconds=60)
        assert (
            await verify.scalar(select(func.count()).select_from(WatchRuleEvaluation))
            == 0
        )
        assert await verify.scalar(select(func.count()).select_from(AlertEvent)) == 0


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("signal_type", "schedule_kind"),
    [("edgar_filing", "edgar"), ("market_move", "interval")],
)
async def test_unavailable_scheduled_sources_fail_durably_without_fabrication(
    trigger_store, signal_type, schedule_kind
) -> None:
    rule_id = await _seed_scheduled(
        trigger_store, signal_type=signal_type, schedule_kind=schedule_kind
    )
    result = await evaluate_scheduled_rule(
        session_factory=trigger_store,
        now=NOW,
        clock=lambda: NOW,
        rule_id=rule_id,
        trigger_kind=(
            "scheduled_edgar" if schedule_kind == "edgar" else "scheduled_watchlist"
        ),
        observation=None,
    )
    assert result.status == "source_unavailable"
    async with trigger_store() as verify:
        row = await verify.get(WatchRule, rule_id)
        assert row is not None
        assert row.claim_attempt_count == 1
        assert _utc(row.next_evaluation_at) == NOW + timedelta(seconds=60)
        assert row.claim_token is None
        assert (
            await verify.scalar(select(func.count()).select_from(WatchRuleEvaluation))
            == 0
        )
        assert await verify.scalar(select(func.count()).select_from(AlertEvent)) == 0


@pytest.mark.asyncio
async def test_wrong_scheduled_trigger_kind_and_reserved_news_never_fabricate(
    trigger_store,
) -> None:
    rule_id = await _seed_scheduled(trigger_store)
    result = await evaluate_scheduled_rule(
        session_factory=trigger_store,
        now=NOW,
        clock=lambda: NOW,
        rule_id=rule_id,
        trigger_kind="scheduled_edgar",
        observation=_scheduled_observation(),
    )
    assert result.status == "invalid_trigger"

    async with trigger_store() as session:
        news = await _add_rule(
            session,
            signal_type="news",
            schedule_kind="interval",
            next_evaluation_at=NOW - timedelta(minutes=1),
            interval=60,
            enabled=False,
        )
        await session.commit()
        news_id = news.id
    news_result = await evaluate_scheduled_rule(
        session_factory=trigger_store,
        now=NOW,
        clock=lambda: NOW,
        rule_id=news_id,
        trigger_kind="scheduled_watchlist",
        observation=None,
    )
    assert news_result.status == "no_claim"
    async with trigger_store() as verify:
        assert await verify.scalar(select(func.count()).select_from(AlertEvent)) == 0
