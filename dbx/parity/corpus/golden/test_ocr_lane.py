"""D1 — OCR last-resort lane, end-to-end (PRE_DEPLOYMENT_PLAN D1).

``test_ingest_markitdown.py`` proves the OCR shell-out wiring against a stub
CLI. This test proves the real thing: a genuinely image-only PDF (no text
layer — built via PIL render -> JPEG -> hand-built ``/DCTDecode`` XObject,
zero font/text resources) driven through the actual
``/api/ingestion/upload/document`` route with the real, Homebrew-installed
``ocrmypdf``/``tesseract`` binaries, asserting the persisted
``document_chunks`` rows land with ``prov="ocr"`` (D1a/b) and carry the
recognized text (proving the whole chain: sniff -> pypdf-empty -> OCR
fallback -> chunk -> persist, not just the OCR shell-out in isolation).

Skipped when ``ocrmypdf`` is not on PATH (CI's server job does not install
it — only the deploy image does, verified separately in
``caos/deploy/Dockerfile``, D1c). Run locally after ``brew install ocrmypdf
tesseract`` to exercise this for real.
"""
from __future__ import annotations

import shutil
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

HERE = Path(__file__).resolve().parent

pytestmark = pytest.mark.skipif(
    shutil.which("ocrmypdf") is None,
    reason="ocrmypdf not on PATH — install via `brew install ocrmypdf tesseract` "
           "to run this test locally; the deploy image installs it unconditionally.",
)


@pytest.fixture()
def ocr_client():
    """Function-scoped, deliberately NOT named ``client`` so conftest's
    `_restore_issuer_baseline` cleans up the issuer/document/chunks this test
    creates (shared process-global DB — see test_golden_e2e.py's e2e_client
    for the same convention). Relies on config's real default
    ``ocrmypdf_cmd="ocrmypdf"`` resolving via PATH — no monkeypatch needed."""
    from main import app

    with TestClient(app) as c:
        yield c


def test_scanned_pdf_recovers_via_ocr_and_tags_provenance(ocr_client):
    from conftest import _DB_PATH

    fixture = (HERE / "scanned_atlf_earnings.pdf").read_bytes()
    issuer_id = ocr_client.get("/api/issuers/").json()[0]["id"]

    r = ocr_client.post(
        "/api/ingestion/upload/document",
        data={"issuer_id": issuer_id, "run_mode": "earnings"},
        files={"file": ("scanned-earnings.pdf", fixture, "application/pdf")},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["chunks_created"] > 0, "real OCR must recover text from the scanned fixture"
    assert body["warning"] is None

    con = sqlite3.connect(_DB_PATH, timeout=30)
    try:
        rows = con.execute(
            "SELECT prov, text FROM document_chunks WHERE document_id = "
            "(SELECT id FROM documents WHERE storage_key = ?)",
            (body["minio_key"],),
        ).fetchall()
    finally:
        con.close()
    assert rows, "no chunks persisted for the uploaded document"
    assert all(prov == "ocr" for prov, _ in rows), rows
    combined = "\n".join(text for _, text in rows)
    assert "Atlas Forge Industrials" in combined
    assert "512.4" in combined
    assert "4.2x" in combined
