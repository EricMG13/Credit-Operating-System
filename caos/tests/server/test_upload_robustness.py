"""D3 — upload robustness adversarial matrix (PRE_DEPLOYMENT_PLAN §6, loop L10).

The funnel's existing coverage is the happy path plus the 0-chunk warning and
concurrency bounds. This is the adversarial table: every hostile upload must
be **rejected with an explicit analyst-visible reason** or **degraded with the
explicit 0-chunk warning** — never a silent ``chunks_created: 0`` success and
never an unhandled 500. Table-driven so new cases are one row each.
"""
from __future__ import annotations

import asyncio
import io
import os
import zipfile
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def rob_client():
    from main import app

    with TestClient(app) as c:
        yield c


def _issuer_id(c: TestClient) -> str:
    return c.get("/api/issuers/").json()[0]["id"]


def _upload_document(c: TestClient, name: str, payload: bytes, mime="application/pdf"):
    return c.post(
        "/api/ingestion/upload/document",
        data={"issuer_id": _issuer_id(c), "run_mode": "earnings"},
        files={"file": (name, payload, mime)},
    )


def _tiny_pdf() -> bytes:
    """Small but real PDF (one text line) — base for the encrypted case."""
    content = b"BT /F1 10 Tf 40 780 Td (robustness base document) Tj ET"
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


def _encrypted_pdf() -> bytes:
    from pypdf import PdfReader, PdfWriter

    writer = PdfWriter()
    for page in PdfReader(io.BytesIO(_tiny_pdf())).pages:
        writer.add_page(page)
    writer.encrypt("hostile-password")
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


# ── document endpoint: reject rows (explicit 4xx + reason) ──────────────────
@pytest.mark.parametrize(
    "name,payload,status,reason",
    [
        ("empty.pdf", b"", 400, "Empty upload"),
        # A docx (any non-%PDF bytes) on the PDF-only document endpoint.
        ("report.docx", b"PK\x03\x04 not a pdf at all", 400, "not a valid PDF"),
        # Extension lies (says .pdf, carries plain text).
        ("really-a-txt.pdf", b"just some plain text pretending", 400, "not a valid PDF"),
    ],
)
def test_document_upload_rejects_with_explicit_reason(rob_client, name, payload, status, reason):
    r = _upload_document(rob_client, name, payload)
    assert r.status_code == status, r.text
    assert reason in r.json()["detail"]


def test_document_upload_oversized_413(rob_client, monkeypatch):
    """The cap aborts mid-read with an explicit 413 (cap patched down so the
    test doesn't ship a real 250MB body)."""
    import ingest

    monkeypatch.setattr(ingest.get_settings(), "max_upload_mb", 1)
    r = _upload_document(rob_client, "huge.pdf", b"%PDF-1.4" + b"\0" * (1024 * 1024 + 64))
    assert r.status_code == 413, r.text
    assert "exceeds the 1 MB limit" in r.json()["detail"]


# ── document endpoint: degrade rows (vaulted, but LOUD about 0 chunks) ──────
@pytest.mark.parametrize(
    "name,payload",
    [
        # Valid magic, garbage body — parses to nothing.
        ("corrupt.pdf", b"%PDF-1.4\n" + os.urandom(2048)),
        # Genuinely password-protected PDF (pypdf AES) — no text without the key.
        ("locked.pdf", None),  # built lazily; pypdf import stays test-time
    ],
)
def test_document_upload_degrades_loudly_never_silently(rob_client, name, payload):
    if payload is None:
        payload = _encrypted_pdf()
    r = _upload_document(rob_client, name, payload)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["chunks_created"] == 0
    assert body["warning"] and "0 chunks" in body["warning"], (
        "a 0-chunk vault MUST carry the explicit warning — silent success is the "
        "exact failure mode D3 exists to prevent"
    )


def test_document_upload_db_failure_removes_uncommitted_vault_object(
    rob_client, monkeypatch, tmp_path: Path
):
    """A pre-commit DB failure must not strand raw evidence outside the ledger."""
    import ingest
    from sqlalchemy.ext.asyncio import AsyncSession

    monkeypatch.setattr(ingest.get_settings(), "caos_storage_dir", str(tmp_path))

    async def fail_flush(_session, *_args, **_kwargs):
        raise RuntimeError("forced document flush failure")

    monkeypatch.setattr(AsyncSession, "flush", fail_flush)
    with pytest.raises(RuntimeError, match="forced document flush failure"):
        _upload_document(rob_client, "rollback-proof.pdf", _tiny_pdf())

    assert [path for path in tmp_path.rglob("*") if path.is_file()] == []


def test_ingest_storage_settings_are_resolved_per_operation(tmp_path, monkeypatch):
    """A cache reset/config swap cannot leave ingest writing to an import-time root."""
    import ingest

    first = tmp_path / "first"
    second = tmp_path / "second"
    current = {"root": first}
    monkeypatch.setattr(
        ingest,
        "get_settings",
        lambda: SimpleNamespace(caos_storage_dir=str(current["root"])),
    )

    first_key = ingest.store(b"first", "evidence.pdf")
    current["root"] = second
    second_key = ingest.store(b"second", "evidence.pdf")

    assert (first / first_key).read_bytes() == b"first"
    assert (second / second_key).read_bytes() == b"second"


@pytest.mark.asyncio
async def test_dependency_cancellation_runs_registered_rollback_cleanup(monkeypatch):
    """A disconnected request must not strand its pre-commit vault object."""
    import database

    class FakeSession:
        def __init__(self):
            self.info = {}
            self.rolled_back = False

        async def __aenter__(self):
            return self

        async def __aexit__(self, _exc_type, _exc, _tb):
            return False

        async def commit(self):
            raise AssertionError("a cancelled route must not commit")

        async def rollback(self):
            self.rolled_back = True

    session = FakeSession()
    monkeypatch.setattr(database, "AsyncSessionLocal", lambda: session)
    cleaned = False

    def cleanup():
        nonlocal cleaned
        cleaned = True

    dependency = database.get_db()
    yielded_session = await anext(dependency)
    database.register_rollback_cleanup(yielded_session, cleanup)

    with pytest.raises(asyncio.CancelledError):
        await dependency.athrow(asyncio.CancelledError())

    assert session.rolled_back is True
    assert cleaned is True


# ── pricing-sheet endpoint: container validation ────────────────────────────
def test_pricing_sheet_rejects_non_workbook_containers(rob_client):
    issuer_id = _issuer_id(rob_client)

    # PDF bytes on the xlsx endpoint.
    r = rob_client.post(
        "/api/ingestion/upload/pricing-sheet",
        data={"issuer_id": issuer_id},
        files={"file": ("px.xlsx", _tiny_pdf(), "application/vnd.ms-excel")},
    )
    assert r.status_code == 400, r.text
    assert "not a valid .xlsx workbook" in r.json()["detail"]

    # Zip-bomb-ish: a real ZIP container that is not a workbook (no xl/
    # entries) — e.g. a decompression bomb renamed .xlsx. Rejected on the
    # container check BEFORE any sheet parsing/expansion happens.
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("bomb.txt", "0" * (4 * 1024 * 1024))  # 4MB → ~4KB zipped
    r = rob_client.post(
        "/api/ingestion/upload/pricing-sheet",
        data={"issuer_id": issuer_id},
        files={"file": ("bomb.xlsx", buf.getvalue(), "application/vnd.ms-excel")},
    )
    assert r.status_code == 400, r.text
    assert "not an Excel workbook" in r.json()["detail"]
