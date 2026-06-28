"""Cross-issuer natural-language query over the curated metric store.

A question is translated into a constrained QuerySpec (validated against the
metric dictionary), executed as a parameterized query, and returned as ranked,
evidence-cited rows. Backs the Command Center NL query bar.

The same router also backs the standalone **Query** concept: ``/capabilities``
reports which graph traversals are runnable from what's stored (so the rail greys
honestly), and ``/graph`` dispatches one capability to its builder ([querygraph.py]).
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from database import Document, DocumentChunk, Issuer, get_db
from engine import querygraph
from engine.metrics import catalog_dicts
from identity import CallerIdentity, get_identity
from nlquery import QueryError, execute, execute_semantic, execute_synthesis, plan

logger = logging.getLogger("caos")
router = APIRouter()

_QUERY_MAX_PER_MINUTE = 20
_READ_MAX_PER_MINUTE = 60  # catalog/chunk reads — looser than the NL POST, still bounded


def _read_rate_guard(caller: CallerIdentity) -> None:
    if not rate_limit.hit(
        f"query-read:{caller.id}", max_attempts=_READ_MAX_PER_MINUTE, window_seconds=60
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Query read rate limit reached — try again in a minute.",
        )


class NlQueryRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)


@router.get("/catalog")
async def get_catalog(caller: CallerIdentity = Depends(get_identity)):
    """The metric dictionary — keys, labels, units, polarity, descriptions."""
    _read_rate_guard(caller)
    return {"metrics": catalog_dicts()}


@router.get("/capabilities")
async def get_capabilities(
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    """The Query rail: capability groups with each entry's enabled state and, when
    greyed, the reason its edge can't be walked from what's stored."""
    _read_rate_guard(caller)
    try:
        from vault_export import sync_analyst_memos
        await sync_analyst_memos(db)
    except Exception as e:
        logger.warning("Could not sync analyst memos: %s", e)
    return await querygraph.capabilities(db)


class GraphRequest(BaseModel):
    capability_id: str = Field(min_length=1, max_length=64)
    issuer_id: Optional[str] = Field(default=None, max_length=36)


@router.post("/graph")
async def query_graph(
    body: GraphRequest,
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    """Run one capability and return its positioned node-link graph. Reads only —
    no LLM, no writes — so it shares the looser read rate guard."""
    _read_rate_guard(caller)
    try:
        from vault_export import sync_analyst_memos
        await sync_analyst_memos(db)
    except Exception as e:
        logger.warning("Could not sync analyst memos: %s", e)
    try:
        return await querygraph.build_graph(db, body.capability_id, body.issuer_id)
    except KeyError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown capability {body.capability_id!r}. See /api/query/capabilities.",
        ) from e


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
    _read_rate_guard(caller)
    if chunk_id.startswith(("m:", "c:", "f:")):
        kind, pk = chunk_id.split(":", 1)
        if kind == "m":
            from database import ModuleOutput, Run
            row = (await db.execute(
                select(ModuleOutput, Run, Issuer)
                .join(Run, ModuleOutput.run_id == Run.id)
                .join(Issuer, Run.issuer_id == Issuer.id)
                .where(ModuleOutput.id == pk)
            )).first()
            if row is None:
                raise HTTPException(404, "Module output not found")
            m_out, run, issuer = row
            import json
            text = (
                f"Module: {m_out.module_name} ({m_out.module_id}).\n"
                f"Confidence: {m_out.confidence} · QA Status: {m_out.qa_status}\n\n"
                f"Output: {json.dumps(m_out.runtime_output, ensure_ascii=False, indent=2)}"
            )
            return ChunkResponse(
                chunk_id=chunk_id, issuer_id=issuer.id, issuer_name=issuer.name,
                doc=m_out.module_name, doc_type="module", seq=0, text=text
            )
        elif kind == "c":
            from database import Claim, ModuleOutput, Run
            row = (await db.execute(
                select(Claim, ModuleOutput, Run, Issuer)
                .join(ModuleOutput, Claim.module_output_id == ModuleOutput.id)
                .join(Run, ModuleOutput.run_id == Run.id)
                .join(Issuer, Run.issuer_id == Issuer.id)
                .where(Claim.id == pk)
            )).first()
            if row is None:
                raise HTTPException(404, "Claim not found")
            claim, m_out, run, issuer = row
            text = f"Claim {claim.claim_id} ({m_out.module_name}):\n\n{claim.claim_text}"
            return ChunkResponse(
                chunk_id=chunk_id, issuer_id=issuer.id, issuer_name=issuer.name,
                doc=f"Claim {claim.claim_id}", doc_type="claim", seq=0, text=text
            )
        elif kind == "f":
            from database import QAFinding, Run
            row = (await db.execute(
                select(QAFinding, Run, Issuer)
                .join(Run, QAFinding.run_id == Run.id)
                .join(Issuer, Run.issuer_id == Issuer.id)
                .where(QAFinding.id == pk)
            )).first()
            if row is None:
                raise HTTPException(404, "QA Finding not found")
            finding, run, issuer = row
            text = (
                f"QA Finding {finding.finding_id} ({finding.severity})\n"
                f"Module: {finding.module_id or 'Run'} · Lane {finding.lane}\n\n"
                f"Description: {finding.description}\n"
                f"Remediation: {finding.required_remediation or 'None required'}"
            )
            return ChunkResponse(
                chunk_id=chunk_id, issuer_id=issuer.id, issuer_name=issuer.name,
                doc=f"QA Finding {finding.finding_id}", doc_type="finding", seq=0, text=text
            )

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
            status_code=422,
            detail=f"Couldn't map that to a known metric — {e}. See /api/query/catalog.",
        ) from e
    # Structured questions rank the metric store; qualitative ones search evidence.
    if mode == "semantic":
        return await execute_semantic(db, spec)
    if mode == "synthesis":
        return await execute_synthesis(db, spec)
    return await execute(db, spec)
