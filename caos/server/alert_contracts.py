"""Strict wire contracts for the C3 monitor/evaluation/delivery seams."""

from __future__ import annotations

import json
from typing import Annotated, Literal, Optional
from uuid import UUID

from pydantic import (
    AwareDatetime,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    JsonValue,
    StringConstraints,
    field_validator,
    model_validator,
)

from engine.periods import is_finite_number


SignalType = Literal[
    "run_finding",
    "qa_gate",
    "covenant",
    "edgar_filing",
    "market_move",
    "cp1b_monitoring",
    "cp1c_peer_outlier",
    "news",
]
Channel = Literal["in_app", "email"]
HexKey = Annotated[str, StringConstraints(pattern=r"^[0-9a-f]{64}$")]


def _reject_bool(value: object) -> object:
    if isinstance(value, bool):
        raise ValueError("boolean values are not valid numbers")
    return value


FiniteWireNumber = Annotated[float, BeforeValidator(_reject_bool)]
HopCount = Annotated[int, BeforeValidator(_reject_bool), Field(ge=0, le=3)]
RuleVersion = Annotated[int, BeforeValidator(_reject_bool), Field(ge=1)]
AttemptCount = Annotated[int, BeforeValidator(_reject_bool), Field(ge=0, le=5)]


def validate_jsonb_compatible(value: object, *, label: str) -> None:
    """Reject valid JSON strings that PostgreSQL ``jsonb`` cannot represent."""
    if isinstance(value, str):
        if "\x00" in value:
            raise ValueError(f"{label} must not contain U+0000")
        return
    if isinstance(value, dict):
        for key, item in value.items():
            validate_jsonb_compatible(key, label=label)
            validate_jsonb_compatible(item, label=label)
        return
    if isinstance(value, (list, tuple)):
        for item in value:
            validate_jsonb_compatible(item, label=label)


def _canonical_json(value: object, *, max_bytes: int, label: str) -> str:
    validate_jsonb_compatible(value, label=label)
    try:
        encoded = json.dumps(
            value,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
            allow_nan=False,
        ).encode("utf-8")
    except (TypeError, ValueError, UnicodeEncodeError) as exc:
        raise ValueError(f"{label} must be canonical finite JSON") from exc
    if len(encoded) > max_bytes:
        raise ValueError(f"{label} exceeds {max_bytes} canonical UTF-8 bytes")
    return encoded.decode("utf-8")


def _bounded_utf8(value: Optional[str], *, maximum: int, label: str) -> Optional[str]:
    if value is None:
        return None
    try:
        size = len(value.encode("utf-8"))
    except UnicodeEncodeError as exc:
        raise ValueError(f"{label} must be valid UTF-8") from exc
    if not 1 <= size <= maximum:
        raise ValueError(f"{label} must be 1..{maximum} UTF-8 bytes")
    return value


class _WireModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, str_strip_whitespace=True)


class SubjectScope(_WireModel):
    tenant_id: str = Field(min_length=1)
    issuer_id: Optional[str] = None
    portfolio_id: Optional[str] = None

    @field_validator("tenant_id")
    @classmethod
    def _tenant_bytes(cls, value: str) -> str:
        return _bounded_utf8(value, maximum=255, label="tenant_id")  # type: ignore[return-value]

    @field_validator("issuer_id", "portfolio_id")
    @classmethod
    def _scope_id_bytes(cls, value: Optional[str], info) -> Optional[str]:
        return _bounded_utf8(value, maximum=36, label=info.field_name)

    @model_validator(mode="after")
    def _bounded_canonical_scope(self) -> "SubjectScope":
        _canonical_json(self.model_dump(mode="json"), max_bytes=64 * 1024, label="subject_scope")
        return self

    def canonical_json(self) -> str:
        return _canonical_json(
            self.model_dump(mode="json"), max_bytes=64 * 1024, label="subject_scope"
        )


class SignalObservation(_WireModel):
    signal_type: SignalType
    subject_scope: SubjectScope
    source_identity: str = Field(min_length=1, max_length=512)
    observed_at: AwareDatetime
    numeric_value: Optional[FiniteWireNumber] = None
    categorical_value: Optional[str] = Field(default=None, max_length=512)
    detail: dict[str, JsonValue] = Field(default_factory=dict)
    source_artifact_refs: tuple[Annotated[str, StringConstraints(max_length=512)], ...] = Field(
        default_factory=tuple, max_length=64
    )
    correlation_id: UUID
    correlation_root_id: UUID
    hop_count: HopCount

    @field_validator("numeric_value")
    @classmethod
    def _finite_numeric_value(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and not is_finite_number(value):
            raise ValueError("numeric_value must be finite")
        return value

    @field_validator("source_identity", "categorical_value", "source_artifact_refs")
    @classmethod
    def _jsonb_safe_string_fields(cls, value: object) -> object:
        validate_jsonb_compatible(value, label="observation")
        return value

    @field_validator("detail")
    @classmethod
    def _bounded_detail(cls, value: dict[str, JsonValue]) -> dict[str, JsonValue]:
        _canonical_json(value, max_bytes=64 * 1024, label="detail")
        return value

    @model_validator(mode="after")
    def _requires_observed_value(self) -> "SignalObservation":
        if self.numeric_value is None and self.categorical_value is None and not self.detail:
            raise ValueError("an observation requires numeric_value, categorical_value, or detail")
        return self


class EvaluationTrigger(_WireModel):
    trigger_kind: Literal[
        "run_completed", "manual", "scheduled_edgar", "scheduled_watchlist"
    ]
    trigger_identity: str = Field(min_length=1, max_length=512)
    watch_rule_id: UUID
    rule_version: RuleVersion
    occurred_at: AwareDatetime
    scheduled_for: Optional[AwareDatetime] = None
    correlation_id: UUID
    correlation_root_id: UUID
    hop_count: HopCount

    @model_validator(mode="after")
    def _scheduled_timestamp_matches_kind(self) -> "EvaluationTrigger":
        scheduled = self.trigger_kind in {"scheduled_edgar", "scheduled_watchlist"}
        if scheduled != (self.scheduled_for is not None):
            raise ValueError("scheduled_for is required exactly for scheduled triggers")
        return self


class AlertCandidate(_WireModel):
    evaluation_id: UUID
    watch_rule_id: UUID
    rule_version: RuleVersion
    observation_key: HexKey
    alert_key: str = Field(pattern=r"^c3:[0-9a-f]{64}$")
    signal_type: SignalType
    subject_scope: SubjectScope
    issuer_id: Optional[str] = Field(default=None, min_length=1, max_length=36)
    portfolio_id: Optional[str] = Field(default=None, min_length=1, max_length=36)
    run_id: Optional[str] = Field(default=None, max_length=64)
    kind: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=240)
    impact: str = Field(max_length=4000)
    evidence: dict[str, JsonValue] = Field(default_factory=dict)
    authority: dict[str, JsonValue] = Field(default_factory=dict)
    correlation_id: UUID
    correlation_root_id: UUID
    hop_count: HopCount

    @field_validator("evidence", "authority")
    @classmethod
    def _bounded_objects(cls, value: dict[str, JsonValue], info) -> dict[str, JsonValue]:
        _canonical_json(value, max_bytes=64 * 1024, label=info.field_name)
        return value

    @model_validator(mode="after")
    def _consistent_keys_and_scope(self) -> "AlertCandidate":
        if self.alert_key != f"c3:{self.observation_key}":
            raise ValueError("alert_key must be c3: plus observation_key")
        if self.issuer_id != self.subject_scope.issuer_id:
            raise ValueError("issuer_id must match subject_scope")
        if self.portfolio_id != self.subject_scope.portfolio_id:
            raise ValueError("portfolio_id must match subject_scope")
        return self


class SinkIntent(_WireModel):
    channel: Channel
    destination_ref: str = Field(min_length=1, max_length=256)
    idempotency_key: HexKey
    status: Literal["pending", "rendered_intent", "not_sent"]
    rendered_intent: Optional[dict[str, JsonValue]] = None
    not_sent_reason: Optional[str] = Field(default=None, max_length=256)

    @field_validator("rendered_intent")
    @classmethod
    def _bounded_rendered_intent(
        cls, value: Optional[dict[str, JsonValue]]
    ) -> Optional[dict[str, JsonValue]]:
        if value is not None:
            _canonical_json(value, max_bytes=256 * 1024, label="rendered_intent")
        return value

    @model_validator(mode="after")
    def _payload_matches_status(self) -> "SinkIntent":
        if self.status == "rendered_intent":
            if self.rendered_intent is None or self.not_sent_reason is not None:
                raise ValueError("rendered_intent status requires only rendered_intent")
        elif self.status == "not_sent":
            if self.not_sent_reason is None or self.rendered_intent is not None:
                raise ValueError("not_sent status requires only not_sent_reason")
        elif self.rendered_intent is not None or self.not_sent_reason is not None:
            raise ValueError("pending status cannot contain a terminal payload")
        return self


class SinkResult(_WireModel):
    channel: Channel
    status: Literal["rendered_intent", "not_sent"]
    intent_id: Optional[UUID] = None
    attempt_count: AttemptCount
    error_class: Optional[str] = Field(default=None, max_length=64)
