"""Durable, externally invoked C3 run and scheduled alert triggers.

This module deliberately owns no timer or network client.  Callers invoke the
completed-run seam after its terminal commit, or invoke ``evaluate_scheduled_rule``
from an external scheduler.  Durable ``WatchRule`` fields remain the sole claim
authority.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import UUID, uuid4

from sqlalchemy import Select, Update, and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from alert_contracts import AsyncSessionFactory, EvaluationTrigger, SignalObservation, SubjectScope
from alert_dispatch import materialize_alert
from alert_evaluation import claim_rule_evaluation, evaluate_rule
from alert_sinks import EmailSink, InAppSink
from config import get_settings
from database import (
    AlertEventContext,
    AsyncSessionLocal,
    Issuer,
    Portfolio,
    PortfolioPosition,
    QAFinding,
    Run,
    WatchRule,
    WatchRuleVersion,
)
from tenancy import tenancy_enabled
from watch_rules import (
    SHARED_TEAM_ID,
    SHARED_TENANT_ID,
    UNASSIGNED_TEAM_ID,
    UNASSIGNED_TENANT_ID,
)


logger = logging.getLogger("caos.alert_triggers")

SCHEDULE_CLAIM_DURATION = timedelta(minutes=5)
SCHEDULE_FAILURE_BACKOFF_SECONDS = (60, 120, 240, 480)
APPROVED_TRIGGER_SINKS = (
    EmailSink(destination_ref="owner-email-route", max_attempts=5),
    InAppSink(destination_ref="monitor-inbox", max_attempts=3),
)
_RUN_SIGNAL_TYPES = frozenset({"qa_gate", "run_finding"})
_UNAVAILABLE_SCHEDULED_SIGNALS = frozenset(
    {"edgar_filing", "market_move", "news"}
)
_CURSOR_UNCHANGED = object()
_RESERVED_TENANT_IDS = frozenset({SHARED_TENANT_ID, UNASSIGNED_TENANT_ID})
_RESERVED_TEAM_IDS = frozenset({SHARED_TEAM_ID, UNASSIGNED_TEAM_ID})
_COMPLETED_RUN_CURSOR_VERSION = 1
_MAX_RECONCILE_PAGE_SIZE = 500


def _now() -> datetime:
    return datetime.now(timezone.utc)


Clock = Callable[[], datetime]


class _ScheduleLeaseLost(RuntimeError):
    pass


class AlertRulesReconciliationDisabled(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class ScheduledRuleClaim:
    rule_id: UUID
    claim_token: UUID
    claim_expires_at: datetime
    scheduled_for: datetime
    schedule_kind: Literal["interval", "edgar"]
    schedule_interval_seconds: int
    signal_type: str
    rule_version: int
    attempt_count: int


@dataclass(frozen=True, slots=True)
class ScheduledEvaluationResult:
    status: Literal[
        "no_claim",
        "completed",
        "failed",
        "source_unavailable",
        "invalid_trigger",
        "missing_observation",
        "lease_lost",
    ]
    rule_id: UUID | None = None
    outcome: Literal["matched", "ignored", "rejected"] | None = None


@dataclass(frozen=True, slots=True)
class RunTriggerResult:
    status: Literal["not_committed", "not_complete", "evaluated"]
    observations: int = 0
    materialized: int = 0
    failures: int = 0


@dataclass(frozen=True, slots=True)
class CompletedRunReconcileResult:
    scanned: int
    observations: int
    materialized: int
    failures: int
    next_cursor: str | None


@dataclass(frozen=True, slots=True)
class _CompletedRunCursor:
    completed_at: datetime
    run_id: str


@dataclass(frozen=True, slots=True)
class _RunSnapshot:
    run_id: str
    issuer_id: str
    portfolio_id: str | None
    qa_status: str
    observed_at: datetime


@dataclass(frozen=True, slots=True)
class _FindingSnapshot:
    row_id: str
    finding_id: str
    severity: str
    module_id: str | None
    lane: int | None
    affected_claim_id: str | None


@dataclass(frozen=True, slots=True)
class _RunObservationBatch:
    observations: tuple[SignalObservation, ...]
    failures: int = 0


def _aware_utc(value: datetime, *, label: str) -> datetime:
    if not isinstance(value, datetime) or value.tzinfo is None:
        raise ValueError(f"{label} must be timezone-aware")
    return value.astimezone(timezone.utc)


def _persisted_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _encode_completed_run_cursor(cursor: _CompletedRunCursor) -> str:
    payload = json.dumps(
        {
            "at": cursor.completed_at.astimezone(timezone.utc).isoformat(),
            "id": cursor.run_id,
            "v": _COMPLETED_RUN_CURSOR_VERSION,
        },
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return base64.urlsafe_b64encode(payload).decode("ascii").rstrip("=")


def _decode_completed_run_cursor(value: str | None) -> _CompletedRunCursor | None:
    if value is None:
        return None
    try:
        if not isinstance(value, str) or not value or len(value) > 2048:
            raise ValueError
        padded = value + "=" * (-len(value) % 4)
        decoded = base64.b64decode(
            padded.encode("ascii"), altchars=b"-_", validate=True
        )
        payload = json.loads(decoded.decode("utf-8"))
        if not isinstance(payload, dict) or set(payload) != {"at", "id", "v"}:
            raise ValueError
        if (
            isinstance(payload["v"], bool)
            or not isinstance(payload["v"], int)
            or payload["v"] != _COMPLETED_RUN_CURSOR_VERSION
        ):
            raise ValueError
        run_id = payload["id"]
        if not isinstance(run_id, str) or not run_id or len(run_id) > 255:
            raise ValueError
        completed_at = datetime.fromisoformat(payload["at"])
        completed_at = _aware_utc(completed_at, label="cursor timestamp")
    except (TypeError, ValueError, UnicodeError):
        raise ValueError("invalid reconciliation cursor") from None
    return _CompletedRunCursor(completed_at=completed_at, run_id=run_id)


def _validate_reconcile_limit(limit: int) -> int:
    if (
        isinstance(limit, bool)
        or not isinstance(limit, int)
        or not 1 <= limit <= _MAX_RECONCILE_PAGE_SIZE
    ):
        raise ValueError(
            f"reconciliation limit must be between 1 and {_MAX_RECONCILE_PAGE_SIZE}"
        )
    return limit


def _rule_id(value: UUID | str | None) -> str | None:
    if value is None:
        return None
    return str(UUID(str(value)))


def _eligible_schedule_claim(now: datetime):
    return and_(
        WatchRule.enabled.is_(True),
        WatchRule.paused.is_(False),
        WatchRule.schedule_kind.in_(("interval", "edgar")),
        WatchRule.next_evaluation_at <= now,
        WatchRule.claim_attempt_count < 5,
        or_(
            WatchRule.claim_token.is_(None),
            WatchRule.claim_expires_at <= now,
        ),
    )


def _expired_fifth_claim(now: datetime):
    return and_(
        WatchRule.enabled.is_(True),
        WatchRule.paused.is_(False),
        WatchRule.schedule_kind.in_(("interval", "edgar")),
        WatchRule.claim_attempt_count == 5,
        WatchRule.claim_token.is_not(None),
        WatchRule.claim_expires_at <= now,
    )


def schedule_reap_update_statement(
    now: datetime, *, rule_id: UUID | str | None = None
) -> Update:
    """Build the atomic terminal transition for an expired fifth lease."""
    normalized_now = _aware_utc(now, label="now")
    candidate = (
        select(WatchRule.id)
        .where(_expired_fifth_claim(normalized_now))
        .order_by(WatchRule.claim_expires_at, WatchRule.id)
        .limit(1)
        .with_for_update(skip_locked=True)
    )
    normalized_rule_id = _rule_id(rule_id)
    if normalized_rule_id is not None:
        candidate = candidate.where(WatchRule.id == normalized_rule_id)
    return (
        update(WatchRule)
        .where(
            WatchRule.id == candidate.scalar_subquery(),
            _expired_fifth_claim(normalized_now),
        )
        .values(
            paused=True,
            next_evaluation_at=None,
            claim_token=None,
            claim_expires_at=None,
            last_evaluated_at=normalized_now,
            updated_at=normalized_now,
        )
        .returning(WatchRule.id)
    )


async def reap_expired_fifth_claim(
    db: AsyncSession,
    *,
    now: datetime,
    rule_id: UUID | str | None = None,
) -> UUID | None:
    """Pause one expired attempt-five row without committing the transaction."""
    reaped_id = await db.scalar(
        schedule_reap_update_statement(now, rule_id=rule_id)
    )
    return UUID(str(reaped_id)) if reaped_id is not None else None


def schedule_claim_select(
    now: datetime, *, rule_id: UUID | str | None = None
) -> Select:
    """Select the earliest eligible durable schedule row with a PG skip lock."""
    normalized_now = _aware_utc(now, label="now")
    statement = (
        select(WatchRule.id)
        .where(_eligible_schedule_claim(normalized_now))
        .order_by(WatchRule.next_evaluation_at, WatchRule.id)
        .limit(1)
        .with_for_update(skip_locked=True)
    )
    normalized_rule_id = _rule_id(rule_id)
    if normalized_rule_id is not None:
        statement = statement.where(WatchRule.id == normalized_rule_id)
    return statement


def schedule_claim_update_statement(
    now: datetime,
    *,
    claim_token: UUID,
    rule_id: UUID | str | None = None,
) -> Update:
    """Build the single conditional UPDATE that owns a scheduled lease."""
    normalized_now = _aware_utc(now, label="now")
    token = UUID(str(claim_token))
    candidate = schedule_claim_select(
        normalized_now, rule_id=rule_id
    ).scalar_subquery()
    return (
        update(WatchRule)
        .where(
            WatchRule.id == candidate,
            _eligible_schedule_claim(normalized_now),
        )
        .values(
            claim_token=str(token),
            claim_expires_at=normalized_now + SCHEDULE_CLAIM_DURATION,
            claim_attempt_count=WatchRule.claim_attempt_count + 1,
            updated_at=normalized_now,
        )
        .returning(
            WatchRule.id,
            WatchRule.claim_token,
            WatchRule.claim_expires_at,
            WatchRule.next_evaluation_at,
            WatchRule.schedule_kind,
            WatchRule.schedule_interval_seconds,
            WatchRule.signal_type,
            WatchRule.current_version,
            WatchRule.claim_attempt_count,
        )
    )


async def claim_scheduled_rule(
    db: AsyncSession,
    *,
    now: datetime,
    rule_id: UUID | str | None = None,
) -> ScheduledRuleClaim | None:
    """Claim one due schedule row without committing the caller's transaction."""
    reaped_id = await reap_expired_fifth_claim(db, now=now, rule_id=rule_id)
    if reaped_id is not None and rule_id is not None:
        return None
    token = uuid4()
    result = await db.execute(
        schedule_claim_update_statement(now, claim_token=token, rule_id=rule_id)
    )
    row = result.mappings().one_or_none()
    if row is None:
        return None
    interval = row["schedule_interval_seconds"]
    scheduled_for = row["next_evaluation_at"]
    if interval is None or scheduled_for is None:
        raise RuntimeError("claimed schedule row is missing its durable cadence")
    return ScheduledRuleClaim(
        rule_id=UUID(str(row["id"])),
        claim_token=UUID(str(row["claim_token"])),
        claim_expires_at=_persisted_utc(row["claim_expires_at"]),
        scheduled_for=_persisted_utc(scheduled_for),
        schedule_kind=row["schedule_kind"],
        schedule_interval_seconds=interval,
        signal_type=row["signal_type"],
        rule_version=row["current_version"],
        attempt_count=row["claim_attempt_count"],
    )


def _bounded_cursor(cursor: object) -> str | None | object:
    if cursor is _CURSOR_UNCHANGED:
        return cursor
    if cursor is None:
        return None
    if not isinstance(cursor, str):
        raise TypeError("cursor must be a string, null, or omitted")
    try:
        size = len(cursor.encode("utf-8"))
    except UnicodeEncodeError as exc:
        raise ValueError("cursor must be valid UTF-8") from exc
    if size > 512:
        raise ValueError("cursor exceeds 512 UTF-8 bytes")
    return cursor


def _cursor_values(cursor: object) -> dict[str, object]:
    bounded = _bounded_cursor(cursor)
    if bounded is _CURSOR_UNCHANGED:
        return {}
    return {"schedule_cursor": bounded}


def _next_interval_slot(claim: ScheduledRuleClaim, now: datetime) -> datetime:
    base = claim.scheduled_for
    interval = timedelta(seconds=claim.schedule_interval_seconds)
    if base > now:
        return base
    elapsed = now - base
    elapsed_microseconds = (
        (elapsed.days * 86_400 + elapsed.seconds) * 1_000_000
        + elapsed.microseconds
    )
    interval_microseconds = claim.schedule_interval_seconds * 1_000_000
    slots = elapsed_microseconds // interval_microseconds + 1
    try:
        future = base + slots * interval
    except OverflowError as exc:
        raise OverflowError("no representable future interval slot") from exc
    if future <= now:
        raise OverflowError("no representable future interval slot")
    return future


def _owned_claim_predicates(claim: ScheduledRuleClaim, now: datetime) -> tuple:
    return (
        WatchRule.id == str(claim.rule_id),
        WatchRule.claim_token == str(claim.claim_token),
        WatchRule.claim_expires_at > now,
        WatchRule.claim_attempt_count == claim.attempt_count,
    )


async def _lock_owned_scheduled_claim(
    db: AsyncSession,
    claim: ScheduledRuleClaim,
    *,
    now: datetime,
) -> bool:
    """Fence side effects behind the current unexpired durable lease.

    The conditional no-op update acquires a write lock until the caller's
    transaction ends on PostgreSQL and SQLite. Rechecking it after materializing
    also rolls the transaction back if the lease expired while work ran.
    """
    normalized_now = _aware_utc(now, label="now")
    owned_id = await db.scalar(
        update(WatchRule)
        .where(*_owned_claim_predicates(claim, normalized_now))
        .values(claim_token=WatchRule.claim_token)
        .returning(WatchRule.id)
    )
    return owned_id is not None


def _clock_now(clock: Clock) -> datetime:
    return _aware_utc(clock(), label="clock result")


async def complete_scheduled_rule(
    db: AsyncSession,
    claim: ScheduledRuleClaim,
    *,
    now: datetime,
    cursor: str | None | object = _CURSOR_UNCHANGED,
) -> bool:
    """Complete an owned unexpired lease and advance past all missed slots."""
    normalized_now = _aware_utc(now, label="now")
    values: dict[str, object] = {
        "last_evaluated_at": normalized_now,
        "next_evaluation_at": _next_interval_slot(claim, normalized_now),
        "claim_token": None,
        "claim_expires_at": None,
        "claim_attempt_count": 0,
        "updated_at": normalized_now,
        **_cursor_values(cursor),
    }
    completed_id = await db.scalar(
        update(WatchRule)
        .where(*_owned_claim_predicates(claim, normalized_now))
        .values(**values)
        .returning(WatchRule.id)
    )
    return completed_id is not None


async def fail_scheduled_rule(
    db: AsyncSession,
    claim: ScheduledRuleClaim,
    *,
    now: datetime,
    cursor: str | None | object = _CURSOR_UNCHANGED,
) -> bool:
    """Release an owned lease with persisted backoff or pause attempt five."""
    normalized_now = _aware_utc(now, label="now")
    if not 1 <= claim.attempt_count <= 5:
        raise ValueError("claim attempt_count must be 1..5")
    values: dict[str, object] = {
        "last_evaluated_at": normalized_now,
        "claim_token": None,
        "claim_expires_at": None,
        "updated_at": normalized_now,
        **_cursor_values(cursor),
    }
    if claim.attempt_count == 5:
        values.update(paused=True, next_evaluation_at=None)
    else:
        delay = SCHEDULE_FAILURE_BACKOFF_SECONDS[claim.attempt_count - 1]
        try:
            values["next_evaluation_at"] = normalized_now + timedelta(seconds=delay)
        except OverflowError:
            values.update(paused=True, next_evaluation_at=None)
    failed_id = await db.scalar(
        update(WatchRule)
        .where(*_owned_claim_predicates(claim, normalized_now))
        .values(**values)
        .returning(WatchRule.id)
    )
    return failed_id is not None


async def _finish_schedule_failure(
    session_factory: AsyncSessionFactory,
    claim: ScheduledRuleClaim,
    *,
    now: datetime,
    cursor: object,
) -> bool:
    async with session_factory() as db:
        async with db.begin():
            if await fail_scheduled_rule(db, claim, now=now, cursor=cursor):
                return True
            if claim.attempt_count != 5:
                return False
            reaped = await reap_expired_fifth_claim(
                db, now=now, rule_id=claim.rule_id
            )
            return reaped == claim.rule_id


async def evaluate_scheduled_rule(
    *,
    session_factory: AsyncSessionFactory = AsyncSessionLocal,
    now: datetime,
    clock: Clock = _now,
    rule_id: UUID | str | None = None,
    trigger_kind: Literal["scheduled_edgar", "scheduled_watchlist"] | None = None,
    observation: SignalObservation | None = None,
    cursor: str | None | object = _CURSOR_UNCHANGED,
) -> ScheduledEvaluationResult:
    """Claim and evaluate one schedule tick without transport or source I/O."""
    if not get_settings().caos_alert_rules_v1_enabled:
        return ScheduledEvaluationResult(status="no_claim")
    normalized_now = _aware_utc(now, label="now")
    _bounded_cursor(cursor)
    async with session_factory() as claim_db:
        async with claim_db.begin():
            claim = await claim_scheduled_rule(
                claim_db, now=normalized_now, rule_id=rule_id
            )
    if claim is None:
        return ScheduledEvaluationResult(status="no_claim")

    expected_kind = (
        "scheduled_edgar"
        if claim.schedule_kind == "edgar"
        else "scheduled_watchlist"
    )
    if trigger_kind is not None and trigger_kind != expected_kind:
        owned = await _finish_schedule_failure(
            session_factory, claim, now=_clock_now(clock), cursor=cursor
        )
        return ScheduledEvaluationResult(
            status="invalid_trigger" if owned else "lease_lost",
            rule_id=claim.rule_id,
        )
    if claim.signal_type in _UNAVAILABLE_SCHEDULED_SIGNALS:
        owned = await _finish_schedule_failure(
            session_factory, claim, now=_clock_now(clock), cursor=cursor
        )
        return ScheduledEvaluationResult(
            status="source_unavailable" if owned else "lease_lost",
            rule_id=claim.rule_id,
        )
    if observation is None:
        owned = await _finish_schedule_failure(
            session_factory, claim, now=_clock_now(clock), cursor=cursor
        )
        return ScheduledEvaluationResult(
            status="missing_observation" if owned else "lease_lost",
            rule_id=claim.rule_id,
        )

    outcome: Literal["matched", "ignored", "rejected"]
    try:
        async with session_factory() as evaluation_db:
            async with evaluation_db.begin():
                evaluation_now = _clock_now(clock)
                if not await _lock_owned_scheduled_claim(
                    evaluation_db, claim, now=evaluation_now
                ):
                    raise _ScheduleLeaseLost
                trigger = EvaluationTrigger(
                    trigger_kind=expected_kind,
                    trigger_identity=observation.source_identity,
                    watch_rule_id=claim.rule_id,
                    rule_version=claim.rule_version,
                    occurred_at=evaluation_now,
                    scheduled_for=claim.scheduled_for,
                    correlation_id=observation.correlation_id,
                    correlation_root_id=observation.correlation_root_id,
                    hop_count=observation.hop_count,
                )
                evaluation_claim = await claim_rule_evaluation(
                    evaluation_db, trigger, observation
                )
                if not evaluation_claim.created:
                    if evaluation_claim.evaluation.outcome not in {
                        "matched",
                        "ignored",
                        "rejected",
                    }:
                        raise RuntimeError("existing evaluation is incomplete")
                    outcome = evaluation_claim.evaluation.outcome
                    if outcome == "matched":
                        context = await evaluation_db.scalar(
                            select(AlertEventContext.id).where(
                                AlertEventContext.watch_rule_evaluation_id
                                == evaluation_claim.evaluation.id
                            )
                        )
                        if context is None:
                            raise RuntimeError("matched evaluation has no alert context")
                else:
                    version = await evaluation_db.scalar(
                        select(WatchRuleVersion).where(
                            WatchRuleVersion.watch_rule_id == str(claim.rule_id),
                            WatchRuleVersion.version == claim.rule_version,
                        )
                    )
                    if version is None:
                        raise RuntimeError("claimed rule version vanished")
                    decision = evaluate_rule(
                        version,
                        observation,
                        evaluation_id=UUID(evaluation_claim.evaluation.id),
                    )
                    outcome = decision.outcome
                    if decision.candidate is None:
                        evaluation_claim.evaluation.outcome = outcome
                    else:
                        await materialize_alert(
                            evaluation_db,
                            decision.candidate,
                            APPROVED_TRIGGER_SINKS,
                            now=evaluation_now,
                        )
                if not await _lock_owned_scheduled_claim(
                    evaluation_db, claim, now=_clock_now(clock)
                ):
                    raise _ScheduleLeaseLost
    except _ScheduleLeaseLost:
        owned = await _finish_schedule_failure(
            session_factory, claim, now=_clock_now(clock), cursor=cursor
        )
        return ScheduledEvaluationResult(
            status="failed" if owned else "lease_lost", rule_id=claim.rule_id
        )
    except Exception:  # noqa: BLE001 - rollback, then persist only safe retry state
        logger.warning(
            "scheduled alert evaluation failed rule_id=%s trigger_kind=%s status=failed",
            claim.rule_id,
            expected_kind,
        )
        owned = await _finish_schedule_failure(
            session_factory, claim, now=_clock_now(clock), cursor=cursor
        )
        return ScheduledEvaluationResult(
            status="failed" if owned else "lease_lost", rule_id=claim.rule_id
        )

    try:
        async with session_factory() as completion_db:
            async with completion_db.begin():
                owned = await complete_scheduled_rule(
                    completion_db, claim, now=_clock_now(clock), cursor=cursor
                )
    except Exception:  # noqa: BLE001 - convert completion faults into durable retry
        logger.warning(
            "scheduled alert completion failed rule_id=%s "
            "trigger_kind=%s status=failed",
            claim.rule_id,
            expected_kind,
        )
        owned = await _finish_schedule_failure(
            session_factory, claim, now=_clock_now(clock), cursor=cursor
        )
        return ScheduledEvaluationResult(
            status="failed" if owned else "lease_lost", rule_id=claim.rule_id
        )
    return ScheduledEvaluationResult(
        status="completed" if owned else "lease_lost",
        rule_id=claim.rule_id,
        outcome=outcome,
    )


def _rule_resource_visibility(
    *,
    issuer_team_id: str | None,
    portfolio_team_id: str | None,
    portfolio_position_exists: bool,
):
    """Apply the same persisted rule-snapshot modes as materialization.

    The rule's immutable tenant/team stamps are the principal. Current resource
    rows only answer whether that principal may see the run; they never supply or
    rewrite the principal, and mutable Analyst membership is intentionally absent.
    """
    unscoped_portfolio = WatchRule.portfolio_id.is_(None)
    scoped_portfolio_exists = and_(
        WatchRule.portfolio_id.is_not(None), portfolio_position_exists
    )
    shared = and_(
        WatchRule.tenant_id == SHARED_TENANT_ID,
        WatchRule.team_id_snapshot == SHARED_TEAM_ID,
        or_(unscoped_portfolio, scoped_portfolio_exists),
    )
    unassigned = and_(
        WatchRule.tenant_id == UNASSIGNED_TENANT_ID,
        WatchRule.team_id_snapshot == UNASSIGNED_TEAM_ID,
        issuer_team_id is None,
        or_(
            unscoped_portfolio,
            and_(scoped_portfolio_exists, portfolio_team_id is None),
        ),
    )
    named = and_(
        WatchRule.tenant_id == WatchRule.team_id_snapshot,
        ~WatchRule.tenant_id.in_(tuple(_RESERVED_TENANT_IDS)),
        ~WatchRule.team_id_snapshot.in_(tuple(_RESERVED_TEAM_IDS)),
        or_(issuer_team_id is None, WatchRule.team_id_snapshot == issuer_team_id),
        or_(
            unscoped_portfolio,
            and_(
                scoped_portfolio_exists,
                WatchRule.team_id_snapshot == portfolio_team_id,
            ),
        ),
    )
    return or_(shared, unassigned, named)


async def _completed_run_snapshot(
    session_factory: AsyncSessionFactory, run_id: str
) -> tuple[_RunSnapshot | None, list[WatchRule], tuple[_FindingSnapshot, ...]]:
    async with session_factory() as db:
        run = await db.get(Run, run_id)
        if run is None:
            return None, [], ()
        if run.status != "complete":
            observed_at = run.completed_at or run.created_at
            return (
                _RunSnapshot(
                    run_id=run.id,
                    issuer_id=run.issuer_id,
                    portfolio_id=run.portfolio_id,
                    qa_status=run.qa_status,
                    observed_at=_persisted_utc(observed_at),
                ),
                [],
                (),
            )
        observed_at = run.completed_at or run.created_at
        issuer = await db.scalar(
            select(Issuer).where(
                Issuer.id == run.issuer_id,
                Issuer.created_at <= observed_at,
            )
        )
        if issuer is None:
            return (
                _RunSnapshot(
                    run_id=run.id,
                    issuer_id=run.issuer_id,
                    portfolio_id=run.portfolio_id,
                    qa_status=run.qa_status,
                    observed_at=_persisted_utc(observed_at),
                ),
                [],
                (),
            )
        portfolio = None
        if run.portfolio_id is not None:
            portfolio = await db.scalar(
                select(Portfolio).where(
                    Portfolio.id == run.portfolio_id,
                    Portfolio.created_at <= observed_at,
                    Portfolio.updated_at <= observed_at,
                )
            )
        portfolio_position_exists = False
        if portfolio is not None:
            portfolio_position_exists = (
                await db.scalar(
                    select(PortfolioPosition.id)
                    .where(
                        PortfolioPosition.portfolio_id == portfolio.id,
                        PortfolioPosition.issuer_id == run.issuer_id,
                        PortfolioPosition.created_at <= observed_at,
                    )
                    .limit(1)
                )
                is not None
            )
        if tenancy_enabled():
            visibility = _rule_resource_visibility(
                issuer_team_id=issuer.team_id,
                portfolio_team_id=(portfolio.team_id if portfolio is not None else None),
                portfolio_position_exists=portfolio_position_exists,
            )
        else:
            visibility = and_(
                WatchRule.tenant_id == SHARED_TENANT_ID,
                WatchRule.team_id_snapshot == SHARED_TEAM_ID,
                or_(WatchRule.portfolio_id.is_(None), portfolio_position_exists),
            )
        effective_version_exists = (
            select(WatchRuleVersion.id)
            .where(
                WatchRuleVersion.watch_rule_id == WatchRule.id,
                WatchRuleVersion.version == WatchRule.current_version,
                WatchRuleVersion.created_at <= observed_at,
            )
            .exists()
        )
        rules = list(
            (
                await db.execute(
                    select(WatchRule)
                    .where(
                        WatchRule.enabled.is_(True),
                        WatchRule.paused.is_(False),
                        WatchRule.schedule_kind == "event_driven",
                        WatchRule.signal_type.in_(tuple(_RUN_SIGNAL_TYPES)),
                        WatchRule.created_at <= observed_at,
                        WatchRule.updated_at <= observed_at,
                        effective_version_exists,
                        visibility,
                        or_(
                            WatchRule.issuer_id.is_(None),
                            WatchRule.issuer_id == run.issuer_id,
                        ),
                        or_(
                            WatchRule.portfolio_id.is_(None),
                            WatchRule.portfolio_id == run.portfolio_id,
                        ),
                    )
                    .order_by(WatchRule.id)
                )
            ).scalars()
        )
        findings = tuple(
            _FindingSnapshot(
                row_id=row.id,
                finding_id=row.finding_id,
                severity=row.severity,
                module_id=row.module_id,
                lane=row.lane,
                affected_claim_id=row.affected_claim_id,
            )
            for row in (
                (
                    await db.execute(
                        select(QAFinding)
                        .where(QAFinding.run_id == run.id)
                        .order_by(QAFinding.id)
                    )
                )
                .scalars()
                .all()
            )
        )
        return (
            _RunSnapshot(
                run_id=run.id,
                issuer_id=run.issuer_id,
                portfolio_id=run.portfolio_id,
                qa_status=run.qa_status,
                observed_at=_persisted_utc(observed_at),
            ),
            rules,
            findings,
        )


def _run_observations(
    run: _RunSnapshot,
    rule: WatchRule,
    findings: tuple[_FindingSnapshot, ...],
) -> _RunObservationBatch:
    scope = SubjectScope(
        tenant_id=rule.tenant_id,
        issuer_id=rule.issuer_id,
        portfolio_id=rule.portfolio_id,
    )
    if rule.signal_type == "qa_gate":
        source_identity = f"run:{run.run_id}:qa_gate"
        correlation = uuid4()
        return _RunObservationBatch(observations=(
            SignalObservation(
                signal_type="qa_gate",
                subject_scope=scope,
                source_identity=source_identity,
                observed_at=run.observed_at,
                categorical_value=run.qa_status,
                detail={"run_id": run.run_id, "qa_status": run.qa_status},
                source_artifact_refs=(f"run:{run.run_id}",),
                correlation_id=correlation,
                correlation_root_id=correlation,
                hop_count=0,
            ),
        ))
    observations: list[SignalObservation] = []
    failures = 0
    for finding in findings:
        try:
            source_identity = f"run:{run.run_id}:finding:{finding.row_id}"
            correlation = uuid4()
            observations.append(
                SignalObservation(
                    signal_type="run_finding",
                    subject_scope=scope,
                    source_identity=source_identity,
                    observed_at=run.observed_at,
                    categorical_value=finding.severity,
                    detail={
                        "run_id": run.run_id,
                        "finding_row_id": finding.row_id,
                        "finding_id": finding.finding_id,
                        "severity": finding.severity,
                        "module_id": finding.module_id,
                        "lane": finding.lane,
                        "affected_claim_id": finding.affected_claim_id,
                    },
                    source_artifact_refs=(
                        f"run:{run.run_id}",
                        f"qa_finding:{finding.row_id}",
                    ),
                    correlation_id=correlation,
                    correlation_root_id=correlation,
                    hop_count=0,
                )
            )
        except Exception:  # noqa: BLE001 - isolate one malformed finding
            failures += 1
            logger.warning(
                "completed-run observation construction failed "
                "run_id=%s rule_id=%s finding_row_id=%s status=failed",
                run.run_id,
                rule.id,
                finding.row_id,
            )
    return _RunObservationBatch(
        observations=tuple(observations),
        failures=failures,
    )


async def _evaluate_completed_run_observation(
    session_factory: AsyncSessionFactory,
    rule: WatchRule,
    observation: SignalObservation,
    *,
    now: datetime,
) -> bool:
    async with session_factory() as db:
        async with db.begin():
            trigger = EvaluationTrigger(
                trigger_kind="run_completed",
                trigger_identity=observation.source_identity,
                watch_rule_id=UUID(rule.id),
                rule_version=rule.current_version,
                occurred_at=observation.observed_at,
                scheduled_for=None,
                correlation_id=observation.correlation_id,
                correlation_root_id=observation.correlation_root_id,
                hop_count=observation.hop_count,
            )
            claim = await claim_rule_evaluation(db, trigger, observation)
            if not claim.created:
                if claim.evaluation.outcome == "matched":
                    context = await db.scalar(
                        select(AlertEventContext.id).where(
                            AlertEventContext.watch_rule_evaluation_id
                            == claim.evaluation.id
                        )
                    )
                    if context is None:
                        raise RuntimeError("matched evaluation has no alert context")
                elif claim.evaluation.outcome not in {"ignored", "rejected"}:
                    raise RuntimeError("existing evaluation is incomplete")
                return False
            version = await db.scalar(
                select(WatchRuleVersion).where(
                    WatchRuleVersion.watch_rule_id == rule.id,
                    WatchRuleVersion.version == rule.current_version,
                )
            )
            if version is None:
                raise RuntimeError("completed-run rule version vanished")
            decision = evaluate_rule(
                version, observation, evaluation_id=UUID(claim.evaluation.id)
            )
            if decision.candidate is None:
                claim.evaluation.outcome = decision.outcome
                return False
            await materialize_alert(
                db,
                decision.candidate,
                APPROVED_TRIGGER_SINKS,
                now=now,
            )
            return True


async def trigger_completed_run(
    run_id: str,
    *,
    session_factory: AsyncSessionFactory = AsyncSessionLocal,
) -> RunTriggerResult:
    """Evaluate committed governed outputs for matching event-driven rules."""
    if not get_settings().caos_alert_rules_v1_enabled:
        return RunTriggerResult(status="evaluated")
    run, rules, findings = await _completed_run_snapshot(session_factory, run_id)
    if run is None:
        return RunTriggerResult(status="not_committed")
    if not rules:
        async with session_factory() as db:
            persisted_status = await db.scalar(select(Run.status).where(Run.id == run_id))
        if persisted_status != "complete":
            return RunTriggerResult(status="not_complete")
        return RunTriggerResult(status="evaluated")

    observations = 0
    materialized = 0
    failures = 0
    for rule in rules:
        try:
            observation_batch = _run_observations(run, rule, findings)
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 - one rule must not stop later rules
            failures += 1
            logger.warning(
                "completed-run observation failed run_id=%s rule_id=%s "
                "signal_type=%s status=failed",
                run.run_id,
                rule.id,
                rule.signal_type,
            )
            continue
        failures += observation_batch.failures
        for observation in observation_batch.observations:
            observations += 1
            try:
                was_materialized = await _evaluate_completed_run_observation(
                    session_factory, rule, observation, now=run.observed_at
                )
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001 - one rule must not stop later rules
                failures += 1
                logger.warning(
                    "completed-run observation failed run_id=%s rule_id=%s "
                    "signal_type=%s status=failed",
                    run.run_id,
                    rule.id,
                    observation.signal_type,
                )
                continue
            if was_materialized:
                materialized += 1
    return RunTriggerResult(
        status="evaluated",
        observations=observations,
        materialized=materialized,
        failures=failures,
    )


async def reconcile_completed_runs(
    *,
    session_factory: AsyncSessionFactory = AsyncSessionLocal,
    limit: int = 100,
    cursor: str | None = None,
) -> CompletedRunReconcileResult:
    """Replay one bounded, cursor-ordered page of authoritative completed runs.

    The caller owns iteration and durable cursor storage. Replaying an input
    cursor is safe because ``trigger_completed_run`` claims evaluations by their
    governed observation identity before materialization. If ``failures`` is
    non-zero, retry the same input cursor; only advance to ``next_cursor`` after
    a clean page. A clean terminal page returns ``next_cursor=None``: recurring
    callers must retain the input cursor and intentionally replay that terminal
    page until a future durable high-water-mark protocol exists.
    """
    if not get_settings().caos_alert_rules_v1_enabled:
        raise AlertRulesReconciliationDisabled("alert rules are disabled")
    normalized_limit = _validate_reconcile_limit(limit)
    decoded_cursor = _decode_completed_run_cursor(cursor)

    completed_order = func.coalesce(Run.completed_at, Run.created_at)
    statement = select(
        Run.id,
        completed_order.label("completed_order"),
    ).where(Run.status == "complete")
    if decoded_cursor is not None:
        statement = statement.where(
            or_(
                completed_order > decoded_cursor.completed_at,
                and_(
                    completed_order == decoded_cursor.completed_at,
                    Run.id > decoded_cursor.run_id,
                ),
            )
        )
    statement = statement.order_by(completed_order, Run.id).limit(
        normalized_limit + 1
    )

    async with session_factory() as db:
        rows = (await db.execute(statement)).all()
    has_more = len(rows) > normalized_limit
    page = rows[:normalized_limit]

    observations = 0
    materialized = 0
    failures = 0
    for run_id, _completed_at in page:
        try:
            result = await trigger_completed_run(
                run_id,
                session_factory=session_factory,
            )
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 - continue the bounded recovery page
            failures += 1
            logger.warning(
                "completed-run reconciliation failed run_id=%s status=failed",
                run_id,
            )
            continue
        if result.status != "evaluated":
            failures += 1
            logger.warning(
                "completed-run reconciliation failed run_id=%s status=%s",
                run_id,
                result.status,
            )
            continue
        observations += result.observations
        materialized += result.materialized
        failures += result.failures

    next_cursor = None
    if failures == 0 and has_more and page:
        last_run_id, last_completed_at = page[-1]
        next_cursor = _encode_completed_run_cursor(
            _CompletedRunCursor(
                completed_at=_persisted_utc(last_completed_at),
                run_id=last_run_id,
            )
        )
    return CompletedRunReconcileResult(
        scanned=len(page),
        observations=observations,
        materialized=materialized,
        failures=failures,
        next_cursor=next_cursor,
    )


__all__ = [
    "APPROVED_TRIGGER_SINKS",
    "AlertRulesReconciliationDisabled",
    "CompletedRunReconcileResult",
    "RunTriggerResult",
    "SCHEDULE_CLAIM_DURATION",
    "SCHEDULE_FAILURE_BACKOFF_SECONDS",
    "ScheduledEvaluationResult",
    "ScheduledRuleClaim",
    "claim_scheduled_rule",
    "complete_scheduled_rule",
    "evaluate_scheduled_rule",
    "fail_scheduled_rule",
    "reconcile_completed_runs",
    "schedule_claim_select",
    "schedule_claim_update_statement",
    "trigger_completed_run",
]
