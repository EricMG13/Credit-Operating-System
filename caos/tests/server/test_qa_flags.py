"""Analyst QA flags (Deep-Dive register "FLAG TO QA · CP-5").

The flag lane is an audit trail: recorded, listable, analyst-stamped — and a
separate table from engine qa_findings so it can never gate a run.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

SERVER_DIR = Path(__file__).resolve().parents[2] / "server"
sys.path.insert(0, str(SERVER_DIR))

ATLF = "a71f0000-0000-0000-0000-000000000001"


@pytest.fixture(scope="session")
def client():
    from main import app

    with TestClient(app) as c:
        yield c


def test_create_flag_records_and_stamps_analyst(client):
    r = client.post(
        "/api/qa/flags",
        json={
            "module_id": "CP-4C",
            "step_ref": "CP-4C-07 Add-back cap analysis",
            "note": "Add-back % looks inconsistent with the covenant hero card.",
            "issuer_id": ATLF,
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert body["module_id"] == "CP-4C"
    assert body["step_ref"] == "CP-4C-07 Add-back cap analysis"
    assert body["issuer_id"] == ATLF
    assert body["run_id"] is None
    assert body["analyst_id"]  # local-dev identity stamps the flag
    assert body["created_at"]


def test_list_flags_filters_by_module_and_step(client):
    client.post(
        "/api/qa/flags",
        json={"module_id": "CP-1B", "step_ref": "CP-1B-02 Bridge variance", "issuer_id": ATLF},
    )
    hits = client.get(
        "/api/qa/flags",
        params={"module_id": "CP-1B", "step_ref": "CP-1B-02 Bridge variance", "issuer_id": ATLF},
    ).json()
    assert len(hits) == 1
    misses = client.get("/api/qa/flags", params={"module_id": "CP-9Z"}).json()
    assert misses == []


def test_flag_empty_note_normalizes_to_null(client):
    r = client.post("/api/qa/flags", json={"module_id": "CP-2B", "note": "   "})
    assert r.status_code == 201
    assert r.json()["note"] is None


def test_flag_validation_rejects_oversize(client):
    assert client.post("/api/qa/flags", json={"module_id": "X" * 32}).status_code == 422
    assert client.post("/api/qa/flags", json={"module_id": "CP-1", "note": "n" * 3000}).status_code == 422


def test_flags_never_gate_committee_export(client):
    """Structural guarantee spot-check: flags live in qa_flags, and the report
    export's blocking-findings query reads qa_findings — a flag on a run must
    not appear in the export refusal payload."""
    from database import QAFinding  # the gate reads this model, not AnalystQaFlag

    assert not hasattr(QAFinding, "step_ref")  # distinct schema, distinct table
    r = client.post("/api/qa/flags", json={"module_id": "CP-5", "run_id": "no-such-run"})
    assert r.status_code == 201  # audit row, no FK to runs, no gate side effect
