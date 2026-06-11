"""CP-2D: GovernanceSponsorScore agent (P1). Upstream: CP-1A, CP-2. Downstream: CP-6A."""

from __future__ import annotations

import json
from typing import Any

from agents.utils.issuer_docs import get_issuer_document_ids
from core.claude_client import AgentMessage, run_agent
from governance.payloads import CP2DGovernancePayload
from governance.prompts import load_active_prompt
from ingestion.rag.chunker import semantic_search

MODULE_ID = "CP-2D"


async def run_cp2d(
    issuer_id: str,
    cp1a_output: dict[str, Any] | None = None,
    cp2_output: dict[str, Any] | None = None,
) -> dict:
    system_prompt = load_active_prompt(MODULE_ID)
    document_ids = await get_issuer_document_ids(issuer_id)
    chunks = await semantic_search(
        query="sponsor private equity ownership board governance management team related-party "
              "transactions shareholder agreement dividend extraction track record",
        document_ids=document_ids, top_k=8,
    )
    context = "\n\n---\n\n".join(c.get("parent_content", "") for c in chunks) if chunks else "[No document chunks available]"
    upstream = ""
    for label, art in (("CP-1A", cp1a_output), ("CP-2", cp2_output)):
        if art:
            upstream += f"\n{label} CONTEXT:\n{json.dumps(art)[:3500]}\n"
    messages = [AgentMessage(role="user", content=(
        f"ISSUER_ID: {issuer_id}\n{upstream}\nDOCUMENT EXCERPTS:\n{context}\n\n"
        "Assess governance quality and sponsor/management strength from source evidence "
        "(extraction risk, alignment, track record). Emit the canonical envelope."))]
    return await run_agent(system_prompt, messages, output_schema=CP2DGovernancePayload)
