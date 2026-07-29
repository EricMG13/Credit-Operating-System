"""E3 — audit_log coverage: one row per mutating-route class (PRE_DEPLOYMENT_PLAN
§7). See ``audit.py`` for the exact scope (what's audited and what's
deliberately excluded as personal/non-institutional state).

Each test drives a real route through ``TestClient`` and asserts the exact
audit row it must produce — action, target_type, and the before/after keys
that make the row useful, not just present. GDPR anonymization is covered
separately in ``test_gdpr_erase.py``.
"""
from __future__ import annotations

import io
import sqlite3

import pytest
from fastapi.testclient import TestClient


def _connect() -> sqlite3.Connection:
    # conftest's _DB_PATH is captured ONCE at import time from the ORIGINAL
    # DATABASE_URL — the one the live engine actually binds to. Re-reading
    # os.environ here would pick up whatever the LAST-run test file's client
    # fixture reassigned it to (test_api.py's `client` fixture does this),
    # pointing sqlite3 at a stale/different path with no audit_log table.
    from conftest import _DB_PATH

    con = sqlite3.connect(_DB_PATH, timeout=30)
    con.row_factory = sqlite3.Row
    return con


@pytest.fixture()
def audit_client():
    """Function-scoped TestClient (not named ``client``) so conftest's
    ``_restore_issuer_baseline`` cleans up issuers this file creates — this
    suite runs in the shared process-global DB. That autouse cleanup covers
    issuers/documents/metric_facts/query_accepted_links only; explicitly clean
    the rest this file creates (runs, portfolios+positions, qa flags, the
    audit_log rows themselves, and the extra analyst the register test makes)
    so this file's tests don't accumulate state other tests can trip over."""
    from main import app

    with TestClient(app) as c:
        # Snapshot AFTER entering the client (lifespan creates the schema —
        # querying before it exists is a bare `sqlite3.OperationalError` when
        # this file runs before any other test has initialized the DB).
        con = _connect()
        before_run_ids = {r[0] for r in con.execute("SELECT id FROM runs")}
        before_analyst_ids = {r[0] for r in con.execute("SELECT id FROM analysts")}
        con.close()

        yield c

    con = _connect()
    try:
        new_run_ids = {r[0] for r in con.execute("SELECT id FROM runs")} - before_run_ids
        if new_run_ids:
            ph = ",".join("?" * len(new_run_ids))
            con.execute(f"DELETE FROM qa_findings WHERE run_id IN ({ph})", tuple(new_run_ids))
            con.execute(f"DELETE FROM module_outputs WHERE run_id IN ({ph})", tuple(new_run_ids))
            con.execute(f"DELETE FROM metric_facts WHERE run_id IN ({ph})", tuple(new_run_ids))
            con.execute(f"DELETE FROM issuer_research_reports WHERE run_id IN ({ph})", tuple(new_run_ids))
            con.execute(f"DELETE FROM runs WHERE id IN ({ph})", tuple(new_run_ids))
        con.execute("DELETE FROM qa_flags WHERE note = ?", ("audit coverage probe",))
        con.execute(
            "DELETE FROM portfolio_positions WHERE portfolio_id IN "
            "(SELECT id FROM portfolios WHERE name = ?)", ("Audit Coverage CLO 1",),
        )
        con.execute("DELETE FROM portfolios WHERE name = ?", ("Audit Coverage CLO 1",))
        new_analyst_ids = {r[0] for r in con.execute("SELECT id FROM analysts")} - before_analyst_ids
        if new_analyst_ids:
            ph = ",".join("?" * len(new_analyst_ids))
            con.execute(f"DELETE FROM audit_log WHERE analyst_id IN ({ph})", tuple(new_analyst_ids))
            con.execute(f"DELETE FROM analysts WHERE id IN ({ph})", tuple(new_analyst_ids))
        con.commit()
    finally:
        con.close()


def _query_audit_rows(action: str) -> list[dict]:
    con = _connect()
    try:
        rows = con.execute(
            "SELECT * FROM audit_log WHERE action = ? ORDER BY created_at DESC", (action,)
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        con.close()


def _tiny_pdf() -> bytes:
    content = b"BT /F1 10 Tf 40 780 Td (audit coverage probe) Tj ET"
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content + b"\nendstream",
    ]
    pdf = b"%PDF-1.4\n"
    offsets = []
    for i, o in enumerate(objs, 1):
        offsets.append(len(pdf))
        pdf += f"{i} 0 obj\n".encode() + o + b"\nendobj\n"
    xref_at = len(pdf)
    pdf += b"xref\n0 " + str(len(objs) + 1).encode() + b"\n0000000000 65535 f \n"
    for off in offsets:
        pdf += ("%010d 00000 n \n" % off).encode()
    return (pdf + b"trailer\n<< /Size " + str(len(objs) + 1).encode()
            + b" /Root 1 0 R >>\nstartxref\n" + str(xref_at).encode() + b"\n%%EOF")


def test_issuer_create_writes_audit_row(audit_client):
    before = len(_query_audit_rows("issuer.create"))
    r = audit_client.post("/api/issuers", json={"name": "Audit Coverage Co", "ticker": "AUDCOV"})
    assert r.status_code == 201, r.text
    issuer_id = r.json()["id"]

    rows = _query_audit_rows("issuer.create")
    assert len(rows) == before + 1
    row = rows[0]
    assert row["target_type"] == "issuer"
    assert row["target_id"] == issuer_id
    assert row["analyst_id"]  # stamped with the real caller, not blank


def test_document_upload_writes_audit_row(audit_client):
    issuer_id = audit_client.post(
        "/api/issuers", json={"name": "Audit Upload Co"}
    ).json()["id"]

    r = audit_client.post(
        "/api/ingestion/upload/document",
        data={"issuer_id": issuer_id, "run_mode": "earnings"},
        files={"file": ("audit-probe.pdf", _tiny_pdf(), "application/pdf")},
    )
    assert r.status_code == 200, r.text
    doc_id = r.json()["document_id"]

    rows = _query_audit_rows("document.upload")
    hit = next((row for row in rows if row["target_id"] == doc_id), None)
    assert hit is not None, "no document.upload audit row for the uploaded document"
    assert hit["target_type"] == "document"


def test_pricing_sheet_rating_edit_writes_audit_row(audit_client):
    from openpyxl import Workbook

    issuer_id = audit_client.post(
        "/api/issuers", json={"name": "Audit Rated Co", "ticker": "AUDRAT"}
    ).json()["id"]

    wb = Workbook()
    ws = wb.active
    ws.append(["Borrower Name", "Ticker", "Holdings", "Ratings"])
    ws.append(["Audit Rated Co", "AUDRAT", 1_000_000, "B1 / B+"])
    buf = io.BytesIO()
    wb.save(buf)

    r = audit_client.post(
        "/api/ingestion/upload/pricing-sheet",
        data={"issuer_id": issuer_id, "run_mode": "full"},
        files={"file": ("audit-ratings.xlsx", buf.getvalue(), "application/vnd.ms-excel")},
    )
    assert r.status_code == 200, r.text
    assert r.json().get("ratings_updated") == 1

    rows = _query_audit_rows("issuer.rating_update")
    hit = next((row for row in rows if row["target_id"] == issuer_id), None)
    assert hit is not None, "no issuer.rating_update audit row for the rated issuer"
    assert hit["after"] is not None


def test_run_create_writes_audit_row(audit_client):
    from conftest import wait_for_run

    issuer_id = audit_client.post(
        "/api/issuers", json={"name": "Audit Run Co"}
    ).json()["id"]

    r = audit_client.post("/api/runs", json={"issuer_id": issuer_id})
    assert r.status_code == 201, r.text
    run_id = r.json()["id"]
    # Wait the run out rather than leaving it executing in the background: the
    # in-process executor is a genuine asyncio task independent of this
    # request's lifecycle (run_executor.InProcessExecutor._spawn), so an
    # un-awaited run can still be mid-execution when a LATER, unrelated test
    # starts — the established convention every run-creating test in this
    # suite follows.
    wait_for_run(audit_client, run_id)

    rows = _query_audit_rows("run.create")
    hit = next((row for row in rows if row["target_id"] == run_id), None)
    assert hit is not None, "no run.create audit row for the created run"
    assert hit["target_type"] == "run"


def test_qa_flag_create_writes_audit_row(audit_client):
    r = audit_client.post("/api/qa/flags", json={"module_id": "CP-1", "note": "audit coverage probe"})
    assert r.status_code == 201, r.text
    flag_id = r.json()["id"]

    rows = _query_audit_rows("qa_flag.create")
    hit = next((row for row in rows if row["target_id"] == flag_id), None)
    assert hit is not None, "no qa_flag.create audit row for the created flag"


def test_query_link_accept_and_retract_write_audit_rows(audit_client):
    a = audit_client.post("/api/issuers", json={"name": "Audit Link A"}).json()["id"]
    b = audit_client.post("/api/issuers", json={"name": "Audit Link B"}).json()["id"]

    accepted = audit_client.post(
        "/api/query/links",
        json={"source_issuer_id": a, "target_issuer_id": b, "capability_id": "test",
              "rationale": "audit coverage probe", "chunk_ids": [], "confidence": "High"},
    )
    assert accepted.status_code == 200, accepted.text
    link_id = accepted.json()["id"]

    create_rows = _query_audit_rows("query_link.create")
    assert any(row["target_id"] == link_id for row in create_rows)

    retracted = audit_client.delete(f"/api/query/links/{link_id}")
    assert retracted.status_code == 200, retracted.text

    retract_rows = _query_audit_rows("query_link.retract")
    hit = next((row for row in retract_rows if row["target_id"] == link_id), None)
    assert hit is not None, "no query_link.retract audit row for the retracted link"
    assert hit["before"] is not None


def test_portfolio_create_writes_audit_row(audit_client):
    from openpyxl import Workbook

    audit_client.post("/api/issuers", json={"name": "Audit Portfolio Co"})

    wb = Workbook()
    ws = wb.active
    ws.title = "Holdings"
    ws.append(["Borrower Name", "Holdings"])
    ws.append(["Audit Portfolio Co", 2_000_000])
    buf = io.BytesIO()
    wb.save(buf)

    r = audit_client.post(
        "/api/portfolios",
        data={"name": "Audit Coverage CLO 1", "kind": "CLO"},
        files={"holdings": ("audit-holdings.xlsx", buf.getvalue(), "application/vnd.ms-excel")},
    )
    assert r.status_code == 201, r.text
    portfolio_id = r.json()["id"]

    rows = _query_audit_rows("portfolio.create")
    hit = next((row for row in rows if row["target_id"] == portfolio_id), None)
    assert hit is not None, "no portfolio.create audit row for the created portfolio"


def test_analyst_register_writes_audit_row(audit_client):
    import os

    os.environ["ANALYST_SIGNUP_CODE"] = "audit-coverage-code"
    from config import get_settings
    get_settings.cache_clear()
    try:
        r = audit_client.post(
            "/api/auth/register",
            json={"code": "audit-coverage-code", "name": "Audit Registrant",
                  "email": "audit-registrant@test.local", "passcode": "audit-coverage-pass1",
                  "recovery_words": ["alpha", "bravo", "charlie"]},
        )
        assert r.status_code == 201, r.text
        analyst_id = r.json()["id"]
    finally:
        os.environ.pop("ANALYST_SIGNUP_CODE", None)
        get_settings.cache_clear()

    rows = _query_audit_rows("analyst.register")
    hit = next((row for row in rows if row["target_id"] == analyst_id), None)
    assert hit is not None, "no analyst.register audit row for the registered analyst"
