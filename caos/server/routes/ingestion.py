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

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import select, insert
from sqlalchemy.ext.asyncio import AsyncSession

import audit
import avscan
import ingest
import rate_limit
import ratings
import vault_export
from database import Document, DocumentChunk, Issuer, get_db, AsyncSessionLocal
from identity import CallerIdentity, get_identity
from tenancy import require_issuer, scope_issuers

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


# Bound concurrent read+scan+parse work (memory guard): each upload buffers the
# whole file (up to max_upload_mb) through ingest.read_capped, AV scan, and
# parse — the rate limit above caps requests/minute per caller, not simultaneous
# in-flight uploads server-wide, so many callers uploading large files at once
# scales resident memory with the sum of their sizes. Uploads past the cap queue
# on this semaphore rather than all buffer at once (mirrors research_executor._sem).
# Lazy-init: on py3.9 asyncio.Semaphore() binds the loop at construction, which
# fails at import time (no running loop). First call builds it in the app loop.
# ponytail: per-process semaphore; if ever multi-replica, the cap is per replica.
_upload_sem: "asyncio.Semaphore | None" = None


def _upload_semaphore() -> "asyncio.Semaphore":
    global _upload_sem
    if _upload_sem is None:
        from config import get_settings
        _upload_sem = asyncio.Semaphore(max(1, get_settings().caos_upload_concurrency))
    return _upload_sem


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
    background_tasks: BackgroundTasks,
) -> IngestionResponse:
    # Gate on the issuer's team: no uploading documents into another team's issuer
    # (no-op when tenancy is off). Also covers the missing-issuer 404.
    require_issuer(caller, await db.get(Issuer, issuer_id))

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
    audit.write(db, analyst_id=caller.id, action="document.upload",
                target_type="document", target_id=doc.id,
                after={"issuer_id": issuer_id, "doc_type": doc_type,
                       "file_name": doc.file_name, "run_mode": run_mode})
    if chunks:
        import hashlib
        import uuid
        from database import LineageEdge

        chunk_dicts = []
        lineage_dicts = []
        for i, chunk in enumerate(chunks):
            cid = str(uuid.uuid4())
            chash = hashlib.sha256(chunk.encode("utf-8")).hexdigest()
            chunk_dicts.append({
                "id": cid,
                "document_id": doc.id,
                "seq": i,
                "text": chunk,
                "chunk_hash": chash,
            })
            lineage_dicts.append({
                "id": str(uuid.uuid4()),
                "artifact_id": f"chunk:{cid}",
                "parent_id": f"doc:{doc.id}",
                "transform": "chunking",
                "transform_version": "1.0",
            })
        await db.execute(insert(DocumentChunk), chunk_dicts)
        await db.execute(insert(LineageEdge), lineage_dicts)
    await db.refresh(doc)
    if chunks:
        from engine.embeddings import embed_chunks_for_document
        async def run_embed_task():
            async with AsyncSessionLocal() as session:
                await embed_chunks_for_document(session, doc.id)
                await session.commit()
        background_tasks.add_task(run_embed_task)

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
    background_tasks: BackgroundTasks,
    issuer_id: str = Form(...),
    run_mode: str = Form("full"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    _upload_rate_guard(caller)
    mode = _validate_run_mode(run_mode)
    async with _upload_semaphore():
        content = await ingest.read_capped(file)
        ingest.sniff_pdf(content)
        await avscan.scan(content)  # no-op unless CLAMAV_HOST is set; rejects malware before parse
        # pypdf/markitdown parsing is synchronous and CPU-bound; off-thread it so a
        # large upload doesn't block the event loop for every other request.
        text = await asyncio.to_thread(ingest.extract_pdf_text, content, file.filename or "upload.pdf")
    return await _vault_document(db, caller, issuer_id, "Document", mode, file, text, content, background_tasks)


async def _collect_ratings(
    db: AsyncSession, content: bytes, resp: IngestionResponse, caller: CallerIdentity,
) -> None:  # noqa: C901
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
            before_moody, before_sp = iss.rating_moody, iss.rating_sp
            changed = False
            if rec.get("moody") and iss.rating_moody != rec["moody"]:
                iss.rating_moody = rec["moody"]
                changed = True
            if rec.get("sp") and iss.rating_sp != rec["sp"]:
                iss.rating_sp = rec["sp"]
                changed = True
            if changed:
                updated += 1
                audit.write(db, analyst_id=caller.id, action="issuer.rating_update",
                            target_type="issuer", target_id=iss.id,
                            before={"rating_moody": before_moody, "rating_sp": before_sp},
                            after={"rating_moody": iss.rating_moody, "rating_sp": iss.rating_sp})
        if updated:
            await db.flush()
            resp.ratings_updated = updated
            resp.message += f" · ratings updated on {updated} issuer{'s' if updated != 1 else ''}"
    except Exception as e:  # never let rating extraction fail a vaulted upload
        logger.warning("rating extraction failed after xlsx upload: %s", e)


@router.post("/upload/pricing-sheet", response_model=IngestionResponse)
async def upload_pricing_sheet(
    background_tasks: BackgroundTasks,
    issuer_id: str = Form(...),
    run_mode: str = Form("full"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    _upload_rate_guard(caller)
    mode = _validate_run_mode(run_mode)
    async with _upload_semaphore():
        content = await ingest.read_capped(file)
        # Scan BEFORE any parse: sniff_xlsx opens the ZIP central directory (openpyxl/
        # zipfile read attacker-controlled bytes), so the scan must precede it to match
        # SECURITY.md's "scanned before it is parsed". No-op unless CLAMAV_HOST is set.
        await avscan.scan(content)
        ingest.sniff_xlsx(content)
        # openpyxl/markitdown parsing is synchronous and CPU-bound — off-thread it (see
        # upload_document) so a large workbook doesn't stall the single event loop.
        text = await asyncio.to_thread(ingest.extract_xlsx_text, content, file.filename or "upload.xlsx")
    resp = await _vault_document(db, caller, issuer_id, "PricingSheet", mode, file, text, content, background_tasks)

    # Structured sheets carry a Ratings column — collect ratings onto issuers.
    await _collect_ratings(db, content, resp, caller)
    return resp


class MemoUploadResponse(BaseModel):
    note: str            # note title — the basename [[wikilinks]] resolve against
    path: str            # path relative to the vault root
    memo_type: str
    issuer_links: List[str]  # issuer names the memo now references via wikilink
    message: str


@router.post("/upload/memo", response_model=MemoUploadResponse)
async def upload_memo(  # noqa: C901
    background_tasks: BackgroundTasks,
    memo_type: str = Form("memo"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    """Analyst-authored commentary (market/research notes) into the Obsidian
    vault's ``Analyst-Memos/`` — the folder ``sync_analyst_memos`` scans and the
    Query graph deep-links. Known issuer names/tickers are auto-wikilinked so a
    plain PDF or text note links itself into coverage. The memo is ALSO chunked
    into ``document_chunks`` (one ``analyst-memo`` Document per linked issuer) so
    Q2 query answers can cite the analyst's own prior commentary — memos linking
    zero issuers stay vault-only (reachable via the Query graph). The run
    pipeline excludes ``analyst-memo`` docs (``build_issuer_index`` filter) so
    engine extraction never cites commentary as source truth."""
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

    async with _upload_semaphore():
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

    issuers = (await db.execute(scope_issuers(select(Issuer), caller))).scalars().all()
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

    # Chunk the memo into document_chunks so Q2 retrieval can cite it. One
    # analyst-memo Document per linked issuer; memos linking zero issuers stay
    # vault-only. Idempotent on title (re-upload replaces the prior memo's docs).
    issuer_by_name = {i.name: i.id for i in issuers}
    linked_ids = [issuer_by_name[n] for n in linked if n in issuer_by_name]
    memo_doc_ids: list[str] = []
    chunks_created = 0
    try:
        from engine.memochunks import chunk_memo_into_corpus
        memo_doc_ids = await chunk_memo_into_corpus(
            db, path.stem, text, linked_ids, caller.email,
        )
        if memo_doc_ids:
            from engine.embeddings import embed_chunks_for_document
            # Embed ONE memo document — the per-issuer copies share chunk_hash, and
            # the embedding table is keyed by (model, chunk_hash), so one embed
            # covers every copy via the chunk_hash join in retrieve_corpus.
            first_doc_id = memo_doc_ids[0]

            async def _embed() -> None:
                async with AsyncSessionLocal() as session:
                    await embed_chunks_for_document(session, first_doc_id)
                    await session.commit()
            background_tasks.add_task(_embed)
            first_doc = await db.get(Document, memo_doc_ids[0])
            chunks_created = first_doc.chunk_count if first_doc else 0
    except Exception as e:  # chunking failure must not fail the vaulted upload
        logger.warning("memo chunking failed (vault copy intact): %s", e)

    msg = f"{name} vaulted as '{path.stem}' — {len(linked)} issuer link(s)."
    if chunks_created:
        msg += f" Chunked into retrieval ({chunks_created} chunks × {len(memo_doc_ids)} issuer(s))."

    audit.write(db, analyst_id=caller.id, action="memo.upload",
                target_type="memo", target_id=path.stem,
                after={"memo_type": mtype, "issuer_links": sorted(linked)})

    return MemoUploadResponse(
        note=path.stem,
        path=f"{vault_export.MEMOS_DIR}/{path.name}",
        memo_type=mtype,
        issuer_links=sorted(linked),
        message=msg,
    )
