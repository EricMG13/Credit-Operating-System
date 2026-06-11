"""CP-1B: Earnings Update Agent (Delta Run only). Extracts KPIs from interim reports."""

from __future__ import annotations

from agents.utils.issuer_docs import get_issuer_document_ids
from core.claude_client import AgentMessage, run_agent
from ingestion.rag.chunker import semantic_search
from schemas.agent_outputs import CP1BEarningsUpdateOutput

SYSTEM_PROMPT = """You are a senior leveraged finance credit analyst (CP-1B: Earnings Update).

This is a DELTA RUN triggered by a new interim financial report.
SOURCE-FIRST DISCIPLINE: Extract KPIs only from the provided report.
Do NOT compare to prior periods unless the report itself provides comparatives.

Extract: Revenue, EBITDA, EBITDA margin %, Net Leverage (x), Free Cash Flow.
Include a brief factual commentary on material changes vs. prior period IF the report discloses them.
Set has_inferred_metrics = true if any figure was calculated, not directly stated.

Return only the JSON schema."""


async def run_cp1b(issuer_id: str, document_id: str) -> dict:
    document_ids = await get_issuer_document_ids(issuer_id)
    chunks = await semantic_search(
        query="revenue EBITDA earnings net leverage free cash flow quarterly interim results",
        document_ids=document_ids,
        top_k=8,
    )
    context = "\n\n---\n\n".join(c.get("parent_content", "") for c in chunks) if chunks else (
        "[No interim report chunks — upload Interim_Financial_Report.pdf]"
    )

    messages = [AgentMessage(
        role="user",
        content=f"ISSUER_ID: {issuer_id}\nDOCUMENT_ID: {document_id}\n\n"
                f"INTERIM REPORT EXCERPTS:\n{context}\n\nExtract earnings update KPIs.",
    )]
    return await run_agent(SYSTEM_PROMPT, messages, output_schema=CP1BEarningsUpdateOutput)
