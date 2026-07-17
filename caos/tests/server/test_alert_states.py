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
