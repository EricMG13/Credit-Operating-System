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

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

import edgar
import ingest
import rate_limit
from config import get_settings
from database import Document, DocumentChunk, Issuer, get_db
from identity import CallerIdentity, get_identity

router = APIRouter()

LEGAL_RUN_MODES = {"full", "earnings", "rv", "legal"}


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
    issuer_id: str
    exhibit_url: str
    file_name: Optional[str] = None
    doc_type: str = "EDGAR Exhibit"
    run_mode: str = "legal"


class VaultExhibitResponse(BaseModel):
    document_id: str
    issuer_id: str
    storage_key: str
    doc_type: str
    run_mode: str
    chunks_created: int
    provenance: str
    message: str


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
    accession: str = Query(...),
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


@router.post("/vault-exhibit", response_model=VaultExhibitResponse)
async def vault_exhibit(
    body: VaultExhibitRequest,
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    """Fetch an EDGAR exhibit and vault it through the standard ingest path,
    turning a pointer into an E-xx-eligible primary source for the issuer."""
    _require_edgar()
    _edgar_rate_guard(caller)
    if body.run_mode.strip().lower() not in LEGAL_RUN_MODES:
        raise HTTPException(400, f"run_mode must be one of {sorted(LEGAL_RUN_MODES)}")
    issuer = await db.get(Issuer, body.issuer_id)
    if not issuer:
        raise HTTPException(404, "Issuer not found")

    try:
        content = await run_in_threadpool(edgar.fetch_exhibit, body.exhibit_url)
    except edgar.EdgarError as exc:
        raise HTTPException(502, str(exc))

    file_name = body.file_name or body.exhibit_url.rsplit("/", 1)[-1] or "edgar-exhibit.htm"
    text = ingest.extract_text(content, file_name)
    key = ingest.store(content, file_name)
    chunks = ingest.chunk_text(text)

    doc = Document(
        issuer_id=body.issuer_id,
        doc_type=body.doc_type,
        run_mode=body.run_mode.strip().lower(),
        file_name=file_name,
        storage_key=key,
        chunk_count=len(chunks),
        uploaded_by=caller.email,
    )
    db.add(doc)
    await db.flush()
    for i, chunk in enumerate(chunks):
        db.add(DocumentChunk(document_id=doc.id, seq=i, text=chunk))
    await db.refresh(doc)

    return VaultExhibitResponse(
        document_id=doc.id,
        issuer_id=body.issuer_id,
        storage_key=key,
        doc_type=body.doc_type,
        run_mode=doc.run_mode,
        chunks_created=len(chunks),
        provenance=edgar.PROV_VAULTED,
        message=(
            f"{file_name} fetched from EDGAR and vaulted ({len(chunks)} chunks). "
            "Now a primary source — E-xx eligible; run CP-4 to interpret covenants."
        ),
    )
