"""CP-1 source precedence — the reported-foundation helpers extracted from the
runner so the dispatch (``engine.bindings``) and the runner can share them
without a module-load import cycle.

If ``bindings`` and ``runner`` both took a top-level edge on each other, Python
would import a partially-initialized ``runner`` (its CP-1 helpers are defined
*after* ``execute_run``) and raise ``ImportError`` (see
``docs/ENGINE_IMPLEMENTATION_SPEC.md`` P1·C1). This module imports only leaf
producers (``edgar_cp1``, ``reported_cp1``) and infra (``config``, ``database``)
— never ``runner`` or ``bindings`` — so it is cycle-free, and it gives CP-1's
source precedence (EDGAR → reported-disclosure → LLM/fixture) its own navigable,
tested home.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Dict, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from database import Document, DocumentChunk, Issuer
from engine import edgar_cp1, reported_cp1
from engine.fixtures import REFERENCE_ISSUER_ID
from engine.schemas import ModulePayload

logger = logging.getLogger("caos.engine")


async def synthesize_cp1_reported(
    session: AsyncSession, issuer: Optional[Issuer], issuer_name: str,
    synthesizer, upstream: Dict[str, ModulePayload], retrieve,
) -> ModulePayload:
    """CP-1 precedence: a deterministic EDGAR reported foundation for a public
    filer (cited to XBRL, no key) when EDGAR is configured and the issuer has a
    ticker; otherwise the LLM/fixture synthesizer. The EDGAR figures are vaulted
    as a chunk and the payload's evidence resolved to it, so CP-5B passes cleanly
    and click-to-source has a real source. The adjusted/covenant-EBITDA read is a
    separate layer (CP-4C) — EDGAR is the reported basis only."""
    settings = get_settings()
    if settings.edgar_user_agent.strip() and issuer is not None and issuer.ticker:
        build = await asyncio.to_thread(edgar_cp1.fetch_cp1, issuer.ticker, issuer_name)
        if build is not None:
            chunk_id = await vault_edgar_facts(session, issuer, build.facts_text)
            for c in build.payload.claims:
                for e in c.evidence:
                    e.resolved_chunk_id = chunk_id
            logger.info("CP-1 grounded in EDGAR for %s (CIK %s)", issuer_name, build.cik)
            return build.payload
    # Non-EDGAR issuers (non-US / IFRS, no SEC XBRL): try a reported-disclosure CP-1
    # from the issuer's own quarterly investor report / earnings before the LLM/fixture
    # path. Its evidence already resolves to the source (uploaded) chunk.
    #
    # The reference/demo issuer is excluded: its docs are stub text with curated
    # fixture financials, so the thin headline-only reported extractor would preempt
    # the rich fixture (offline) or a full LLM spread (live) with a single number.
    if issuer is None or issuer.id != REFERENCE_ISSUER_ID:
        reported = await reported_cp1.build_reported_cp1_payload(issuer_name, retrieve)
        if reported is not None:
            logger.info("CP-1 grounded in issuer-disclosed reported metrics for %s", issuer_name)
            return reported
    return await synthesizer.synthesize(
        "CP-1", issuer_name=issuer_name, upstream=upstream, retrieve=retrieve
    )


async def vault_edgar_facts(session: AsyncSession, issuer: Issuer, facts_text: str) -> str:
    """Idempotently vault the EDGAR XBRL extract as a single-chunk document for the
    issuer, returning the chunk id to anchor CP-1 evidence to. Re-runs refresh the
    chunk text in place rather than accumulating duplicates."""
    storage_key = f"edgar/{issuer.id}/xbrl_facts"
    doc = (await session.execute(
        select(Document).where(
            Document.issuer_id == issuer.id, Document.storage_key == storage_key
        )
    )).scalar_one_or_none()
    if doc is not None:
        chunk = (await session.execute(
            select(DocumentChunk)
            .where(DocumentChunk.document_id == doc.id)
            .order_by(DocumentChunk.seq)
        )).scalars().first()
        if chunk is not None:
            chunk.text = facts_text
            await session.flush()
            return chunk.id
    else:
        doc = Document(
            issuer_id=issuer.id, doc_type="EDGAR-XBRL",
            file_name="sec_edgar_xbrl_facts.txt", storage_key=storage_key,
            chunk_count=1, uploaded_by="edgar-lane",
        )
        session.add(doc)
        await session.flush()
    chunk = DocumentChunk(document_id=doc.id, seq=0, text=facts_text)
    session.add(chunk)
    await session.flush()
    return chunk.id
