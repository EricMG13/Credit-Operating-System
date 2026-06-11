"""
CP-2B: DownsidePathway agent (P1).

Stress-transmission engine. Upstream: CP-1, CP-1B, CP-2. Downstream: CP-3D, CP-6A.
Conditional hard stop if CP-1 and CP-2 are both unavailable.
"""

from __future__ import annotations

import json
from typing import Any

from agents.utils.issuer_docs import get_issuer_document_ids
from core.claude_client import AgentMessage, run_agent
from governance.payloads import CP2BDownsidePathwayPayload
from governance.prompts import load_active_prompt
from ingestion.rag.chunker import semantic_search

MODULE_ID = "CP-2B"


async def run_cp2b(
    issuer_id: str,
    cp1_output: dict[str, Any] | None = None,
    cp1b_output: dict[str, Any] | None = None,
    cp2_output: dict[str, Any] | None = None,
) -> dict:
    # Conditional hard stop (route map gate).
    if cp1_output is None and cp2_output is None:
        return CP2BDownsidePathwayPayload(
            qa_status="Blocked",  # type: ignore[arg-type]
            limitation_flags=["CONDITIONAL_HARD_STOP: CP-1 and CP-2 both unavailable"],
            validation_warnings=["CP-2B did not execute: required upstream CP-1 and CP-2 missing."],
        ).model_dump()

    system_prompt = load_active_prompt(MODULE_ID)
    document_ids = await get_issuer_document_ids(issuer_id)
    chunks = await semantic_search(
        query="revenue concentration customer churn margin compression working capital "
              "capex covenant headroom maturity liquidity cyclicality demand sensitivity",
        document_ids=document_ids,
        top_k=8,
    )
    context = "\n\n---\n\n".join(c.get("parent_content", "") for c in chunks) if chunks else "[No document chunks available]"

    upstream = ""
    for label, art in (("CP-1", cp1_output), ("CP-1B", cp1b_output), ("CP-2", cp2_output)):
        if art:
            upstream += f"\n{label} ARTIFACT:\n{json.dumps(art)[:4000]}\n"

    messages = [
        AgentMessage(
            role="user",
            content=f"ISSUER_ID: {issuer_id}\n{upstream}\nDOCUMENT EXCERPTS:\n{context}\n\n"
                    "Build the downside pathway via the required causal chain (Operating Driver -> "
                    "Break Point -> Financial Effect -> FCF/Liquidity -> Leverage/Covenant/Refinancing "
                    "-> Credit Consequence). Identify first-break, assess the 8 fragility groups, and "
                    "label unsupported links [Insufficient Information] or [Analyst Inference]. Emit the envelope.",
        )
    ]
    return await run_agent(system_prompt, messages, output_schema=CP2BDownsidePathwayPayload)
