"""Alert states (Watchtower ack/assign — Command's ranked changes + Monitor's
alert inbox share these rows, never gates a run, upsert keyed on alert_key)."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

SERVER_DIR = Path(__file__).resolve().parents[2] / "server"
sys.path.insert(0, str(SERVER_DIR))


@pytest.fixture(scope="module")
def client():
    from main import app

    with TestClient(app) as c:
        yield c


_C3_RULE_BOUNDARY_TESTS = frozenset(
    {
        "test_contextual_alert_lists_and_patch_are_404_masked_across_named_teams",
        "test_direct_c3_state_writes_require_visible_context_before_rate_limit",
    }
)


@pytest.fixture(autouse=True)
def _enable_alert_rules_for_c3_boundaries(request, monkeypatch):
    """Keep legacy alert tests default-off; opt in only C3 rule-backed cases."""
    test_name = getattr(request.node, "originalname", request.node.name)
    if test_name not in _C3_RULE_BOUNDARY_TESTS:
        return
    from config import get_settings

    monkeypatch.setitem(
        get_settings().__dict__, "caos_alert_rules_v1_enabled", True
    )


def test_create_state_records_and_stamps_analyst(client):
    r = client.post(
        "/api/alerts/state",
        json={"alert_key": "run-1:ATLF:cusum-shift:ebitda_margin", "state": "ack"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["alert_key"] == "run-1:ATLF:cusum-shift:ebitda_margin"
    assert body["state"] == "ack"
    assert body["analyst_id"]  # local-dev identity stamps the row
    assert body["created_at"]


def test_second_post_for_same_key_upserts_not_duplicates(client):
    key = "run-2:QLMH:peer-outlier:net_leverage"
    r1 = client.post("/api/alerts/state", json={"alert_key": key, "state": "ack", "assignee": "e.guei"})
    assert r1.status_code == 200
    id1 = r1.json()["id"]

    r2 = client.post("/api/alerts/state", json={"alert_key": key, "state": "ack", "assignee": "j.mora"})
    assert r2.status_code == 200
    assert r2.json()["id"] == id1  # same row, updated — not a new one
    assert r2.json()["assignee"] == "j.mora"

    hits = client.get("/api/alerts/state", params={"alert_key": key}).json()
    assert len(hits) == 1


def test_later_cycle_reset_is_a_new_key_not_inherited_ack(client):
    """A re-fired anomaly in a later run cycle is a genuinely new event —
    its alert_key differs (run_id changes), so it must start open, not
    silently inherit the earlier cycle's ack."""
    older = client.post(
        "/api/alerts/state", json={"alert_key": "run-3:EG:ts-jump:dm", "state": "ack"}
    ).json()
    newer_hits = client.get("/api/alerts/state", params={"alert_key": "run-4:EG:ts-jump:dm"}).json()
    assert older["state"] == "ack"
    assert newer_hits == []  # nothing recorded yet for the new cycle's key


def test_state_validation_rejects_unknown_value(client):
    assert client.post(
        "/api/alerts/state", json={"alert_key": "run-5:X:kind:metric", "state": "bogus"}
    ).status_code == 422


def test_resolve_stamps_resolved_at_and_accepts_a_resolution_note(client):
    key = "run-7:BLHP:cusum-shift:leverage"
    client.post("/api/alerts/state", json={"alert_key": key, "state": "open"})
    r = client.post(
        "/api/alerts/state",
        json={"alert_key": key, "state": "resolved", "resolution_note": "Refinanced — no longer a covenant risk."},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["state"] == "resolved"
    assert body["resolved_at"]
    assert body["resolution_note"] == "Refinanced — no longer a covenant risk."


def test_a_fresh_key_may_open_directly_at_any_state_including_resolved(client):
    # No prior row exists for this key — there is nothing to regress FROM, so
    # the fail-closed lattice never blocks a first-ever write.
    r = client.post("/api/alerts/state", json={"alert_key": "run-8:NEW:ts-jump:dm", "state": "resolved"})
    assert r.status_code == 200
    assert r.json()["state"] == "resolved"


def test_cannot_regress_a_resolved_alert_back_to_ack(client):
    key = "run-9:QLMH:ts-jump:dm"
    client.post("/api/alerts/state", json={"alert_key": key, "state": "resolved"})
    r = client.post("/api/alerts/state", json={"alert_key": key, "state": "ack"})
    assert r.status_code == 409


def test_cannot_regress_an_acked_alert_back_to_open(client):
    key = "run-10:QLMH:ts-jump:dm"
    client.post("/api/alerts/state", json={"alert_key": key, "state": "ack"})
    r = client.post("/api/alerts/state", json={"alert_key": key, "state": "open"})
    assert r.status_code == 409


def test_same_state_repatch_is_idempotent_not_a_rejected_regression(client):
    key = "run-11:QLMH:ts-jump:dm"
    client.post("/api/alerts/state", json={"alert_key": key, "state": "ack"})
    # Re-PATCHing the SAME state (e.g. to change the assignee) is not a
    # regression — it must succeed, not 409.
    r = client.post("/api/alerts/state", json={"alert_key": key, "state": "ack", "assignee": "j.mora"})
    assert r.status_code == 200
    assert r.json()["assignee"] == "j.mora"


def test_re_resolving_preserves_the_original_resolved_at_and_note_when_none_is_sent(client):
    key = "run-12:QLMH:ts-jump:dm"
    first = client.post(
        "/api/alerts/state",
        json={"alert_key": key, "state": "resolved", "resolution_note": "Original reason"},
    ).json()
    again = client.post(
        "/api/alerts/state", json={"alert_key": key, "state": "resolved", "assignee": "j.mora"},
    ).json()
    assert again["resolved_at"] == first["resolved_at"]  # not re-stamped forward
    assert again["resolution_note"] == "Original reason"  # not silently blanked
    assert again["assignee"] == "j.mora"


def test_empty_assignee_and_note_normalize_to_null(client):
    r = client.post(
        "/api/alerts/state",
        json={"alert_key": "run-6:X:kind:metric", "state": "open", "assignee": "  ", "note": "  "},
    )
    assert r.status_code == 200
    assert r.json()["assignee"] is None
    assert r.json()["note"] is None


def test_event_patch_preserves_omitted_assignment_and_note(client):
    import asyncio
    from uuid import uuid4

    from database import AlertEvent, AsyncSessionLocal

    event_id = str(uuid4())
    alert_key = f"legacy-event-patch:{uuid4()}"

    async def seed_event():
        async with AsyncSessionLocal.begin() as session:
            session.add(
                AlertEvent(
                    id=event_id,
                    alert_key=alert_key,
                    kind="event-patch-preservation",
                    title="Preserve workflow metadata",
                    impact="Ack and resolve must not erase assignment custody.",
                    evidence={},
                    authority={},
                )
            )

    asyncio.run(seed_event())
    seeded = client.post(
        "/api/alerts/state",
        json={
            "alert_key": alert_key,
            "state": "open",
            "assignee": "credit-owner",
            "note": "Retain through lifecycle changes.",
        },
    )
    assert seeded.status_code == 200, seeded.text

    acknowledged = client.patch(
        f"/api/alerts/events/{event_id}",
        json={"state": "ack"},
    )
    assert acknowledged.status_code == 200, acknowledged.text
    assert acknowledged.json()["assignee"] == "credit-owner"
    assert acknowledged.json()["note"] == "Retain through lifecycle changes."

    resolved = client.patch(
        f"/api/alerts/events/{event_id}",
        json={"state": "resolved", "resolution_note": "Risk retired."},
    )
    assert resolved.status_code == 200, resolved.text
    assert resolved.json()["assignee"] == "credit-owner"
    assert resolved.json()["note"] == "Retain through lifecycle changes."
    assert resolved.json()["resolution_note"] == "Risk retired."

    cleared = client.patch(
        f"/api/alerts/events/{event_id}",
        json={"state": "resolved", "assignee": None, "note": "  "},
    )
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["assignee"] is None
    assert cleared.json()["note"] is None
    assert cleared.json()["resolution_note"] == "Risk retired."


def test_list_unfiltered_and_by_missing_key(client):
    all_rows = client.get("/api/alerts/state").json()
    assert len(all_rows) >= 4  # every state created above accumulates
    assert client.get("/api/alerts/state", params={"alert_key": "no-such-key"}).json() == []


def test_states_never_touch_run_or_qa_gates(client):
    """Structural guarantee spot-check: AlertState carries no FK to runs and
    lives outside qa_findings — an ack/assign can never gate a run or a
    committee export."""
    from database import AlertState, QAFinding

    assert not hasattr(QAFinding, "assignee")  # distinct schema, distinct table
    r = client.post("/api/alerts/state", json={"alert_key": "no-such-run:X:kind:metric", "state": "ack"})
    assert r.status_code == 200  # audit row, no FK to runs, no gate side effect
    assert AlertState.__tablename__ == "alert_states"


def test_event_list_keeps_legacy_list_shape_with_bounded_filter_bound_cursor(client):
    import asyncio
    from datetime import datetime, timedelta, timezone
    from uuid import uuid4

    from database import AlertEvent, AsyncSessionLocal

    prefix = f"legacy-cursor-{uuid4()}"

    async def seed_events():
        now = datetime.now(timezone.utc)
        async with AsyncSessionLocal.begin() as session:
            for index in range(3):
                session.add(
                    AlertEvent(
                        id=str(uuid4()),
                        alert_key=f"{prefix}:{index}",
                        kind="cursor-test",
                        title=f"Cursor event {index}",
                        impact="bounded",
                        evidence={"index": index},
                        authority={"origin": "test"},
                        created_at=now - timedelta(seconds=index),
                        updated_at=now - timedelta(seconds=index),
                    )
                )

    asyncio.run(seed_events())
    first = client.get("/api/alerts/events", params={"kind": "cursor-test", "limit": 2})
    assert first.status_code == 200, first.text
    assert first.headers["x-alert-event-can-mutate"] == "true"
    assert isinstance(first.json(), list) and len(first.json()) == 2
    expected_keys = {
        "id",
        "alert_key",
        "issuer_id",
        "run_id",
        "kind",
        "title",
        "impact",
        "evidence",
        "authority",
        "state",
        "assignee",
        "note",
        "resolved_at",
        "resolution_note",
        "created_at",
        "updated_at",
    }
    assert set(first.json()[0]) == expected_keys
    cursor = first.headers.get("x-next-cursor")
    assert cursor

    second = client.get(
        "/api/alerts/events",
        params={"kind": "cursor-test", "limit": 2, "cursor": cursor},
    )
    assert second.status_code == 200
    assert second.headers["x-alert-event-can-mutate"] == "true"
    assert len(second.json()) == 1
    assert {row["id"] for row in first.json()}.isdisjoint(
        {row["id"] for row in second.json()}
    )

    assert (
        client.get(
            "/api/alerts/events",
            params={"kind": "different", "limit": 2, "cursor": cursor},
        ).status_code
        == 400
    )
    assert client.get("/api/alerts/events", params={"limit": 0}).status_code == 422
    assert client.get("/api/alerts/events", params={"limit": 201}).status_code == 422


def test_event_list_reports_exact_server_mutation_capability_for_writer_and_viewer(
    client,
):
    from uuid import uuid4

    from identity import CallerIdentity, get_identity
    from main import app

    def as_role(role: str):
        async def dependency():
            return CallerIdentity(
                id=f"event-capability-{role}",
                email=f"event-capability-{role}@example.test",
                full_name=f"Event capability {role}",
                role=role,
                source="profile",
            )

        app.dependency_overrides[get_identity] = dependency

    kind = f"event-capability-{uuid4()}"
    try:
        as_role("analyst")
        writer_page = client.get("/api/alerts/events", params={"kind": kind})
        assert writer_page.status_code == 200, writer_page.text
        assert writer_page.json() == []
        assert writer_page.headers["x-alert-event-can-mutate"] == "true"

        as_role("viewer")
        viewer_page = client.get("/api/alerts/events", params={"kind": kind})
        assert viewer_page.status_code == 200, viewer_page.text
        assert viewer_page.json() == []
        assert viewer_page.headers["x-alert-event-can-mutate"] == "false"
    finally:
        app.dependency_overrides.clear()


def test_contextual_alert_lists_and_patch_are_404_masked_across_named_teams(
    client, monkeypatch
):
    from datetime import datetime, timezone

    import rate_limit
    from config import get_settings
    from identity import CallerIdentity, get_identity
    from main import app

    def as_caller(user_id: str, team_id: str):
        async def dependency():
            return CallerIdentity(
                id=user_id,
                email=f"{user_id}@example.test",
                full_name=user_id,
                role="analyst",
                source="profile",
                team_id=team_id,
            )

        app.dependency_overrides[get_identity] = dependency

    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)
    rate_limit.reset()
    try:
        as_caller("alert-owner-a", "alert-team-a")
        rule = client.post(
            "/api/watch-rules",
            headers={"Idempotency-Key": "alert-states-scoped-context"},
            json={
                "name": "Scoped alert watch",
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
                    "kind": "scoped-context-test",
                    "title": "Scoped context event",
                    "impact": "Do not leak across teams.",
                },
            },
        )
        assert rule.status_code == 201, rule.text
        evaluated = client.post(
            f"/api/watch-rules/{rule.json()['id']}/evaluate",
            json={
                "source_identity": f"fact:scoped:{rule.json()['id']}",
                "observed_at": datetime.now(timezone.utc).isoformat(),
                "numeric_value": None,
                "categorical_value": "critical",
                "detail": {"finding": "scoped"},
                "source_artifact_refs": [],
                "hop_count": 0,
            },
        )
        assert evaluated.status_code == 200, evaluated.text
        event_id = evaluated.json()["alert_event_id"]
        own_event = next(
            row
            for row in client.get(
                "/api/alerts/events", params={"kind": "scoped-context-test"}
            ).json()
            if row["id"] == event_id
        )
        client.post(
            "/api/alerts/state",
            json={"alert_key": own_event["alert_key"], "state": "ack"},
        )

        as_caller("alert-outsider-b", "alert-team-b")
        foreign_events = client.get(
            "/api/alerts/events", params={"kind": "scoped-context-test"}
        )
        assert foreign_events.status_code == 200
        assert all(row["id"] != event_id for row in foreign_events.json())
        assert (
            client.get(
                "/api/alerts/state", params={"alert_key": own_event["alert_key"]}
            ).json()
            == []
        )
        masked = client.patch(
            f"/api/alerts/events/{event_id}", json={"state": "resolved"}
        )
        assert masked.status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_direct_c3_state_writes_require_visible_context_before_rate_limit(
    client, monkeypatch
):
    import asyncio
    from datetime import datetime, timezone
    from uuid import uuid4

    import rate_limit
    from config import get_settings
    from database import AlertEvent, AsyncSessionLocal
    from identity import CallerIdentity, get_identity
    from main import app

    def as_caller(user_id: str, team_id: str):
        async def dependency():
            return CallerIdentity(
                id=user_id,
                email=f"{user_id}@example.test",
                full_name=user_id,
                role="analyst",
                source="profile",
                team_id=team_id,
            )

        app.dependency_overrides[get_identity] = dependency

    settings = get_settings()
    monkeypatch.setattr(settings, "caos_tenancy_enabled", True)
    rate_limit.reset()
    try:
        as_caller("state-owner-a", "state-team-a")
        rule = client.post(
            "/api/watch-rules",
            headers={"Idempotency-Key": "alert-states-direct-state"},
            json={
                "name": "Direct state capability",
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
                    "kind": "direct-state-capability",
                    "title": "Direct state capability event",
                    "impact": "Keep direct writes scoped.",
                },
            },
        )
        assert rule.status_code == 201, rule.text
        evaluated = client.post(
            f"/api/watch-rules/{rule.json()['id']}/evaluate",
            json={
                "source_identity": f"fact:direct-state:{uuid4()}",
                "observed_at": datetime.now(timezone.utc).isoformat(),
                "numeric_value": None,
                "categorical_value": "critical",
                "detail": {"finding": "scoped"},
                "source_artifact_refs": [],
                "hop_count": 0,
            },
        )
        assert evaluated.status_code == 200, evaluated.text
        event_id = evaluated.json()["alert_event_id"]
        own_event = next(
            row
            for row in client.get(
                "/api/alerts/events", params={"kind": "direct-state-capability"}
            ).json()
            if row["id"] == event_id
        )

        rate_calls = []

        def record_hit(key, **_kwargs):
            rate_calls.append(key)
            return True

        monkeypatch.setattr(rate_limit, "hit", record_hit)
        owner_write = client.post(
            "/api/alerts/state",
            json={"alert_key": own_event["alert_key"], "state": "ack"},
        )
        assert owner_write.status_code == 200, owner_write.text
        assert len(rate_calls) == 1

        rate_calls.clear()
        as_caller("state-outsider-b", "state-team-b")
        masked = client.post(
            "/api/alerts/state",
            json={
                "alert_key": own_event["alert_key"],
                "state": "resolved",
                "resolution_note": "must not leak or mutate",
            },
        )
        assert masked.status_code == 404
        assert rate_calls == []

        as_caller("state-owner-a", "state-team-a")
        owner_rows = client.get(
            "/api/alerts/state", params={"alert_key": own_event["alert_key"]}
        ).json()
        assert owner_rows[0]["state"] == "ack"
        assert owner_rows[0]["resolution_note"] is None

        rate_calls.clear()
        monkeypatch.setattr(settings, "caos_tenancy_enabled", False)
        unknown_c3 = client.post(
            "/api/alerts/state",
            json={"alert_key": f"c3:{'f' * 64}", "state": "ack"},
        )
        assert unknown_c3.status_code == 404
        assert rate_calls == []

        uncontexted_key = f"c3:{uuid4().hex}{uuid4().hex}"

        async def seed_uncontexted_c3_event():
            async with AsyncSessionLocal.begin() as session:
                session.add(
                    AlertEvent(
                        id=str(uuid4()),
                        alert_key=uncontexted_key,
                        kind="uncontexted-c3-test",
                        title="Uncontexted C3 event",
                        impact="must remain immutable through direct state writes",
                        evidence={},
                        authority={},
                    )
                )

        asyncio.run(seed_uncontexted_c3_event())
        uncontexted_c3 = client.post(
            "/api/alerts/state",
            json={"alert_key": uncontexted_key, "state": "ack"},
        )
        assert uncontexted_c3.status_code == 404
        assert rate_calls == []

        legacy = client.post(
            "/api/alerts/state",
            json={"alert_key": f"legacy-direct:{uuid4()}", "state": "ack"},
        )
        assert legacy.status_code == 200, legacy.text
        assert len(rate_calls) == 1
    finally:
        app.dependency_overrides.clear()


def test_profileless_proxy_tenancy_off_keeps_legacy_alerts_but_cannot_adopt_c3(
    client, monkeypatch
):
    import asyncio
    from datetime import datetime, timezone
    from uuid import uuid4

    from config import get_settings
    from database import AlertEvent, AlertState, Analyst, AsyncSessionLocal
    from sqlalchemy import select

    settings = get_settings()
    monkeypatch.setattr(settings, "caos_alert_rules_v1_enabled", True)
    monkeypatch.setattr(settings, "caos_tenancy_enabled", True)

    profile_id = str(uuid4())
    profile_email = f"matched-alert-owner-{uuid4()}@example.test"
    profile_headers = {
        "X-Forwarded-User": f"matched-proxy-subject-{uuid4()}",
        "X-Forwarded-Email": profile_email.swapcase(),
        "X-Forwarded-Preferred-Username": "Matched alert owner",
    }
    unmatched_user = f"profileless-alert-user-{uuid4()}"
    unmatched_headers = {
        "X-Forwarded-User": unmatched_user,
        "X-Forwarded-Email": f"unmatched-{uuid4()}@example.test",
        "X-Forwarded-Preferred-Username": "Profileless alert user",
    }
    legacy_event_id = str(uuid4())
    legacy_key = f"legacy-profileless-proxy:{uuid4()}"
    legacy_orphan_key = f"legacy-profileless-orphan:{uuid4()}"
    c3_orphan_event_id = str(uuid4())
    c3_orphan_key = f"c3:{uuid4().hex}{uuid4().hex}"

    async def seed_profile_and_legacy_events():
        async with AsyncSessionLocal.begin() as session:
            session.add(
                Analyst(
                    id=profile_id,
                    name="Matched Alert Owner",
                    email=profile_email,
                    role="qa",
                    team_id=None,
                )
            )
            session.add_all(
                [
                    AlertEvent(
                        id=legacy_event_id,
                        alert_key=legacy_key,
                        kind="profileless-proxy-legacy",
                        title="Legacy shared-desk alert",
                        impact="Legacy alert behavior remains available.",
                        evidence={},
                        authority={},
                    ),
                    AlertEvent(
                        id=c3_orphan_event_id,
                        alert_key=c3_orphan_key,
                        kind="profileless-proxy-c3-orphan",
                        title="Contextless C3 orphan",
                        impact="A C3-shaped orphan is never legacy authority.",
                        evidence={},
                        authority={},
                    ),
                ]
            )

    asyncio.run(seed_profile_and_legacy_events())
    created = client.post(
        "/api/watch-rules",
        headers={
            **profile_headers,
            "Idempotency-Key": f"profileless-alert-visibility-{uuid4()}",
        },
        json={
            "name": "Profileless proxy C3 visibility",
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
                "kind": "profileless-proxy-c3-context",
                "title": "Profile-backed C3 alert",
                "impact": "Only a durable profile may own its workflow state.",
            },
        },
    )
    assert created.status_code == 201, created.text
    evaluated = client.post(
        f"/api/watch-rules/{created.json()['id']}/evaluate",
        headers=profile_headers,
        json={
            "source_identity": f"profileless-alert-visibility:{uuid4()}",
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "numeric_value": None,
            "categorical_value": "critical",
            "detail": {"fixture": "profileless proxy alert boundary"},
            "source_artifact_refs": [],
            "hop_count": 0,
        },
    )
    assert evaluated.status_code == 200, evaluated.text
    c3_event_id = evaluated.json()["alert_event_id"]

    async def alert_key_for_event() -> str:
        async with AsyncSessionLocal() as session:
            event = await session.get(AlertEvent, c3_event_id)
            assert event is not None
            return event.alert_key

    c3_key = asyncio.run(alert_key_for_event())
    seeded_c3_state = client.post(
        "/api/alerts/state",
        headers=profile_headers,
        json={"alert_key": c3_key, "state": "open"},
    )
    assert seeded_c3_state.status_code == 200, seeded_c3_state.text
    assert seeded_c3_state.json()["analyst_id"] == profile_id

    tenancy_on_c3_patch = client.patch(
        f"/api/alerts/events/{c3_event_id}",
        headers=unmatched_headers,
        json={"state": "ack", "note": "UNASSIGNED is not shared C3 authority."},
    )
    tenancy_on_c3_upsert = client.post(
        "/api/alerts/state",
        headers=unmatched_headers,
        json={"alert_key": c3_key, "state": "resolved"},
    )
    tenancy_on_visible_event_ids = {
        row["id"]
        for row in client.get("/api/alerts/events", headers=unmatched_headers).json()
    }
    tenancy_on_visible_c3_states = client.get(
        "/api/alerts/state",
        headers=unmatched_headers,
        params={"alert_key": c3_key},
    ).json()

    monkeypatch.setattr(settings, "caos_tenancy_enabled", False)
    unmatched_identity = client.get("/api/auth/me", headers=unmatched_headers)
    legacy_patch = client.patch(
        f"/api/alerts/events/{legacy_event_id}",
        headers=unmatched_headers,
        json={"state": "ack", "note": "Legacy workflow remains writable."},
    )
    legacy_orphan_state = client.post(
        "/api/alerts/state",
        headers=unmatched_headers,
        json={"alert_key": legacy_orphan_key, "state": "ack"},
    )
    c3_patch = client.patch(
        f"/api/alerts/events/{c3_event_id}",
        headers=unmatched_headers,
        json={"state": "ack", "note": "Must not adopt C3 ownership."},
    )
    c3_orphan_patch = client.patch(
        f"/api/alerts/events/{c3_orphan_event_id}",
        headers=unmatched_headers,
        json={"state": "ack"},
    )
    c3_upsert = client.post(
        "/api/alerts/state",
        headers=unmatched_headers,
        json={"alert_key": c3_key, "state": "resolved"},
    )
    c3_orphan_upsert = client.post(
        "/api/alerts/state",
        headers=unmatched_headers,
        json={"alert_key": c3_orphan_key, "state": "ack"},
    )
    visible_event_ids = {
        row["id"]
        for row in client.get("/api/alerts/events", headers=unmatched_headers).json()
    }
    visible_c3_states = client.get(
        "/api/alerts/state",
        headers=unmatched_headers,
        params={"alert_key": c3_key},
    ).json()
    visible_legacy_orphan_states = client.get(
        "/api/alerts/state",
        headers=unmatched_headers,
        params={"alert_key": legacy_orphan_key},
    ).json()

    async def persisted_c3_states() -> list[tuple[str | None, str]]:
        async with AsyncSessionLocal() as session:
            return list(
                (
                    await session.execute(
                        select(AlertState.analyst_id, AlertState.state).where(
                            AlertState.alert_key.in_([c3_key, c3_orphan_key])
                        )
                    )
                ).all()
            )

    assert {
        "unmatched_identity_id": unmatched_identity.json()["id"],
        "legacy_patch": legacy_patch.status_code,
        "legacy_orphan_upsert": legacy_orphan_state.status_code,
        "tenancy_on_c3_patch": tenancy_on_c3_patch.status_code,
        "tenancy_on_c3_upsert": tenancy_on_c3_upsert.status_code,
        "tenancy_on_c3_visible": c3_event_id in tenancy_on_visible_event_ids,
        "tenancy_on_visible_c3_states": tenancy_on_visible_c3_states,
        "c3_patch": c3_patch.status_code,
        "c3_orphan_patch": c3_orphan_patch.status_code,
        "c3_upsert": c3_upsert.status_code,
        "c3_orphan_upsert": c3_orphan_upsert.status_code,
        "legacy_event_visible": legacy_event_id in visible_event_ids,
        "contextual_c3_visible": c3_event_id in visible_event_ids,
        "orphan_c3_visible": c3_orphan_event_id in visible_event_ids,
        "visible_c3_states": visible_c3_states,
        "visible_legacy_orphan_states": len(visible_legacy_orphan_states),
        "persisted_c3_states": asyncio.run(persisted_c3_states()),
    } == {
        "unmatched_identity_id": unmatched_user,
        "legacy_patch": 200,
        "legacy_orphan_upsert": 200,
        "tenancy_on_c3_patch": 404,
        "tenancy_on_c3_upsert": 404,
        "tenancy_on_c3_visible": False,
        "tenancy_on_visible_c3_states": [],
        "c3_patch": 404,
        "c3_orphan_patch": 404,
        "c3_upsert": 404,
        "c3_orphan_upsert": 404,
        "legacy_event_visible": True,
        "contextual_c3_visible": False,
        "orphan_c3_visible": False,
        "visible_c3_states": [],
        "visible_legacy_orphan_states": 1,
        "persisted_c3_states": [(profile_id, "open")],
    }


def test_tenancy_on_legacy_alert_reads_require_a_visible_issuer_anchor(
    client, monkeypatch
):
    import asyncio
    from uuid import uuid4

    from config import get_settings
    from database import AlertEvent, AsyncSessionLocal, Issuer
    from identity import CallerIdentity, get_identity
    from main import app

    team_id = f"legacy-team-{uuid4()}"
    issuer_id = str(uuid4())
    visible_event_id = str(uuid4())
    unscoped_event_id = str(uuid4())

    async def seed_legacy():
        async with AsyncSessionLocal.begin() as session:
            session.add(
                Issuer(
                    id=issuer_id,
                    name=f"Legacy issuer {issuer_id}",
                    normalized_name=f"legacy issuer {issuer_id}",
                    team_id=team_id,
                    uniqueness_scope=team_id,
                    created_by="seed",
                )
            )
            session.add_all(
                [
                    AlertEvent(
                        id=visible_event_id,
                        alert_key=f"legacy-visible:{visible_event_id}",
                        issuer_id=issuer_id,
                        kind="legacy-scope-test",
                        title="Issuer anchored",
                        impact="visible",
                        evidence={},
                        authority={},
                    ),
                    AlertEvent(
                        id=unscoped_event_id,
                        alert_key=f"legacy-unscoped:{unscoped_event_id}",
                        issuer_id=None,
                        kind="legacy-scope-test",
                        title="Unscoped",
                        impact="hidden",
                        evidence={},
                        authority={},
                    ),
                ]
            )

    async def identity():
        return CallerIdentity(
            id="legacy-reader",
            email="legacy@example.test",
            full_name="Legacy Reader",
            role="analyst",
            source="profile",
            team_id=team_id,
        )

    asyncio.run(seed_legacy())
    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)
    app.dependency_overrides[get_identity] = identity
    try:
        rows = client.get(
            "/api/alerts/events", params={"kind": "legacy-scope-test"}
        ).json()
        assert {row["id"] for row in rows} == {visible_event_id}
    finally:
        app.dependency_overrides.clear()


def test_tenancy_on_orphan_alert_state_is_readable_only_by_its_analyst_owner(
    client, monkeypatch
):
    from uuid import uuid4

    from config import get_settings
    from identity import CallerIdentity, get_identity
    from main import app

    key = f"orphan-state:{uuid4()}"

    def as_caller(user_id: str):
        async def dependency():
            return CallerIdentity(
                id=user_id,
                email=f"{user_id}@example.test",
                full_name=user_id,
                role="analyst",
                source="profile",
                team_id="orphan-team",
            )

        app.dependency_overrides[get_identity] = dependency

    monkeypatch.setattr(get_settings(), "caos_tenancy_enabled", True)
    try:
        as_caller("orphan-owner")
        created = client.post(
            "/api/alerts/state", json={"alert_key": key, "state": "ack"}
        )
        assert created.status_code == 200
        owner_rows = client.get("/api/alerts/state", params={"alert_key": key}).json()
        assert len(owner_rows) == 1

        as_caller("orphan-teammate")
        assert client.get("/api/alerts/state", params={"alert_key": key}).json() == []
    finally:
        app.dependency_overrides.clear()
