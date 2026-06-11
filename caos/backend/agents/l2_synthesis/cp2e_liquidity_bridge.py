"""
CP-2E: LiquidityCashFlowBridge agent (P1).

Registry-driven agent on the canonical envelope. System prompt loaded from the
Modular OS corpus (CP-2E_ACTIVE_PROMPT.md); output conforms to
CP2ELiquidityBridgePayload. Upstream: CP-1, CP-2. Downstream: CP-3, CP-3D, CP-6A.
"""

from __future__ import annotations

import json
from typing import Any

from agents.utils.issuer_docs import get_issuer_document_ids
from core.claude_client import AgentMessage, run_agent
from governance.payloads import CP2ELiquidityBridgePayload
from governance.prompts import load_active_prompt
from ingestion.rag.chunker import semantic_search

MODULE_ID = "CP-2E"


async def run_cp2e(
    issuer_id: str,
    cp1_output: dict[str, Any] | None = None,
    cp2_output: dict[str, Any] | None = None,
) -> dict:
    system_prompt = load_active_prompt(MODULE_ID)

    document_ids = await get_issuer_document_ids(issuer_id)
    chunks = await semantic_search(
        query="cash and cash equivalents restricted cash revolver availability undrawn "
              "borrowing base covenant liquidity working capital capex cash interest "
              "cash taxes debt amortization maturity schedule",
        document_ids=document_ids,
        top_k=10,
    )
    context = "\n\n---\n\n".join(c.get("parent_content", "") for c in chunks) if chunks else (
        "[No document chunks available — populate via /api/ingestion/upload/document]"
    )

    upstream = ""
    if cp1_output:
        upstream += f"\nCP-1 CANONICAL FINANCIALS (definitions are authoritative):\n{json.dumps(cp1_output)[:6000]}\n"
    if cp2_output:
        upstream += f"\nCP-2 SYNTHESIS CONTEXT:\n{json.dumps(cp2_output)[:4000]}\n"

    messages = [
        AgentMessage(
            role="user",
            content=f"ISSUER_ID: {issuer_id}\n{upstream}\n"
                    f"DOCUMENT EXCERPTS:\n{context}\n\n"
                    "Build the 12-month near-term liquidity & cash-flow bridge per the CP-2E "
                    "contract. Distinguish accessible from covenant/borrowing-base-constrained "
                    "liquidity; store unavailable values as null (never zero); only compute "
                    "Months to Empty when beginning liquidity and a supported cash-burn basis "
                    "both exist; assign a Liquidity Risk Level. Emit the canonical envelope.",
        )
    ]

    return await run_agent(system_prompt, messages, output_schema=CP2ELiquidityBridgePayload)
