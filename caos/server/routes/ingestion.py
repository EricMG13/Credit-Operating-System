"""Document ingestion endpoints — batch intake of PDF documents and XLSX
pricing sheets.

There is no per-document type or date input: ingested documents are already
dated, and classification is CP-0's job downstream. The caller picks a run
mode (same templates as the CP-X pipeline routes) that applies to the batch.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

import ingest
import rate_limit
from database import Document, DocumentChunk, Issuer, get_db
from identity import CallerIdentity, get_identity

router = APIRouter()

# CP-X route templates — keep in sync with the frontend wizard / Concept B.
RUN_MODES = {"full", "earnings", "rv", "legal"}

# Uploads parse + chunk + store, so cap per-caller (DoS / resource abuse).
_UPLOAD_MAX_PER_MINUTE = 20


def _upload_rate_guard(caller: CallerIdentity) -> None:
    if not rate_limit.hit(
        f"upload:{caller.id}", max_attempts=_UPLOAD_MAX_PER_MINUTE, window_seconds=60
    ):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Upload rate limit reached — try again in a minute.",
        )


class IngestionResponse(BaseModel):
    document_id: str
    issuer_id: str
    minio_key: str  # kept name for frontend compatibility; now a vault path
    run_mode: str
    chunks_created: int
    message: str


def _validate_run_mode(run_mode: str) -> str:
    mode = run_mode.strip().lower()
    if mode not in RUN_MODES:
        raise HTTPException(400, f"run_mode must be one of {sorted(RUN_MODES)}")
    return mode


async def _vault_document(
    db: AsyncSession,
    caller: CallerIdentity,
    issuer_id: str,
    doc_type: str,
    run_mode: str,
    file: UploadFile,
    text: str,
    content: bytes,
) -> IngestionResponse:
    issuer = await db.get(Issuer, issuer_id)
    if not issuer:
        raise HTTPException(404, "Issuer not found")

    key = ingest.store(content, file.filename or "upload.bin")
    chunks = ingest.chunk_text(text)

    doc = Document(
        issuer_id=issuer_id,
        doc_type=doc_type,
        run_mode=run_mode,
        file_name=file.filename or "upload.bin",
        storage_key=key,
        chunk_count=len(chunks),
        uploaded_by=caller.email,
    )
    db.add(doc)
    await db.flush()
    for i, chunk in enumerate(chunks):
        db.add(DocumentChunk(document_id=doc.id, seq=i, text=chunk))
    await db.refresh(doc)

    return IngestionResponse(
        document_id=doc.id,
        issuer_id=issuer_id,
        minio_key=key,
        run_mode=run_mode,
        chunks_created=len(chunks),
        message=f"{file.filename} vaulted and chunked ({len(chunks)} chunks) — {run_mode} run.",
    )


@router.post("/upload/document", response_model=IngestionResponse)
async def upload_document(
    issuer_id: str = Form(...),
    run_mode: str = Form("full"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    _upload_rate_guard(caller)
    mode = _validate_run_mode(run_mode)
    content = await ingest.read_capped(file)
    ingest.sniff_pdf(content)
    text = ingest.extract_pdf_text(content, file.filename or "upload.pdf")
    return await _vault_document(db, caller, issuer_id, "Document", mode, file, text, content)


@router.post("/upload/pricing-sheet", response_model=IngestionResponse)
async def upload_pricing_sheet(
    issuer_id: str = Form(...),
    run_mode: str = Form("full"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    _upload_rate_guard(caller)
    mode = _validate_run_mode(run_mode)
    content = await ingest.read_capped(file)
    ingest.sniff_xlsx(content)
    text = ingest.extract_xlsx_text(content, file.filename or "upload.xlsx")
    return await _vault_document(db, caller, issuer_id, "PricingSheet", mode, file, text, content)
