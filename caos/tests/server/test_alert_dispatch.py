"""Atomic C3 alert materialization and durable delivery lease tests."""

from __future__ import annotations

import asyncio
import copy
import hashlib
import json
import logging
from inspect import Parameter, signature
from dataclasses import dataclass, replace
from datetime import datetime, timedelta, timezone
from typing import get_type_hints
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
from sqlalchemy import event, func, select
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import alert_dispatch
from alert_contracts import AlertCandidate, SubjectScope
from alert_dispatch import (
    MaterializationError,
    claim_delivery_intent,
    complete_delivery_intent,
    delivery_claim_select,
    dispatch_once,
    materialize_alert,
    record_delivery_failure,
)
from alert_sinks import AlertSink, EmailSink, InAppSink, sink_idempotency_key
from database import (
    AlertDeliveryIntent,
    AlertEvent,
    AlertEventContext,
    AlertState,
    AnalysisContextRecord,
    Base,
    Issuer,
    NotificationEvent,
    Portfolio,
    PortfolioPosition,
    Run,
    SectorTaxonomy,
    WatchRule,
    WatchRuleEvaluation,
    WatchRuleVersion,
)


NOW = datetime(2026, 7, 20, 12, tzinfo=timezone.utc)
RULE_ID = UUID("00000000-0000-0000-0000-000000000201")
EVALUATION_ID = UUID("00000000-0000-0000-0000-000000000202")
CORRELATION_ID = UUID("00000000-0000-0000-0000-000000000203")
ROOT_ID = UUID("00000000-0000-0000-0000-000000000204")
OBSERVATION_KEY = "b" * 64
SOURCE_IDENTITY = "source:governed:secret-fact"


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def _candidate(**overrides: object) -> AlertCandidate:
    payload = {
        "evaluation_id": EVALUATION_ID,
        "watch_rule_id": RULE_ID,
        "rule_version": 1,
        "observation_key": OBSERVATION_KEY,
        "alert_key": f"c3:{OBSERVATION_KEY}",
        "signal_type": "qa_gate",
        "subject_scope": SubjectScope(
            tenant_id="tenant-a", issuer_id=None, portfolio_id=None
        ),
        "issuer_id": None,
        "portfolio_id": None,
        "run_id": None,
        "kind": "credit_change",
        "title": "QA gate changed",
        "impact": "Review the governed evidence.",
        "evidence": {
            "source_identity": SOURCE_IDENTITY,
            "observed_at": NOW.isoformat(),
            "numeric_value": None,
            "categorical_value": "critical",
            "source_artifact_refs": ["artifact:governed:1"],
            "detail": {"finding": "secret-content"},
        },
        "authority": {
            "observation_key": OBSERVATION_KEY,
            "source_identity": SOURCE_IDENTITY,
            "watch_rule_id": str(RULE_ID),
            "rule_version": 1,
        },
        "correlation_id": CORRELATION_ID,
        "correlation_root_id": ROOT_ID,
        "hop_count": 1,
    }
    payload.update(overrides)
    return AlertCandidate.model_validate(payload)


def _sinks():
    return (
        InAppSink(destination_ref="inbox-primary", max_attempts=3),
        EmailSink(destination_ref="email-route-primary", max_attempts=5),
    )


def _omission_marker(value: object, *, count: int | None = None) -> dict:
    canonical = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")
    marker = {
        "omitted": True,
        "canonical_bytes": len(canonical),
        "sha256": hashlib.sha256(canonical).hexdigest(),
    }
    if count is not None:
        marker["count"] = count
    return marker


async def _add_issuer(
    session,
    *,
    issuer_id: str,
    team_id: str | None = "desk-a",
) -> None:
    session.add(
        Issuer(
            id=issuer_id,
            name=f"Issuer {issuer_id}",
            normalized_name=f"issuer {issuer_id}",
            team_id=team_id,
            uniqueness_scope=team_id or "shared",
            created_by="alice",
            created_at=NOW,
        )
    )
    await session.flush()


async def _add_issuer_run(
    session,
    *,
    issuer_id: str,
    run_id: str,
    team_id: str | None = "desk-a",
    portfolio_id: str | None = None,
) -> None:
    await _add_issuer(session, issuer_id=issuer_id, team_id=team_id)
    session.add(
        Run(
            id=run_id,
            issuer_id=issuer_id,
            status="complete",
            analyst_id="alice",
            portfolio_id=portfolio_id,
            created_at=NOW,
        )
    )
    await session.flush()


async def _set_evaluation_scope(
    session,
    *,
    issuer_id: str | None,
    portfolio_id: str | None,
    run_id: str,
) -> None:
    evaluation = await session.get(WatchRuleEvaluation, str(EVALUATION_ID))
    evaluation.issuer_id = issuer_id
    evaluation.portfolio_id = portfolio_id
    evaluation.subject_scope_json = {
        "tenant_id": "tenant-a",
        "issuer_id": issuer_id,
        "portfolio_id": portfolio_id,
    }
    evaluation.detail_json = {"finding": "secret-content", "run_id": run_id}
    rule = await session.get(WatchRule, str(RULE_ID))
    rule.issuer_id = issuer_id
    rule.portfolio_id = portfolio_id


def _scoped_candidate(
    *, issuer_id: str | None, portfolio_id: str | None, run_id: str
) -> AlertCandidate:
    evidence = copy.deepcopy(_candidate().evidence)
    evidence["detail"]["run_id"] = run_id
    return _candidate(
        subject_scope=SubjectScope(
            tenant_id="tenant-a",
            issuer_id=issuer_id,
            portfolio_id=portfolio_id,
        ),
        issuer_id=issuer_id,
        portfolio_id=portfolio_id,
        run_id=run_id,
        evidence=evidence,
    )


def _candidate_evidence(**overrides: object) -> dict:
    evidence = copy.deepcopy(_candidate().evidence)
    evidence.update(overrides)
    return evidence


@pytest_asyncio.fixture
async def alert_store(tmp_path):
    engine = create_async_engine(
        f"sqlite+aiosqlite:///{tmp_path / 'alerts.db'}",
        connect_args={"timeout": 10},
    )

    @event.listens_for(engine.sync_engine, "connect")
    def _sqlite_setup(connection, _record) -> None:
        cursor = connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=10000")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    async with engine.begin() as connection:
        await connection.run_sync(
            lambda sync: Base.metadata.create_all(
                sync,
                tables=[
                    Issuer.__table__,
                    Portfolio.__table__,
                    PortfolioPosition.__table__,
                    Run.__table__,
                    SectorTaxonomy.__table__,
                    AnalysisContextRecord.__table__,
                    NotificationEvent.__table__,
                    AlertEvent.__table__,
                    WatchRule.__table__,
                    WatchRuleVersion.__table__,
                    WatchRuleEvaluation.__table__,
                    AlertEventContext.__table__,
                    AlertDeliveryIntent.__table__,
                    AlertState.__table__,
                ],
            )
        )
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with sessions.begin() as session:
        session.add(
            WatchRule(
                id=str(RULE_ID),
                tenant_id="tenant-a",
                owner_user_id="alice",
                team_id_snapshot="desk-a",
                issuer_id=None,
                portfolio_id=None,
                name="QA watch",
                signal_type="qa_gate",
                enabled=True,
                paused=False,
                current_version=1,
                schedule_kind="event_driven",
                schedule_interval_seconds=None,
                next_evaluation_at=None,
                schedule_cursor=None,
                claim_token=None,
                claim_expires_at=None,
                last_evaluated_at=None,
                claim_attempt_count=0,
                config_json={
                    "operator": "eq",
                    "threshold": "critical",
                    "kind": "credit_change",
                    "title": "QA gate changed",
                    "impact": "Review the governed evidence.",
                },
                created_at=NOW,
                updated_at=NOW,
            )
        )
        await session.flush()
        session.add(
            WatchRuleVersion(
                id=str(uuid4()),
                watch_rule_id=str(RULE_ID),
                version=1,
                owner_user_id="alice",
                team_id_snapshot="desk-a",
                signal_type="qa_gate",
                config_json={
                    "operator": "eq",
                    "threshold": "critical",
                    "kind": "credit_change",
                    "title": "QA gate changed",
                    "impact": "Review the governed evidence.",
                },
                created_at=NOW,
            )
        )
        await session.flush()
        session.add(
            WatchRuleEvaluation(
                id=str(EVALUATION_ID),
                tenant_id="tenant-a",
                owner_user_id="alice",
                team_id_snapshot="desk-a",
                issuer_id=None,
                portfolio_id=None,
                watch_rule_id=str(RULE_ID),
                rule_version=1,
                signal_type="qa_gate",
                subject_scope_json={
                    "tenant_id": "tenant-a",
                    "issuer_id": None,
                    "portfolio_id": None,
                },
                source_identity=SOURCE_IDENTITY,
                observation_key=OBSERVATION_KEY,
                outcome="observed",
                correlation_id=str(CORRELATION_ID),
                correlation_root_id=str(ROOT_ID),
                hop_count=1,
                evaluated_at=NOW,
                detail_json={"finding": "secret-content"},
            )
        )
    try:
        yield sessions
    finally:
        await engine.dispose()


async def _materialize_committed(sessions, *, sinks=None):
    async with sessions.begin() as session:
        result = await materialize_alert(
            session, _candidate(), sinks or _sinks(), now=NOW
        )
    return result


@pytest.mark.asyncio
async def test_materialization_rolls_back_outcome_event_context_and_intents(
    alert_store,
) -> None:
    async with alert_store() as session:
        result = await materialize_alert(session, _candidate(), _sinks(), now=NOW)
        assert result.event.alert_key == f"c3:{OBSERVATION_KEY}"
        assert len(result.intents) == 2
        await session.rollback()

    async with alert_store() as verify:
        evaluation = await verify.get(WatchRuleEvaluation, str(EVALUATION_ID))
        assert evaluation.outcome == "observed"
        for model in (AlertEvent, AlertEventContext, AlertDeliveryIntent):
            assert await verify.scalar(select(func.count()).select_from(model)) == 0


@pytest.mark.asyncio
async def test_materialization_preserves_candidate_and_stamps_provenance(
    alert_store,
) -> None:
    result = await _materialize_committed(alert_store)
    assert result.event.kind == "credit_change"
    assert result.event.title == "QA gate changed"
    assert result.event.impact == "Review the governed evidence."
    assert result.event.evidence == _candidate().evidence
    assert result.event.authority == _candidate().authority
    assert result.event.created_by == "alice"
    assert result.context.context_json == {
        "observation_key": OBSERVATION_KEY,
        "correlation_id": str(CORRELATION_ID),
        "subject_scope": {
            "tenant_id": "tenant-a",
            "issuer_id": None,
            "portfolio_id": None,
        },
    }
    assert [(row.channel, row.status, row.attempt_count) for row in result.intents] == [
        ("email", "pending", 0),
        ("in_app", "pending", 0),
    ]
    assert all(_utc(row.available_at) == NOW for row in result.intents)


@pytest.mark.asyncio
async def test_duplicate_sink_configuration_collapses_but_conflicts_fail_before_write(
    alert_store,
) -> None:
    duplicate = InAppSink(destination_ref="same", max_attempts=3)
    async with alert_store.begin() as session:
        result = await materialize_alert(
            session, _candidate(), (duplicate, duplicate), now=NOW
        )
        assert len(result.intents) == 1

    other_key = "c" * 64
    candidate = _candidate(
        evaluation_id=uuid4(),
        observation_key=other_key,
        alert_key=f"c3:{other_key}",
        authority={
            **_candidate().authority,
            "observation_key": other_key,
        },
    )
    with pytest.raises(MaterializationError, match="conflicting_sink"):
        async with alert_store.begin() as session:
            await materialize_alert(
                session,
                candidate,
                (
                    EmailSink(destination_ref="same", max_attempts=3),
                    EmailSink(destination_ref="same", max_attempts=5),
                ),
                now=NOW,
            )


@pytest.mark.asyncio
async def test_sequential_replay_reuses_rows_without_resetting_terminal_intent(
    alert_store,
) -> None:
    first = await _materialize_committed(alert_store)
    email_id = next(row.id for row in first.intents if row.channel == "email")
    async with alert_store.begin() as session:
        row = await session.get(AlertDeliveryIntent, email_id)
        row.status = "not_sent"
        row.not_sent_reason = "operator_cancelled"
        row.available_at = NOW + timedelta(days=1)

    second = await _materialize_committed(alert_store)
    assert second.event.id == first.event.id
    assert second.context.id == first.context.id
    assert {row.id for row in second.intents} == {row.id for row in first.intents}
    email = next(row for row in second.intents if row.channel == "email")
    assert (email.status, email.not_sent_reason, _utc(email.available_at)) == (
        "not_sent",
        "operator_cancelled",
        NOW + timedelta(days=1),
    )


@pytest.mark.asyncio
async def test_separate_session_concurrent_materialization_has_one_row_set(
    alert_store,
) -> None:
    async def worker():
        async with alert_store.begin() as session:
            result = await materialize_alert(session, _candidate(), _sinks(), now=NOW)
            return result.event.id, result.context.id

    first, second = await asyncio.gather(worker(), worker())
    assert first == second
    async with alert_store() as verify:
        assert await verify.scalar(select(func.count()).select_from(AlertEvent)) == 1
        assert (
            await verify.scalar(select(func.count()).select_from(AlertEventContext))
            == 1
        )
        assert (
            await verify.scalar(select(func.count()).select_from(AlertDeliveryIntent))
            == 2
        )


@pytest.mark.asyncio
async def test_alert_key_collision_fails_closed_without_mutating_legacy_event(
    alert_store,
) -> None:
    async with alert_store.begin() as session:
        session.add(
            AlertEvent(
                alert_key=f"c3:{OBSERVATION_KEY}",
                kind="different",
                title="Existing legacy title",
                impact="unchanged",
                evidence={},
                authority={},
                created_by="legacy",
                created_at=NOW,
                updated_at=NOW,
            )
        )
    with pytest.raises(MaterializationError, match="event_collision"):
        async with alert_store.begin() as session:
            await materialize_alert(session, _candidate(), _sinks(), now=NOW)
    async with alert_store() as verify:
        event_row = await verify.scalar(select(AlertEvent))
        evaluation = await verify.get(WatchRuleEvaluation, str(EVALUATION_ID))
        assert (event_row.title, event_row.created_by) == (
            "Existing legacy title",
            "legacy",
        )
        assert evaluation.outcome == "observed"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("outcome", "ignored"),
        ("source_identity", "different-source"),
        ("correlation_id", str(uuid4())),
        ("correlation_root_id", str(uuid4())),
        ("hop_count", 2),
        ("signal_type", "run_finding"),
    ],
)
async def test_materialization_rejects_nonmatching_evaluation(
    alert_store, field, value
) -> None:
    async with alert_store.begin() as session:
        evaluation = await session.get(WatchRuleEvaluation, str(EVALUATION_ID))
        setattr(evaluation, field, value)
    with pytest.raises(MaterializationError, match="candidate_mismatch"):
        async with alert_store.begin() as session:
            await materialize_alert(session, _candidate(), _sinks(), now=NOW)
    async with alert_store() as verify:
        assert await verify.scalar(select(func.count()).select_from(AlertEvent)) == 0


@pytest.mark.asyncio
async def test_unknown_candidate_run_id_fails_closed_before_legacy_fk_insert(
    alert_store,
) -> None:
    async with alert_store.begin() as session:
        evaluation = await session.get(WatchRuleEvaluation, str(EVALUATION_ID))
        evaluation.detail_json = {
            "finding": "secret-content",
            "run_id": "missing-run",
        }
    with pytest.raises(MaterializationError, match="run_not_found"):
        async with alert_store.begin() as session:
            evidence = _candidate_evidence(
                detail={"finding": "secret-content", "run_id": "missing-run"}
            )
            await materialize_alert(
                session,
                _candidate(run_id="missing-run", evidence=evidence),
                _sinks(),
                now=NOW,
            )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "candidate",
    [
        _candidate(title="Drifted title"),
        _candidate(authority={**_candidate().authority, "extra": "forged"}),
    ],
)
async def test_materialization_rejects_candidate_presentation_or_authority_drift(
    alert_store, candidate
) -> None:
    with pytest.raises(MaterializationError, match="candidate_mismatch"):
        async with alert_store.begin() as session:
            await materialize_alert(session, candidate, _sinks(), now=NOW)
    async with alert_store() as verify:
        assert await verify.scalar(select(func.count()).select_from(AlertEvent)) == 0


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "evidence",
    [
        _candidate_evidence(extra="forged"),
        _candidate_evidence(observed_at=(NOW + timedelta(seconds=1)).isoformat()),
        _candidate_evidence(detail={"finding": "forged"}),
        _candidate_evidence(
            source_artifact_refs={
                "omitted": True,
                "count": 1,
                "canonical_bytes": 12,
            }
        ),
        _candidate_evidence(
            detail=_omission_marker({"finding": "secret-content"}),
            source_artifact_refs=_omission_marker(["artifact:governed:1"], count=1),
        ),
    ],
)
async def test_materialization_rejects_noncanonical_or_drifted_evidence(
    alert_store, evidence
) -> None:
    with pytest.raises(MaterializationError, match="candidate_mismatch"):
        async with alert_store.begin() as session:
            await materialize_alert(
                session, _candidate(evidence=evidence), _sinks(), now=NOW
            )
    async with alert_store() as verify:
        assert await verify.scalar(select(func.count()).select_from(AlertEvent)) == 0


@pytest.mark.asyncio
async def test_materialization_accepts_the_exact_task3_detail_omission_marker(
    alert_store,
) -> None:
    evidence = _candidate_evidence(
        detail=_omission_marker({"finding": "secret-content"})
    )
    async with alert_store.begin() as session:
        result = await materialize_alert(
            session, _candidate(evidence=evidence), _sinks(), now=NOW
        )
    assert result.event.evidence["detail"] == evidence["detail"]


@pytest.mark.asyncio
async def test_reconstructed_rule_decision_rejects_unmatched_forged_value(
    alert_store,
) -> None:
    evidence = _candidate_evidence(categorical_value="warning")
    with pytest.raises(MaterializationError, match="candidate_mismatch"):
        async with alert_store.begin() as session:
            await materialize_alert(
                session, _candidate(evidence=evidence), _sinks(), now=NOW
            )


@pytest.mark.asyncio
async def test_candidate_nested_mutation_before_call_is_revalidated(
    alert_store,
) -> None:
    candidate = _candidate()
    candidate.evidence["detail"]["finding"] = "forged-after-construction"
    with pytest.raises(MaterializationError, match="candidate_mismatch"):
        async with alert_store.begin() as session:
            await materialize_alert(session, candidate, _sinks(), now=NOW)


@pytest.mark.asyncio
async def test_candidate_is_owned_before_first_await_and_cannot_drift(
    alert_store,
) -> None:
    candidate = _candidate()
    engine = alert_store.kw["bind"]
    mutated = False

    def mutate_candidate(
        _connection, _cursor, _statement, _parameters, _context, _many
    ):
        nonlocal mutated
        if not mutated:
            mutated = True
            candidate.evidence["detail"]["finding"] = "mutated-during-first-await"
            candidate.authority["source_identity"] = "mutated-during-first-await"

    event.listen(engine.sync_engine, "before_cursor_execute", mutate_candidate)
    try:
        async with alert_store.begin() as session:
            result = await materialize_alert(session, candidate, _sinks(), now=NOW)
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", mutate_candidate)

    assert mutated is True
    assert result.event.evidence["detail"] == {"finding": "secret-content"}
    assert result.event.authority["source_identity"] == SOURCE_IDENTITY


def test_frozen_evaluation_schema_explicitly_marks_unrecoverable_evidence_fields() -> (
    None
):
    assert alert_dispatch.UNRECOVERABLE_EVIDENCE_FIELDS == frozenset(
        {"numeric_value", "categorical_value", "source_artifact_refs"}
    )


@pytest.mark.asyncio
async def test_issuer_scoped_run_with_same_issuer_materializes(alert_store) -> None:
    async with alert_store.begin() as session:
        await _add_issuer_run(session, issuer_id="issuer-a", run_id="run-same-issuer")
        await _set_evaluation_scope(
            session,
            issuer_id="issuer-a",
            portfolio_id=None,
            run_id="run-same-issuer",
        )
    async with alert_store.begin() as session:
        result = await materialize_alert(
            session,
            _scoped_candidate(
                issuer_id="issuer-a", portfolio_id=None, run_id="run-same-issuer"
            ),
            _sinks(),
            now=NOW,
        )
    assert (result.event.issuer_id, result.event.run_id) == (
        "issuer-a",
        "run-same-issuer",
    )


@pytest.mark.asyncio
async def test_issuer_scoped_run_with_cross_issuer_is_rejected(alert_store) -> None:
    async with alert_store.begin() as session:
        await _add_issuer(session, issuer_id="issuer-a")
        await _add_issuer_run(session, issuer_id="issuer-b", run_id="run-cross-issuer")
        await _set_evaluation_scope(
            session,
            issuer_id="issuer-a",
            portfolio_id=None,
            run_id="run-cross-issuer",
        )
    with pytest.raises(MaterializationError, match="run_scope_mismatch"):
        async with alert_store.begin() as session:
            await materialize_alert(
                session,
                _scoped_candidate(
                    issuer_id="issuer-a",
                    portfolio_id=None,
                    run_id="run-cross-issuer",
                ),
                _sinks(),
                now=NOW,
            )


@pytest.mark.asyncio
@pytest.mark.parametrize("held", [True, False])
async def test_portfolio_scoped_run_requires_a_position_for_its_issuer(
    alert_store, held
) -> None:
    async with alert_store.begin() as session:
        session.add(
            Portfolio(
                id="portfolio-a",
                name="Portfolio A",
                created_by="alice",
                team_id="desk-a",
                created_at=NOW,
                updated_at=NOW,
            )
        )
        await session.flush()
        await _add_issuer_run(
            session,
            issuer_id="issuer-held" if held else "issuer-not-held",
            run_id="run-portfolio",
            portfolio_id="portfolio-a",
        )
        if held:
            session.add(
                PortfolioPosition(
                    id=str(uuid4()),
                    portfolio_id="portfolio-a",
                    issuer_id="issuer-held",
                    borrower_name="Held issuer",
                    par_usd=1_000_000,
                    created_at=NOW,
                )
            )
            await session.flush()
        await _set_evaluation_scope(
            session,
            issuer_id=None,
            portfolio_id="portfolio-a",
            run_id="run-portfolio",
        )
    candidate = _scoped_candidate(
        issuer_id=None, portfolio_id="portfolio-a", run_id="run-portfolio"
    )
    if held:
        async with alert_store.begin() as session:
            result = await materialize_alert(session, candidate, _sinks(), now=NOW)
        assert result.event.run_id == "run-portfolio"
    else:
        with pytest.raises(MaterializationError, match="run_scope_mismatch"):
            async with alert_store.begin() as session:
                await materialize_alert(session, candidate, _sinks(), now=NOW)


@pytest.mark.asyncio
@pytest.mark.parametrize("issuer_team", ["desk-a", "desk-b"])
async def test_scope_less_run_requires_shared_or_same_frozen_team(
    alert_store, issuer_team
) -> None:
    async with alert_store.begin() as session:
        await _add_issuer_run(
            session,
            issuer_id=f"issuer-{issuer_team}",
            run_id="run-team-scope",
            team_id=issuer_team,
        )
        await _set_evaluation_scope(
            session,
            issuer_id=None,
            portfolio_id=None,
            run_id="run-team-scope",
        )
    candidate = _scoped_candidate(
        issuer_id=None, portfolio_id=None, run_id="run-team-scope"
    )
    if issuer_team == "desk-a":
        async with alert_store.begin() as session:
            result = await materialize_alert(session, candidate, _sinks(), now=NOW)
        assert result.event.run_id == "run-team-scope"
    else:
        with pytest.raises(MaterializationError, match="run_scope_mismatch"):
            async with alert_store.begin() as session:
                await materialize_alert(session, candidate, _sinks(), now=NOW)


@pytest.mark.asyncio
async def test_materialization_leaves_notification_and_alert_state_compatibility_untouched(
    alert_store,
) -> None:
    async with alert_store.begin() as session:
        session.add(
            NotificationEvent(
                analyst_id="alice",
                kind="run_complete",
                subject_kind="run",
                subject_id="legacy-run",
                title="Existing workflow notification",
                idempotency_key="legacy-notification-key",
                created_at=NOW,
            )
        )
    await _materialize_committed(alert_store)
    async with alert_store() as verify:
        notification = await verify.scalar(select(NotificationEvent))
        assert notification.title == "Existing workflow notification"
        assert await verify.scalar(select(func.count()).select_from(AlertState)) == 0


@pytest.mark.asyncio
async def test_two_separate_claimers_have_exactly_one_lease_winner(alert_store) -> None:
    await _materialize_committed(
        alert_store,
        sinks=(EmailSink(destination_ref="only", max_attempts=5),),
    )

    async def worker():
        async with alert_store.begin() as session:
            return await claim_delivery_intent(session, now=NOW)

    claims = await asyncio.gather(worker(), worker())
    assert sum(claim is not None for claim in claims) == 1
    lease = next(claim for claim in claims if claim is not None)
    assert (lease.attempt_count, lease.lease_expires_at) == (
        1,
        NOW + timedelta(minutes=5),
    )


@pytest.mark.asyncio
async def test_claim_reclaims_expired_lease_and_rejects_stale_token_completion(
    alert_store,
) -> None:
    await _materialize_committed(
        alert_store,
        sinks=(EmailSink(destination_ref="only", max_attempts=5),),
    )
    async with alert_store.begin() as session:
        first = await claim_delivery_intent(session, now=NOW)
    assert first is not None
    reclaim_at = NOW + timedelta(minutes=5)
    async with alert_store.begin() as session:
        second = await claim_delivery_intent(session, now=reclaim_at)
    assert second is not None
    assert second.intent_id == first.intent_id
    assert second.lease_token != first.lease_token
    assert second.attempt_count == 2
    terminal = EmailSink(destination_ref="only").render(second.envelope)
    async with alert_store.begin() as session:
        assert (
            await complete_delivery_intent(
                session, first, terminal, now=reclaim_at + timedelta(seconds=1)
            )
            is False
        )
    async with alert_store.begin() as session:
        assert (
            await complete_delivery_intent(
                session, second, terminal, now=reclaim_at + timedelta(seconds=1)
            )
            is True
        )


@pytest.mark.asyncio
async def test_failure_requeues_with_persisted_exponential_backoff(alert_store) -> None:
    await _materialize_committed(
        alert_store,
        sinks=(EmailSink(destination_ref="only", max_attempts=5),),
    )
    for attempt, delay in ((1, 30), (2, 60), (3, 120), (4, 240)):
        claimed_at = NOW + timedelta(seconds=sum((30, 60, 120, 240)[: attempt - 1]))
        async with alert_store.begin() as session:
            lease = await claim_delivery_intent(session, now=claimed_at)
        assert lease is not None and lease.attempt_count == attempt
        async with alert_store.begin() as session:
            assert await record_delivery_failure(
                session,
                lease,
                now=claimed_at,
                error_class="RenderFailure",
            )
        async with alert_store() as verify:
            row = await verify.get(AlertDeliveryIntent, str(lease.intent_id))
            assert row.status == "pending"
            assert _utc(row.available_at) == claimed_at + timedelta(seconds=delay)
            assert row.lease_token is None and row.lease_expires_at is None


@pytest.mark.asyncio
async def test_fifth_owned_failure_and_orphan_at_bound_become_not_sent(
    alert_store,
) -> None:
    await _materialize_committed(
        alert_store,
        sinks=(EmailSink(destination_ref="only", max_attempts=5),),
    )
    async with alert_store.begin() as session:
        row = await session.scalar(select(AlertDeliveryIntent))
        row.attempt_count = 4
        row.available_at = NOW
    async with alert_store.begin() as session:
        lease = await claim_delivery_intent(session, now=NOW)
    assert lease is not None and lease.attempt_count == 5
    async with alert_store.begin() as session:
        assert await record_delivery_failure(
            session, lease, now=NOW, error_class="RenderFailure"
        )
    async with alert_store() as verify:
        row = await verify.get(AlertDeliveryIntent, str(lease.intent_id))
        assert (row.status, row.not_sent_reason) == (
            "not_sent",
            "render_error:RenderFailure",
        )

    async with alert_store.begin() as session:
        first = await session.scalar(select(AlertDeliveryIntent))
        orphan = AlertDeliveryIntent(
            id=str(uuid4()),
            tenant_id=first.tenant_id,
            owner_user_id=first.owner_user_id,
            team_id_snapshot=first.team_id_snapshot,
            issuer_id=None,
            portfolio_id=None,
            alert_event_id=first.alert_event_id,
            alert_event_context_id=first.alert_event_context_id,
            channel="in_app",
            destination_ref="orphan",
            status="leased",
            attempt_count=3,
            max_attempts=3,
            available_at=NOW,
            lease_token=str(uuid4()),
            lease_expires_at=NOW,
            rendered_intent=None,
            not_sent_reason=None,
            correlation_root_id=str(ROOT_ID),
            created_at=NOW,
            updated_at=NOW,
        )
        session.add(orphan)
        orphan_id = orphan.id
    async with alert_store.begin() as session:
        assert await claim_delivery_intent(session, now=NOW) is None
    async with alert_store() as verify:
        orphan = await verify.get(AlertDeliveryIntent, orphan_id)
        assert (orphan.status, orphan.not_sent_reason) == (
            "not_sent",
            "retry_exhausted",
        )


@pytest.mark.asyncio
async def test_completion_rejects_sink_output_identity_mismatches(alert_store) -> None:
    await _materialize_committed(
        alert_store,
        sinks=(EmailSink(destination_ref="only", max_attempts=5),),
    )
    async with alert_store.begin() as session:
        lease = await claim_delivery_intent(session, now=NOW)
    assert lease is not None
    valid = EmailSink(destination_ref="only").render(lease.envelope)
    bad_results = (
        valid.model_copy(update={"channel": "in_app"}),
        valid.model_copy(update={"destination_ref": "wrong"}),
        valid.model_copy(update={"idempotency_key": "0" * 64}),
    )
    for invalid in bad_results:
        with pytest.raises(ValueError, match="sink intent"):
            async with alert_store.begin() as session:
                await complete_delivery_intent(session, lease, invalid, now=NOW)
    async with alert_store() as verify:
        row = await verify.get(AlertDeliveryIntent, str(lease.intent_id))
        assert row.status == "leased"


@pytest.mark.asyncio
async def test_forged_lease_identity_or_attempt_state_fails_closed(alert_store) -> None:
    await _materialize_committed(
        alert_store,
        sinks=(EmailSink(destination_ref="only", max_attempts=5),),
    )
    async with alert_store.begin() as session:
        lease = await claim_delivery_intent(session, now=NOW)
    assert lease is not None
    wrong_key = sink_idempotency_key(
        lease.envelope.alert_event_context_id, "email", "wrong"
    )
    forged = replace(
        lease,
        destination_ref="wrong",
        idempotency_key=wrong_key,
        envelope=replace(
            lease.envelope,
            destination_ref="wrong",
            idempotency_key=wrong_key,
        ),
    )
    forged_result = EmailSink(destination_ref="wrong").render(forged.envelope)
    with pytest.raises(ValueError, match="sink intent"):
        async with alert_store.begin() as session:
            await complete_delivery_intent(session, forged, forged_result, now=NOW)

    forged_attempt = replace(lease, attempt_count=5, max_attempts=5)
    async with alert_store.begin() as session:
        assert (
            await record_delivery_failure(
                session, forged_attempt, now=NOW, error_class="RenderFailure"
            )
            is False
        )
    async with alert_store() as verify:
        row = await verify.get(AlertDeliveryIntent, str(lease.intent_id))
        assert (row.status, row.attempt_count, row.not_sent_reason) == (
            "leased",
            1,
            None,
        )


@pytest.mark.asyncio
async def test_dispatch_sees_only_committed_work_and_renders_between_transactions(
    alert_store,
) -> None:
    session = alert_store()
    await session.begin()
    await materialize_alert(
        session,
        _candidate(),
        (EmailSink(destination_ref="only", max_attempts=5),),
        now=NOW,
    )
    assert (
        await dispatch_once(
            alert_store,
            {("email", "only"): EmailSink(destination_ref="only")},
            lambda: NOW,
        )
        is None
    )
    await session.commit()
    await session.close()

    @dataclass(frozen=True, slots=True)
    class TransactionCheckingSink(AlertSink):
        channel = "email"

        def render(self, envelope):
            assert all(not tracked.in_transaction() for tracked in tracked_sessions)
            return EmailSink(
                destination_ref=self.destination_ref,
                max_attempts=self.max_attempts,
            ).render(envelope)

    tracked_sessions = []

    def tracked_factory():
        created = alert_store()
        tracked_sessions.append(created)
        return created

    result = await dispatch_once(
        tracked_factory,
        {("email", "only"): TransactionCheckingSink(destination_ref="only")},
        lambda: NOW,
    )
    assert result is not None and result.status == "rendered_intent"
    async with alert_store() as verify:
        row = await verify.scalar(select(AlertDeliveryIntent))
        assert row.status == "rendered_intent"


@pytest.mark.asyncio
async def test_dispatch_render_failure_is_sanitized_and_retried_without_secrets(
    alert_store, caplog
) -> None:
    await _materialize_committed(
        alert_store,
        sinks=(EmailSink(destination_ref="email-route-secret", max_attempts=2),),
    )

    @dataclass(frozen=True, slots=True)
    class ExplodingSink(AlertSink):
        channel = "email"

        def render(self, envelope):
            raise RuntimeError("credential=top-secret destination=raw@example.test")

    caplog.set_level(logging.INFO)
    result = await dispatch_once(
        alert_store,
        {
            ("email", "email-route-secret"): ExplodingSink(
                destination_ref="email-route-secret", max_attempts=2
            )
        },
        lambda: NOW,
    )
    assert result is not None
    assert (result.status, result.error_class, result.attempt_count) == (
        "not_sent",
        "RuntimeError",
        1,
    )
    async with alert_store() as verify:
        row = await verify.scalar(select(AlertDeliveryIntent))
        assert row.status == "pending"
        assert _utc(row.available_at) == NOW + timedelta(seconds=30)
        assert row.not_sent_reason is None
    logs = caplog.text
    for secret in (
        "top-secret",
        "raw@example.test",
        "email-route-secret",
        SOURCE_IDENTITY,
        "secret-content",
    ):
        assert secret not in logs


@pytest.mark.asyncio
async def test_dispatch_missing_sink_uses_machine_failure_only(alert_store) -> None:
    await _materialize_committed(
        alert_store,
        sinks=(EmailSink(destination_ref="only", max_attempts=1),),
    )
    result = await dispatch_once(alert_store, {}, lambda: NOW)
    assert result is not None
    assert (result.status, result.error_class) == ("not_sent", "missing_sink")
    async with alert_store() as verify:
        row = await verify.scalar(select(AlertDeliveryIntent))
        assert (row.status, row.not_sent_reason) == (
            "not_sent",
            "render_error:missing_sink",
        )


def test_postgresql_claim_compiles_for_update_skip_locked() -> None:
    compiled = str(
        delivery_claim_select(NOW).compile(
            dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}
        )
    ).upper()
    assert "FOR UPDATE SKIP LOCKED" in compiled


@pytest.mark.asyncio
async def test_postgresql_compiles_the_exact_production_upsert_and_transition_builders(
    alert_store,
) -> None:
    event_builder = getattr(alert_dispatch, "alert_event_upsert_statement")
    context_builder = getattr(alert_dispatch, "alert_context_upsert_statement")
    intent_builder = getattr(alert_dispatch, "alert_intent_upsert_statement")
    claim_builder = getattr(alert_dispatch, "delivery_claim_update_statement")
    completion_builder = getattr(alert_dispatch, "delivery_completion_update_statement")
    failure_builder = getattr(alert_dispatch, "delivery_failure_update_statement")

    upserts = {
        "event": event_builder(
            "postgresql",
            {"id": str(uuid4()), "alert_key": f"c3:{OBSERVATION_KEY}"},
        ),
        "context": context_builder(
            "postgresql",
            {
                "id": str(uuid4()),
                "alert_event_id": str(uuid4()),
                "watch_rule_evaluation_id": str(EVALUATION_ID),
            },
        ),
        "intent": intent_builder(
            "postgresql",
            {
                "id": str(uuid4()),
                "alert_event_context_id": str(uuid4()),
                "channel": "email",
                "destination_ref": "opaque",
            },
        ),
    }
    compiled_upserts = {
        name: str(statement.compile(dialect=postgresql.dialect())).upper()
        for name, statement in upserts.items()
    }
    assert "ON CONFLICT (ALERT_KEY) DO NOTHING" in compiled_upserts["event"]
    assert "ON CONFLICT DO NOTHING" in compiled_upserts["context"]
    assert "ON CONFLICT DO NOTHING" in compiled_upserts["intent"]

    await _materialize_committed(
        alert_store,
        sinks=(EmailSink(destination_ref="only", max_attempts=5),),
    )
    async with alert_store.begin() as session:
        lease = await claim_delivery_intent(session, now=NOW)
    assert lease is not None
    terminal = EmailSink(destination_ref="only").render(lease.envelope)
    transitions = {
        "claim": claim_builder(
            str(lease.intent_id),
            now=NOW,
            token=str(uuid4()),
            expires_at=NOW + timedelta(minutes=5),
        ),
        "completion": completion_builder(lease, terminal, now=NOW),
        "failure": failure_builder(lease, now=NOW, error_class="RenderFailure"),
    }
    compiled = {
        name: str(statement.compile(dialect=postgresql.dialect())).upper()
        for name, statement in transitions.items()
    }
    assert "ATTEMPT_COUNT=(ALERT_DELIVERY_INTENTS.ATTEMPT_COUNT +" in compiled["claim"]
    assert "RETURNING ALERT_DELIVERY_INTENTS.ID" in compiled["claim"]
    for required in (
        "STATUS",
        "AVAILABLE_AT",
        "ATTEMPT_COUNT",
        "MAX_ATTEMPTS",
        "LEASE_TOKEN",
        "LEASE_EXPIRES_AT",
    ):
        assert required in compiled["claim"]
    for transition in ("completion", "failure"):
        for required in (
            "LEASE_TOKEN",
            "LEASE_EXPIRES_AT",
            "STATUS",
            "CHANNEL",
            "DESTINATION_REF",
            "ATTEMPT_COUNT",
            "MAX_ATTEMPTS",
            "CORRELATION_ROOT_ID",
        ):
            assert required in compiled[transition]
        assert "RETURNING ALERT_DELIVERY_INTENTS.ID" in compiled[transition]


def test_dispatch_public_orchestration_annotations_are_precise() -> None:
    hints = get_type_hints(dispatch_once)
    assert hints["session_factory"] is alert_dispatch.AsyncSessionFactory
    assert hints["sink_registry"] == alert_dispatch.SinkRegistry
    parameters = signature(dispatch_once).parameters
    assert parameters["session_factory"].annotation is not Parameter.empty
    assert parameters["sink_registry"].annotation is not Parameter.empty
