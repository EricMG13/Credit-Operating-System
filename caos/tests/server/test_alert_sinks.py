"""Deterministic, non-network delivery sink contract tests."""

from __future__ import annotations

import hashlib
import inspect
import json
from dataclasses import FrozenInstanceError, dataclass, replace
from uuid import UUID

import pytest

from alert_sinks import (
    AlertSink,
    DeliveryEnvelope,
    EmailSink,
    InAppSink,
    sink_idempotency_key,
)


CONTEXT_ID = UUID("00000000-0000-0000-0000-000000000123")


def _envelope(*, channel: str = "email", destination_ref: str = "desk-primary"):
    return DeliveryEnvelope(
        intent_id=UUID("00000000-0000-0000-0000-000000000124"),
        alert_event_id="00000000-0000-0000-0000-000000000125",
        alert_event_context_id=CONTEXT_ID,
        channel=channel,
        destination_ref=destination_ref,
        idempotency_key=sink_idempotency_key(CONTEXT_ID, channel, destination_ref),
        attempt_count=1,
        correlation_root_id=UUID("00000000-0000-0000-0000-000000000126"),
        kind="credit_change",
        title="Leverage moved above policy",
        impact="Review the governed credit evidence.",
        evidence={"metric": "net_leverage", "value": 5.2},
        authority={"observation_key": "a" * 64},
    )


def _canonical_bytes(value: object) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")


def test_sink_descriptors_are_strict_immutable_and_utf8_bounded() -> None:
    sink = EmailSink(destination_ref="desk-primary", max_attempts=5)
    assert (sink.channel, sink.destination_ref, sink.max_attempts) == (
        "email",
        "desk-primary",
        5,
    )
    with pytest.raises(FrozenInstanceError):
        sink.max_attempts = 4
    with pytest.raises((TypeError, ValueError)):
        EmailSink(destination_ref="", max_attempts=1)
    with pytest.raises((TypeError, ValueError)):
        EmailSink(destination_ref="🔥" * 65, max_attempts=1)
    with pytest.raises((TypeError, ValueError)):
        EmailSink(destination_ref="desk", max_attempts=True)
    with pytest.raises((TypeError, ValueError)):
        EmailSink(destination_ref="desk", max_attempts=6)

    @dataclass(frozen=True, slots=True)
    class InvalidChannelSink(AlertSink):
        channel = "sms"

        def render(self, envelope):
            raise AssertionError("must not render")

    with pytest.raises(ValueError, match="channel"):
        InvalidChannelSink(destination_ref="desk", max_attempts=1)


def test_sink_idempotency_key_has_a_canonical_versioned_golden_value() -> None:
    canonical = _canonical_bytes(
        ["c3-delivery-v1", str(CONTEXT_ID), "email", "desk-primary"]
    )
    expected = hashlib.sha256(canonical).hexdigest()
    assert sink_idempotency_key(CONTEXT_ID, "email", "desk-primary") == expected
    assert (
        expected == "d39382bd0e37dc10754c25b00fd92f29da5cd14ea1962372f85adde55e5902da"
    )
    assert sink_idempotency_key(CONTEXT_ID, "in_app", "desk-primary") != expected


def test_delivery_envelope_is_immutable_and_rejects_key_or_channel_mismatch() -> None:
    envelope = _envelope()
    with pytest.raises(FrozenInstanceError):
        envelope.title = "changed"
    with pytest.raises(ValueError, match="idempotency"):
        replace(envelope, idempotency_key="0" * 64)
    with pytest.raises(ValueError, match="channel"):
        _envelope(channel="sms")


def test_in_app_render_is_deterministic_internal_reference_without_destination() -> (
    None
):
    envelope = _envelope(channel="in_app")
    sink = InAppSink(destination_ref="desk-primary", max_attempts=3)

    first = sink.render(envelope)
    second = sink.render(envelope)

    assert first == second
    assert first.status == "rendered_intent"
    assert first.idempotency_key == envelope.idempotency_key
    assert first.rendered_intent == {
        "schema": "c3-alert-v1",
        "kind": "in_app_alert_reference",
        "alert_event_id": envelope.alert_event_id,
        "alert_event_context_id": str(envelope.alert_event_context_id),
    }
    assert envelope.destination_ref not in json.dumps(first.rendered_intent)


def test_email_render_is_deterministic_bounded_and_never_claims_transport_success() -> (
    None
):
    envelope = _envelope()
    sink = EmailSink(destination_ref="desk-primary", max_attempts=5)

    result = sink.render(envelope)

    assert result.status == "rendered_intent"
    assert result.channel == "email"
    assert result.destination_ref == envelope.destination_ref
    assert result.idempotency_key == envelope.idempotency_key
    assert result.rendered_intent == {
        "schema": "c3-alert-v1",
        "kind": "email_render_intent",
        "alert_event_id": envelope.alert_event_id,
        "alert_event_context_id": str(envelope.alert_event_context_id),
        "subject": envelope.title,
        "body": envelope.impact,
        "credit_kind": envelope.kind,
        "evidence": envelope.evidence,
        "authority": envelope.authority,
    }
    assert len(_canonical_bytes(result.rendered_intent)) <= 256 * 1024
    serialized = json.dumps(result.rendered_intent).lower()
    assert envelope.destination_ref not in serialized
    for false_claim in ("delivered", "accepted", "connected"):
        assert false_claim not in serialized


def test_sink_rejects_an_envelope_for_another_descriptor() -> None:
    with pytest.raises(ValueError, match="descriptor"):
        EmailSink(destination_ref="desk-secondary", max_attempts=5).render(_envelope())
    with pytest.raises(ValueError, match="descriptor"):
        InAppSink(destination_ref="desk-primary", max_attempts=5).render(_envelope())


def test_sink_module_has_no_network_or_provider_client_operation() -> None:
    import alert_sinks

    source = inspect.getsource(alert_sinks).lower()
    for forbidden in (
        "import requests",
        "import httpx",
        "import smtplib",
        "socket.",
        ".sendmail(",
        ".post(",
        ".connect(",
    ):
        assert forbidden not in source
