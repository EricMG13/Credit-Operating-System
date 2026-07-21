"""Deterministic C3 alert rendering without transport or provider I/O."""

from __future__ import annotations

import hashlib
import json
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import ClassVar, Literal
from uuid import UUID

from alert_contracts import SinkIntent


Channel = Literal["in_app", "email"]
_IDEMPOTENCY_VERSION = "c3-delivery-v1"


def _bounded_utf8(value: object, *, maximum: int, label: str) -> str:
    if not isinstance(value, str):
        raise TypeError(f"{label} must be a string")
    try:
        size = len(value.encode("utf-8"))
    except UnicodeEncodeError as exc:
        raise ValueError(f"{label} must be valid UTF-8") from exc
    if not 1 <= size <= maximum:
        raise ValueError(f"{label} must be 1..{maximum} UTF-8 bytes")
    return value


def sink_idempotency_key(
    alert_event_context_id: UUID | str,
    channel: Channel,
    destination_ref: str,
) -> str:
    """Hash the canonical, versioned delivery identity tuple."""
    context_id = UUID(str(alert_event_context_id))
    if channel not in {"in_app", "email"}:
        raise ValueError("channel must be in_app or email")
    destination = _bounded_utf8(destination_ref, maximum=256, label="destination_ref")
    canonical = json.dumps(
        [_IDEMPOTENCY_VERSION, str(context_id), channel, destination],
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()


@dataclass(frozen=True, slots=True)
class DeliveryEnvelope:
    """Immutable data required to render one owned delivery lease."""

    intent_id: UUID
    alert_event_id: str
    alert_event_context_id: UUID
    channel: Channel
    destination_ref: str
    idempotency_key: str
    attempt_count: int
    correlation_root_id: UUID
    kind: str
    title: str
    impact: str
    evidence: dict
    authority: dict

    def __post_init__(self) -> None:
        if self.channel not in {"in_app", "email"}:
            raise ValueError("channel must be in_app or email")
        _bounded_utf8(self.destination_ref, maximum=256, label="destination_ref")
        expected = sink_idempotency_key(
            self.alert_event_context_id, self.channel, self.destination_ref
        )
        if self.idempotency_key != expected:
            raise ValueError("idempotency_key does not match the delivery identity")
        if (
            isinstance(self.attempt_count, bool)
            or not isinstance(self.attempt_count, int)
            or not 1 <= self.attempt_count <= 5
        ):
            raise ValueError("attempt_count must be 1..5")


@dataclass(frozen=True, slots=True)
class AlertSink(ABC):
    """Strict immutable descriptor and deterministic renderer."""

    destination_ref: str
    max_attempts: int = 5
    channel: ClassVar[Channel]

    def __post_init__(self) -> None:
        if self.channel not in {"in_app", "email"}:
            raise ValueError("channel must be in_app or email")
        _bounded_utf8(self.destination_ref, maximum=256, label="destination_ref")
        if (
            isinstance(self.max_attempts, bool)
            or not isinstance(self.max_attempts, int)
            or not 1 <= self.max_attempts <= 5
        ):
            raise ValueError("max_attempts must be 1..5")

    def _validate_envelope(self, envelope: DeliveryEnvelope) -> None:
        if not isinstance(envelope, DeliveryEnvelope):
            raise TypeError("envelope must be a DeliveryEnvelope")
        if (
            envelope.channel != self.channel
            or envelope.destination_ref != self.destination_ref
        ):
            raise ValueError("envelope does not match the sink descriptor")

    @abstractmethod
    def render(self, envelope: DeliveryEnvelope) -> SinkIntent:
        """Return a terminal wire intent without performing external I/O."""


@dataclass(frozen=True, slots=True)
class InAppSink(AlertSink):
    channel: ClassVar[Channel] = "in_app"

    def render(self, envelope: DeliveryEnvelope) -> SinkIntent:
        self._validate_envelope(envelope)
        return SinkIntent(
            channel=self.channel,
            destination_ref=self.destination_ref,
            idempotency_key=envelope.idempotency_key,
            status="rendered_intent",
            rendered_intent={
                "schema": "c3-alert-v1",
                "kind": "in_app_alert_reference",
                "alert_event_id": envelope.alert_event_id,
                "alert_event_context_id": str(envelope.alert_event_context_id),
            },
        )


@dataclass(frozen=True, slots=True)
class EmailSink(AlertSink):
    channel: ClassVar[Channel] = "email"

    def render(self, envelope: DeliveryEnvelope) -> SinkIntent:
        self._validate_envelope(envelope)
        return SinkIntent(
            channel=self.channel,
            destination_ref=self.destination_ref,
            idempotency_key=envelope.idempotency_key,
            status="rendered_intent",
            rendered_intent={
                "schema": "c3-alert-v1",
                "kind": "email_render_intent",
                "alert_event_id": envelope.alert_event_id,
                "alert_event_context_id": str(envelope.alert_event_context_id),
                "subject": envelope.title,
                "body": envelope.impact,
                "credit_kind": envelope.kind,
                "evidence": envelope.evidence,
                "authority": envelope.authority,
            },
        )


__all__ = [
    "AlertSink",
    "DeliveryEnvelope",
    "EmailSink",
    "InAppSink",
    "sink_idempotency_key",
]
