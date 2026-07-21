"""Atomic C3 alert materialization and durable delivery lease transitions."""

from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Protocol, TypeAlias
from uuid import UUID, uuid4

from pydantic import ValidationError
from sqlalchemy import Select, and_, or_, select, update
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import OperationalError

from alert_contracts import AlertCandidate, SignalObservation, SinkIntent, SinkResult
from alert_evaluation import evaluate_rule
from alert_sinks import AlertSink, Channel, DeliveryEnvelope, sink_idempotency_key
from database import (
    AlertDeliveryIntent,
    AlertEvent,
    AlertEventContext,
    Issuer,
    Portfolio,
    PortfolioPosition,
    Run,
    WatchRuleEvaluation,
    WatchRuleVersion,
)
from watch_rules import RuleConfig


_LEASE_DURATION = timedelta(minutes=5)
_MACHINE_ERROR = re.compile(r"^[A-Za-z0-9_.-]{1,64}$")
_EVIDENCE_KEYS = frozenset(
    {
        "source_identity",
        "observed_at",
        "numeric_value",
        "categorical_value",
        "source_artifact_refs",
        "detail",
    }
)

# The frozen evaluation row does not retain these original observation fields.
# We can re-run the rule decision and validate their bounded wire shape, but cannot
# prove their historical value identity against storage after Task 3 returns.
UNRECOVERABLE_EVIDENCE_FIELDS = frozenset(
    {"numeric_value", "categorical_value", "source_artifact_refs"}
)


class AsyncSessionFactory(Protocol):
    """Callable that creates one async context-managed database session."""

    def __call__(self) -> AsyncSession: ...


SinkRegistryKey: TypeAlias = Channel | tuple[Channel, str]
SinkRegistry: TypeAlias = Mapping[SinkRegistryKey, AlertSink]


class MaterializationError(Exception):
    """Stable fail-closed rejection at the candidate persistence boundary."""

    code = "alert_materialization_rejected"


@dataclass(frozen=True, slots=True)
class MaterializedAlert:
    event: AlertEvent
    context: AlertEventContext
    intents: tuple[AlertDeliveryIntent, ...]


@dataclass(frozen=True, slots=True)
class DeliveryLease:
    intent_id: UUID
    lease_token: UUID
    lease_expires_at: datetime
    channel: str
    destination_ref: str
    idempotency_key: str
    attempt_count: int
    max_attempts: int
    correlation_root_id: UUID
    envelope: DeliveryEnvelope


def _aware_utc(value: datetime, *, label: str) -> datetime:
    if not isinstance(value, datetime) or value.tzinfo is None:
        raise ValueError(f"{label} must be a timezone-aware datetime")
    return value.astimezone(timezone.utc)


def _insert_for_dialect(dialect: str, model):
    if dialect == "postgresql":
        return postgresql_insert(model)
    if dialect == "sqlite":
        return sqlite_insert(model)
    raise MaterializationError("unsupported_database")


def alert_event_upsert_statement(dialect: str, values: Mapping[str, object]):
    """Build the production conflict-safe alert-event insertion."""
    return (
        _insert_for_dialect(dialect, AlertEvent)
        .values(**dict(values))
        .on_conflict_do_nothing(index_elements=["alert_key"])
    )


def alert_context_upsert_statement(dialect: str, values: Mapping[str, object]):
    """Build the production conflict-safe evaluation-context insertion."""
    return (
        _insert_for_dialect(dialect, AlertEventContext)
        .values(**dict(values))
        .on_conflict_do_nothing()
    )


def alert_intent_upsert_statement(dialect: str, values: Mapping[str, object]):
    """Build the production conflict-safe destination-intent insertion."""
    return (
        _insert_for_dialect(dialect, AlertDeliveryIntent)
        .values(**dict(values))
        .on_conflict_do_nothing()
    )


def _deduplicated_sinks(sinks: Sequence[AlertSink]) -> tuple[AlertSink, ...]:
    if not isinstance(sinks, Sequence) or isinstance(sinks, (str, bytes)) or not sinks:
        raise MaterializationError("sinks_required")
    unique: dict[tuple[str, str], AlertSink] = {}
    for sink in sinks:
        if not isinstance(sink, AlertSink):
            raise MaterializationError("invalid_sink")
        key = (sink.channel, sink.destination_ref)
        previous = unique.get(key)
        if previous is not None and previous != sink:
            raise MaterializationError("conflicting_sink_configuration")
        unique[key] = sink
    return tuple(unique[key] for key in sorted(unique))


def _canonical_bytes(value: object) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")


def _omission_marker(value: object, *, count: int | None = None) -> dict[str, object]:
    canonical = _canonical_bytes(value)
    marker: dict[str, object] = {
        "omitted": True,
        "canonical_bytes": len(canonical),
        "sha256": hashlib.sha256(canonical).hexdigest(),
    }
    if count is not None:
        marker["count"] = count
    return marker


def _artifact_marker_is_well_formed(value: object) -> bool:
    if not isinstance(value, dict) or set(value) != {
        "omitted",
        "count",
        "canonical_bytes",
        "sha256",
    }:
        return False
    count = value.get("count")
    size = value.get("canonical_bytes")
    digest = value.get("sha256")
    return all(
        (
            value.get("omitted") is True,
            isinstance(count, int) and not isinstance(count, bool) and 1 <= count <= 64,
            isinstance(size, int) and not isinstance(size, bool) and size >= 2,
            isinstance(digest, str)
            and re.fullmatch(r"[0-9a-f]{64}", digest) is not None,
        )
    )


def _persisted_utc(value: datetime) -> datetime:
    if not isinstance(value, datetime):
        raise ValueError("persisted timestamp is invalid")
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _validated_observation_from_evidence(
    evaluation: WatchRuleEvaluation,
    candidate: AlertCandidate,
) -> tuple[SignalObservation, bool] | None:
    """Validate Task 3 evidence and reconstruct every persisted observation field.

    The bool records whether artifact references were present and therefore can be
    compared exactly. A canonical omission marker is shape-validated only because
    the frozen evaluation schema intentionally does not retain the original list.
    """
    evidence = candidate.evidence
    if not isinstance(evidence, dict) or set(evidence) != _EVIDENCE_KEYS:
        return None
    if evidence.get("source_identity") != evaluation.source_identity:
        return None
    observed_at = evidence.get("observed_at")
    if not isinstance(observed_at, str):
        return None
    try:
        parsed_observed_at = datetime.fromisoformat(observed_at)
    except ValueError:
        return None
    if parsed_observed_at.tzinfo is None:
        return None
    if parsed_observed_at.astimezone(timezone.utc) != _persisted_utc(
        evaluation.evaluated_at
    ):
        return None

    detail = evidence.get("detail")
    if detail != evaluation.detail_json and detail != _omission_marker(
        evaluation.detail_json
    ):
        return None

    artifact_value = evidence.get("source_artifact_refs")
    artifacts_recoverable = isinstance(artifact_value, list)
    if artifacts_recoverable:
        artifact_refs: tuple[str, ...] = tuple(artifact_value)
    elif _artifact_marker_is_well_formed(artifact_value):
        probe = dict(evidence)
        probe["source_artifact_refs"] = []
        empty_list_bytes = len(_canonical_bytes([]))
        full_evidence_bytes = (
            len(_canonical_bytes(probe))
            - empty_list_bytes
            + artifact_value["canonical_bytes"]
        )
        if full_evidence_bytes <= 64 * 1024:
            return None
        artifact_refs = ()
    else:
        return None

    try:
        observation = SignalObservation(
            signal_type=evaluation.signal_type,
            subject_scope=evaluation.subject_scope_json,
            source_identity=evaluation.source_identity,
            observed_at=parsed_observed_at,
            numeric_value=evidence.get("numeric_value"),
            categorical_value=evidence.get("categorical_value"),
            detail=evaluation.detail_json,
            source_artifact_refs=artifact_refs,
            correlation_id=UUID(evaluation.correlation_id),
            correlation_root_id=UUID(evaluation.correlation_root_id),
            hop_count=evaluation.hop_count,
        )
    except (TypeError, ValueError, ValidationError):
        return None
    return observation, artifacts_recoverable


def _candidate_matches_evaluation(
    evaluation: WatchRuleEvaluation,
    version: WatchRuleVersion,
    candidate: AlertCandidate,
) -> bool:
    scope = candidate.subject_scope.model_dump(mode="json")
    try:
        config = RuleConfig.model_validate(version.config_json)
    except (TypeError, ValueError):
        return False
    expected_authority = {
        "observation_key": evaluation.observation_key,
        "source_identity": evaluation.source_identity,
        "watch_rule_id": evaluation.watch_rule_id,
        "rule_version": evaluation.rule_version,
    }
    reconstructed = _validated_observation_from_evidence(evaluation, candidate)
    if reconstructed is None:
        return False
    observation, artifacts_recoverable = reconstructed
    decision = evaluate_rule(version, observation, evaluation_id=UUID(evaluation.id))
    expected = decision.candidate
    if decision.outcome != "matched" or expected is None:
        return False
    identity_matches = all(
        (
            evaluation.id == str(candidate.evaluation_id),
            evaluation.tenant_id == candidate.subject_scope.tenant_id,
            evaluation.owner_user_id != "",
            evaluation.watch_rule_id == str(candidate.watch_rule_id),
            evaluation.rule_version == candidate.rule_version,
            evaluation.signal_type == candidate.signal_type,
            evaluation.subject_scope_json == scope,
            evaluation.issuer_id == candidate.issuer_id,
            evaluation.portfolio_id == candidate.portfolio_id,
            evaluation.observation_key == candidate.observation_key,
            evaluation.correlation_id == str(candidate.correlation_id),
            evaluation.correlation_root_id == str(candidate.correlation_root_id),
            evaluation.hop_count == candidate.hop_count,
            evaluation.outcome in {"observed", "matched"},
            version.watch_rule_id == evaluation.watch_rule_id,
            version.version == evaluation.rule_version,
            version.owner_user_id == evaluation.owner_user_id,
            version.team_id_snapshot == evaluation.team_id_snapshot,
            version.signal_type == evaluation.signal_type,
            candidate.kind == config.kind == expected.kind,
            candidate.title == config.title == expected.title,
            candidate.impact == config.impact == expected.impact,
            candidate.run_id == expected.run_id,
            candidate.authority == expected_authority,
        )
    )
    if not identity_matches:
        return False
    if artifacts_recoverable:
        expected_evidence = dict(expected.evidence)
        if candidate.evidence["detail"] == _omission_marker(evaluation.detail_json):
            expected_evidence["detail"] = _omission_marker(evaluation.detail_json)
        return candidate.evidence == expected_evidence
    # Task 3 may replace the source-artifact list with a digest marker only after
    # detail omission. Its original list is not persisted, so exact digest
    # provenance is unrecoverable; all remaining evidence is checked exactly.
    return all(
        (
            candidate.evidence["source_identity"]
            == expected.evidence["source_identity"],
            candidate.evidence["observed_at"] == expected.evidence["observed_at"],
            candidate.evidence["numeric_value"] == expected.evidence["numeric_value"],
            candidate.evidence["categorical_value"]
            == expected.evidence["categorical_value"],
            candidate.evidence["detail"] == _omission_marker(evaluation.detail_json),
        )
    )


def _event_matches(
    event: AlertEvent,
    candidate: AlertCandidate,
    *,
    created_by: str,
) -> bool:
    return all(
        (
            event.alert_key == candidate.alert_key,
            event.context_id is None,
            event.issuer_id == candidate.issuer_id,
            event.run_id == candidate.run_id,
            event.kind == candidate.kind,
            event.title == candidate.title,
            event.impact == candidate.impact,
            event.evidence == candidate.evidence,
            event.authority == candidate.authority,
            event.created_by == created_by,
        )
    )


def _context_payload(candidate: AlertCandidate) -> dict:
    return {
        "observation_key": candidate.observation_key,
        "correlation_id": str(candidate.correlation_id),
        "subject_scope": candidate.subject_scope.model_dump(mode="json"),
    }


def _context_matches(
    context: AlertEventContext,
    event: AlertEvent,
    evaluation: WatchRuleEvaluation,
    candidate: AlertCandidate,
) -> bool:
    return all(
        (
            context.tenant_id == evaluation.tenant_id,
            context.owner_user_id == evaluation.owner_user_id,
            context.team_id_snapshot == evaluation.team_id_snapshot,
            context.issuer_id == evaluation.issuer_id,
            context.portfolio_id == evaluation.portfolio_id,
            context.alert_event_id == event.id,
            context.watch_rule_evaluation_id == evaluation.id,
            context.watch_rule_id == evaluation.watch_rule_id,
            context.rule_version == evaluation.rule_version,
            context.signal_type == evaluation.signal_type,
            context.correlation_root_id == str(candidate.correlation_root_id),
            context.hop_count == candidate.hop_count,
            context.context_json == _context_payload(candidate),
        )
    )


def _intent_matches(
    intent: AlertDeliveryIntent,
    context: AlertEventContext,
    evaluation: WatchRuleEvaluation,
    sink: AlertSink,
) -> bool:
    return all(
        (
            intent.tenant_id == evaluation.tenant_id,
            intent.owner_user_id == evaluation.owner_user_id,
            intent.team_id_snapshot == evaluation.team_id_snapshot,
            intent.issuer_id == evaluation.issuer_id,
            intent.portfolio_id == evaluation.portfolio_id,
            intent.alert_event_id == context.alert_event_id,
            intent.alert_event_context_id == context.id,
            intent.channel == sink.channel,
            intent.destination_ref == sink.destination_ref,
            intent.max_attempts == sink.max_attempts,
            intent.correlation_root_id == context.correlation_root_id,
        )
    )


async def _validate_run_scope(
    db: AsyncSession,
    evaluation: WatchRuleEvaluation,
    run_id: str,
) -> None:
    row = (
        await db.execute(
            select(Run, Issuer)
            .join(Issuer, Issuer.id == Run.issuer_id)
            .where(Run.id == run_id)
        )
    ).one_or_none()
    if row is None:
        raise MaterializationError("run_not_found")
    run, issuer = row
    team_id = evaluation.team_id_snapshot
    if issuer.team_id not in {None, team_id}:
        raise MaterializationError("run_scope_mismatch")
    if evaluation.issuer_id is not None:
        if run.issuer_id != evaluation.issuer_id:
            raise MaterializationError("run_scope_mismatch")
        return
    if evaluation.portfolio_id is not None:
        portfolio = await db.get(Portfolio, evaluation.portfolio_id)
        if (
            portfolio is None
            or portfolio.team_id not in {None, team_id}
            or run.portfolio_id != evaluation.portfolio_id
        ):
            raise MaterializationError("run_scope_mismatch")
        position_exists = await db.scalar(
            select(PortfolioPosition.id)
            .where(
                PortfolioPosition.portfolio_id == evaluation.portfolio_id,
                PortfolioPosition.issuer_id == run.issuer_id,
            )
            .limit(1)
        )
        if position_exists is None:
            raise MaterializationError("run_scope_mismatch")


async def materialize_alert(
    db: AsyncSession,
    candidate: AlertCandidate,
    sinks: Sequence[AlertSink],
    *,
    now: datetime,
) -> MaterializedAlert:
    """Insert or get the event/context/destinations in the caller's transaction."""
    if not isinstance(candidate, AlertCandidate):
        raise MaterializationError("invalid_candidate")
    # Own and revalidate the complete nested candidate before the first await.
    # Callers can otherwise mutate Pydantic's nested dict/list references while
    # this coroutine is suspended on its initial database read.
    try:
        candidate = AlertCandidate.model_validate_json(candidate.model_dump_json())
    except (TypeError, ValueError, ValidationError) as exc:
        raise MaterializationError("invalid_candidate") from exc
    normalized_now = _aware_utc(now, label="now")
    unique_sinks = _deduplicated_sinks(sinks)
    row = (
        await db.execute(
            select(WatchRuleEvaluation, WatchRuleVersion)
            .join(
                WatchRuleVersion,
                (WatchRuleVersion.watch_rule_id == WatchRuleEvaluation.watch_rule_id)
                & (WatchRuleVersion.version == WatchRuleEvaluation.rule_version),
            )
            .where(WatchRuleEvaluation.id == str(candidate.evaluation_id))
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).one_or_none()
    if row is None:
        raise MaterializationError("candidate_mismatch")
    evaluation, version = row
    if not _candidate_matches_evaluation(evaluation, version, candidate):
        raise MaterializationError("candidate_mismatch")
    if candidate.run_id is not None:
        await _validate_run_scope(db, evaluation, candidate.run_id)

    evaluation.outcome = "matched"
    event_values = {
        "id": str(uuid4()),
        "alert_key": candidate.alert_key,
        "context_id": None,
        "issuer_id": candidate.issuer_id,
        "run_id": candidate.run_id,
        "kind": candidate.kind,
        "title": candidate.title,
        "impact": candidate.impact,
        "evidence": candidate.evidence,
        "authority": candidate.authority,
        "created_by": evaluation.owner_user_id,
        "created_at": normalized_now,
        "updated_at": normalized_now,
    }
    dialect = db.get_bind().dialect.name
    await db.execute(alert_event_upsert_statement(dialect, event_values))
    event = await db.scalar(
        select(AlertEvent)
        .where(AlertEvent.alert_key == candidate.alert_key)
        .execution_options(populate_existing=True)
    )
    if event is None or not _event_matches(
        event, candidate, created_by=evaluation.owner_user_id
    ):
        raise MaterializationError("event_collision")

    context_values = {
        "id": str(uuid4()),
        "tenant_id": evaluation.tenant_id,
        "owner_user_id": evaluation.owner_user_id,
        "team_id_snapshot": evaluation.team_id_snapshot,
        "issuer_id": evaluation.issuer_id,
        "portfolio_id": evaluation.portfolio_id,
        "alert_event_id": event.id,
        "watch_rule_evaluation_id": evaluation.id,
        "watch_rule_id": evaluation.watch_rule_id,
        "rule_version": evaluation.rule_version,
        "signal_type": evaluation.signal_type,
        "correlation_root_id": evaluation.correlation_root_id,
        "hop_count": evaluation.hop_count,
        "context_json": _context_payload(candidate),
        "created_at": normalized_now,
    }
    await db.execute(alert_context_upsert_statement(dialect, context_values))
    context = await db.scalar(
        select(AlertEventContext)
        .where(AlertEventContext.alert_event_id == event.id)
        .execution_options(populate_existing=True)
    )
    if context is None or not _context_matches(context, event, evaluation, candidate):
        raise MaterializationError("context_collision")

    intents: list[AlertDeliveryIntent] = []
    for sink in unique_sinks:
        intent_values = {
            "id": str(uuid4()),
            "tenant_id": evaluation.tenant_id,
            "owner_user_id": evaluation.owner_user_id,
            "team_id_snapshot": evaluation.team_id_snapshot,
            "issuer_id": evaluation.issuer_id,
            "portfolio_id": evaluation.portfolio_id,
            "alert_event_id": event.id,
            "alert_event_context_id": context.id,
            "channel": sink.channel,
            "destination_ref": sink.destination_ref,
            "status": "pending",
            "attempt_count": 0,
            "max_attempts": sink.max_attempts,
            "available_at": normalized_now,
            "lease_token": None,
            "lease_expires_at": None,
            "rendered_intent": None,
            "not_sent_reason": None,
            "correlation_root_id": evaluation.correlation_root_id,
            "created_at": normalized_now,
            "updated_at": normalized_now,
        }
        await db.execute(alert_intent_upsert_statement(dialect, intent_values))
        intent = await db.scalar(
            select(AlertDeliveryIntent)
            .where(
                AlertDeliveryIntent.alert_event_context_id == context.id,
                AlertDeliveryIntent.channel == sink.channel,
                AlertDeliveryIntent.destination_ref == sink.destination_ref,
            )
            .execution_options(populate_existing=True)
        )
        if intent is None or not _intent_matches(intent, context, evaluation, sink):
            raise MaterializationError("intent_collision")
        intents.append(intent)
    return MaterializedAlert(
        event=event,
        context=context,
        intents=tuple(
            sorted(intents, key=lambda row: (row.channel, row.destination_ref))
        ),
    )


def _eligible(now: datetime):
    return or_(
        and_(
            AlertDeliveryIntent.status == "pending",
            AlertDeliveryIntent.available_at <= now,
        ),
        and_(
            AlertDeliveryIntent.status == "leased",
            AlertDeliveryIntent.lease_expires_at <= now,
        ),
    )


def delivery_claim_select(now: datetime) -> Select:
    """Build the PostgreSQL row-lock claim selection for offline compilation."""
    normalized_now = _aware_utc(now, label="now")
    return (
        select(AlertDeliveryIntent)
        .where(
            _eligible(normalized_now),
            AlertDeliveryIntent.attempt_count < AlertDeliveryIntent.max_attempts,
        )
        .order_by(
            AlertDeliveryIntent.available_at,
            AlertDeliveryIntent.created_at,
            AlertDeliveryIntent.id,
        )
        .limit(1)
        .with_for_update(skip_locked=True)
    )


def delivery_claim_update_statement(
    intent_id: str,
    *,
    now: datetime,
    token: str,
    expires_at: datetime,
):
    """Build the tokenized, bounded-attempt claim transition."""
    normalized_now = _aware_utc(now, label="now")
    normalized_expiry = _aware_utc(expires_at, label="expires_at")
    return (
        update(AlertDeliveryIntent)
        .execution_options(synchronize_session=False)
        .where(
            AlertDeliveryIntent.id == intent_id,
            _eligible(normalized_now),
            AlertDeliveryIntent.attempt_count < AlertDeliveryIntent.max_attempts,
        )
        .values(
            status="leased",
            attempt_count=AlertDeliveryIntent.attempt_count + 1,
            lease_token=token,
            lease_expires_at=normalized_expiry,
            rendered_intent=None,
            not_sent_reason=None,
            updated_at=normalized_now,
        )
        .returning(AlertDeliveryIntent.id)
    )


def _owned_lease_predicates(lease: DeliveryLease, now: datetime) -> tuple:
    return (
        AlertDeliveryIntent.id == str(lease.intent_id),
        AlertDeliveryIntent.status == "leased",
        AlertDeliveryIntent.lease_token == str(lease.lease_token),
        AlertDeliveryIntent.lease_expires_at > now,
        AlertDeliveryIntent.channel == lease.channel,
        AlertDeliveryIntent.destination_ref == lease.destination_ref,
        AlertDeliveryIntent.attempt_count == lease.attempt_count,
        AlertDeliveryIntent.max_attempts == lease.max_attempts,
        AlertDeliveryIntent.correlation_root_id == str(lease.correlation_root_id),
    )


def delivery_completion_update_statement(
    lease: DeliveryLease,
    result: SinkIntent,
    *,
    now: datetime,
):
    """Build the full-identity conditional terminal completion."""
    normalized_now = _aware_utc(now, label="now")
    return (
        update(AlertDeliveryIntent)
        .execution_options(synchronize_session=False)
        .where(*_owned_lease_predicates(lease, normalized_now))
        .values(
            status=result.status,
            rendered_intent=result.rendered_intent,
            not_sent_reason=result.not_sent_reason,
            lease_token=None,
            lease_expires_at=None,
            updated_at=normalized_now,
        )
        .returning(AlertDeliveryIntent.id)
    )


def delivery_failure_update_statement(
    lease: DeliveryLease,
    *,
    now: datetime,
    error_class: str,
):
    """Build the full-identity retry or terminal failure transition."""
    normalized_now = _aware_utc(now, label="now")
    safe_class = _safe_error_class(error_class)
    terminal = lease.attempt_count >= lease.max_attempts
    values: dict[str, Any] = {
        "status": "not_sent" if terminal else "pending",
        "rendered_intent": None,
        "not_sent_reason": f"render_error:{safe_class}" if terminal else None,
        "lease_token": None,
        "lease_expires_at": None,
        "updated_at": normalized_now,
    }
    if not terminal:
        delay = min(300, 30 * (2 ** (lease.attempt_count - 1)))
        values["available_at"] = normalized_now + timedelta(seconds=delay)
    return (
        update(AlertDeliveryIntent)
        .execution_options(synchronize_session=False)
        .where(*_owned_lease_predicates(lease, normalized_now))
        .values(**values)
        .returning(AlertDeliveryIntent.id)
    )


async def _mark_exhausted(db: AsyncSession, now: datetime) -> None:
    await db.execute(
        update(AlertDeliveryIntent)
        .execution_options(synchronize_session=False)
        .where(
            _eligible(now),
            AlertDeliveryIntent.attempt_count >= AlertDeliveryIntent.max_attempts,
        )
        .values(
            status="not_sent",
            rendered_intent=None,
            not_sent_reason="retry_exhausted",
            lease_token=None,
            lease_expires_at=None,
            updated_at=now,
        )
    )


async def _claim_id_sqlite(
    db: AsyncSession, *, now: datetime, token: str, expires_at: datetime
) -> str | None:
    candidate_id = (
        select(AlertDeliveryIntent.id)
        .where(
            _eligible(now),
            AlertDeliveryIntent.attempt_count < AlertDeliveryIntent.max_attempts,
        )
        .order_by(
            AlertDeliveryIntent.available_at,
            AlertDeliveryIntent.created_at,
            AlertDeliveryIntent.id,
        )
        .limit(1)
        .scalar_subquery()
    )
    return await db.scalar(
        update(AlertDeliveryIntent)
        .execution_options(synchronize_session=False)
        .where(
            AlertDeliveryIntent.id == candidate_id,
            _eligible(now),
            AlertDeliveryIntent.attempt_count < AlertDeliveryIntent.max_attempts,
        )
        .values(
            status="leased",
            attempt_count=AlertDeliveryIntent.attempt_count + 1,
            lease_token=token,
            lease_expires_at=expires_at,
            rendered_intent=None,
            not_sent_reason=None,
            updated_at=now,
        )
        .returning(AlertDeliveryIntent.id)
    )


async def _load_lease(
    db: AsyncSession,
    intent_id: str,
    *,
    token: str,
    expires_at: datetime,
) -> DeliveryLease:
    row = (
        await db.execute(
            select(AlertDeliveryIntent, AlertEvent)
            .join(AlertEvent, AlertEvent.id == AlertDeliveryIntent.alert_event_id)
            .where(AlertDeliveryIntent.id == intent_id)
            .execution_options(populate_existing=True)
        )
    ).one()
    intent, event = row
    key = sink_idempotency_key(
        intent.alert_event_context_id, intent.channel, intent.destination_ref
    )
    envelope = DeliveryEnvelope(
        intent_id=UUID(intent.id),
        alert_event_id=intent.alert_event_id,
        alert_event_context_id=UUID(intent.alert_event_context_id),
        channel=intent.channel,
        destination_ref=intent.destination_ref,
        idempotency_key=key,
        attempt_count=intent.attempt_count,
        correlation_root_id=UUID(intent.correlation_root_id),
        kind=event.kind,
        title=event.title,
        impact=event.impact,
        evidence=event.evidence,
        authority=event.authority,
    )
    return DeliveryLease(
        intent_id=UUID(intent.id),
        lease_token=UUID(token),
        lease_expires_at=expires_at,
        channel=intent.channel,
        destination_ref=intent.destination_ref,
        idempotency_key=key,
        attempt_count=intent.attempt_count,
        max_attempts=intent.max_attempts,
        correlation_root_id=UUID(intent.correlation_root_id),
        envelope=envelope,
    )


async def claim_delivery_intent(
    db: AsyncSession, *, now: datetime
) -> DeliveryLease | None:
    """Claim one eligible row in the caller's transaction without committing."""
    normalized_now = _aware_utc(now, label="now")
    await _mark_exhausted(db, normalized_now)
    token = str(uuid4())
    expires_at = normalized_now + _LEASE_DURATION
    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        selected = await db.scalar(delivery_claim_select(normalized_now))
        if selected is None:
            return None
        intent_id = await db.scalar(
            delivery_claim_update_statement(
                selected.id,
                now=normalized_now,
                token=token,
                expires_at=expires_at,
            )
        )
    elif dialect == "sqlite":
        intent_id = await _claim_id_sqlite(
            db, now=normalized_now, token=token, expires_at=expires_at
        )
    else:
        raise ValueError("unsupported_database")
    if intent_id is None:
        return None
    return await _load_lease(db, intent_id, token=token, expires_at=expires_at)


def _validate_sink_intent(
    lease: DeliveryLease,
    result: SinkIntent,
    intent: AlertDeliveryIntent | None = None,
) -> None:
    if not isinstance(result, SinkIntent) or (
        result.channel != lease.channel
        or result.destination_ref != lease.destination_ref
        or result.idempotency_key != lease.idempotency_key
        or result.status not in {"rendered_intent", "not_sent"}
    ):
        raise ValueError("sink intent does not match the owned delivery lease")
    if intent is not None:
        expected_key = sink_idempotency_key(
            intent.alert_event_context_id,
            intent.channel,
            intent.destination_ref,
        )
        if any(
            (
                lease.channel != intent.channel,
                lease.destination_ref != intent.destination_ref,
                lease.idempotency_key != expected_key,
                lease.attempt_count != intent.attempt_count,
                lease.max_attempts != intent.max_attempts,
                str(lease.correlation_root_id) != intent.correlation_root_id,
                result.channel != intent.channel,
                result.destination_ref != intent.destination_ref,
                result.idempotency_key != expected_key,
            )
        ):
            raise ValueError("sink intent does not match the persisted delivery lease")


async def complete_delivery_intent(
    db: AsyncSession,
    lease: DeliveryLease,
    result: SinkIntent,
    *,
    now: datetime,
) -> bool:
    """Persist an owned terminal render result without committing."""
    normalized_now = _aware_utc(now, label="now")
    intent = await db.scalar(
        select(AlertDeliveryIntent).where(
            AlertDeliveryIntent.id == str(lease.intent_id),
            AlertDeliveryIntent.status == "leased",
            AlertDeliveryIntent.lease_token == str(lease.lease_token),
            AlertDeliveryIntent.lease_expires_at > normalized_now,
        )
    )
    if intent is None:
        return False
    _validate_sink_intent(lease, result, intent)
    completed_id = await db.scalar(
        delivery_completion_update_statement(
            lease,
            result,
            now=normalized_now,
        )
    )
    return completed_id is not None


def _safe_error_class(value: str) -> str:
    return (
        value
        if isinstance(value, str) and _MACHINE_ERROR.fullmatch(value)
        else "render_error"
    )


async def record_delivery_failure(
    db: AsyncSession,
    lease: DeliveryLease,
    *,
    now: datetime,
    error_class: str,
) -> bool:
    """Release an owned attempt to retry or terminal not-sent state."""
    normalized_now = _aware_utc(now, label="now")
    released_id = await db.scalar(
        delivery_failure_update_statement(
            lease,
            now=normalized_now,
            error_class=error_class,
        )
    )
    return released_id is not None


def _registry_sink(registry: SinkRegistry, lease: DeliveryLease) -> AlertSink | None:
    sink = registry.get((lease.channel, lease.destination_ref))
    if sink is None:
        sink = registry.get(lease.channel)
    return sink if isinstance(sink, AlertSink) else None


async def dispatch_once(
    session_factory: AsyncSessionFactory,
    sink_registry: SinkRegistry,
    clock: Callable[[], datetime],
) -> SinkResult | None:
    """Claim, render outside storage, then conditionally finish in two transactions."""
    claim_now = _aware_utc(clock(), label="clock")
    try:
        async with session_factory() as db:
            async with db.begin():
                lease = await claim_delivery_intent(db, now=claim_now)
    except OperationalError as exc:
        if getattr(exc.orig, "sqlite_errorcode", None) not in {5, 6, 517}:
            raise
        return None
    if lease is None:
        return None

    sink = _registry_sink(sink_registry, lease)
    error_class: str | None = None
    rendered: SinkIntent | None = None
    if sink is None:
        error_class = "missing_sink"
    else:
        try:
            rendered = sink.render(lease.envelope)
            _validate_sink_intent(lease, rendered)
        except Exception as exc:  # Renderer failures cross only as their class.
            error_class = _safe_error_class(type(exc).__name__)

    finish_now = _aware_utc(clock(), label="clock")
    async with session_factory() as db:
        async with db.begin():
            if rendered is not None:
                completed = await complete_delivery_intent(
                    db, lease, rendered, now=finish_now
                )
            else:
                completed = await record_delivery_failure(
                    db,
                    lease,
                    now=finish_now,
                    error_class=error_class or "render_error",
                )
    if rendered is not None and completed:
        return SinkResult(
            channel=lease.channel,
            status=rendered.status,
            intent_id=lease.intent_id,
            attempt_count=lease.attempt_count,
        )
    return SinkResult(
        channel=lease.channel,
        status="not_sent",
        intent_id=lease.intent_id,
        attempt_count=lease.attempt_count,
        error_class=error_class or "lease_lost",
    )


__all__ = [
    "AsyncSessionFactory",
    "DeliveryLease",
    "MaterializationError",
    "MaterializedAlert",
    "SinkRegistry",
    "UNRECOVERABLE_EVIDENCE_FIELDS",
    "alert_context_upsert_statement",
    "alert_event_upsert_statement",
    "alert_intent_upsert_statement",
    "claim_delivery_intent",
    "complete_delivery_intent",
    "delivery_claim_update_statement",
    "delivery_claim_select",
    "delivery_completion_update_statement",
    "delivery_failure_update_statement",
    "dispatch_once",
    "materialize_alert",
    "record_delivery_failure",
]
