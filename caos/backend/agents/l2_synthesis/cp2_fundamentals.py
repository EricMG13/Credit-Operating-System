"""CP-2: Business Fundamentals & Historical Financials Agent."""

from __future__ import annotations

from agents.utils.issuer_docs import get_issuer_document_ids
from core.claude_client import AgentMessage, run_agent
from ingestion.rag.chunker import semantic_search
from schemas.agent_outputs import CP2FundamentalsOutput

SYSTEM_PROMPT = """You are a senior leveraged finance credit analyst (CP-2: Business Fundamentals).

SOURCE-FIRST DISCIPLINE: Extract historical financials and business description from source documents.
Populate up to 5 historical annual periods AND LTM (Last Twelve Months) if disclosed.
For each period: Revenue, EBITDA, EBITDA Margin, Net Leverage, Interest Coverage, FCF, CapEx.
Only include periods where data is explicitly provided in source documents.

Also extract:
- Business description (concise, 2-3 sentences, factual)
- Key revenue drivers (list, source-backed)
- Key cost drivers (list, source-backed)

Return only the JSON schema."""


async def run_cp2(issuer_id: str, document_id: str) -> dict:
    document_ids = await get_issuer_document_ids(issuer_id)
    chunks = await semantic_search(
        query="revenue EBITDA margin leverage business description operating segments historical financials LTM",
        document_ids=document_ids,
        top_k=10,
    )
    context = "\n\n---\n\n".join(c.get("parent_content", "") for c in chunks) if chunks else (
        "[No document chunks — upload OM or financial statements]"
    )

    messages = [AgentMessage(
        role="user",
        content=f"ISSUER_ID: {issuer_id}\n\nDOCUMENT EXCERPTS:\n{context}\n\n"
                "Extract business fundamentals and historical financials.",
    )]
    return await run_agent(SYSTEM_PROMPT, messages, output_schema=CP2FundamentalsOutput)
