"""IC Decision Record (C8, expansion 4.1) — the append-only per-issuer
"what did we decide, when, on what evidence, and who dissented" record.
"""

from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

SERVER_DIR = Path(__file__).resolve().parents[2] / "server"
sys.path.insert(0, str(SERVER_DIR))


@pytest.fixture(scope="session")
def client(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("caos-decision-record")
    os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{tmp / 'test.db'}"
    os.environ["CAOS_STORAGE_DIR"] = str(tmp / "vault")
    os.environ["ANTHROPIC_API_KEY"] = ""
    from main import app  # imported after env is set

    with TestClient(app) as c:
        yield c


@pytest.fixture()
def issuer_id(client):
    # Unique name per test — the shared session-scoped client persists issuers
    # across the whole file (no cleanup, matching test_qa_flags.py's own
    # convention), and create_issuer dedups case-insensitively.
    r = client.post("/api/issuers/", json={"name": f"ZZDecisionCo {uuid.uuid4().hex[:8]}"})
    assert r.status_code == 201, r.text
    return r.json()["id"]


_BODY = {
    "recommendation": "OVERWEIGHT",
    "conviction": "HIGH",
    "thesis": "Deleveraging ahead of schedule; refi risk is manageable.",
    "committee_date": "2026-07-10",
    "decision": "approved",
}


def test_create_decision_record_stamps_analyst_and_returns_fields(client, issuer_id):
    r = client.post("/api/decisions", json={**_BODY, "issuer_id": issuer_id, "dissent": "One member flagged FX exposure."})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["issuer_id"] == issuer_id
    assert body["recommendation"] == "OVERWEIGHT"
    assert body["conviction"] == "HIGH"
    assert body["decision"] == "approved"
    assert body["dissent"] == "One member flagged FX exposure."
    assert body["run_id"] is None
    assert body["report_id"] is None
    assert body["analyst_id"]  # local-dev identity stamps the record
    assert body["created_at"]


def test_create_rejects_unknown_issuer(client):
    r = client.post("/api/decisions", json={**_BODY, "issuer_id": "no-such-issuer"})
    assert r.status_code == 404


def test_create_rejects_invalid_recommendation_and_decision(client, issuer_id):
    assert client.post("/api/decisions", json={**_BODY, "issuer_id": issuer_id, "recommendation": "BUY"}).status_code == 422
    assert client.post("/api/decisions", json={**_BODY, "issuer_id": issuer_id, "decision": "maybe"}).status_code == 422
    assert client.post("/api/decisions", json={**_BODY, "issuer_id": issuer_id, "conviction": "SUPER-HIGH"}).status_code == 422


def test_dissent_empty_string_normalizes_to_null(client, issuer_id):
    r = client.post("/api/decisions", json={**_BODY, "issuer_id": issuer_id, "dissent": "   "})
    assert r.status_code == 201
    assert r.json()["dissent"] is None


def test_list_filters_by_issuer_and_orders_newest_first(client, issuer_id):
    other = client.post("/api/issuers/", json={"name": "ZZDecisionCo Two"}).json()["id"]
    client.post("/api/decisions", json={**_BODY, "issuer_id": issuer_id, "thesis": "First."})
    client.post("/api/decisions", json={**_BODY, "issuer_id": issuer_id, "thesis": "Second."})
    client.post("/api/decisions", json={**_BODY, "issuer_id": other, "thesis": "Unrelated."})

    hits = client.get("/api/decisions", params={"issuer_id": issuer_id}).json()
    assert len(hits) == 2
    assert hits[0]["thesis"] == "Second."  # newest first
    assert all(h["issuer_id"] == issuer_id for h in hits)
    # list joins Issuer for the cross-issuer Command board view.
    assert all(h["issuer_name"].startswith("ZZDecisionCo") for h in hits)


def test_append_only_no_update_or_delete_route(client, issuer_id):
    r = client.post("/api/decisions", json={**_BODY, "issuer_id": issuer_id})
    record_id = r.json()["id"]
    assert client.put(f"/api/decisions/{record_id}", json={}).status_code in (404, 405)
    assert client.delete(f"/api/decisions/{record_id}").status_code in (404, 405)


def test_thesis_required_and_bounded(client, issuer_id):
    assert client.post("/api/decisions", json={**_BODY, "issuer_id": issuer_id, "thesis": ""}).status_code == 422
    assert client.post("/api/decisions", json={**_BODY, "issuer_id": issuer_id, "thesis": "x" * 3000}).status_code == 422
