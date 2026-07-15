"""Coverage Control Plane — ingestion gaps (WP-4 G14).

A vaulted document that produced zero chunks (scanned/encrypted source, OCR
unavailable or also failed) or that only produced OCR-derived chunks (D1's
lower-fidelity lane) degrades silently today — ingest.py logs a warning and
moves on, with nothing else surfacing the fact. GET /api/digest/ingestion-gaps
is a pure read over persisted Document/DocumentChunk state (no LLM).
"""

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


async def _seed_document(issuer_id: str, file_name: str, chunk_count: int, chunk_provs: list) -> str:
    from database import AsyncSessionLocal, Document, DocumentChunk

    async with AsyncSessionLocal() as s:
        doc = Document(
            issuer_id=issuer_id, doc_type="10-K", file_name=file_name,
            storage_key=f"vault/{file_name}", chunk_count=chunk_count,
        )
        s.add(doc)
        await s.flush()
        for i, prov in enumerate(chunk_provs):
            s.add(DocumentChunk(document_id=doc.id, seq=i, text=f"chunk {i}", prov=prov))
        await s.commit()
        return doc.id


@pytest.mark.asyncio
async def test_zero_chunk_document_flagged_as_a_silent_ingestion_gap(client):
    issuer_id = client.post("/api/issuers/", json={"name": "Gap Co"}).json()["id"]
    doc_id = await _seed_document(issuer_id, "scanned-encrypted.pdf", chunk_count=0, chunk_provs=[])

    r = client.get("/api/digest/ingestion-gaps")
    assert r.status_code == 200, r.text
    body = r.json()
    assert any(row["document_id"] == doc_id for row in body["zero_chunk"])
    flagged = next(row for row in body["zero_chunk"] if row["document_id"] == doc_id)
    assert flagged["issuer_name"] == "Gap Co"
    assert flagged["file_name"] == "scanned-encrypted.pdf"
    assert "unusable" in flagged["detail"].lower()
    assert not any(row["document_id"] == doc_id for row in body["ocr_lane"])


@pytest.mark.asyncio
async def test_ocr_derived_document_flagged_distinctly_from_zero_chunk(client):
    issuer_id = client.post("/api/issuers/", json={"name": "OCR Co"}).json()["id"]
    doc_id = await _seed_document(issuer_id, "scanned-readable.pdf", chunk_count=3, chunk_provs=[None, "ocr", "ocr"])

    r = client.get("/api/digest/ingestion-gaps")
    assert r.status_code == 200, r.text
    body = r.json()
    assert any(row["document_id"] == doc_id for row in body["ocr_lane"])
    flagged = next(row for row in body["ocr_lane"] if row["document_id"] == doc_id)
    assert "ocr" in flagged["detail"].lower()
    assert not any(row["document_id"] == doc_id for row in body["zero_chunk"])


@pytest.mark.asyncio
async def test_native_text_document_appears_in_neither_list(client):
    issuer_id = client.post("/api/issuers/", json={"name": "Clean Co"}).json()["id"]
    doc_id = await _seed_document(issuer_id, "native-text.pdf", chunk_count=5, chunk_provs=[None, None, None, None, None])

    r = client.get("/api/digest/ingestion-gaps")
    assert r.status_code == 200, r.text
    body = r.json()
    assert not any(row["document_id"] == doc_id for row in body["zero_chunk"])
    assert not any(row["document_id"] == doc_id for row in body["ocr_lane"])


@pytest.mark.asyncio
async def test_a_partially_ocr_document_still_counts_as_ocr_lane(client):
    """Even one OCR-derived chunk among mostly-native ones is worth
    disclosing — this is not an all-or-nothing signal."""
    issuer_id = client.post("/api/issuers/", json={"name": "Mixed Co"}).json()["id"]
    doc_id = await _seed_document(issuer_id, "mostly-native.pdf", chunk_count=4, chunk_provs=[None, None, None, "ocr"])

    r = client.get("/api/digest/ingestion-gaps")
    body = r.json()
    assert any(row["document_id"] == doc_id for row in body["ocr_lane"])
    rollup = next(row for row in body["coverage"] if row["issuer_id"] == issuer_id)
    assert rollup["origins"] == ["OCR"]
    assert rollup["document_count"] == 1
    assert rollup["analyst_owner"] is None
