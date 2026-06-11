"""
CP-1C: PeerBenchmark agent (P1).

Registry-driven agent on the canonical envelope. System prompt is loaded from
the Modular OS corpus (CP-1C_ACTIVE_PROMPT.md); output conforms to
CP1CPeerBenchmarkPayload. Upstream: CP-1. Downstream: CP-2, CP-3.
"""

from __future__ import annotations

from agents.utils.issuer_docs import get_issuer_document_ids
from core.claude_client import AgentMessage, run_agent
from governance.payloads import CP1CPeerBenchmarkPayload
from governance.prompts import load_active_prompt
from ingestion.rag.chunker import semantic_search

MODULE_ID = "CP-1C"


async def run_cp1c(issuer_id: str, peer_list: list[str] | None = None) -> dict:
    system_prompt = load_active_prompt(MODULE_ID)

    document_ids = await get_issuer_document_ids(issuer_id)
    chunks = await semantic_search(
        query="peers competitors sector leverage margin coverage EBITDA revenue "
              "comparable companies valuation EV multiples",
        document_ids=document_ids,
        top_k=8,
    )
    context = "\n\n---\n\n".join(c.get("parent_content", "") for c in chunks) if chunks else (
        "[No document chunks available — populate via /api/ingestion/upload/document]"
    )

    peer_instruction = (
        f"User-provided peer list (Tier 2, highest override): {', '.join(peer_list)}\n\n"
        if peer_list else
        "No user peer list provided — run the Web Scrape Discovery Protocol (Tier 1) "
        "and tag peers 'Web-Scraped — Unverified'.\n\n"
    )

    messages = [
        AgentMessage(
            role="user",
            content=f"ISSUER_ID: {issuer_id}\n\n{peer_instruction}"
                    f"CP-1 CANONICAL CONTEXT / DOCUMENT EXCERPTS:\n{context}\n\n"
                    "Produce the peer benchmark per the CP-1C contract. Assign comparability "
                    "status before any aggregate statistic; apply the peer-statistic minimums "
                    "(median>=3, quartile>=4, average>=5). Emit the canonical envelope.",
        )
    ]

    return await run_agent(system_prompt, messages, output_schema=CP1CPeerBenchmarkPayload)
