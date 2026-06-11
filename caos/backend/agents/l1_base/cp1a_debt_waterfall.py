"""CP-1A: Debt Waterfall Agent. Recovery analysis by lien priority."""

from __future__ import annotations

from agents.utils.issuer_docs import get_issuer_document_ids
from core.claude_client import AgentMessage, run_agent
from ingestion.rag.chunker import semantic_search
from schemas.agent_outputs import CP1ADebtWaterfallOutput

SYSTEM_PROMPT = """You are a senior leveraged finance credit analyst (CP-1A: Debt Waterfall).

SOURCE-FIRST DISCIPLINE: All recovery assumptions must reference the collateral descriptions,
intercreditor agreements, or coverage ratios stated in source documents.
Do NOT model recovery scenarios unless explicit collateral values or coverage data is provided.

Your task: Map the debt waterfall in priority order. For each tranche:
- Rank (1 = highest priority)
- Instrument name and amount
- Recovery scenario (base and stress) expressed as % — ONLY if source data supports it

If recovery data is unavailable, omit recovery fields (do not set to zero — use null).
Return only the JSON schema. No prose."""


async def run_cp1a(issuer_id: str, document_id: str) -> dict:
    document_ids = await get_issuer_document_ids(issuer_id)
    chunks = await semantic_search(
        query="collateral security interest lien priority intercreditor waterfall recovery",
        document_ids=document_ids,
        top_k=6,
    )
    context = "\n\n---\n\n".join(c.get("parent_content", "") for c in chunks) if chunks else (
        "[No document chunks — upload Credit Agreement]"
    )

    messages = [AgentMessage(
        role="user",
        content=f"ISSUER_ID: {issuer_id}\n\nDOCUMENT EXCERPTS:\n{context}\n\nMap the debt waterfall.",
    )]
    return await run_agent(SYSTEM_PROMPT, messages, output_schema=CP1ADebtWaterfallOutput)
