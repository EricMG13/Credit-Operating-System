"""CP-0 SourceReadiness — issuer-grounded document assessment (replaces the canned
ATLF fixture). Classification unit tests + the runner wiring for a fully-sourced
issuer (ATLF) and a fresh issuer with no documents.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from config import get_settings
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


def test_categorize_by_content_head():
    # Real SEC filings/exhibits are named by accession number / "EX-10.1" — the
    # (uninformative) name matches nothing, so they must classify by head content (#25).
    tenk = _doc("Document", "0000950170-25-077138.pdf")
    assert _categorize(tenk, "UNITED STATES SECURITIES AND EXCHANGE COMMISSION Form 10-K "
                             "ANNUAL REPORT PURSUANT TO SECTION 13 OR 15(d)") == {"financials"}
    agreement = _doc("Document", "EX-10.1.pdf")
    assert _categorize(agreement, "Exhibit 10.1 Execution Version CREDIT AGREEMENT dated as of "
                                  "January 21, 2026 among VIASAT TECHNOLOGIES LIMITED, as Borrower") == {"agreement"}
    assert _categorize(_doc("Document", "cert.pdf"),
                       "COMPLIANCE CERTIFICATE delivered pursuant to Section 6.01") == {"covenant"}
    # no markers + uninformative name → unclassified (e.g. an earnings deck)
    assert _categorize(_doc("Document", "deck.pdf"), "Q4 FY2026 Earnings Results May 28, 2026") == set()


def test_categorize_ifrs_quarterly_report():
    # Non-US / IFRS issuers (e.g. Virgin Media O2, a mixed bond + term-loan credit) file
    # quarterly investor reports headed "Condensed Consolidated Financial Statements" /
    # IFRS "Statement of Financial Position" — these are financials despite carrying no
    # US-10-K markers.
    rpt = _doc("Document", "VMO2-IFRS-Quarterly-Report-Q1-2025.pdf")
    assert _categorize(rpt, "Quarterly Report and Condensed Consolidated Financial "
                            "Statements 31 March 2025. Condensed Consolidated Statement of "
                            "Financial Position") == {"financials"}


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


def test_fresh_issuer_cp0_reports_no_docs(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "edgar_user_agent", "CAOS tests ops@example.test")
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


def test_ticker_does_not_claim_edgar_when_execution_is_disabled(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "edgar_user_agent", "")
    iss = client.post("/api/issuers/", json={"name": "EDGAR Disabled Co", "ticker": "OFFX"}).json()
    run = wait_for_run(client, client.post("/api/runs", json={"issuer_id": iss["id"]}).json()["id"])

    ro = client.get(f"/api/runs/{run['id']}/modules/CP-0").json()["runtime_output"]
    assert ro["edgar_available"] is False
    assert not any(g["id"] == "G-EDGAR" for g in ro["gap_log"])


@pytest.mark.asyncio
async def test_readiness_combines_multiple_head_chunks_and_reports_medium(seeded_db):
    import hashlib
    import uuid

    from database import AsyncSessionLocal, Document, DocumentChunk, Issuer
    from engine.readiness import synthesize_source_readiness

    async with AsyncSessionLocal() as db:
        issuer = Issuer(id=str(uuid.uuid4()), name="Partial Readiness Co", ticker=None)
        db.add(issuer)
        await db.flush()
        doc = Document(
            issuer_id=issuer.id,
            doc_type="Document",
            file_name="accession.pdf",
            storage_key="test:partial-readiness",
            chunk_count=2,
        )
        db.add(doc)
        await db.flush()
        for seq, text in enumerate(("Form 10-K", "Consolidated financial statements")):
            db.add(DocumentChunk(
                document_id=doc.id,
                seq=seq,
                text=text,
                chunk_hash=hashlib.sha256(text.encode()).hexdigest(),
            ))
        await db.flush()

        result = await synthesize_source_readiness(db, issuer)

    assert result.confidence == "Medium"
    assert result.runtime_output["categories_present"] == ["financials"]
