"""Deterministic evaluator and durable evaluation-claim contract tests."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from alert_contracts import EvaluationTrigger, SignalObservation, SubjectScope
from alert_evaluation import (
    EvaluationClaimError,
    claim_rule_evaluation,
    evaluate_rule,
    observation_key,
)
from config import get_settings
from database import Base, WatchRule, WatchRuleEvaluation, WatchRuleVersion
from identity import CallerIdentity
from watch_rules import (
    CreateWatchRuleCommand,
    RuleConfig,
    UpdateWatchRulePatch,
    create_watch_rule,
    update_watch_rule,
)


NOW = datetime(2026, 7, 20, 12, tzinfo=timezone.utc)
RULE_ID = UUID("00000000-0000-0000-0000-000000000001")


def _config(**overrides: object) -> RuleConfig:
    payload = {
        "operator": "present",
        "threshold": None,
        "kind": "credit_change",
        "title": "Credit signal changed",
        "impact": "Review the governed evidence.",
    }
    payload.update(overrides)
    return RuleConfig.model_validate(payload)


def _version(
    *,
    signal_type: str = "run_finding",
    version: int = 7,
    config: RuleConfig | None = None,
):
    return SimpleNamespace(
        watch_rule_id=str(RULE_ID),
        version=version,
        signal_type=signal_type,
        config_json=(config or _config()).model_dump(mode="json"),
    )


def _observation(
    *,
    signal_type: str = "run_finding",
    tenant_id: str = "tenant-a",
    issuer_id: str | None = "issuer-1",
    portfolio_id: str | None = None,
    source_identity: str = "run:abc:cp5:finding:1",
    numeric_value: float | None = None,
    categorical_value: str | None = "critical",
    detail: dict | None = None,
    correlation_id: UUID | None = None,
    correlation_root_id: UUID | None = None,
    hop_count: int = 0,
) -> SignalObservation:
    correlation = correlation_id or uuid4()
    root = correlation_root_id or correlation
    return SignalObservation(
        signal_type=signal_type,
        subject_scope=SubjectScope(
            tenant_id=tenant_id,
            issuer_id=issuer_id,
            portfolio_id=portfolio_id,
        ),
        source_identity=source_identity,
        observed_at=NOW,
        numeric_value=numeric_value,
        categorical_value=categorical_value,
        detail=detail or {},
        source_artifact_refs=("artifact:governed:1",),
        correlation_id=correlation,
        correlation_root_id=root,
        hop_count=hop_count,
    )


def _trigger(
    rule: WatchRule, observation: SignalObservation, *, version: int | None = None
):
    return EvaluationTrigger(
        trigger_kind="manual",
        trigger_identity=observation.source_identity,
        watch_rule_id=UUID(rule.id),
        rule_version=version or rule.current_version,
        occurred_at=NOW,
        scheduled_for=None,
        correlation_id=observation.correlation_id,
        correlation_root_id=observation.correlation_root_id,
        hop_count=observation.hop_count,
    )


def test_observation_key_has_a_fixed_canonical_golden_value() -> None:
    observation = _observation()
    assert observation_key(_version(), observation) == (
        "b5b33627b719f90d61a7aba4017521fc0fe708fe8a7ec6d8ea2f6a0ec9bfc546"
    )
    changed_rendering = observation.model_copy(
        update={
            "observed_at": datetime(2030, 1, 1, tzinfo=timezone.utc),
            "detail": {"x": 1},
        }
    )
    assert observation_key(_version(), changed_rendering) == observation_key(
        _version(), observation
    )


def test_observation_key_changes_for_fact_or_immutable_rule_version() -> None:
    observation = _observation()
    assert observation_key(_version(), observation) != observation_key(
        _version(),
        observation.model_copy(update={"source_identity": "run:abc:cp5:finding:2"}),
    )
    assert observation_key(_version(), observation) != observation_key(
        _version(version=8), observation
    )


@pytest.mark.parametrize(
    ("operator", "threshold", "value", "expected"),
    [
        ("present", None, 4.0, "matched"),
        ("eq", 4.0, 4.0, "matched"),
        ("gt", 4.0, 4.1, "matched"),
        ("gte", 4.0, 4.0, "matched"),
        ("lt", 4.0, 4.1, "ignored"),
        ("lte", 4.0, 4.0, "matched"),
    ],
)
def test_numeric_credit_signal_decisions_are_pure_and_deterministic(
    operator, threshold, value, expected
) -> None:
    version = _version(
        signal_type="covenant", config=_config(operator=operator, threshold=threshold)
    )
    observation = _observation(
        signal_type="covenant", numeric_value=value, categorical_value=None
    )
    evaluation_id = uuid4()
    first = evaluate_rule(version, observation, evaluation_id=evaluation_id)
    second = evaluate_rule(version, observation, evaluation_id=evaluation_id)
    assert first == second
    assert first.outcome == expected
    assert (first.candidate is not None) is (expected == "matched")


def test_matched_candidate_uses_immutable_presentation_and_observation_provenance() -> (
    None
):
    observation = _observation(detail={"run_id": "run-123", "finding": "breach"})
    version = _version(
        config=_config(kind="qa", title="QA gate failed", impact="Block review")
    )
    evaluation_id = uuid4()
    decision = evaluate_rule(version, observation, evaluation_id=evaluation_id)
    candidate = decision.candidate
    assert decision.outcome == "matched" and candidate is not None
    assert candidate.evaluation_id == evaluation_id
    assert candidate.kind == "qa"
    assert candidate.title == "QA gate failed"
    assert candidate.impact == "Block review"
    assert candidate.run_id == "run-123"
    assert candidate.evidence["source_identity"] == observation.source_identity
    assert candidate.evidence["source_artifact_refs"] == ["artifact:governed:1"]
    assert candidate.authority == {
        "observation_key": candidate.observation_key,
        "source_identity": observation.source_identity,
        "watch_rule_id": str(RULE_ID),
        "rule_version": 7,
    }


@pytest.mark.parametrize("run_id", [7, True, "x" * 65])
def test_candidate_run_id_is_derived_only_from_a_bounded_string(run_id) -> None:
    decision = evaluate_rule(
        _version(), _observation(detail={"run_id": run_id}), evaluation_id=uuid4()
    )
    assert decision.candidate is not None
    assert decision.candidate.run_id is None


@pytest.mark.parametrize("signal_type", ["edgar_filing", "market_move", "news"])
def test_unavailable_sources_are_rejected_without_a_candidate(signal_type: str) -> None:
    decision = evaluate_rule(
        _version(signal_type=signal_type),
        _observation(signal_type=signal_type),
        evaluation_id=uuid4(),
    )
    assert (decision.outcome, decision.reason, decision.candidate) == (
        "rejected",
        "source_unavailable",
        None,
    )


def test_missing_nonfinite_and_boolean_numeric_inputs_are_rejected_not_zeroed() -> None:
    version = _version(
        signal_type="cp1b_monitoring", config=_config(operator="gt", threshold=0.0)
    )
    missing = _observation(
        signal_type="cp1b_monitoring", numeric_value=None, categorical_value="missing"
    )
    assert (
        evaluate_rule(version, missing, evaluation_id=uuid4()).reason
        == "numeric_required"
    )
    for invalid in (float("nan"), float("inf"), True):
        unsafe = missing.model_copy(update={"numeric_value": invalid})
        assert (
            evaluate_rule(version, unsafe, evaluation_id=uuid4()).reason
            == "numeric_invalid"
        )


def test_incompatible_signal_or_operator_is_rejected() -> None:
    mismatch = evaluate_rule(
        _version(signal_type="qa_gate"),
        _observation(signal_type="run_finding"),
        evaluation_id=uuid4(),
    )
    assert mismatch.reason == "signal_mismatch"
    invalid_version = SimpleNamespace(
        watch_rule_id=str(RULE_ID),
        version=1,
        signal_type="qa_gate",
        config_json={
            "operator": "gt",
            "threshold": 1,
            "kind": "qa",
            "title": "QA",
            "impact": "",
        },
    )
    assert (
        evaluate_rule(
            invalid_version, _observation(signal_type="qa_gate"), evaluation_id=uuid4()
        ).reason
        == "invalid_rule_config"
    )


@pytest_asyncio.fixture
async def claim_store(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)
    engine = create_async_engine(
        f"sqlite+aiosqlite:///{tmp_path / 'claims.db'}",
        connect_args={"timeout": 10},
    )
    async with engine.begin() as connection:
        await connection.run_sync(
            lambda sync: Base.metadata.create_all(
                sync,
                tables=[
                    WatchRule.__table__,
                    WatchRuleVersion.__table__,
                    WatchRuleEvaluation.__table__,
                ],
            )
        )
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with sessions() as session:
        command = CreateWatchRuleCommand(
            name="QA watch",
            signal_type="qa_gate",
            enabled=True,
            paused=False,
            issuer_id=None,
            portfolio_id=None,
            schedule_kind="event_driven",
            schedule_interval_seconds=None,
            next_evaluation_at=None,
            config=_config(operator="eq", threshold="critical"),
        )
        rule = await create_watch_rule(
            session,
            CallerIdentity(
                id="alice",
                email="alice@example.test",
                full_name="Alice",
                team_id="desk-a",
            ),
            command,
        )
        await session.commit()
        rule_id = rule.id
    try:
        yield sessions, rule_id
    finally:
        await engine.dispose()


def _claim_observation(**overrides) -> SignalObservation:
    return _observation(
        signal_type="qa_gate",
        tenant_id="desk-a",
        issuer_id=None,
        categorical_value="critical",
        **overrides,
    )


@pytest.mark.asyncio
async def test_claim_is_idempotent_and_does_not_commit(claim_store) -> None:
    sessions, rule_id = claim_store
    async with sessions() as session:
        rule = await session.get(WatchRule, rule_id)
        observation = _claim_observation()
        first = await claim_rule_evaluation(
            session, _trigger(rule, observation), observation
        )
        second = await claim_rule_evaluation(
            session, _trigger(rule, observation), observation
        )
        assert first.created is True
        assert second.created is False
        assert first.evaluation.id == second.evaluation.id
        await session.rollback()
    async with sessions() as verify:
        assert (
            await verify.scalar(select(func.count()).select_from(WatchRuleEvaluation))
            == 0
        )


@pytest.mark.asyncio
async def test_claim_changes_identity_for_new_fact_and_new_rule_version(
    claim_store,
) -> None:
    sessions, rule_id = claim_store
    async with sessions() as session:
        rule = await session.get(WatchRule, rule_id)
        first_observation = _claim_observation()
        first = await claim_rule_evaluation(
            session, _trigger(rule, first_observation), first_observation
        )
        second_observation = _claim_observation(source_identity="qa:run-2:gate")
        second = await claim_rule_evaluation(
            session, _trigger(rule, second_observation), second_observation
        )
        assert first.evaluation.observation_key != second.evaluation.observation_key
        await session.commit()

        await update_watch_rule(
            session,
            CallerIdentity(
                id="alice",
                email="alice@example.test",
                full_name="Alice",
                team_id="desk-a",
            ),
            rule.id,
            1,
            UpdateWatchRulePatch(name="QA watch v2"),
        )
        await session.commit()
        versioned = await claim_rule_evaluation(
            session, _trigger(rule, first_observation, version=2), first_observation
        )
        assert versioned.evaluation.observation_key != first.evaluation.observation_key
        assert (
            await session.scalar(select(func.count()).select_from(WatchRuleEvaluation))
            == 3
        )


@pytest.mark.asyncio
async def test_claim_loads_the_exact_older_immutable_signal_version(
    claim_store,
) -> None:
    sessions, rule_id = claim_store
    async with sessions() as session:
        rule = await session.get(WatchRule, rule_id)
        await update_watch_rule(
            session,
            CallerIdentity(
                id="alice",
                email="alice@example.test",
                full_name="Alice",
                team_id="desk-a",
            ),
            rule.id,
            1,
            UpdateWatchRulePatch(
                signal_type="covenant",
                config=_config(operator="gt", threshold=4.0),
            ),
        )
        await session.commit()
        old_observation = _claim_observation(source_identity="qa:old-version:fact")
        result = await claim_rule_evaluation(
            session,
            _trigger(rule, old_observation, version=1),
            old_observation,
        )
        assert result.created is True
        assert result.evaluation.rule_version == 1
        assert result.evaluation.signal_type == "qa_gate"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "mismatch", ["scope", "identity", "correlation", "root", "hop"]
)
async def test_claim_rejects_scope_and_loop_mismatches_before_insert(
    claim_store, mismatch
) -> None:
    sessions, rule_id = claim_store
    async with sessions() as session:
        rule = await session.get(WatchRule, rule_id)
        observation = _claim_observation()
        trigger = _trigger(rule, observation)
        if mismatch == "scope":
            observation = observation.model_copy(
                update={
                    "subject_scope": SubjectScope(
                        tenant_id="desk-b", issuer_id=None, portfolio_id=None
                    )
                }
            )
        elif mismatch == "identity":
            trigger = trigger.model_copy(update={"trigger_identity": "different"})
        elif mismatch == "correlation":
            trigger = trigger.model_copy(update={"correlation_id": uuid4()})
        elif mismatch == "root":
            trigger = trigger.model_copy(update={"correlation_root_id": uuid4()})
        else:
            observation = observation.model_copy(update={"hop_count": 1})
        with pytest.raises(EvaluationClaimError):
            await claim_rule_evaluation(session, trigger, observation)
        assert (
            await session.scalar(select(func.count()).select_from(WatchRuleEvaluation))
            == 0
        )


@pytest.mark.asyncio
@pytest.mark.parametrize(("enabled", "paused"), [(False, False), (True, True)])
async def test_claim_rejects_disabled_or_paused_rules(
    claim_store, enabled, paused
) -> None:
    sessions, rule_id = claim_store
    async with sessions() as session:
        rule = await session.get(WatchRule, rule_id)
        rule.enabled = enabled
        rule.paused = paused
        await session.commit()
        observation = _claim_observation()
        with pytest.raises(EvaluationClaimError):
            await claim_rule_evaluation(
                session, _trigger(rule, observation), observation
            )
        assert (
            await session.scalar(select(func.count()).select_from(WatchRuleEvaluation))
            == 0
        )


@pytest.mark.asyncio
async def test_hop_three_claims_once_and_wire_rejects_hop_four(claim_store) -> None:
    sessions, rule_id = claim_store
    observation = _claim_observation(hop_count=3)
    async with sessions() as session:
        rule = await session.get(WatchRule, rule_id)
        first = await claim_rule_evaluation(
            session, _trigger(rule, observation), observation
        )
        returned = await claim_rule_evaluation(
            session, _trigger(rule, observation), observation
        )
        assert first.created is True and returned.created is False
        await session.commit()
    with pytest.raises(ValidationError):
        observation.model_copy(update={"hop_count": 4}).model_validate(
            {**observation.model_dump(), "hop_count": 4}
        )


@pytest.mark.asyncio
async def test_concurrent_claims_use_separate_connections_and_create_one_durable_row(
    claim_store,
) -> None:
    sessions, rule_id = claim_store
    correlation = uuid4()
    observation = _claim_observation(
        correlation_id=correlation,
        correlation_root_id=correlation,
        source_identity="qa:concurrent:fact",
    )
    ready = asyncio.Event()
    arrivals = 0
    arrival_lock = asyncio.Lock()

    async def worker():
        nonlocal arrivals
        async with sessions() as session:
            rule = await session.get(WatchRule, rule_id)
            connection = await session.connection()
            connection_id = id(connection.sync_connection.connection.dbapi_connection)
            async with arrival_lock:
                arrivals += 1
                if arrivals == 2:
                    ready.set()
            await ready.wait()
            result = await claim_rule_evaluation(
                session, _trigger(rule, observation), observation
            )
            await session.commit()
            return connection_id, result.created, result.evaluation.id

    first, second = await asyncio.gather(worker(), worker())
    assert first[0] != second[0]
    assert sorted((first[1], second[1])) == [False, True]
    assert first[2] == second[2]
    async with sessions() as verify:
        assert (
            await verify.scalar(select(func.count()).select_from(WatchRuleEvaluation))
            == 1
        )
