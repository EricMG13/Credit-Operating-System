"""Pure C3 rule evaluation and conflict-safe durable observation claims."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Literal
from uuid import UUID, uuid4

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from alert_contracts import AlertCandidate, EvaluationTrigger, SignalObservation
from database import WatchRule, WatchRuleEvaluation, WatchRuleVersion
from engine.periods import is_finite_number
from watch_rules import RuleConfig


_OBSERVATION_KEY_VERSION = "c3-observation-v1"
_UNAVAILABLE_SIGNALS = frozenset({"edgar_filing", "market_move", "news"})
_CATEGORICAL_SIGNALS = frozenset({"run_finding", "qa_gate"})
_NUMERIC_SIGNALS = frozenset({"covenant", "cp1b_monitoring", "cp1c_peer_outlier"})


class EvaluationClaimError(Exception):
    """Stable rejection for an invalid or inaccessible durable claim."""

    code = "evaluation_claim_rejected"


@dataclass(frozen=True, slots=True)
class EvaluationDecision:
    outcome: Literal["matched", "ignored", "rejected"]
    candidate: AlertCandidate | None = None
    reason: str | None = None

    def __post_init__(self) -> None:
        if self.outcome == "matched" and self.candidate is None:
            raise ValueError("matched decisions require a candidate")
        if self.outcome != "matched" and self.candidate is not None:
            raise ValueError("only matched decisions may contain a candidate")
        if self.outcome == "rejected" and not self.reason:
            raise ValueError("rejected decisions require a reason")


@dataclass(frozen=True, slots=True)
class EvaluationClaim:
    evaluation: WatchRuleEvaluation
    created: bool


def _version_fields(rule_version) -> tuple[str, int, str]:
    try:
        watch_rule_id = str(rule_version.watch_rule_id)
        version = rule_version.version
        signal_type = rule_version.signal_type
    except AttributeError as exc:
        raise ValueError("rule_version is missing persisted identity") from exc
    if isinstance(version, bool) or not isinstance(version, int) or version < 1:
        raise ValueError("rule version must be a positive integer")
    return watch_rule_id, version, signal_type


def observation_key(rule_version, observation: SignalObservation) -> str:
    """Hash only immutable rule-version, subject, and source/fact identity."""
    watch_rule_id, version, signal_type = _version_fields(rule_version)
    scope = json.loads(observation.subject_scope.canonical_json())
    canonical = json.dumps(
        [
            _OBSERVATION_KEY_VERSION,
            watch_rule_id,
            version,
            signal_type,
            scope,
            observation.source_identity,
        ],
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()


def _rejected(reason: str) -> EvaluationDecision:
    return EvaluationDecision(outcome="rejected", reason=reason)


def _numeric_match(operator: str, value: float, threshold: float | None) -> bool:
    if operator == "present":
        return True
    if threshold is None:
        return False
    if operator == "eq":
        return value == threshold
    if operator == "gt":
        return value > threshold
    if operator == "gte":
        return value >= threshold
    if operator == "lt":
        return value < threshold
    return value <= threshold


def _categorical_match(
    config: RuleConfig, observation: SignalObservation
) -> tuple[bool, str | None]:
    if config.operator == "present":
        return True, None
    threshold = config.threshold
    if isinstance(threshold, str):
        if observation.categorical_value is None:
            return False, "categorical_required"
        return observation.categorical_value == threshold, None
    value = observation.numeric_value
    if value is None:
        return False, "numeric_required"
    if isinstance(value, bool) or not is_finite_number(value):
        return False, "numeric_invalid"
    return value == threshold, None


def evaluate_rule(
    rule_version,
    observation: SignalObservation,
    *,
    evaluation_id: UUID,
) -> EvaluationDecision:
    """Evaluate one immutable version without reading clocks, storage, or network."""
    try:
        watch_rule_id, version, signal_type = _version_fields(rule_version)
    except (TypeError, ValueError):
        return _rejected("invalid_rule_version")
    if signal_type != observation.signal_type:
        return _rejected("signal_mismatch")
    if signal_type in _UNAVAILABLE_SIGNALS:
        return _rejected("source_unavailable")
    try:
        config = RuleConfig.model_validate(rule_version.config_json)
    except (ValidationError, TypeError, ValueError):
        return _rejected("invalid_rule_config")

    if signal_type in _CATEGORICAL_SIGNALS:
        if config.operator not in {"present", "eq"}:
            return _rejected("invalid_rule_config")
        matched, rejection = _categorical_match(config, observation)
    elif signal_type in _NUMERIC_SIGNALS:
        value = observation.numeric_value
        if value is None:
            return _rejected("numeric_required")
        if isinstance(value, bool) or not is_finite_number(value):
            return _rejected("numeric_invalid")
        threshold = config.threshold
        if threshold is not None and (
            isinstance(threshold, (str, bool)) or not is_finite_number(threshold)
        ):
            return _rejected("invalid_rule_config")
        matched = _numeric_match(config.operator, float(value), threshold)
        rejection = None
    else:
        return _rejected("unsupported_signal")
    if rejection is not None:
        return _rejected(rejection)
    if not matched:
        return EvaluationDecision(outcome="ignored")

    key = observation_key(rule_version, observation)
    detail_run_id = observation.detail.get("run_id")
    run_id = (
        detail_run_id
        if isinstance(detail_run_id, str) and len(detail_run_id) <= 64
        else None
    )
    evidence = observation.model_dump(mode="json")
    authority = {
        "observation_key": key,
        "source_identity": observation.source_identity,
        "watch_rule_id": watch_rule_id,
        "rule_version": version,
    }
    candidate = AlertCandidate(
        evaluation_id=evaluation_id,
        watch_rule_id=UUID(watch_rule_id),
        rule_version=version,
        observation_key=key,
        alert_key=f"c3:{key}",
        signal_type=observation.signal_type,
        subject_scope=observation.subject_scope,
        issuer_id=observation.subject_scope.issuer_id,
        portfolio_id=observation.subject_scope.portfolio_id,
        run_id=run_id,
        kind=config.kind,
        title=config.title,
        impact=config.impact,
        evidence=evidence,
        authority=authority,
        correlation_id=observation.correlation_id,
        correlation_root_id=observation.correlation_root_id,
        hop_count=observation.hop_count,
    )
    return EvaluationDecision(outcome="matched", candidate=candidate)


def _validate_claim(
    rule: WatchRule,
    version: WatchRuleVersion,
    trigger: EvaluationTrigger,
    observation: SignalObservation,
) -> None:
    scope = observation.subject_scope
    if not rule.enabled or rule.paused:
        raise EvaluationClaimError("watch_rule_inactive")
    if rule.current_version < trigger.rule_version:
        raise EvaluationClaimError("rule_version_unavailable")
    if version.signal_type != observation.signal_type:
        raise EvaluationClaimError("signal_mismatch")
    if (
        rule.tenant_id != scope.tenant_id
        or rule.issuer_id != scope.issuer_id
        or rule.portfolio_id != scope.portfolio_id
    ):
        raise EvaluationClaimError("subject_scope_mismatch")
    if trigger.trigger_identity != observation.source_identity:
        raise EvaluationClaimError("trigger_identity_mismatch")
    if trigger.correlation_id != observation.correlation_id:
        raise EvaluationClaimError("correlation_mismatch")
    if trigger.correlation_root_id != observation.correlation_root_id:
        raise EvaluationClaimError("correlation_root_mismatch")
    if trigger.hop_count != observation.hop_count:
        raise EvaluationClaimError("hop_mismatch")


async def _get_existing(
    db: AsyncSession, tenant_id: str, key: str
) -> WatchRuleEvaluation | None:
    return (
        await db.execute(
            select(WatchRuleEvaluation).where(
                WatchRuleEvaluation.tenant_id == tenant_id,
                WatchRuleEvaluation.observation_key == key,
            )
        )
    ).scalar_one_or_none()


async def claim_rule_evaluation(
    db: AsyncSession,
    trigger: EvaluationTrigger,
    observation: SignalObservation,
) -> EvaluationClaim:
    """Insert or get one observed evaluation without committing the transaction."""
    row = (
        await db.execute(
            select(WatchRule, WatchRuleVersion)
            .join(
                WatchRuleVersion,
                (WatchRuleVersion.watch_rule_id == WatchRule.id)
                & (WatchRuleVersion.version == trigger.rule_version),
            )
            .where(
                WatchRule.id == str(trigger.watch_rule_id),
                WatchRule.tenant_id == observation.subject_scope.tenant_id,
            )
        )
    ).one_or_none()
    if row is None:
        raise EvaluationClaimError("watch_rule_not_found")
    rule, version = row
    _validate_claim(rule, version, trigger, observation)
    key = observation_key(version, observation)
    existing = await _get_existing(db, rule.tenant_id, key)
    if existing is not None:
        return EvaluationClaim(evaluation=existing, created=False)

    evaluation_id = str(uuid4())
    values = {
        "id": evaluation_id,
        "tenant_id": rule.tenant_id,
        "owner_user_id": version.owner_user_id,
        "team_id_snapshot": version.team_id_snapshot,
        "issuer_id": rule.issuer_id,
        "portfolio_id": rule.portfolio_id,
        "watch_rule_id": rule.id,
        "rule_version": version.version,
        "signal_type": version.signal_type,
        "subject_scope_json": observation.subject_scope.model_dump(mode="json"),
        "source_identity": observation.source_identity,
        "observation_key": key,
        "outcome": "observed",
        "correlation_id": str(observation.correlation_id),
        "correlation_root_id": str(observation.correlation_root_id),
        "hop_count": observation.hop_count,
        "evaluated_at": observation.observed_at,
        "detail_json": observation.detail,
    }
    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        statement = postgresql_insert(WatchRuleEvaluation)
    elif dialect == "sqlite":
        statement = sqlite_insert(WatchRuleEvaluation)
    else:  # CAOS supports only SQLite and PostgreSQL, so fail closed elsewhere.
        raise EvaluationClaimError("unsupported_database")
    inserted_id = await db.scalar(
        statement.values(**values)
        .on_conflict_do_nothing(index_elements=["tenant_id", "observation_key"])
        .returning(WatchRuleEvaluation.id)
    )
    resolved = await _get_existing(db, rule.tenant_id, key)
    if resolved is None:
        raise EvaluationClaimError("evaluation_insert_unresolved")
    return EvaluationClaim(evaluation=resolved, created=inserted_id is not None)


__all__ = [
    "EvaluationClaim",
    "EvaluationClaimError",
    "EvaluationDecision",
    "claim_rule_evaluation",
    "evaluate_rule",
    "observation_key",
]
