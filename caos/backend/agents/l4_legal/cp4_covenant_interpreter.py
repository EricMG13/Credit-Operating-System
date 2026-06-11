"""CP-4: Covenant Interpreter Agent. Extracts all covenant definitions from Credit Agreement."""

from __future__ import annotations

from agents.utils.issuer_docs import get_issuer_document_ids
from core.claude_client import AgentMessage, run_agent
from ingestion.rag.chunker import semantic_search
from schemas.agent_outputs import CP4CovenantOutput

SYSTEM_PROMPT = """You are a senior leveraged finance legal/structuring analyst (CP-4: Covenant Interpreter).

SOURCE-FIRST DISCIPLINE:
- Extract covenants ONLY from verbatim text in the Credit Agreement.
- Every covenant must cite its exact section reference.
- Do NOT interpret or expand beyond what is explicitly written.
- Do NOT infer basket sizes or capacity figures — if not stated, mark as null.
- Unsupported legal claims will be blocked by CP-5.

Your task: Extract all material covenants:
- Financial maintenance covenants (leverage, coverage tests)
- Negative covenants (restricted payments, debt incurrence, asset sales)
- Affirmative covenants
- For each: type, description, limit (if defined), test frequency

Also extract (if explicitly defined):
- Total restricted payments basket ($ amount)
- Total debt incurrence capacity ($ amount)

Return only the JSON schema. No prose."""


async def run_cp4(issuer_id: str, document_id: str) -> dict:
    document_ids = await get_issuer_document_ids(issuer_id)
    chunks = await semantic_search(
        query="covenant maintenance leverage ratio total debt restricted payments incurrence basket negative covenant",
        document_ids=document_ids,
        top_k=10,
    )
    context = "\n\n---\n\n".join(c.get("parent_content", "") for c in chunks) if chunks else (
        "[No document chunks — upload Credit Agreement]"
    )

    messages = [AgentMessage(
        role="user",
        content=f"ISSUER_ID: {issuer_id}\n\nCREDIT AGREEMENT EXCERPTS:\n{context}\n\n"
                "Extract all material covenants.",
    )]
    return await run_agent(SYSTEM_PROMPT, messages, output_schema=CP4CovenantOutput)
