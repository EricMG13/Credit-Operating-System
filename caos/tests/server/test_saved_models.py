"""Saved Model Builder state (GET/PUT /api/models/{issuer_id}) — the DB copy
Report Studio reads. Covers: null before save, roundtrip persistence, unknown
issuer 404 with its own detail (regression for the SPA 404-handler masking)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    from main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def issuer_id(client):
    r = client.post("/api/issuers", json={"name": "Saved Model Roundtrip Co"})
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def test_get_before_any_save_is_null(client, issuer_id):
    r = client.get(f"/api/models/{issuer_id}")
    assert r.status_code == 200, r.text
    assert r.json() is None


def test_put_then_get_roundtrips_payload(client, issuer_id):
    payload = {
        "version": 1,
        "assumptions": {"base": {"revG": 3.5}},
        "overrides": {"rev:b1": 1234.0},
        "collapsedRows": ["capex"],
    }
    r = client.put(f"/api/models/{issuer_id}", json={"payload": payload})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["issuer_id"] == issuer_id
    assert body["payload"] == payload
    assert body["updated_at"]

    r2 = client.get(f"/api/models/{issuer_id}")
    assert r2.status_code == 200
    assert r2.json()["payload"] == payload


def test_put_overwrites_previous_save(client, issuer_id):
    r = client.put(f"/api/models/{issuer_id}", json={"payload": {"version": 1, "overrides": {}}})
    assert r.status_code == 200
    assert r.json()["payload"] == {"version": 1, "overrides": {}}


def test_unknown_issuer_404_keeps_custom_detail(client):
    # The SAVE MODEL button on the ATLF reference page hits exactly this path
    # (portfolio code, not a registry id). The SPA 404 handler must not mask
    # the endpoint's own detail into a generic "Not Found".
    r = client.put("/api/models/NOT-A-REGISTRY-ID", json={"payload": {"version": 1}})
    assert r.status_code == 404
    assert r.json() == {"detail": "Issuer not found"}


def test_malformed_body_is_422(client, issuer_id):
    # payload has a dict default, so a missing key is tolerated — but a wrong
    # TYPE must be rejected by validation, not stored.
    r = client.put(f"/api/models/{issuer_id}", json={"payload": "not-a-dict"})
    assert r.status_code == 422


# ── #6b: optimistic-concurrency guard (pre-prod audit, deferred half of #6) ──
# One analyst editing the same model in two tabs must not have the second save
# silently clobber the first — the client sends the updated_at it last saw, and
# a stale value is rejected with 409 instead of a last-write-wins overwrite.

def test_stale_expected_updated_at_is_409(client):
    r = client.post("/api/issuers", json={"name": "Saved Model Conflict Co"})
    assert r.status_code in (200, 201), r.text
    iid = r.json()["id"]

    first = client.put(f"/api/models/{iid}", json={"payload": {"version": 1, "tab": "A"}})
    assert first.status_code == 200, first.text
    stale_ts = first.json()["updated_at"]

    # Tab B saves next, moving updated_at forward.
    second = client.put(f"/api/models/{iid}", json={"payload": {"version": 1, "tab": "B"}})
    assert second.status_code == 200, second.text
    assert second.json()["updated_at"] != stale_ts

    # Tab A, still holding the ORIGINAL updated_at, tries to save — must be
    # rejected rather than silently overwriting tab B's save.
    conflict = client.put(
        f"/api/models/{iid}",
        json={"payload": {"version": 1, "tab": "A-again"}, "expected_updated_at": stale_ts},
    )
    assert conflict.status_code == 409, conflict.text
    assert conflict.json()["detail"]["current"]["payload"] == {"version": 1, "tab": "B"}

    # Tab B's save is untouched.
    still_b = client.get(f"/api/models/{iid}")
    assert still_b.json()["payload"] == {"version": 1, "tab": "B"}


def test_matching_expected_updated_at_saves_normally(client):
    r = client.post("/api/issuers", json={"name": "Saved Model No-Conflict Co"})
    assert r.status_code in (200, 201), r.text
    iid = r.json()["id"]

    first = client.put(f"/api/models/{iid}", json={"payload": {"version": 1, "n": 1}})
    ts = first.json()["updated_at"]

    second = client.put(
        f"/api/models/{iid}",
        json={"payload": {"version": 1, "n": 2}, "expected_updated_at": ts},
    )
    assert second.status_code == 200, second.text
    assert second.json()["payload"] == {"version": 1, "n": 2}


def test_no_expected_updated_at_skips_the_check(client, issuer_id):
    # Backward-compatible: omitting the field (the old client shape) must not
    # start 409-ing every save, even though this issuer already has a row
    # from the earlier tests in this module.
    r = client.put(f"/api/models/{issuer_id}", json={"payload": {"version": 1, "no_check": True}})
    assert r.status_code == 200, r.text
