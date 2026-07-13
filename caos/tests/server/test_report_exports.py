from io import BytesIO
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from openpyxl import load_workbook
from pypdf import PdfReader
from fastapi.testclient import TestClient

from report_exports import render_report_pdf, render_report_xlsx


PAYLOAD = {
    "document": {
        "run_id": "run-1",
        "issuer_id": "issuer-1",
        "as_of_date": "2026-06-30",
        "qa_status": "Passed",
        "committee_status": "Committee Ready",
        "prepared_by": "analyst-1",
        "sections": [
            {
                "module_id": "CP-1",
                "module_name": "Credit foundation",
                "confidence": 0.91,
                "qa_status": "Passed",
                "summary": {
                    "normalized_financials": {
                        "revenue": {"FY2025": 1_250.0},
                        "net_leverage_adj_ltm": 5.2,
                    },
                    "limitations": ["No covenant EBITDA bridge"],
                },
            },
            {
                "module_id": "CP-4C",
                "module_name": "Capacity",
                "confidence": 0.78,
                "qa_status": "Restricted",
                "summary": {"headroom": 85.0, "unit": "$M"},
            },
        ],
    },
}
AUTHORITY = {
    "origin": "live",
    "as_of": "2026-07-13T12:00:00Z",
    "approval_state": "published",
    "source_ids": ["manifest-1", "run-1", "checkpoint-1"],
}


def test_xlsx_export_reopens_with_typed_values_and_audit_sheets():
    content = render_report_xlsx(
        version_id="version-1",
        document_sha256="a" * 64,
        payload=PAYLOAD,
        authority=AUTHORITY,
    )
    assert content.startswith(b"PK")
    workbook = load_workbook(BytesIO(content), read_only=True, data_only=False)
    assert workbook.sheetnames[:3] == ["Cover", "Module Summary", "CP-1"]
    assert "Sources - Audit" in workbook.sheetnames
    assert workbook["Cover"]["B4"].value == "version-1"
    assert workbook["Module Summary"]["A2"].value == "CP-1"
    cp1_values = list(workbook["CP-1"].iter_rows(min_row=4, values_only=True))
    leverage = next(value for path, value in cp1_values if path == "normalized_financials.net_leverage_adj_ltm")
    assert leverage == 5.2
    assert isinstance(leverage, float)
    assert workbook["Sources - Audit"]["A2"].value == "manifest-1"
    workbook.close()


def test_pdf_export_reopens_and_carries_version_authority_and_modules():
    content = render_report_pdf(
        version_id="version-1",
        document_sha256="b" * 64,
        payload=PAYLOAD,
        authority=AUTHORITY,
    )
    assert content.startswith(b"%PDF-")
    reader = PdfReader(BytesIO(content))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    assert "CAOS IMMUTABLE COMMITTEE REPORT" in text
    assert "version-1" in text
    assert "CP-1" in text
    assert "Committee Ready" in text
    assert len(reader.pages) >= 3


@pytest.mark.asyncio
async def test_version_export_endpoint_returns_owned_binary_files_and_headers(seeded_db):
    from database import AnalysisContextRecord, AsyncSessionLocal, ModelCheckpoint, ReportVersion, Run
    from identity import CallerIdentity, get_identity
    from main import app

    issuer_id = "a71f0000-0000-0000-0000-000000000001"
    suffix = uuid4().hex
    context_id = f"report-export-context-{suffix}"
    run_id = f"report-export-run-{suffix}"
    checkpoint_id = f"report-export-checkpoint-{suffix}"
    version_id = f"report-export-version-{suffix}"
    async with AsyncSessionLocal() as db:
        db.add_all([
            AnalysisContextRecord(
                id=context_id, analyst_id="report-export-owner",
                name="Export verification", issuer_ids=[issuer_id], artifacts={},
            ),
            Run(
                id=run_id, issuer_id=issuer_id, analyst_id="report-export-owner",
                status="complete", qa_status="Passed", committee_status="Committee Ready",
                completed_at=datetime.now(timezone.utc),
            ),
        ])
        await db.flush()
        db.add(ModelCheckpoint(
            id=checkpoint_id, issuer_id=issuer_id, analyst_id="report-export-owner",
            context_id=context_id, issuer_run_id=run_id,
            label="Export snapshot", payload_hash="d" * 64, payload={}, authority={},
        ))
        await db.flush()
        db.add(ReportVersion(
            id=version_id,
            context_id=context_id,
            analyst_id="report-export-owner",
            run_id=run_id,
            model_checkpoint_id=checkpoint_id,
            thesis_version_id=None,
            status="published",
            payload=PAYLOAD,
            document_sha256="c" * 64,
            authority=AUTHORITY,
            created_at=datetime.now(timezone.utc),
        ))
        await db.commit()
    app.dependency_overrides[get_identity] = lambda: CallerIdentity(
        id="report-export-owner",
        email="owner@firm.test",
        full_name="Report Owner",
        role="analyst",
        source="profile",
    )
    try:
        with TestClient(app) as client:
            xlsx = client.post(f"/api/reports/versions/{version_id}/export?format=xlsx")
            assert xlsx.status_code == 200, xlsx.text
            assert xlsx.headers["content-type"].startswith("application/vnd.openxmlformats")
            assert xlsx.headers["x-caos-document-sha256"] == "c" * 64
            assert load_workbook(BytesIO(xlsx.content), read_only=True)["Cover"]["B4"].value == version_id
            pdf = client.post(f"/api/reports/versions/{version_id}/export?format=pdf")
            assert pdf.status_code == 200, pdf.text
            assert pdf.headers["content-type"].startswith("application/pdf")
            assert len(PdfReader(BytesIO(pdf.content)).pages) >= 3

            app.dependency_overrides[get_identity] = lambda: CallerIdentity(
                id="report-export-foreign",
                email="foreign@firm.test",
                full_name="Foreign Analyst",
                role="analyst",
                source="profile",
            )
            assert client.post(f"/api/reports/versions/{version_id}/export?format=xlsx").status_code == 404
    finally:
        app.dependency_overrides.clear()
