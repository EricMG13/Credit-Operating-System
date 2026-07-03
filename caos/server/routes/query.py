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
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from database import Document, DocumentChunk, Issuer, QueryAcceptedLink, get_db
from engine import querygraph, queryoverlay
from engine.metrics import catalog_dicts
from identity import CallerIdentity, get_identity
from nlquery import QueryError, execute, execute_semantic, execute_synthesis, plan

logger = logging.getLogger("caos")
router = APIRouter()

_QUERY_MAX_PER_MINUTE = 20
_READ_MAX_PER_MINUTE = 60  # catalog/chunk reads — looser than the NL POST, still bounded
_ADMIN_QUERY_RE = re.compile(r"\b(all runs by user|runs by user|user\s+[A-Z0-9._%+-]+@|analyst activity|by analyst|display all runs by)\b", re.I)


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
    result = await querygraph.capabilities(db)
    # Whether the LLM lanes (router / model overlay) can run at all — the frontend
    # hides their affordances when this is false (keyless deploys stay deterministic).
    result["availability"]["model_lane"] = queryoverlay.available()
    return result


class GraphRequest(BaseModel):
    capability_id: str = Field(min_length=1, max_length=64)
    issuer_id: Optional[str] = Field(default=None, max_length=36)
    # Free-text risk theme for the shared-theme walk (BM25 corpus overlay).
    # Ignored by every other capability. None → the capability's default seed.
    theme: Optional[str] = Field(default=None, max_length=200)


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
        return await querygraph.build_graph(db, body.capability_id, body.issuer_id, theme=body.theme)
    except KeyError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown capability {body.capability_id!r}. See /api/query/capabilities.",
        ) from e


class RouteRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)


@router.post("/route")
async def route_query(
    body: RouteRequest,
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    """LLM-route free text to up to 3 registry capabilities, each with a reason.

    Contract: on ANY failure (no key, timeout, unparseable reply) this returns
    ``{"candidates": [], "source": "keyword"}`` and the client falls back to its
    local keyword router — routing never gets worse than the deterministic path.
    """
    if not rate_limit.hit(
        f"query:{caller.id}", max_attempts=_QUERY_MAX_PER_MINUTE, window_seconds=60
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Query rate limit reached — try again in a minute.",
        )
    if not queryoverlay.available():
        return {"candidates": [], "source": "keyword"}
    caps = await querygraph.capabilities(db)
    flat = [c for g in caps["groups"] for c in g["capabilities"]]
    try:
        return await queryoverlay.route(body.text, flat)
    except Exception as e:  # noqa: BLE001 — fault-isolated lane: degrade, log, never 5xx
        logger.warning("query-route LLM lane failed (%s) — keyword fallback", e)
        return {"candidates": [], "source": "keyword"}


_OVERLAY_MAX_PER_MINUTE = 10  # LLM spend — tighter than the read guard


class OverlayRequest(BaseModel):
    capability_id: str = Field(min_length=1, max_length=64)
    issuer_id: Optional[str] = Field(default=None, max_length=36)
    force: bool = False


@router.post("/overlay")
async def query_overlay(
    body: OverlayRequest,
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    """The model overlay for one deterministic graph: citation-gated proposed
    links + labeled commentary + suggested walks. Persisted + cached by graph
    hash; read-only over the graph itself. Failures are loud (5xx with detail)
    but isolated — /graph never depends on this lane."""
    if not rate_limit.hit(
        f"query-overlay:{caller.id}", max_attempts=_OVERLAY_MAX_PER_MINUTE, window_seconds=60
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Overlay rate limit reached — try again in a minute.",
        )
    if not queryoverlay.available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model lane unavailable — no provider key configured.",
        )
    try:
        return await queryoverlay.overlay(
            db, body.capability_id, body.issuer_id, analyst_id=caller.id, force=body.force
        )
    except KeyError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown capability {body.capability_id!r}. See /api/query/capabilities.",
        ) from e
    except Exception as e:  # noqa: BLE001 — surface as an explicit lane failure
        logger.warning("query-overlay LLM lane failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Model overlay failed — the deterministic graph is unaffected. Try again.",
        ) from e


# ── Analyst-ratified links (phase 3): the model proposes, the ANALYST writes ──

def _link_dict(r: QueryAcceptedLink) -> dict:
    return {
        "id": r.id, "issuer_a": r.issuer_a, "issuer_b": r.issuer_b,
        "capability_id": r.capability_id, "rationale": r.rationale or "",
        "chunk_ids": r.chunk_ids or [], "confidence": r.confidence or "Low",
        "model": r.model or "", "analyst_id": r.analyst_id,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


class AcceptLinkRequest(BaseModel):
    source_issuer_id: str = Field(min_length=1, max_length=36)
    target_issuer_id: str = Field(min_length=1, max_length=36)
    capability_id: str = Field(min_length=1, max_length=64)
    rationale: str = Field(default="", max_length=300)
    chunk_ids: list[str] = Field(default_factory=list, max_length=8)
    confidence: str = Field(default="Low", max_length=16)
    model: str = Field(default="", max_length=128)


@router.get("/links")
async def list_accepted_links(
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    """All analyst-ratified links — backs the accept/undo state in the overlay UI."""
    _read_rate_guard(caller)
    rows = (await db.execute(select(QueryAcceptedLink))).scalars().all()
    return {"links": [_link_dict(r) for r in rows]}


@router.post("/links")
async def accept_link(
    body: AcceptLinkRequest,
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    """Ratify one model-proposed issuer↔issuer link. Analyst-initiated write —
    the LLM lane never calls this. Idempotent per pair (normalized, undirected):
    re-accepting returns the existing ratification."""
    if not rate_limit.hit(
        f"query:{caller.id}", max_attempts=_QUERY_MAX_PER_MINUTE, window_seconds=60
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Query rate limit reached — try again in a minute.",
        )
    a, b = sorted((body.source_issuer_id, body.target_issuer_id))
    if a == b:
        raise HTTPException(status_code=422, detail="A link needs two distinct issuers.")
    issuers = (await db.execute(select(Issuer.id).where(Issuer.id.in_([a, b])))).scalars().all()
    if len(set(issuers)) != 2:
        raise HTTPException(status_code=404, detail="Both endpoints must be known issuers.")
    existing = (await db.execute(
        select(QueryAcceptedLink).where(QueryAcceptedLink.issuer_a == a, QueryAcceptedLink.issuer_b == b)
    )).scalars().first()
    if existing is not None:
        return {**_link_dict(existing), "created": False}
    row = QueryAcceptedLink(
        issuer_a=a, issuer_b=b, capability_id=body.capability_id,
        rationale=body.rationale, chunk_ids=body.chunk_ids,
        confidence=body.confidence if body.confidence in ("High", "Medium", "Low") else "Low",
        model=body.model, analyst_id=caller.id,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return {**_link_dict(row), "created": True}


@router.delete("/links/{link_id}")
async def retract_link(
    link_id: str,
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    """Retract a ratified link — it stops being drawn on the next graph build."""
    if not rate_limit.hit(
        f"query:{caller.id}", max_attempts=_QUERY_MAX_PER_MINUTE, window_seconds=60
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Query rate limit reached — try again in a minute.",
        )
    row = (await db.execute(
        select(QueryAcceptedLink).where(QueryAcceptedLink.id == link_id)
    )).scalars().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Link not found.")
    await db.delete(row)
    await db.commit()
    return {"deleted": link_id}


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
    if _ADMIN_QUERY_RE.search(body.question):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User-level run queries are admin-only.",
        )
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
