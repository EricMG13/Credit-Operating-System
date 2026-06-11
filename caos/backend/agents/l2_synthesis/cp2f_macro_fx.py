"""CP-2F: MacroFXHedgingSensitivity agent (P1). Upstream: CP-2. Downstream: CP-6A."""

from __future__ import annotations

import json
from typing import Any

from agents.utils.issuer_docs import get_issuer_document_ids
from core.claude_client import AgentMessage, run_agent
from governance.payloads import CP2FMacroPayload
from governance.prompts import load_active_prompt
from ingestion.rag.chunker import semantic_search

MODULE_ID = "CP-2F"


async def run_cp2f(issuer_id: str, cp2_output: dict[str, Any] | None = None) -> dict:
    system_prompt = load_active_prompt(MODULE_ID)
    document_ids = await get_issuer_document_ids(issuer_id)
    chunks = await semantic_search(
        query="foreign exchange currency exposure functional currency hedging interest rate "
              "swap commodity input cost geographic revenue mix macro sensitivity inflation",
        document_ids=document_ids, top_k=8,
    )
    context = "\n\n---\n\n".join(c.get("parent_content", "") for c in chunks) if chunks else "[No document chunks available]"
    upstream = f"\nCP-2 CONTEXT:\n{json.dumps(cp2_output)[:4000]}\n" if cp2_output else ""
    messages = [AgentMessage(role="user", content=(
        f"ISSUER_ID: {issuer_id}\n{upstream}\nDOCUMENT EXCERPTS:\n{context}\n\n"
        "Assess macro sensitivity, FX exposure (transaction/translation), and hedging coverage "
        "from disclosed evidence. Do not assume hedges or exposures not disclosed. Emit the envelope."))]
    return await run_agent(system_prompt, messages, output_schema=CP2FMacroPayload)
