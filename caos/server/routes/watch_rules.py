"""Scoped HTTP API for durable C3 watch rules and manual evaluation."""

from __future__ import annotations

import base64
from datetime import datetime, timezone
import hashlib
import hmac
import json
from typing import Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)
from sqlalchemy import and_, exists, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from alert_contracts import (
    EvaluationTrigger,
    SignalObservation,
    SignalType,
    SubjectScope,
)
from alert_dispatch import MaterializationError, materialize_alert
from alert_evaluation import EvaluationClaimError, claim_rule_evaluation, evaluate_rule
from alert_sinks import EmailSink, InAppSink
from config import get_settings
from database import (
    AlertEventContext,
    Issuer,
    Portfolio,
    WatchRule,
    WatchRuleVersion,
    get_db,
)
from identity import CallerIdentity, get_identity, get_write_identity
from tenancy import tenancy_enabled
from watch_rules import (
    CreateWatchRuleCommand,
    RuleConfig,
    UpdateWatchRulePatch,
    WatchRuleConflictError,
    WatchRuleNotFoundError,
    WatchRuleValidationError,
    _require_visible_scopes,
    _scope_for_caller,
    create_watch_rule,
    update_watch_rule,
)


router = APIRouter()

_WRITE_LIMIT = 30
_EVALUATE_LIMIT = 12
_LIST_MAX = 100
_CURSOR_MAX = 2048
_CURSOR_VERSION = 1
_UNAVAILABLE_SIGNALS = frozenset({"edgar_filing", "market_move", "news"})
_APPROVED_SINKS = (
    EmailSink(destination_ref="owner-email-route", max_attempts=5),
    InAppSink(destination_ref="monitor-inbox", max_attempts=3),
)


class _StrictModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        frozen=True,
        strict=True,
        str_strip_whitespace=True,
    )


def _wire_datetime(value: object) -> object:
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return value
    return value


class CreateWatchRuleRequest(CreateWatchRuleCommand):
    @field_validator("next_evaluation_at", mode="before")
    @classmethod
    def _parse_next_evaluation_at(cls, value: object) -> object:
        return _wire_datetime(value)


class WatchRuleUpdateRequest(UpdateWatchRulePatch):
    @field_validator("next_evaluation_at", mode="before")
    @classmethod
    def _parse_next_evaluation_at(cls, value: object) -> object:
        return _wire_datetime(value)


class WatchRulePatchRequest(_StrictModel):
    expected_version: int = Field(ge=1)
    patch: WatchRuleUpdateRequest

    @field_validator("expected_version", mode="before")
    @classmethod
    def _reject_boolean_version(cls, value: object) -> object:
        if isinstance(value, bool):
            raise ValueError("expected_version must be a positive integer")
        return value

    @model_validator(mode="after")
    def _require_change(self) -> "WatchRulePatchRequest":
        if not self.patch.model_fields_set:
            raise ValueError("patch must contain at least one field")
        return self


class ManualEvaluationRequest(_StrictModel):
    source_identity: str = Field(min_length=1, max_length=512)
    observed_at: AwareDatetime
    numeric_value: float | None = None
    categorical_value: str | None = Field(default=None, max_length=512)
    detail: dict = Field(default_factory=dict)
    source_artifact_refs: tuple[str, ...] = Field(default=(), max_length=64)
    hop_count: int = Field(default=0, ge=0, le=3)

    @field_validator("observed_at", mode="before")
    @classmethod
    def _parse_wire_datetime(cls, value: object) -> object:
        return _wire_datetime(value)

    @field_validator("source_artifact_refs", mode="before")
    @classmethod
    def _own_wire_refs(cls, value: object) -> object:
        if isinstance(value, list):
            return tuple(value)
        return value

    @field_validator("numeric_value", "hop_count", mode="before")
    @classmethod
    def _reject_boolean_number(cls, value: object) -> object:
        if isinstance(value, bool):
            raise ValueError("boolean numeric values are forbidden")
        return value

    @field_validator("source_artifact_refs")
    @classmethod
    def _bound_artifact_refs(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        if any(not item or len(item) > 512 for item in value):
            raise ValueError("artifact references must contain 1..512 characters")
        return value


class WatchRuleOut(_StrictModel):
    id: UUID
    name: str
    signal_type: SignalType
    enabled: bool
    paused: bool
    issuer_id: str | None
    portfolio_id: str | None
    current_version: int
    schedule_kind: str
    schedule_interval_seconds: int | None
    next_evaluation_at: AwareDatetime | None
    last_evaluated_at: AwareDatetime | None
    config: RuleConfig
    created_at: AwareDatetime
    updated_at: AwareDatetime


class ManualEvaluationOut(_StrictModel):
    evaluation_id: UUID
    outcome: Literal["matched", "ignored", "rejected"]
    alert_event_id: str | None = None
    created: bool


def _utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _rule_out(rule: WatchRule) -> WatchRuleOut:
    try:
        config = RuleConfig.model_validate(rule.config_json)
    except (TypeError, ValueError) as exc:
        raise HTTPException(409, "watch_rule_invalid") from exc
    return WatchRuleOut(
        id=UUID(rule.id),
        name=rule.name,
        signal_type=rule.signal_type,
        enabled=rule.enabled,
        paused=rule.paused,
        issuer_id=rule.issuer_id,
        portfolio_id=rule.portfolio_id,
        current_version=rule.current_version,
        schedule_kind=rule.schedule_kind,
        schedule_interval_seconds=rule.schedule_interval_seconds,
        next_evaluation_at=_utc(rule.next_evaluation_at),
        last_evaluated_at=_utc(rule.last_evaluated_at),
        config=config,
        created_at=_utc(rule.created_at),
        updated_at=_utc(rule.updated_at),
    )


def _rule_uuid(value: str) -> str:
    try:
        return str(UUID(value))
    except (TypeError, ValueError, AttributeError):
        raise HTTPException(404, "watch_rule_not_found") from None


def _scope_predicate(caller: CallerIdentity):
    tenant_id, team_id = _scope_for_caller(caller)
    role = caller.role.strip().lower()
    principal = (
        WatchRule.tenant_id == tenant_id,
        or_(
            WatchRule.owner_user_id == caller.id,
            WatchRule.team_id_snapshot == team_id,
            role == "admin",
        ),
    )
    if not tenancy_enabled():
        return and_(*principal)
    issuer_scope = or_(
        WatchRule.issuer_id.is_(None),
        exists(
            select(Issuer.id).where(
                Issuer.id == WatchRule.issuer_id,
                or_(Issuer.team_id.is_(None), Issuer.team_id == caller.team_id),
            )
        ),
    )
    portfolio_scope = or_(
        WatchRule.portfolio_id.is_(None),
        exists(
            select(Portfolio.id).where(
                Portfolio.id == WatchRule.portfolio_id,
                Portfolio.team_id == caller.team_id,
            )
        ),
    )
    return and_(*principal, issuer_scope, portfolio_scope)


async def _visible_rule(
    db: AsyncSession,
    caller: CallerIdentity,
    rule_id: str,
    *,
    mutation: bool = False,
    lock: bool = False,
) -> WatchRule:
    statement = select(WatchRule).where(
        WatchRule.id == _rule_uuid(rule_id), _scope_predicate(caller)
    )
    if mutation:
        statement = statement.where(
            or_(
                WatchRule.owner_user_id == caller.id,
                caller.role.strip().lower() == "admin",
            )
        )
    if lock:
        statement = statement.with_for_update().execution_options(
            populate_existing=True
        )
    rule = (await db.execute(statement)).scalar_one_or_none()
    if rule is None:
        raise HTTPException(404, "watch_rule_not_found")
    return rule


def _filter_fingerprint(
    *,
    caller: CallerIdentity,
    signal_type: str | None,
    enabled: bool | None,
    issuer_id: str | None,
    portfolio_id: str | None,
    name_prefix: str | None,
) -> str:
    tenant_id, team_id = _scope_for_caller(caller)
    payload = {
        "caller": caller.id,
        "role": caller.role.strip().lower(),
        "tenant": tenant_id,
        "team": team_id,
        "tenancy_enabled": tenancy_enabled(),
        "signal_type": signal_type,
        "enabled": enabled,
        "issuer_id": issuer_id,
        "portfolio_id": portfolio_id,
        "name_prefix": name_prefix,
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _encode_cursor(*, fingerprint: str, row: WatchRule) -> str:
    created_at = _utc(row.created_at)
    payload = {
        "v": _CURSOR_VERSION,
        "resource": "watch_rules",
        "fingerprint": fingerprint,
        "created_at": created_at.isoformat(),
        "id": row.id,
    }
    raw = (
        base64.urlsafe_b64encode(
            json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
        )
        .decode("ascii")
        .rstrip("=")
    )
    signature = hmac.new(
        get_settings().session_secret.encode("utf-8"),
        raw.encode("ascii"),
        hashlib.sha256,
    ).hexdigest()
    return f"{raw}.{signature}"


def _decode_cursor(cursor: str, *, fingerprint: str) -> tuple[datetime, str]:
    if len(cursor) > _CURSOR_MAX:
        raise HTTPException(400, "invalid_watch_rule_cursor")
    try:
        raw, signature = cursor.rsplit(".", 1)
        expected = hmac.new(
            get_settings().session_secret.encode("utf-8"),
            raw.encode("ascii"),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(signature.encode("ascii"), expected.encode("ascii")):
            raise ValueError
        decoded = base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4))
        payload = json.loads(decoded)
        if (
            not isinstance(payload, dict)
            or payload.get("v") != _CURSOR_VERSION
            or payload.get("resource") != "watch_rules"
            or payload.get("fingerprint") != fingerprint
            or not isinstance(payload.get("created_at"), str)
            or not isinstance(payload.get("id"), str)
        ):
            raise ValueError
        created_at = datetime.fromisoformat(payload["created_at"])
        if created_at.tzinfo is None:
            raise ValueError
        return created_at.astimezone(timezone.utc), _rule_uuid(payload["id"])
    except (UnicodeError, ValueError, KeyError, TypeError, json.JSONDecodeError):
        raise HTTPException(400, "invalid_watch_rule_cursor") from None


def _rate_limit(caller: CallerIdentity, *, lane: str, maximum: int) -> None:
    if not rate_limit.hit(
        f"watch-rule:{lane}:{caller.id}",
        max_attempts=maximum,
        window_seconds=60,
    ):
        raise HTTPException(429, "watch_rule_rate_limited")


@router.post("", response_model=WatchRuleOut, status_code=status.HTTP_201_CREATED)
async def create_rule(
    body: CreateWatchRuleRequest,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_write_identity),
):
    try:
        await _require_visible_scopes(
            db,
            caller,
            issuer_id=body.issuer_id,
            portfolio_id=body.portfolio_id,
        )
    except WatchRuleNotFoundError:
        raise HTTPException(404, "watch_rule_not_found") from None
    _rate_limit(caller, lane="write", maximum=_WRITE_LIMIT)
    try:
        rule = await create_watch_rule(db, caller, body)
    except WatchRuleNotFoundError:
        raise HTTPException(404, "watch_rule_not_found") from None
    except WatchRuleValidationError:
        raise HTTPException(422, "watch_rule_invalid") from None
    return _rule_out(rule)


@router.get("", response_model=list[WatchRuleOut])
async def list_rules(
    response: Response,
    limit: int = Query(default=50, ge=1, le=_LIST_MAX),
    cursor: str | None = Query(default=None, max_length=_CURSOR_MAX),
    signal_type: SignalType | None = Query(default=None),
    enabled: bool | None = Query(default=None),
    issuer_id: str | None = Query(default=None, min_length=1, max_length=36),
    portfolio_id: str | None = Query(default=None, min_length=1, max_length=36),
    name_prefix: str | None = Query(default=None, min_length=1, max_length=160),
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    fingerprint = _filter_fingerprint(
        caller=caller,
        signal_type=signal_type,
        enabled=enabled,
        issuer_id=issuer_id,
        portfolio_id=portfolio_id,
        name_prefix=name_prefix,
    )
    statement = select(WatchRule).where(_scope_predicate(caller))
    if signal_type is not None:
        statement = statement.where(WatchRule.signal_type == signal_type)
    if enabled is not None:
        statement = statement.where(WatchRule.enabled == enabled)
    if issuer_id is not None:
        statement = statement.where(WatchRule.issuer_id == issuer_id)
    if portfolio_id is not None:
        statement = statement.where(WatchRule.portfolio_id == portfolio_id)
    if name_prefix is not None:
        statement = statement.where(WatchRule.name.startswith(name_prefix))
    if cursor is not None:
        created_at, last_id = _decode_cursor(cursor, fingerprint=fingerprint)
        statement = statement.where(
            or_(
                WatchRule.created_at < created_at,
                and_(WatchRule.created_at == created_at, WatchRule.id < last_id),
            )
        )
    rows = (
        (
            await db.execute(
                statement.order_by(
                    WatchRule.created_at.desc(), WatchRule.id.desc()
                ).limit(limit + 1)
            )
        )
        .scalars()
        .all()
    )
    page = rows[:limit]
    if len(rows) > limit and page:
        response.headers["X-Next-Cursor"] = _encode_cursor(
            fingerprint=fingerprint, row=page[-1]
        )
    return [_rule_out(row) for row in page]


@router.get("/{rule_id}", response_model=WatchRuleOut)
async def get_rule(
    rule_id: str,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    return _rule_out(await _visible_rule(db, caller, rule_id))


@router.patch("/{rule_id}", response_model=WatchRuleOut)
async def patch_rule(
    rule_id: str,
    body: WatchRulePatchRequest,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_write_identity),
):
    await _visible_rule(db, caller, rule_id, mutation=True)
    _rate_limit(caller, lane="write", maximum=_WRITE_LIMIT)
    try:
        rule = await update_watch_rule(
            db,
            caller,
            _rule_uuid(rule_id),
            body.expected_version,
            body.patch,
        )
    except WatchRuleNotFoundError:
        raise HTTPException(404, "watch_rule_not_found") from None
    except WatchRuleConflictError:
        raise HTTPException(409, "watch_rule_version_conflict") from None
    except WatchRuleValidationError:
        raise HTTPException(422, "watch_rule_invalid") from None
    return _rule_out(rule)


@router.post("/{rule_id}/evaluate", response_model=ManualEvaluationOut)
async def evaluate_rule_manually(
    rule_id: str,
    body: ManualEvaluationRequest,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_write_identity),
):
    rule = await _visible_rule(db, caller, rule_id, mutation=True, lock=True)
    _rate_limit(caller, lane="evaluate", maximum=_EVALUATE_LIMIT)
    if rule.signal_type in _UNAVAILABLE_SIGNALS:
        raise HTTPException(409, "source_unavailable")
    if not rule.enabled or rule.paused:
        raise HTTPException(409, "watch_rule_inactive")

    correlation_id = uuid4()
    scope = SubjectScope(
        tenant_id=rule.tenant_id,
        issuer_id=rule.issuer_id,
        portfolio_id=rule.portfolio_id,
    )
    try:
        observation = SignalObservation(
            signal_type=rule.signal_type,
            subject_scope=scope,
            source_identity=body.source_identity,
            observed_at=body.observed_at,
            numeric_value=body.numeric_value,
            categorical_value=body.categorical_value,
            detail=body.detail,
            source_artifact_refs=body.source_artifact_refs,
            correlation_id=correlation_id,
            correlation_root_id=correlation_id,
            hop_count=body.hop_count,
        )
        trigger = EvaluationTrigger(
            trigger_kind="manual",
            trigger_identity=body.source_identity,
            watch_rule_id=UUID(rule.id),
            rule_version=rule.current_version,
            occurred_at=body.observed_at,
            scheduled_for=None,
            correlation_id=correlation_id,
            correlation_root_id=correlation_id,
            hop_count=body.hop_count,
        )
    except (TypeError, ValueError):
        raise HTTPException(422, "observation_invalid") from None

    try:
        claim = await claim_rule_evaluation(db, trigger, observation)
    except EvaluationClaimError as exc:
        code = str(exc)
        if code == "watch_rule_not_found":
            raise HTTPException(404, "watch_rule_not_found") from None
        raise HTTPException(409, code) from None

    if not claim.created:
        if claim.evaluation.outcome == "matched":
            context = await db.scalar(
                select(AlertEventContext).where(
                    AlertEventContext.watch_rule_evaluation_id == claim.evaluation.id
                )
            )
            if context is None:
                raise HTTPException(409, "evaluation_rejected")
            return ManualEvaluationOut(
                evaluation_id=UUID(claim.evaluation.id),
                outcome="matched",
                alert_event_id=context.alert_event_id,
                created=False,
            )
        if claim.evaluation.outcome in {"ignored", "rejected"}:
            return ManualEvaluationOut(
                evaluation_id=UUID(claim.evaluation.id),
                outcome=claim.evaluation.outcome,
                created=False,
            )
        raise HTTPException(409, "evaluation_rejected")

    version = await db.scalar(
        select(WatchRuleVersion).where(
            WatchRuleVersion.watch_rule_id == rule.id,
            WatchRuleVersion.version == rule.current_version,
        )
    )
    if version is None:
        raise HTTPException(409, "evaluation_rejected")
    decision = evaluate_rule(
        version, observation, evaluation_id=UUID(claim.evaluation.id)
    )
    if decision.outcome != "matched" or decision.candidate is None:
        claim.evaluation.outcome = decision.outcome
        return ManualEvaluationOut(
            evaluation_id=UUID(claim.evaluation.id),
            outcome=decision.outcome,
            created=True,
        )
    try:
        materialized = await materialize_alert(
            db,
            decision.candidate,
            _APPROVED_SINKS,
            now=datetime.now(timezone.utc),
        )
    except MaterializationError:
        raise HTTPException(409, "evaluation_rejected") from None
    return ManualEvaluationOut(
        evaluation_id=UUID(claim.evaluation.id),
        outcome="matched",
        alert_event_id=materialized.event.id,
        created=True,
    )


__all__ = ["router"]
