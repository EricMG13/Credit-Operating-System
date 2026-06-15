"""CP-0 SourceReadiness — issuer-grounded document assessment (replaces the canned
ATLF fixture). Classification unit tests + the runner wiring for a fully-sourced
issuer (ATLF) and a fresh issuer with no documents.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from conftest import wait_for_run
from engine.fixtures import REFERENCE_ISSUER_ID
from engine.readiness import _categorize


def _doc(doc_type, file_name):
    return SimpleNamespace(doc_type=doc_type, file_name=file_name)


def test_categorize_by_type_and_filename():
    assert _categorize(_doc("Audit", "audited_financials_fy23_fy25.pdf")) == {"financials"}
    assert _categorize(_doc("SFA", "senior_facilities_agreement.pdf")) == {"agreement"}
    assert _categorize(_doc("Indenture", "ssn_indenture.pdf")) == {"agreement"}
    assert _categorize(_doc("OM", "offering_memorandum.pdf")) == {"offering"}
    assert _categorize(_doc("Covenant", "compliance_certificate_q1_2026.pdf")) == {"covenant"}
    assert _categorize(_doc("EDGAR-XBRL", "sec_edgar_xbrl_facts.txt")) == {"financials"}
    assert _categorize(_doc("Misc", "random_notes.txt")) == set()


@pytest.fixture(scope="module")
def client():
    from main import app

    with TestClient(app) as c:
        yield c


def test_atlf_cp0_grounded_in_real_docs(client):
    run = wait_for_run(client, client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID}).json()["id"])
    cp0 = client.get(f"/api/runs/{run['id']}/modules/CP-0").json()
    ro = cp0["runtime_output"]
    assert ro["files_classified"] >= 8
    assert set(ro["categories_present"]) == {"financials", "agreement", "offering", "covenant"}
    assert ro["readiness_score"] == 1.0
    # full coverage → Committee Ready (the engine test relies on this too)
    assert cp0["qa_status"] == "Passed" and cp0["committee_status"] == "Committee Ready"


def test_fresh_issuer_cp0_reports_no_docs(client):
    iss = client.post("/api/issuers/", json={"name": "Fresh Co", "ticker": "FRESHX"}).json()
    run = wait_for_run(client, client.post("/api/runs", json={"issuer_id": iss["id"]}).json()["id"])
    cp0 = client.get(f"/api/runs/{run['id']}/modules/CP-0").json()
    ro = cp0["runtime_output"]
    assert ro["files_classified"] == 0
    assert ro["edgar_available"] is True
    assert cp0["confidence"] == "Insufficient Information"
    assert any(g["id"] == "G-EDGAR" for g in ro["gap_log"])
    # no ATLF content leaking into a different issuer
    assert "atlas" not in str(ro).lower()
