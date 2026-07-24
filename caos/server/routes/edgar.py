"""SEC EDGAR retrieval endpoints — the free covenant/legal source-acquisition
lane for CP-4 (see Modular OS/CP-4/REF_CP-4_EDGARCovenantSourceMap.md).

Discovery endpoints return *pointers* (``external · unverified``); ``vault-exhibit``
fetches a specific exhibit and runs it through the same ingest path as an upload,
turning the pointer into a vaulted, E-xx-eligible primary source that can satisfy
the CP-4 Legal File Gate and clear CP-5/CP-5B.

Off by default: every endpoint 503s until ``EDGAR_USER_AGENT`` is configured
(SEC fair-access requires it). No key, no paid service.
"""

from __future__ import annotations

import hashlib
from datetime import date, datetime, time, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import avscan
import edgar
import ingest
import rate_limit
from config import get_settings
from database import (
    AsyncSessionLocal,
    Document,
    DocumentChunk,
    Issuer,
    get_db,
    register_rollback_cleanup,
)
from identity import CallerIdentity, get_identity, get_write_identity
from tenancy import require_issuer

router = APIRouter()

LEGAL_RUN_MODES = {"full", "primary", "earnings", "rv", "legal"}


class FilingHitOut(BaseModel):
    cik: str
    accession: str
    form: str
    filed_date: str
    title: str
    source_url: str
    provenance: str


class ExhibitOut(BaseModel):
    name: str
    url: str
    doc_label: str
    authority_rank: Optional[int]
    size: Optional[int]


class VaultExhibitRequest(BaseModel):
    issuer_id: str = Field(min_length=1, max_length=36)
    exhibit_url: str = Field(min_length=1, max_length=2_048)
    file_name: Optional[str] = Field(default=None, max_length=512)
    doc_type: str = Field(default="EDGAR Exhibit", min_length=1, max_length=64)
    run_mode: str = Field(default="legal", min_length=1, max_length=16)
    filed_date: Optional[date] = None


class VaultExhibitResponse(BaseModel):
    document_id: str
    issuer_id: str
    storage_key: str
    doc_type: str
    run_mode: str
    chunks_created: int
    provenance: str
    message: str
    # Set when chunks_created == 0 (scanned/encrypted/empty exhibit): vaulted but
    # not searchable, so surface the signal rather than a silent 0. (ingest.py)
    warning: Optional[str] = None


def _require_edgar() -> None:
    if not get_settings().edgar_user_agent.strip():
        raise HTTPException(
            503,
            "EDGAR lane is not configured. Set EDGAR_USER_AGENT to a descriptive "
            "contact string (SEC fair-access requires it). No key or cost needed.",
        )


# EDGAR routes make outbound SEC requests (and vault-exhibit fetches + ingests),
# so cap per-caller — the in-edgar.py fair-access throttle is global, not per-user.
_EDGAR_MAX_PER_MINUTE = 30


def _edgar_rate_guard(caller: CallerIdentity) -> None:
    if not rate_limit.hit(
        f"edgar:{caller.id}", max_attempts=_EDGAR_MAX_PER_MINUTE, window_seconds=60
    ):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "EDGAR rate limit reached — try again in a minute.",
        )


def _hit_out(h: edgar.FilingHit) -> FilingHitOut:
    return FilingHitOut(
        cik=h.cik, accession=h.accession, form=h.form, filed_date=h.filed_date,
        title=h.title, source_url=h.source_url, provenance=h.provenance,
    )


@router.get("/search", response_model=List[FilingHitOut])
async def search_filings(
    q: str = Query(..., min_length=2),
    forms: Optional[str] = Query(None, description="Comma-separated, e.g. 8-K,S-4,10-K"),
    limit: int = Query(10, ge=1, le=50),
    caller: CallerIdentity = Depends(get_identity),
):
    """Full-text search → filing pointers (external · unverified)."""
    _require_edgar()
    _edgar_rate_guard(caller)
    form_list = [f.strip() for f in forms.split(",")] if forms else None
    try:
        hits = await run_in_threadpool(edgar.search, q, form_list, None, None, limit)
    except edgar.EdgarError as exc:
        raise HTTPException(502, str(exc))
    return [_hit_out(h) for h in hits]


@router.get("/filings/{cik}", response_model=List[FilingHitOut])
async def issuer_filings(
    cik: str,
    forms: Optional[str] = Query(None),
    limit: int = Query(25, ge=1, le=100),
    caller: CallerIdentity = Depends(get_identity),
):
    """An issuer's recent filings, optionally filtered to covenant-bearing forms."""
    _require_edgar()
    _edgar_rate_guard(caller)
    form_list = [f.strip() for f in forms.split(",")] if forms else None
    try:
        hits = await run_in_threadpool(edgar.list_filings, cik, form_list, limit)
    except edgar.EdgarError as exc:
        raise HTTPException(502, str(exc))
    return [_hit_out(h) for h in hits]


@router.get("/exhibits", response_model=List[ExhibitOut])
async def filing_exhibits(
    cik: str = Query(...),
    # SEC accession number, dashed or bare (BE6-4): the value is interpolated
    # into the outbound SEC URL path (dash-strip only), so pin its shape here —
    # a malformed value could only ever 404 at SEC, but don't send it at all.
    accession: str = Query(..., pattern=r"^\d{10}-\d{2}-\d{6}$|^\d{18}$"),
    caller: CallerIdentity = Depends(get_identity),
):
    """A filing's documents, classified against the CP-4 covenant taxonomy."""
    _require_edgar()
    _edgar_rate_guard(caller)
    try:
        exhibits = await run_in_threadpool(edgar.list_exhibits, cik, accession)
    except edgar.EdgarError as exc:
        raise HTTPException(502, str(exc))
    return [
        ExhibitOut(
            name=e.name, url=e.url, doc_label=e.doc_label,
            authority_rank=e.authority_rank, size=e.size,
        )
        for e in exhibits
    ]


@router.post("/vault-url", response_model=VaultExhibitResponse)
@router.post("/vault-exhibit", response_model=VaultExhibitResponse)
async def vault_exhibit(
    body: VaultExhibitRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_write_identity),
):
    """Fetch an EDGAR exhibit and vault it through the standard ingest path,
    turning a pointer into an E-xx-eligible primary source for the issuer."""
    _require_edgar()
    _edgar_rate_guard(caller)
    if body.run_mode.strip().lower() not in LEGAL_RUN_MODES:
        raise HTTPException(400, f"run_mode must be one of {sorted(LEGAL_RUN_MODES)}")
    # Gate on the issuer's team: no vaulting EDGAR exhibits into another team's issuer.
    require_issuer(caller, await db.get(Issuer, body.issuer_id))

    try:
        content = await run_in_threadpool(edgar.fetch_exhibit, body.exhibit_url)
    except edgar.EdgarError as exc:
        raise HTTPException(502, str(exc))

    # Same vault, same scan: every path that writes caller-influenced bytes into
    # the vault goes through avscan (no-op unless CLAMAV_HOST is set). Always
    # runs, even on a dedupe hit below — this endpoint fetches fresh bytes
    # from EDGAR on every call, and the malware-scan invariant applies to
    # every fetch, not just ones that end up creating a new Document row.
    await avscan.scan(content)

    normalized_run_mode = body.run_mode.strip().lower()

    # Content-identity dedupe (audit fix): documents carried no unique
    # constraint, so re-vaulting byte-identical content (e.g. re-running
    # vault-exhibit on the same exhibit URL) created a second Document row
    # with a fresh id and fresh chunk ids — retrieval.rrf_fusion keys results
    # by chunk_id, so the same paragraph could be returned and cited as two
    # independent sources in a memo. Same scope as the migrations/0069
    # partial unique index (issuer_id, content_sha256) WHERE status='active'
    # AND chunk_count > 0, which is the race-safe backstop if two identical
    # vaults land concurrently. A prior 0-chunk copy (failed parse) is
    # deliberately excluded — it was never citable, so a re-vault should get
    # a genuine reprocessing attempt rather than being trapped behind a stale
    # empty document. Checked before parse/store/chunk so a repeat vault of
    # the same exhibit doesn't also leave a second, unreferenced copy of the
    # bytes sitting in the vault.
    content_sha256 = hashlib.sha256(content).hexdigest()
    existing_doc = (await db.execute(
        select(Document).where(
            Document.issuer_id == body.issuer_id,
            Document.content_sha256 == content_sha256,
            Document.status == "active",
            Document.chunk_count > 0,
        )
    )).scalar_one_or_none()

    dedupe_hit = existing_doc is not None
    if dedupe_hit:
        # A re-vault of identical content isn't erroneous, just redundant —
        # 200 with the existing document, no duplicate row, no re-parse, no
        # re-store, no re-chunk, no re-embed. The existing document's own
        # fields are left untouched rather than overwritten from this call's
        # doc_type/run_mode/filed_date.
        doc = existing_doc
        key = existing_doc.storage_key
        file_name = existing_doc.file_name
        chunks_created = existing_doc.chunk_count
    else:
        file_name = body.file_name or body.exhibit_url.rsplit("/", 1)[-1] or "edgar-exhibit.htm"
        # Offload the sync pypdf / HTML-regex parse so it doesn't block the event loop
        # (matches the sibling run_in_threadpool calls on the EDGAR entrypoints above).
        text = await run_in_threadpool(ingest.extract_text, content, file_name)
        # Off-thread the vault disk write too (up to 25 MB) — a sync write on the event
        # loop stalls every other request, same reason the extract above is offloaded
        # and matching the upload path (routes/ingestion.py).
        key = await run_in_threadpool(ingest.store, content, file_name)
        def cleanup_uncommitted() -> None:
            ingest.remove_uncommitted(key)

        register_rollback_cleanup(db, cleanup_uncommitted)
        chunks = ingest.chunk_text(text)

        doc = Document(
            issuer_id=body.issuer_id,
            analyst_id=caller.id,
            doc_type=body.doc_type,
            run_mode=normalized_run_mode,
            file_name=file_name,
            storage_key=key,
            source_kind="legal_document",
            source_published_at=(
                datetime.combine(body.filed_date, time.min, tzinfo=timezone.utc)
                if body.filed_date else None
            ),
            chunk_count=len(chunks),
            uploaded_by=caller.email,
            content_sha256=content_sha256,
        )
        db.add(doc)
        await db.flush()
        if chunks:
            from database import LineageEdge
            for i, chunk in enumerate(chunks):
                chash = hashlib.sha256(chunk.encode("utf-8")).hexdigest()
                db_chunk = DocumentChunk(document_id=doc.id, seq=i, text=chunk, chunk_hash=chash)
                db.add(db_chunk)
                db.add(LineageEdge(
                    artifact_id=f"chunk:{db_chunk.id}",
                    parent_id=f"doc:{doc.id}",
                    transform="chunking",
                    transform_version="1.0"
                ))
        await db.refresh(doc)
        if chunks:
            from engine.embeddings import embed_chunks_for_document
            async def run_embed_task():
                async with AsyncSessionLocal() as session:
                    await embed_chunks_for_document(session, doc.id)
                    await session.commit()
            background_tasks.add_task(run_embed_task)
        chunks_created = len(chunks)

    message = (
        f"{file_name} matches already-vaulted content for this issuer "
        f"(document {doc.id}); reusing the existing document — no duplicate created."
        if dedupe_hit else
        f"{file_name} fetched from EDGAR and vaulted ({chunks_created} chunks). "
        "Now a primary source — E-xx eligible; run CP-4 to interpret covenants."
    )
    return VaultExhibitResponse(
        document_id=doc.id,
        issuer_id=body.issuer_id,
        storage_key=key,
        doc_type=doc.doc_type,
        run_mode=normalized_run_mode,
        chunks_created=chunks_created,
        provenance=edgar.PROV_VAULTED,
        message=message,
        warning=ingest.NO_CHUNKS_WARNING if not chunks_created else None,
    )
