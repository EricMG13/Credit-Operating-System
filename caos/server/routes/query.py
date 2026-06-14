"""Cross-issuer natural-language query over the curated metric store.

A question is translated into a constrained QuerySpec (validated against the
metric dictionary), executed as a parameterized query, and returned as ranked,
evidence-cited rows. Backs the Command Center NL query bar.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from database import Document, DocumentChunk, Issuer, get_db
from engine.metrics import catalog_dicts
from identity import CallerIdentity, get_identity
from nlquery import QueryError, execute, execute_semantic, plan

logger = logging.getLogger("caos")
router = APIRouter()

_QUERY_MAX_PER_MINUTE = 20


class NlQueryRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)


@router.get("/catalog")
async def get_catalog(caller: CallerIdentity = Depends(get_identity)):
    """The metric dictionary — keys, labels, units, polarity, descriptions."""
    return {"metrics": catalog_dicts()}


class ChunkResponse(BaseModel):
    chunk_id: str
    issuer_id: str
    issuer_name: str
    doc: str
    doc_type: str
    seq: int
    text: str


@router.get("/chunk/{chunk_id}", response_model=ChunkResponse)
async def get_chunk(
    chunk_id: str,
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    """Fetch one ingested source chunk by id — backs click-to-source on the
    citation chips (the `src` / E-xx markers) in the query results."""
    row = (await db.execute(
        select(DocumentChunk, Document, Issuer)
        .join(Document, Document.id == DocumentChunk.document_id)
        .join(Issuer, Issuer.id == Document.issuer_id)
        .where(DocumentChunk.id == chunk_id)
    )).first()
    if row is None:
        raise HTTPException(404, "Chunk not found")
    chunk, doc, issuer = row
    return ChunkResponse(
        chunk_id=chunk.id, issuer_id=issuer.id, issuer_name=issuer.name,
        doc=doc.file_name, doc_type=doc.doc_type, seq=chunk.seq, text=chunk.text,
    )


@router.post("/nl")
async def nl_query(
    body: NlQueryRequest,
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    if not rate_limit.hit(
        f"query:{caller.id}", max_attempts=_QUERY_MAX_PER_MINUTE, window_seconds=60
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Query rate limit reached — try again in a minute.",
        )
    try:
        mode, spec = await plan(body.question)
    except QueryError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Couldn't map that to a known metric — {e}. See /api/query/catalog.",
        ) from e
    # Structured questions rank the metric store; qualitative ones search evidence.
    if mode == "semantic":
        return await execute_semantic(db, spec)
    return await execute(db, spec)
