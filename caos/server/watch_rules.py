"""Transaction-neutral repository services for immutable C3 watch rules."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from alert_contracts import SignalType, validate_jsonb_compatible
from database import Issuer, Portfolio, WatchRule, WatchRuleVersion
from engine.periods import is_finite_number
from identity import CallerIdentity, require_write_role
from tenancy import issuer_visible, portfolio_visible, tenancy_enabled


Operator = Literal["present", "eq", "gt", "gte", "lt", "lte"]
ScheduleKind = Literal["event_driven", "interval", "edgar"]

SHARED_TENANT_ID = "caos-shared-deployment"
SHARED_TEAM_ID = "caos-shared-desk"
UNASSIGNED_TENANT_ID = "caos-unassigned"
UNASSIGNED_TEAM_ID = "caos-unassigned"

_UNAVAILABLE_SIGNALS = frozenset({"edgar_filing", "market_move", "news"})
_CATEGORICAL_SIGNALS = frozenset({"run_finding", "qa_gate"})
_NUMERIC_SIGNALS = frozenset({"covenant", "cp1b_monitoring", "cp1c_peer_outlier"})
_MAX_CONFIG_BYTES = 64 * 1024
_CREATE_IDEMPOTENCY_KEY_RE = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")


class WatchRuleError(Exception):
    """Base class for stable watch-rule domain failures."""

    code = "watch_rule_error"


class WatchRuleNotFoundError(WatchRuleError):
    code = "watch_rule_not_found"

    def __init__(self) -> None:
        super().__init__("Watch rule not found")


class WatchRuleConflictError(WatchRuleError):
    code = "watch_rule_version_conflict"

    def __init__(self) -> None:
        super().__init__("Watch rule version conflict")


class WatchRuleIdempotencyConflictError(WatchRuleError):
    code = "watch_rule_idempotency_conflict"

    def __init__(self) -> None:
        super().__init__("Idempotency-Key was used for a different watch rule")


class WatchRuleValidationError(WatchRuleError):
    code = "watch_rule_invalid"


def _canonical_config(config: "RuleConfig") -> dict:
    payload = config.model_dump(mode="json")
    validate_jsonb_compatible(payload, label="config")
    try:
        encoded = json.dumps(
            payload,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
            allow_nan=False,
        ).encode("utf-8")
    except (TypeError, ValueError, UnicodeEncodeError) as exc:
        raise ValueError("config must be canonical finite JSON") from exc
    if len(encoded) > _MAX_CONFIG_BYTES:
        raise ValueError("config exceeds 65536 canonical UTF-8 bytes")
    return payload


def _create_request_sha256(command: "CreateWatchRuleCommand") -> str:
    payload = command.model_dump(mode="json")
    validate_jsonb_compatible(payload, label="watch rule create request")
    try:
        canonical = json.dumps(
            payload,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
            allow_nan=False,
        ).encode("utf-8")
    except (TypeError, ValueError, UnicodeEncodeError) as exc:
        raise WatchRuleValidationError(
            "watch rule create request must be canonical finite JSON"
        ) from exc
    return hashlib.sha256(canonical).hexdigest()


def _watch_rule_insert(dialect: str, values: dict):
    if dialect == "postgresql":
        statement = postgresql_insert(WatchRule)
    elif dialect == "sqlite":
        statement = sqlite_insert(WatchRule)
    else:
        raise WatchRuleValidationError("unsupported_database")
    return (
        statement.values(**values)
        .on_conflict_do_nothing(
            index_elements=[
                "tenant_id",
                "owner_user_id",
                "create_idempotency_key",
            ]
        )
        .returning(WatchRule.id)
    )


class _StrictModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        frozen=True,
        strict=True,
        str_strip_whitespace=True,
    )


class RuleConfig(_StrictModel):
    operator: Operator
    threshold: str | int | float | None = None
    kind: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=240)
    impact: str = Field(max_length=4000)

    @field_validator("threshold", mode="before")
    @classmethod
    def _reject_boolean_threshold(cls, value: object) -> object:
        if isinstance(value, bool):
            raise ValueError("threshold must be a finite non-boolean number or string")
        return value

    @model_validator(mode="after")
    def _operator_threshold_pair(self) -> "RuleConfig":
        if self.operator == "present":
            if self.threshold is not None:
                raise ValueError("present forbids a threshold")
        elif self.operator == "eq":
            if isinstance(self.threshold, str):
                if not self.threshold:
                    raise ValueError(
                        "eq requires a non-empty string or finite non-boolean number"
                    )
            elif not is_finite_number(self.threshold) or isinstance(
                self.threshold, bool
            ):
                raise ValueError(
                    "eq requires a non-empty string or finite non-boolean number"
                )
        elif not is_finite_number(self.threshold) or isinstance(self.threshold, bool):
            raise ValueError("ordered comparison requires a finite non-boolean number")
        _canonical_config(self)
        return self


def _validate_signal_config(
    signal_type: str, config: RuleConfig, enabled: bool
) -> None:
    if enabled and signal_type in _UNAVAILABLE_SIGNALS:
        raise ValueError(
            f"{signal_type} is source-unavailable and must remain disabled"
        )
    if signal_type in _CATEGORICAL_SIGNALS and config.operator not in {"present", "eq"}:
        raise ValueError(f"{signal_type} does not support operator {config.operator}")
    if signal_type in _NUMERIC_SIGNALS and config.operator != "present":
        if isinstance(config.threshold, (str, bool)) or not is_finite_number(
            config.threshold
        ):
            raise ValueError(
                "numeric signals require a finite non-boolean numeric threshold"
            )
    if (
        signal_type
        not in _CATEGORICAL_SIGNALS | _NUMERIC_SIGNALS | _UNAVAILABLE_SIGNALS
    ):
        raise ValueError("unsupported signal type")


def _validate_schedule(
    *,
    enabled: bool,
    paused: bool,
    schedule_kind: str,
    schedule_interval_seconds: int | None,
    next_evaluation_at: datetime | None,
) -> None:
    if schedule_kind == "event_driven":
        if schedule_interval_seconds is not None or next_evaluation_at is not None:
            raise ValueError(
                "event-driven rules forbid an interval and next evaluation time"
            )
        return
    if (
        isinstance(schedule_interval_seconds, bool)
        or schedule_interval_seconds is None
        or not 60 <= schedule_interval_seconds <= 86_400
    ):
        raise ValueError("scheduled rules require an interval from 60 to 86400 seconds")
    if next_evaluation_at is not None and next_evaluation_at.tzinfo is None:
        raise ValueError("next_evaluation_at must be timezone-aware")
    if enabled and not paused and next_evaluation_at is None:
        raise ValueError("enabled unpaused scheduled rules require next_evaluation_at")


class CreateWatchRuleCommand(_StrictModel):
    name: str = Field(min_length=1, max_length=160)
    signal_type: SignalType
    enabled: bool
    paused: bool = False
    issuer_id: str | None = Field(default=None, min_length=1, max_length=36)
    portfolio_id: str | None = Field(default=None, min_length=1, max_length=36)
    schedule_kind: ScheduleKind
    schedule_interval_seconds: int | None = None
    next_evaluation_at: AwareDatetime | None = None
    config: RuleConfig

    @field_validator("schedule_interval_seconds", mode="before")
    @classmethod
    def _reject_boolean_interval(cls, value: object) -> object:
        if isinstance(value, bool):
            raise ValueError("schedule_interval_seconds must be an integer")
        return value

    @field_validator("next_evaluation_at")
    @classmethod
    def _normalize_next_evaluation_at(cls, value: datetime | None) -> datetime | None:
        return value.astimezone(timezone.utc) if value is not None else None

    @model_validator(mode="after")
    def _valid_rule_state(self) -> "CreateWatchRuleCommand":
        _validate_signal_config(self.signal_type, self.config, self.enabled)
        _validate_schedule(
            enabled=self.enabled,
            paused=self.paused,
            schedule_kind=self.schedule_kind,
            schedule_interval_seconds=self.schedule_interval_seconds,
            next_evaluation_at=self.next_evaluation_at,
        )
        return self


class UpdateWatchRulePatch(_StrictModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    signal_type: SignalType | None = None
    enabled: bool | None = None
    paused: bool | None = None
    issuer_id: str | None = Field(default=None, min_length=1, max_length=36)
    portfolio_id: str | None = Field(default=None, min_length=1, max_length=36)
    schedule_kind: ScheduleKind | None = None
    schedule_interval_seconds: int | None = None
    next_evaluation_at: AwareDatetime | None = None
    config: RuleConfig | None = None

    @field_validator("schedule_interval_seconds", mode="before")
    @classmethod
    def _reject_boolean_interval(cls, value: object) -> object:
        if isinstance(value, bool):
            raise ValueError("schedule_interval_seconds must be an integer")
        return value

    @field_validator("next_evaluation_at")
    @classmethod
    def _normalize_next_evaluation_at(cls, value: datetime | None) -> datetime | None:
        return value.astimezone(timezone.utc) if value is not None else None

    @model_validator(mode="after")
    def _validate_intrinsic_patch_state(self) -> "UpdateWatchRulePatch":
        changed = self.model_fields_set
        if (
            "schedule_interval_seconds" in changed
            and self.schedule_interval_seconds is not None
        ):
            if not 60 <= self.schedule_interval_seconds <= 86_400:
                raise ValueError(
                    "scheduled rules require an interval from 60 to 86400 seconds"
                )
        if self.schedule_kind == "event_driven":
            if (
                "schedule_interval_seconds" in changed
                and self.schedule_interval_seconds is not None
            ) or (
                "next_evaluation_at" in changed and self.next_evaluation_at is not None
            ):
                raise ValueError(
                    "event-driven rules forbid an interval and next evaluation time"
                )
        if self.signal_type is not None and self.config is not None:
            _validate_signal_config(
                self.signal_type,
                self.config,
                self.enabled is True,
            )
        elif self.enabled is True and self.signal_type in _UNAVAILABLE_SIGNALS:
            raise ValueError(
                f"{self.signal_type} is source-unavailable and must remain disabled"
            )
        return self


def _scope_for_caller(caller: CallerIdentity) -> tuple[str, str]:
    if not tenancy_enabled():
        return SHARED_TENANT_ID, SHARED_TEAM_ID
    if caller.team_id is None:
        return UNASSIGNED_TENANT_ID, UNASSIGNED_TEAM_ID
    return caller.team_id, caller.team_id


async def _require_visible_scopes(
    db: AsyncSession,
    caller: CallerIdentity,
    *,
    issuer_id: str | None,
    portfolio_id: str | None,
) -> None:
    if issuer_id is not None:
        issuer = await db.get(Issuer, issuer_id)
        if not issuer_visible(caller, issuer):
            raise WatchRuleNotFoundError()
    if portfolio_id is not None:
        portfolio = await db.get(Portfolio, portfolio_id)
        if not portfolio_visible(caller, portfolio):
            raise WatchRuleNotFoundError()


async def create_watch_rule(
    db: AsyncSession,
    caller: CallerIdentity,
    command: CreateWatchRuleCommand,
    *,
    idempotency_key: str | None = None,
) -> WatchRule:
    """Create a rule and version 1 without taking ownership of the transaction."""
    require_write_role(caller)
    if not isinstance(command, CreateWatchRuleCommand):
        raise WatchRuleValidationError("command must be a CreateWatchRuleCommand")
    if idempotency_key is not None and not _CREATE_IDEMPOTENCY_KEY_RE.fullmatch(
        idempotency_key
    ):
        raise WatchRuleValidationError(
            "Idempotency-Key must be 1-128 letters, digits, '.', '_', ':' or '-'."
        )
    tenant_id, team_id = _scope_for_caller(caller)
    await _require_visible_scopes(
        db,
        caller,
        issuer_id=command.issuer_id,
        portfolio_id=command.portfolio_id,
    )
    now = datetime.now(timezone.utc)
    rule_id = str(uuid4())
    config_json = _canonical_config(command.config)
    request_sha256 = (
        _create_request_sha256(command) if idempotency_key is not None else None
    )
    rule_values = {
        "id": rule_id,
        "tenant_id": tenant_id,
        "owner_user_id": caller.id,
        "team_id_snapshot": team_id,
        "issuer_id": command.issuer_id,
        "portfolio_id": command.portfolio_id,
        "create_idempotency_key": idempotency_key,
        "create_request_sha256": request_sha256,
        "name": command.name,
        "signal_type": command.signal_type,
        "enabled": command.enabled,
        "paused": command.paused,
        "current_version": 1,
        "schedule_kind": command.schedule_kind,
        "schedule_interval_seconds": command.schedule_interval_seconds,
        "next_evaluation_at": command.next_evaluation_at,
        "schedule_cursor": None,
        "claim_token": None,
        "claim_expires_at": None,
        "last_evaluated_at": None,
        "claim_attempt_count": 0,
        "config_json": config_json,
        "created_at": now,
        "updated_at": now,
    }
    if idempotency_key is None:
        rule = WatchRule(**rule_values)
        db.add(rule)
    else:
        inserted_id = await db.scalar(
            _watch_rule_insert(db.get_bind().dialect.name, rule_values)
        )
        rule = (
            await db.execute(
                select(WatchRule).where(
                    WatchRule.tenant_id == tenant_id,
                    WatchRule.owner_user_id == caller.id,
                    WatchRule.create_idempotency_key == idempotency_key,
                )
            )
        ).scalar_one_or_none()
        if rule is None:
            raise WatchRuleValidationError("watch_rule_idempotency_insert_unresolved")
        if inserted_id is None:
            if rule.create_request_sha256 != request_sha256:
                raise WatchRuleIdempotencyConflictError()
            return rule

    version = WatchRuleVersion(
        id=str(uuid4()),
        watch_rule_id=rule_id,
        version=1,
        owner_user_id=caller.id,
        team_id_snapshot=team_id,
        signal_type=command.signal_type,
        config_json=config_json,
        created_at=now,
    )
    db.add(version)
    await db.flush()
    return rule


def _merged_command(
    rule: WatchRule, patch: UpdateWatchRulePatch
) -> CreateWatchRuleCommand:
    changed = patch.model_fields_set

    def value(name: str):
        return getattr(patch, name) if name in changed else getattr(rule, name)

    schedule_kind = value("schedule_kind")
    interval = value("schedule_interval_seconds")
    next_at = value("next_evaluation_at")
    if (
        next_at is not None
        and "next_evaluation_at" not in changed
        and next_at.tzinfo is None
    ):
        # SQLite reloads timezone-aware DateTime columns as naive values. This is
        # trusted persisted state, not caller input; storage is normalized to UTC.
        next_at = next_at.replace(tzinfo=timezone.utc)
    elif next_at is not None:
        next_at = next_at.astimezone(timezone.utc)
    if schedule_kind == "event_driven":
        interval = None
        next_at = None
    try:
        return CreateWatchRuleCommand(
            name=value("name"),
            signal_type=value("signal_type"),
            enabled=value("enabled"),
            paused=value("paused"),
            issuer_id=value("issuer_id"),
            portfolio_id=value("portfolio_id"),
            schedule_kind=schedule_kind,
            schedule_interval_seconds=interval,
            next_evaluation_at=next_at,
            config=(
                patch.config
                if "config" in changed
                else RuleConfig.model_validate(rule.config_json)
            ),
        )
    except (ValueError, TypeError) as exc:
        raise WatchRuleValidationError(str(exc)) from exc


async def update_watch_rule(
    db: AsyncSession,
    caller: CallerIdentity,
    rule_id: str,
    expected_version: int,
    patch: UpdateWatchRulePatch,
) -> WatchRule:
    """Lock and version one owned rule without committing the caller's transaction."""
    require_write_role(caller)
    if (
        isinstance(expected_version, bool)
        or not isinstance(expected_version, int)
        or expected_version < 1
    ):
        raise WatchRuleValidationError("expected_version must be a positive integer")
    if not isinstance(patch, UpdateWatchRulePatch):
        raise WatchRuleValidationError("patch must be an UpdateWatchRulePatch")
    tenant_id, _team_id = _scope_for_caller(caller)
    rule = (
        await db.execute(
            select(WatchRule)
            .where(WatchRule.id == str(rule_id), WatchRule.tenant_id == tenant_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if rule is None or (
        rule.owner_user_id != caller.id and caller.role.strip().lower() != "admin"
    ):
        raise WatchRuleNotFoundError()
    if rule.current_version != expected_version:
        raise WatchRuleConflictError()

    command = _merged_command(rule, patch)
    schedule_fields = {
        "schedule_kind",
        "schedule_interval_seconds",
        "next_evaluation_at",
        "enabled",
        "paused",
    }
    if rule.claim_token is not None and patch.model_fields_set & schedule_fields:
        raise WatchRuleValidationError("an actively claimed schedule cannot be changed")
    terminal_schedule_resumed = (
        "paused" in patch.model_fields_set
        and patch.paused is False
        and rule.paused is True
        and rule.claim_attempt_count >= 5
        and command.schedule_kind in {"interval", "edgar"}
    )
    await _require_visible_scopes(
        db,
        caller,
        issuer_id=command.issuer_id,
        portfolio_id=command.portfolio_id,
    )

    new_version = rule.current_version + 1
    config_json = _canonical_config(command.config)
    rule.name = command.name
    rule.signal_type = command.signal_type
    rule.enabled = command.enabled
    rule.paused = command.paused
    rule.issuer_id = command.issuer_id
    rule.portfolio_id = command.portfolio_id
    rule.schedule_kind = command.schedule_kind
    rule.schedule_interval_seconds = command.schedule_interval_seconds
    rule.next_evaluation_at = command.next_evaluation_at
    if command.schedule_kind == "event_driven":
        rule.schedule_cursor = None
        rule.claim_token = None
        rule.claim_expires_at = None
        rule.last_evaluated_at = None
        rule.claim_attempt_count = 0
    elif terminal_schedule_resumed:
        rule.claim_attempt_count = 0
    rule.config_json = config_json
    rule.current_version = new_version
    now = datetime.now(timezone.utc)
    rule.updated_at = now
    db.add(
        WatchRuleVersion(
            id=str(uuid4()),
            watch_rule_id=rule.id,
            version=new_version,
            owner_user_id=rule.owner_user_id,
            team_id_snapshot=rule.team_id_snapshot,
            signal_type=rule.signal_type,
            config_json=config_json,
            created_at=now,
        )
    )
    await db.flush()
    return rule


__all__ = [
    "CreateWatchRuleCommand",
    "RuleConfig",
    "SHARED_TEAM_ID",
    "SHARED_TENANT_ID",
    "UNASSIGNED_TEAM_ID",
    "UNASSIGNED_TENANT_ID",
    "UpdateWatchRulePatch",
    "WatchRuleConflictError",
    "WatchRuleError",
    "WatchRuleIdempotencyConflictError",
    "WatchRuleNotFoundError",
    "WatchRuleValidationError",
    "create_watch_rule",
    "update_watch_rule",
]
