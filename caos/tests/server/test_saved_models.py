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
