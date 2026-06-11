"""
CP-3D: RefinancingLMERisk agent (P1).

Upstream: CP-1, CP-1A, CP-2B, CP-2E. Downstream: CP-4, CP-6A.
Creditor perspective; does not provide legal advice.
"""

from __future__ import annotations

import json
from typing import Any

from agents.utils.issuer_docs import get_issuer_document_ids
from core.claude_client import AgentMessage, run_agent
from governance.payloads import CP3DRefinancingLMEPayload
from governance.prompts import load_active_prompt
from ingestion.rag.chunker import semantic_search

MODULE_ID = "CP-3D"


async def run_cp3d(
    issuer_id: str,
    cp1_output: dict[str, Any] | None = None,
    cp1a_output: dict[str, Any] | None = None,
    cp2b_output: dict[str, Any] | None = None,
    cp2e_output: dict[str, Any] | None = None,
) -> dict:
    system_prompt = load_active_prompt(MODULE_ID)
    document_ids = await get_issuer_document_ids(issuer_id)
    chunks = await semantic_search(
        query="debt maturity schedule maturity wall refinancing revolver springing maturity "
              "amend extend exchange uptier drop down priming covenant capacity restricted payments "
              "sponsor liability management",
        document_ids=document_ids,
        top_k=10,
    )
    context = "\n\n---\n\n".join(c.get("parent_content", "") for c in chunks) if chunks else "[No document chunks available]"

    upstream = ""
    for label, art in (("CP-1", cp1_output), ("CP-1A", cp1a_output),
                       ("CP-2B", cp2b_output), ("CP-2E", cp2e_output)):
        if art:
            upstream += f"\n{label} ARTIFACT:\n{json.dumps(art)[:3500]}\n"

    messages = [
        AgentMessage(
            role="user",
            content=f"ISSUER_ID: {issuer_id}\n{upstream}\nDOCUMENT EXCERPTS:\n{context}\n\n"
                    "Map the maturity wall, assess refinancing pressure and LME vulnerability "
                    "(Low/Medium/High), identify exposed creditor classes, and classify the most "
                    "likely refinancing_path_type from the 7-value enum. Do not provide legal advice. "
                    "Emit the canonical envelope.",
        )
    ]
    return await run_agent(system_prompt, messages, output_schema=CP3DRefinancingLMEPayload)
