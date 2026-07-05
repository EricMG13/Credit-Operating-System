"""Document ingestion endpoints — batch intake of PDF documents and XLSX
pricing sheets.

There is no per-document type or date input: ingested documents are already
dated, and classification is CP-0's job downstream. The caller picks a run
mode (same templates as the CP-X pipeline routes) that applies to the batch.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select, insert
from sqlalchemy.ext.asyncio import AsyncSession

import avscan
import ingest
import rate_limit
import ratings
import vault_export
from database import Document, DocumentChunk, Issuer, get_db
from identity import CallerIdentity, get_identity

logger = logging.getLogger("caos.ingestion")
router = APIRouter()

# CP-X route templates — keep in sync with the frontend wizard / Concept B.
# "primary" runs the same full route as "full"; the wizard warns to include the
# new-loan price, OID and cap table in the source materials (run_mode is metadata
# today, so behaviour matches "full" by construction).
RUN_MODES = {"full", "primary", "earnings", "rv", "legal"}

# Analyst memo intake (→ the Obsidian vault, not document_chunks).
MEMO_TYPES = {"market-commentary", "research", "memo"}
_MEMO_EXTS = {".md", ".txt", ".pdf"}

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
    # Set when chunks_created == 0 (scanned/encrypted/empty doc): the upload still
    # succeeds but is not searchable, so surface the signal rather than a silent 0.
    warning: Optional[str] = None
    # Count of issuers whose agency rating was updated from a Ratings column in a
    # structured (xlsx) upload; None/absent for PDFs or a sheet without ratings.
    ratings_updated: Optional[int] = None


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

    # Off-thread the vault write (up to MAX_UPLOAD_MB) so a large/slow disk write
    # doesn't block the event loop — matching the extract_* calls in the callers.
    key = await asyncio.to_thread(ingest.store, content, file.filename or "upload.bin")
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
    if chunks:
        await db.execute(
            insert(DocumentChunk),
            [{"document_id": doc.id, "seq": i, "text": chunk} for i, chunk in enumerate(chunks)]
        )
    await db.refresh(doc)

    return IngestionResponse(
        document_id=doc.id,
        issuer_id=issuer_id,
        minio_key=key,
        run_mode=run_mode,
        chunks_created=len(chunks),
        message=f"{file.filename} vaulted and chunked ({len(chunks)} chunks) — {run_mode} run.",
        warning=ingest.NO_CHUNKS_WARNING if not chunks else None,
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
    await avscan.scan(content)  # no-op unless CLAMAV_HOST is set; rejects malware before parse
    # pypdf/markitdown parsing is synchronous and CPU-bound; off-thread it so a
    # large upload doesn't block the event loop for every other request.
    text = await asyncio.to_thread(ingest.extract_pdf_text, content, file.filename or "upload.pdf")
    return await _vault_document(db, caller, issuer_id, "Document", mode, file, text, content)


async def _collect_ratings(db: AsyncSession, content: bytes, resp: IngestionResponse) -> None:
    """Pull agency ratings off a structured (xlsx) upload and write them onto
    matching *existing* issuers — matched by FIGI, then ticker, then exact name.

    Cross-issuer by design: a holdings / market-data sheet is authoritative rating
    data for every name it lists, not just the upload's own issuer (this is how
    ratings get "collected from ingest documents" instead of typed). Only updates
    existing issuers — never creates — so a sheet can't inject entities. Best-effort:
    the document is already vaulted, so any failure here is logged and swallowed.
    """
    try:
        # openpyxl parse is sync/CPU-bound — off-thread it like the extract_* calls.
        records = await asyncio.to_thread(ratings.extract_ratings_from_workbook, content)
        if not records:
            return
        issuers = (await db.execute(select(Issuer).limit(2000))).scalars().all()
        by_figi = {i.figi.strip().lower(): i for i in issuers if i.figi}
        by_ticker = {i.ticker.strip().lower(): i for i in issuers if i.ticker}
        by_name = {i.name.strip().lower(): i for i in issuers if i.name}
        updated = 0
        for rec in records:
            iss = None
            for key, table in ((rec.get("figi"), by_figi),
                               (rec.get("ticker"), by_ticker),
                               (rec.get("name"), by_name)):
                if key and key.strip().lower() in table:
                    iss = table[key.strip().lower()]
                    break
            if iss is None:
                continue
            changed = False
            if rec.get("moody") and iss.rating_moody != rec["moody"]:
                iss.rating_moody = rec["moody"]
                changed = True
            if rec.get("sp") and iss.rating_sp != rec["sp"]:
                iss.rating_sp = rec["sp"]
                changed = True
            if changed:
                updated += 1
        if updated:
            await db.flush()
            resp.ratings_updated = updated
            resp.message += f" · ratings updated on {updated} issuer{'s' if updated != 1 else ''}"
    except Exception as e:  # never let rating extraction fail a vaulted upload
        logger.warning("rating extraction failed after xlsx upload: %s", e)


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
    # Scan BEFORE any parse: sniff_xlsx opens the ZIP central directory (openpyxl/
    # zipfile read attacker-controlled bytes), so the scan must precede it to match
    # SECURITY.md's "scanned before it is parsed". No-op unless CLAMAV_HOST is set.
    await avscan.scan(content)
    ingest.sniff_xlsx(content)
    # openpyxl/markitdown parsing is synchronous and CPU-bound — off-thread it (see
    # upload_document) so a large workbook doesn't stall the single event loop.
    text = await asyncio.to_thread(ingest.extract_xlsx_text, content, file.filename or "upload.xlsx")
    resp = await _vault_document(db, caller, issuer_id, "PricingSheet", mode, file, text, content)
    # Structured sheets carry a Ratings column — collect ratings onto issuers.
    await _collect_ratings(db, content, resp)
    return resp


class MemoUploadResponse(BaseModel):
    note: str            # note title — the basename [[wikilinks]] resolve against
    path: str            # path relative to the vault root
    memo_type: str
    issuer_links: List[str]  # issuer names the memo now references via wikilink
    message: str


@router.post("/upload/memo", response_model=MemoUploadResponse)
async def upload_memo(
    memo_type: str = Form("memo"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    """Analyst-authored commentary (market/research notes) into the Obsidian
    vault's ``Analyst-Memos/`` — the folder ``sync_analyst_memos`` scans and the
    Query graph deep-links. Known issuer names/tickers are auto-wikilinked so a
    plain PDF or text note links itself into coverage. Vault-only: the memo is
    not chunked into document_chunks (upload under an issuer for engine
    retrieval)."""
    _upload_rate_guard(caller)
    from config import get_settings  # local: one patch of config.get_settings covers route + sync

    settings = get_settings()
    if not settings.vault_export_dir:
        raise HTTPException(503, "No vault configured — set VAULT_EXPORT_DIR to accept memos.")
    mtype = memo_type.strip().lower()
    if mtype not in MEMO_TYPES:
        raise HTTPException(400, f"memo_type must be one of {sorted(MEMO_TYPES)}")
    name = file.filename or "memo.md"
    ext = Path(name).suffix.lower()
    if ext not in _MEMO_EXTS:
        raise HTTPException(
            400, f"Unsupported memo format {ext or '(none)'} — use one of {sorted(_MEMO_EXTS)}"
        )

    content = await ingest.read_capped(file)
    await avscan.scan(content)  # scan before parse; no-op unless CLAMAV_HOST is set
    if ext == ".pdf":
        ingest.sniff_pdf(content)
        # markitdown/pypdf is synchronous and CPU-bound — off-thread it (see upload_document).
        text = await asyncio.to_thread(ingest.extract_pdf_text, content, name)
    else:
        text = content.decode("utf-8", "replace")
    if not text.strip():
        raise HTTPException(
            422, "No text could be extracted — scanned/encrypted PDF? Upload a text-based copy."
        )

    issuers = (await db.execute(select(Issuer))).scalars().all()
    text, linked = vault_export.autolink_issuers(text, [(i.name, i.ticker) for i in issuers])

    title = vault_export.memo_note_title(name)
    md = vault_export.render_memo(
        title, mtype, caller.email, name, text,
        date=datetime.now(timezone.utc).date().isoformat(),
    )
    # Off-thread the disk write, matching _vault_document.
    path = await asyncio.to_thread(vault_export.write_memo, settings.vault_export_dir, title, md)
    try:
        await vault_export.sync_analyst_memos(db)
    except Exception as e:  # the note is written; the next Query read re-syncs links
        logger.warning("analyst memo link sync failed after upload: %s", e)

    return MemoUploadResponse(
        note=path.stem,
        path=f"{vault_export.MEMOS_DIR}/{path.name}",
        memo_type=mtype,
        issuer_links=sorted(linked),
        message=f"{name} vaulted as '{path.stem}' — {len(linked)} issuer link(s).",
    )
