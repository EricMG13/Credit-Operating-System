"""Scoped HTTP contracts for C3 watch rules and manual evaluation."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

SERVER_DIR = Path(__file__).resolve().parents[2] / "server"
sys.path.insert(0, str(SERVER_DIR))


def _identity(user_id: str, *, role: str = "analyst", team_id: str | None = None):
    from identity import CallerIdentity

    async def dependency() -> CallerIdentity:
        return CallerIdentity(
            id=user_id,
            email=f"{user_id}@example.test",
            full_name=user_id,
            role=role,
            source="profile",
            team_id=team_id,
        )

    return dependency


@pytest.fixture(scope="module")
def client():
    from main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def _reset_route_policy(monkeypatch):
    import rate_limit
    from config import get_settings
    from identity import get_identity
    from main import app

    settings = get_settings()
    monkeypatch.setattr(settings, "caos_tenancy_enabled", False)
    rate_limit.reset()
    app.dependency_overrides[get_identity] = _identity("route-owner")
    yield
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def _enable_alert_rules_boundary(monkeypatch):
    """Existing Task 5 route contracts explicitly exercise the flag-on seam."""
    from config import get_settings

    monkeypatch.setitem(
        get_settings().__dict__, "caos_alert_rules_v1_enabled", True
    )


def _create_payload(**overrides):
    payload = {
        "name": "QA gate watch",
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
            "kind": "qa_change",
            "title": "QA gate changed",
            "impact": "Review governed evidence.",
        },
    }
    payload.update(overrides)
    return payload


def _manual_payload(source_identity: str, **overrides):
    payload = {
        "source_identity": source_identity,
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "numeric_value": None,
        "categorical_value": "critical",
        "detail": {"safe": "fact"},
        "source_artifact_refs": ["fact:governed:1"],
        "hop_count": 0,
    }
    payload.update(overrides)
    return payload


def _as(user_id: str, *, role: str = "analyst", team_id: str | None = None):
    from identity import get_identity
    from main import app

    app.dependency_overrides[get_identity] = _identity(
        user_id, role=role, team_id=team_id
    )


def test_create_and_read_return_only_safe_operational_fields(client):
    response = client.post("/api/watch-rules", json=_create_payload())
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["name"] == "QA gate watch"
    assert body["current_version"] == 1
    assert body["config"]["operator"] == "present"
    for secret_field in (
        "config_json",
        "tenant_id",
        "owner_user_id",
        "team_id_snapshot",
        "claim_token",
        "claim_expires_at",
        "claim_attempt_count",
        "schedule_cursor",
    ):
        assert secret_field not in body

    fetched = client.get(f"/api/watch-rules/{body['id']}")
    assert fetched.status_code == 200
    assert fetched.json() == body


def test_requests_forbid_forged_authority_and_bool_integer_coercion(client):
    forged = _create_payload(tenant_id="other-team", owner_user_id="attacker")
    assert client.post("/api/watch-rules", json=forged).status_code == 422

    boolean_interval = _create_payload(
        schedule_kind="interval",
        schedule_interval_seconds=True,
        next_evaluation_at=datetime.now(timezone.utc).isoformat(),
    )
    assert client.post("/api/watch-rules", json=boolean_interval).status_code == 422


def test_scheduled_rule_accepts_aware_json_datetime_on_create_and_patch(client):
    next_at = datetime.now(timezone.utc).isoformat()
    created = client.post(
        "/api/watch-rules",
        json=_create_payload(
            schedule_kind="interval",
            schedule_interval_seconds=60,
            next_evaluation_at=next_at,
        ),
    )
    assert created.status_code == 201, created.text
    assert created.json()["next_evaluation_at"]

    patched = client.patch(
        f"/api/watch-rules/{created.json()['id']}",
        json={
            "expected_version": 1,
            "patch": {"next_evaluation_at": next_at},
        },
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["current_version"] == 2


def test_viewer_is_rejected_before_rate_limit_consumption(client, monkeypatch):
    import rate_limit

    calls = 0

    def counted_hit(*_args, **_kwargs):
        nonlocal calls
        calls += 1
        return True

    monkeypatch.setattr(rate_limit, "hit", counted_hit)
    _as("readonly", role="viewer")
    response = client.post("/api/watch-rules", json=_create_payload())
    assert response.status_code == 403
    assert calls == 0


def test_scope_capabilities_precede_rate_limits_for_create_patch_and_evaluate(
    client, monkeypatch
):
    from uuid import uuid4

    import rate_limit
    from config import get_settings
    from database import AsyncSessionLocal, Issuer

    foreign_issuer_id = str(uuid4())

    async def seed_foreign_issuer():
        async with AsyncSessionLocal.begin() as session:
            session.add(
                Issuer(
                    id=foreign_issuer_id,
                    name=f"Foreign issuer {foreign_issuer_id}",
                    normalized_name=f"foreign issuer {foreign_issuer_id}",
                    team_id="rate-team-b",
                    uniqueness_scope="rate-team-b",
                    created_by="seed",
                )
            )

    asyncio.run(seed_foreign_issuer())
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)
    _as("rate-owner", team_id="rate-team-a")
    owned = client.post("/api/watch-rules", json=_create_payload()).json()

    calls = 0

    def reject_if_called(*_args, **_kwargs):
        nonlocal calls
        calls += 1
        return False

    monkeypatch.setattr(rate_limit, "hit", reject_if_called)

    unauthorized_create = client.post(
        "/api/watch-rules", json=_create_payload(issuer_id=foreign_issuer_id)
    )
    assert unauthorized_create.status_code == 404
    assert calls == 0

    _as("rate-outsider", team_id="rate-team-b")
    foreign_patch = client.patch(
        f"/api/watch-rules/{owned['id']}",
        json={"expected_version": 1, "patch": {"name": "foreign edit"}},
    )
    assert foreign_patch.status_code == 404
    assert calls == 0

    foreign_evaluation = client.post(
        f"/api/watch-rules/{owned['id']}/evaluate",
        json=_manual_payload("fact:foreign-rate-order"),
    )
    assert foreign_evaluation.status_code == 404
    assert calls == 0


def test_authorized_mutations_consume_their_documented_rate_lanes(client, monkeypatch):
    import rate_limit

    hits = []

    def record_hit(key, **_kwargs):
        hits.append(key)
        return True

    monkeypatch.setattr(rate_limit, "hit", record_hit)
    _as("lane-owner")
    created = client.post("/api/watch-rules", json=_create_payload())
    assert created.status_code == 201, created.text
    rule_id = created.json()["id"]

    patched = client.patch(
        f"/api/watch-rules/{rule_id}",
        json={"expected_version": 1, "patch": {"name": "Lane edit"}},
    )
    assert patched.status_code == 200, patched.text
    evaluated = client.post(
        f"/api/watch-rules/{rule_id}/evaluate",
        json=_manual_payload("fact:authorized-rate-lanes"),
    )
    assert evaluated.status_code == 200, evaluated.text
    assert hits == [
        "watch-rule:write:lane-owner",
        "watch-rule:write:lane-owner",
        "watch-rule:evaluate:lane-owner",
    ]


def test_named_team_reads_but_only_owner_or_admin_writes_and_lookup_is_masked(
    client, monkeypatch
):
    from config import get_settings

    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)
    _as("alice", team_id="desk-a")
    created = client.post("/api/watch-rules", json=_create_payload()).json()

    _as("teammate", team_id="desk-a")
    assert client.get(f"/api/watch-rules/{created['id']}").status_code == 200
    denied = client.patch(
        f"/api/watch-rules/{created['id']}",
        json={"expected_version": 1, "patch": {"name": "forged edit"}},
    )
    assert denied.status_code == 404

    _as("outsider", team_id="desk-b")
    assert client.get(f"/api/watch-rules/{created['id']}").status_code == 404
    assert client.get("/api/watch-rules/not-a-uuid").status_code == 404

    _as("desk-admin", role="admin", team_id="desk-a")
    updated = client.patch(
        f"/api/watch-rules/{created['id']}",
        json={"expected_version": 1, "patch": {"name": "admin edit"}},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["current_version"] == 2


def test_patch_rejects_stale_version_unavailable_source_and_rate_limit(
    client, monkeypatch
):
    import rate_limit

    created = client.post("/api/watch-rules", json=_create_payload()).json()
    stale = client.patch(
        f"/api/watch-rules/{created['id']}",
        json={"expected_version": 99, "patch": {"name": "stale"}},
    )
    assert stale.status_code == 409
    assert stale.json() == {"detail": "watch_rule_version_conflict"}

    unavailable = client.post(
        "/api/watch-rules",
        json=_create_payload(signal_type="news", enabled=True),
    )
    assert unavailable.status_code == 422

    monkeypatch.setattr(rate_limit, "hit", lambda *_args, **_kwargs: False)
    limited = client.patch(
        f"/api/watch-rules/{created['id']}",
        json={"expected_version": 1, "patch": {"name": "limited"}},
    )
    assert limited.status_code == 429
    assert limited.json() == {"detail": "watch_rule_rate_limited"}


def test_manual_evaluate_is_atomic_idempotent_and_only_returns_safe_state(client):
    created = client.post("/api/watch-rules", json=_create_payload()).json()
    payload = _manual_payload("fact:manual-idempotent")

    first = client.post(f"/api/watch-rules/{created['id']}/evaluate", json=payload)
    assert first.status_code == 200, first.text
    assert first.json()["outcome"] == "matched"
    assert first.json()["alert_event_id"]
    assert set(first.json()) == {
        "evaluation_id",
        "outcome",
        "alert_event_id",
        "created",
    }

    replay = client.post(f"/api/watch-rules/{created['id']}/evaluate", json=payload)
    assert replay.status_code == 200, replay.text
    assert replay.json()["evaluation_id"] == first.json()["evaluation_id"]
    assert replay.json()["alert_event_id"] == first.json()["alert_event_id"]
    assert replay.json()["created"] is False

    async def intent_state():
        from database import AlertDeliveryIntent, AsyncSessionLocal

        async with AsyncSessionLocal() as session:
            rows = (
                (
                    await session.execute(
                        select(AlertDeliveryIntent).where(
                            AlertDeliveryIntent.alert_event_id
                            == first.json()["alert_event_id"]
                        )
                    )
                )
                .scalars()
                .all()
            )
            return [(row.channel, row.status, row.rendered_intent) for row in rows]

    intents = asyncio.run(intent_state())
    assert intents == [("email", "pending", None), ("in_app", "pending", None)]


def test_manual_evaluate_rejects_client_scope_version_destination_and_inactive_rule(
    client,
):
    created = client.post(
        "/api/watch-rules", json=_create_payload(enabled=False)
    ).json()
    for field, value in (
        ("tenant_id", "forged"),
        ("rule_version", 1),
        ("watch_rule_id", created["id"]),
        ("destination_ref", "attacker@example.test"),
    ):
        payload = _manual_payload(f"fact:forged:{field}", **{field: value})
        assert (
            client.post(
                f"/api/watch-rules/{created['id']}/evaluate", json=payload
            ).status_code
            == 422
        )

    inactive = client.post(
        f"/api/watch-rules/{created['id']}/evaluate",
        json=_manual_payload("fact:inactive"),
    )
    assert inactive.status_code == 409
    assert inactive.json() == {"detail": "watch_rule_inactive"}


def test_manual_evaluate_rejects_unavailable_source_and_has_its_own_rate_limit(
    client, monkeypatch
):
    import rate_limit

    unavailable = client.post(
        "/api/watch-rules",
        json=_create_payload(signal_type="news", enabled=False),
    ).json()
    rejected = client.post(
        f"/api/watch-rules/{unavailable['id']}/evaluate",
        json=_manual_payload("fact:unavailable"),
    )
    assert rejected.status_code == 409
    assert rejected.json() == {"detail": "source_unavailable"}

    active = client.post("/api/watch-rules", json=_create_payload()).json()
    monkeypatch.setattr(rate_limit, "hit", lambda *_args, **_kwargs: False)
    limited = client.post(
        f"/api/watch-rules/{active['id']}/evaluate",
        json=_manual_payload("fact:evaluation-rate-limit"),
    )
    assert limited.status_code == 429
    assert limited.json() == {"detail": "watch_rule_rate_limited"}


def test_manual_evaluate_rolls_back_claim_if_materialization_fails(client, monkeypatch):
    import routes.watch_rules as watch_rule_routes

    created = client.post("/api/watch-rules", json=_create_payload()).json()
    source_identity = "fact:rollback"

    async def fail_materialization(*_args, **_kwargs):
        raise watch_rule_routes.MaterializationError("candidate_mismatch")

    monkeypatch.setattr(watch_rule_routes, "materialize_alert", fail_materialization)
    failed = client.post(
        f"/api/watch-rules/{created['id']}/evaluate",
        json=_manual_payload(source_identity),
    )
    assert failed.status_code == 409
    assert failed.json() == {"detail": "evaluation_rejected"}

    async def evaluation_count():
        from database import AsyncSessionLocal, WatchRuleEvaluation

        async with AsyncSessionLocal() as session:
            return await session.scalar(
                select(func.count())
                .select_from(WatchRuleEvaluation)
                .where(WatchRuleEvaluation.source_identity == source_identity)
            )

    assert asyncio.run(evaluation_count()) == 0


def test_rule_collection_is_bounded_and_cursor_is_scope_and_filter_bound(client):
    prefix = "cursor-rule-"
    for index in range(3):
        response = client.post(
            "/api/watch-rules",
            json=_create_payload(name=f"{prefix}{index}"),
        )
        assert response.status_code == 201

    first = client.get("/api/watch-rules", params={"limit": 2, "name_prefix": prefix})
    assert first.status_code == 200
    assert isinstance(first.json(), list) and len(first.json()) == 2
    cursor = first.headers.get("x-next-cursor")
    assert cursor

    second = client.get(
        "/api/watch-rules",
        params={"limit": 2, "name_prefix": prefix, "cursor": cursor},
    )
    assert second.status_code == 200
    assert len(second.json()) == 1
    assert {row["id"] for row in first.json()}.isdisjoint(
        {row["id"] for row in second.json()}
    )

    tampered = cursor[:-1] + ("0" if cursor[-1] != "0" else "1")
    assert (
        client.get(
            "/api/watch-rules",
            params={"limit": 2, "name_prefix": prefix, "cursor": tampered},
        ).status_code
        == 400
    )
    assert (
        client.get(
            "/api/watch-rules",
            params={"limit": 2, "name_prefix": "other", "cursor": cursor},
        ).status_code
        == 400
    )
    _as("other-reader")
    assert (
        client.get(
            "/api/watch-rules",
            params={"limit": 2, "name_prefix": prefix, "cursor": cursor},
        ).status_code
        == 400
    )
    assert client.get("/api/watch-rules", params={"limit": 0}).status_code == 422
    assert client.get("/api/watch-rules", params={"limit": 101}).status_code == 422
    assert client.get("/api/watch-rules", params={"limit": "true"}).status_code == 422
    assert (
        client.get(
            "/api/watch-rules", params={"signal_type": "not-a-signal"}
        ).status_code
        == 422
    )


def test_rule_cursor_fingerprint_explicitly_binds_tenancy_mode(monkeypatch):
    import routes.watch_rules as watch_rule_routes
    from config import get_settings
    from identity import CallerIdentity

    caller = CallerIdentity(
        id="fingerprint-user",
        email="fingerprint@example.test",
        full_name="Fingerprint User",
        role="analyst",
        source="profile",
        team_id="fingerprint-team",
    )
    monkeypatch.setattr(
        watch_rule_routes, "_scope_for_caller", lambda _caller: ("fixed", "fixed")
    )
    settings = get_settings()
    monkeypatch.setattr(settings, "caos_tenancy_enabled", False)
    disabled = watch_rule_routes._filter_fingerprint(
        caller=caller,
        signal_type=None,
        enabled=None,
        issuer_id=None,
        portfolio_id=None,
        name_prefix=None,
    )
    monkeypatch.setattr(settings, "caos_tenancy_enabled", True)
    enabled = watch_rule_routes._filter_fingerprint(
        caller=caller,
        signal_type=None,
        enabled=None,
        issuer_id=None,
        portfolio_id=None,
        name_prefix=None,
    )
    assert disabled != enabled
