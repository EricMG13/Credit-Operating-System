"""Default-off activation contract for the C3 watch-rule runtime seam."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient


NOW = datetime(2026, 7, 21, 12, tzinfo=timezone.utc)
_FLAG = "caos_alert_rules_v1_enabled"


def _set_flag(monkeypatch: pytest.MonkeyPatch, enabled: bool) -> None:
    """Set the cached setting even during RED, before the model field exists."""
    from config import get_settings

    monkeypatch.setitem(get_settings().__dict__, _FLAG, enabled)


@pytest.fixture(scope="module")
def client():
    from main import app

    with TestClient(app) as test_client:
        yield test_client


def test_alert_rules_setting_defaults_false(monkeypatch) -> None:
    from config import Settings

    monkeypatch.delenv("CAOS_ALERT_RULES_V1_ENABLED", raising=False)
    assert Settings(_env_file=None).caos_alert_rules_v1_enabled is False


def test_alert_rules_setting_parses_true_from_environment(monkeypatch) -> None:
    from config import Settings

    monkeypatch.setenv("CAOS_ALERT_RULES_V1_ENABLED", "true")
    assert Settings(_env_file=None).caos_alert_rules_v1_enabled is True


@pytest.mark.parametrize("enabled", [False, True])
def test_settings_snapshot_reports_alert_rules_activation(
    client, monkeypatch, enabled
) -> None:
    _set_flag(monkeypatch, enabled)

    response = client.get("/api/settings")

    assert response.status_code == 200, response.text
    assert response.json()["features"]["alert_rules_v1_enabled"] is enabled


def test_flag_off_masks_every_watch_rule_route_before_validation_quota_or_db(
    client, monkeypatch
) -> None:
    import rate_limit
    from database import get_db
    from main import app

    _set_flag(monkeypatch, False)
    calls = {"db": 0, "rate_limit": 0}

    async def forbidden_db():
        calls["db"] += 1
        raise HTTPException(503, "database dependency invoked")
        yield  # pragma: no cover - marks this as a dependency generator

    def forbidden_rate_limit(*_args, **_kwargs):
        calls["rate_limit"] += 1
        raise AssertionError("watch-rule quota must not run while disabled")

    app.dependency_overrides[get_db] = forbidden_db
    monkeypatch.setattr(rate_limit, "hit", forbidden_rate_limit)
    try:
        responses = [
            client.post("/api/watch-rules", json={}),
            client.get("/api/watch-rules", params={"limit": "not-an-integer"}),
            client.get("/api/watch-rules/not-a-rule-id"),
            client.patch("/api/watch-rules/not-a-rule-id", json={}),
            client.post("/api/watch-rules/not-a-rule-id/evaluate", json={}),
        ]
    finally:
        app.dependency_overrides.clear()

    assert [response.status_code for response in responses] == [404] * 5
    assert all(response.json() == {"detail": "Not Found"} for response in responses)
    assert calls == {"db": 0, "rate_limit": 0}


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("POST", "/api/watch-rules"),
        ("PATCH", "/api/watch-rules/not-a-rule-id"),
        ("POST", "/api/watch-rules/not-a-rule-id/evaluate"),
    ],
)
@pytest.mark.parametrize(
    ("content", "content_type"),
    [
        ("{", "application/json"),
        (b'{"name":"\xff"}', "application/json"),
        ("{", "application/problem+json"),
    ],
)
def test_flag_off_masks_watch_rules_before_body_decode(
    client, monkeypatch, method, path, content, content_type
) -> None:
    _set_flag(monkeypatch, False)

    response = client.request(
        method,
        path,
        content=content,
        headers={"Content-Type": content_type},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Not Found"}


@pytest.mark.asyncio
async def test_flag_off_gate_skips_receive_and_preserves_prefix_boundaries(
    monkeypatch,
) -> None:
    from feature_gates import AlertRulesActivationGateMiddleware

    calls = {"app": 0, "receive": 0}
    messages: list[dict] = []

    async def downstream(_scope, _receive, send) -> None:
        calls["app"] += 1
        await send({"type": "http.response.start", "status": 204, "headers": []})
        await send({"type": "http.response.body", "body": b""})

    async def forbidden_receive():
        calls["receive"] += 1
        raise AssertionError("activation gate consumed the request body")

    async def capture(message) -> None:
        messages.append(message)

    gate = AlertRulesActivationGateMiddleware(downstream)
    scope = {"type": "http", "method": "POST", "path": "/api/watch-rules"}

    _set_flag(monkeypatch, False)
    await gate(scope, forbidden_receive, capture)

    assert calls == {"app": 0, "receive": 0}
    assert messages[0]["status"] == 404
    assert messages[1]["body"] == b'{"detail":"Not Found"}'

    for path in ("/api/watch-rules-x", "/api/alerts/events"):
        messages.clear()
        await gate({**scope, "path": path}, forbidden_receive, capture)
        assert messages[0]["status"] == 204

    _set_flag(monkeypatch, True)
    messages.clear()
    await gate(scope, forbidden_receive, capture)

    assert calls == {"app": 3, "receive": 0}
    assert messages[0]["status"] == 204


def test_flag_off_mask_precedes_request_body_limits(client, monkeypatch) -> None:
    from request_limits import JSON_BODY_LIMIT_BYTES

    headers = {
        "Content-Type": "application/json",
        "Content-Length": str(JSON_BODY_LIMIT_BYTES + 1),
    }
    _set_flag(monkeypatch, False)
    disabled = client.post("/api/watch-rules", content="{}", headers=headers)

    _set_flag(monkeypatch, True)
    enabled = client.post("/api/watch-rules", content="{}", headers=headers)

    assert disabled.status_code == 404
    assert disabled.json() == {"detail": "Not Found"}
    assert enabled.status_code == 413
    assert enabled.json() == {"detail": "Request body too large."}


def test_global_csrf_and_edge_policy_remain_outside_flag_off_mask(
    client, monkeypatch
) -> None:
    from config import get_settings

    _set_flag(monkeypatch, False)
    csrf_rejected = client.post(
        "/api/watch-rules",
        content="{",
        headers={
            "Content-Type": "application/json",
            "Host": "caos.example",
            "Sec-Fetch-Site": "cross-site",
        },
    )

    current = get_settings()
    monkeypatch.setattr(current, "environment", "production")
    monkeypatch.setattr(current, "edge_proxy_secret", "edge-secret")
    edge_rejected = client.get("/api/watch-rules")

    assert csrf_rejected.status_code == 403
    assert csrf_rejected.json() == {"detail": "Cross-site API mutation rejected."}
    assert edge_rejected.status_code == 401
    assert edge_rejected.json() == {
        "detail": "Request did not carry a valid edge credential."
    }


@pytest.mark.asyncio
async def test_flag_off_completed_run_trigger_is_a_side_effect_free_noop(
    monkeypatch,
) -> None:
    from alert_triggers import trigger_completed_run

    _set_flag(monkeypatch, False)
    calls = {"session": 0}

    def forbidden_session_factory():
        calls["session"] += 1
        raise AssertionError("completed-run trigger opened a session while disabled")

    result = await trigger_completed_run(
        "run-that-must-not-be-read", session_factory=forbidden_session_factory
    )

    assert (result.status, result.observations, result.materialized) == (
        "evaluated",
        0,
        0,
    )
    assert calls == {"session": 0}


@pytest.mark.asyncio
async def test_flag_off_scheduled_evaluation_does_not_claim_or_read_clock(
    monkeypatch,
) -> None:
    from alert_triggers import evaluate_scheduled_rule

    _set_flag(monkeypatch, False)
    calls = {"session": 0, "clock": 0}

    def forbidden_session_factory():
        calls["session"] += 1
        raise AssertionError("scheduled evaluation opened a session while disabled")

    def forbidden_clock():
        calls["clock"] += 1
        raise AssertionError("scheduled evaluation read its clock while disabled")

    result = await evaluate_scheduled_rule(
        session_factory=forbidden_session_factory,
        now="not-a-datetime",  # type: ignore[arg-type]
        clock=forbidden_clock,
        cursor=object(),
    )

    assert (result.status, result.rule_id, result.outcome) == ("no_claim", None, None)
    assert calls == {"session": 0, "clock": 0}


@pytest.mark.asyncio
async def test_flag_off_dispatch_does_not_read_clock_claim_or_render(
    monkeypatch,
) -> None:
    from alert_dispatch import dispatch_once

    _set_flag(monkeypatch, False)
    calls = {"session": 0, "clock": 0, "sink": 0}

    def forbidden_session_factory():
        calls["session"] += 1
        raise AssertionError("dispatch opened a session while disabled")

    def forbidden_clock():
        calls["clock"] += 1
        raise AssertionError("dispatch read its clock while disabled")

    class ForbiddenRegistry(dict):
        def get(self, *_args, **_kwargs):
            calls["sink"] += 1
            raise AssertionError("dispatch read its sink registry while disabled")

    result = await dispatch_once(
        forbidden_session_factory, ForbiddenRegistry(), forbidden_clock
    )

    assert result is None
    assert calls == {"session": 0, "clock": 0, "sink": 0}


def test_flag_off_keeps_legacy_event_and_state_lifecycle_available(
    client, monkeypatch
) -> None:
    from database import AlertEvent, AsyncSessionLocal

    _set_flag(monkeypatch, False)
    event_id = str(uuid4())
    alert_key = f"legacy-activation:{event_id}"
    kind = f"activation-{event_id}"

    async def seed_event() -> None:
        async with AsyncSessionLocal.begin() as session:
            session.add(
                AlertEvent(
                    id=event_id,
                    alert_key=alert_key,
                    kind=kind,
                    title="Legacy activation event",
                    impact="Must remain visible during C3 rollback.",
                    evidence={"source": "legacy"},
                    authority={"origin": "test"},
                    created_at=NOW,
                    updated_at=NOW,
                )
            )

    asyncio.run(seed_event())
    listed = client.get("/api/alerts/events", params={"kind": kind})
    opened = client.post(
        "/api/alerts/state", json={"alert_key": alert_key, "state": "open"}
    )
    acknowledged = client.post(
        "/api/alerts/state", json={"alert_key": alert_key, "state": "ack"}
    )
    resolved = client.patch(
        f"/api/alerts/events/{event_id}",
        json={"state": "resolved", "resolution_note": "Reviewed."},
    )

    assert listed.status_code == 200, listed.text
    assert [row["id"] for row in listed.json()] == [event_id]
    assert opened.status_code == 200 and opened.json()["state"] == "open"
    assert acknowledged.status_code == 200 and acknowledged.json()["state"] == "ack"
    assert resolved.status_code == 200 and resolved.json()["state"] == "resolved"


def test_flag_on_watch_rule_crud_and_manual_evaluation_smoke(
    client, monkeypatch
) -> None:
    _set_flag(monkeypatch, True)
    marker = uuid4().hex
    created = client.post(
        "/api/watch-rules",
        json={
            "name": f"Activation smoke {marker}",
            "signal_type": "qa_gate",
            "enabled": True,
            "paused": False,
            "issuer_id": None,
            "portfolio_id": None,
            "schedule_kind": "event_driven",
            "schedule_interval_seconds": None,
            "next_evaluation_at": None,
            "config": {
                "operator": "present",
                "threshold": None,
                "kind": "activation-smoke",
                "title": "Activation smoke",
                "impact": "Flag-on boundary remains operational.",
            },
        },
    )
    assert created.status_code == 201, created.text

    rule_id = created.json()["id"]
    fetched = client.get(f"/api/watch-rules/{rule_id}")
    evaluated = client.post(
        f"/api/watch-rules/{rule_id}/evaluate",
        json={
            "source_identity": f"test:activation:{marker}",
            "observed_at": NOW.isoformat(),
            "numeric_value": None,
            "categorical_value": "critical",
            "detail": {"marker": marker},
            "source_artifact_refs": [f"test:activation:{marker}"],
            "hop_count": 0,
        },
    )

    assert fetched.status_code == 200 and fetched.json()["id"] == rule_id
    assert evaluated.status_code == 200, evaluated.text
    assert evaluated.json()["outcome"] == "matched"
    assert evaluated.json()["alert_event_id"]
