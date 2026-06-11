"""
CP-3B: RecoveryInstrumentPreference agent (P1). Upstream: CP-3 + capital structure.
Two input gates (route map): CP-3 RV unavailable -> Blocked; capital structure lacks
seniority/subordination -> Blocked.
"""

from __future__ import annotations

import json
from typing import Any

from agents.utils.issuer_docs import get_issuer_document_ids
from core.claude_client import AgentMessage, run_agent
from governance.payloads import CP3BRecoveryPayload
from governance.prompts import load_active_prompt
from ingestion.rag.chunker import semantic_search

MODULE_ID = "CP-3B"


async def run_cp3b(
    issuer_id: str,
    cp3_output: dict[str, Any] | None = None,
    capital_structure: dict[str, Any] | None = None,
) -> dict:
    # Input Gate 1: CP-3 RV analysis required.
    if cp3_output is None:
        return CP3BRecoveryPayload(
            qa_status="Blocked",  # type: ignore[arg-type]
            limitation_flags=["INPUT_GATE_1: CP-3 RV analysis unavailable"],
        ).model_dump()
    # Input Gate 2: capital structure must carry seniority/subordination.
    if not capital_structure or "tranches" not in capital_structure:
        return CP3BRecoveryPayload(
            qa_status="Blocked",  # type: ignore[arg-type]
            limitation_flags=["INPUT_GATE_2: capital structure lacks seniority/subordination detail"],
        ).model_dump()

    system_prompt = load_active_prompt(MODULE_ID)
    document_ids = await get_issuer_document_ids(issuer_id)
    chunks = await semantic_search(
        query="collateral security interest lien priority seniority subordination guarantee "
              "enterprise value recovery waterfall intercreditor structural subordination",
        document_ids=document_ids, top_k=8,
    )
    context = "\n\n---\n\n".join(c.get("parent_content", "") for c in chunks) if chunks else "[No document chunks available]"
    upstream = (f"\nCP-3 RV:\n{json.dumps(cp3_output)[:3000]}\n"
                f"\nCAPITAL STRUCTURE:\n{json.dumps(capital_structure)[:3000]}\n")
    messages = [AgentMessage(role="user", content=(
        f"ISSUER_ID: {issuer_id}\n{upstream}\nDOCUMENT EXCERPTS:\n{context}\n\n"
        "Build the recovery waterfall and instrument-level recovery bands, rank instruments, and "
        "select a preferred instrument with a decision posture. Emit the canonical envelope."))]
    return await run_agent(system_prompt, messages, output_schema=CP3BRecoveryPayload)
