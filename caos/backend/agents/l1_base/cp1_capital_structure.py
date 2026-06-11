"""
CP-1: Capital Structure Agent — LEGACY TAXONOMY (Taxonomy B).

⚠ TAXONOMY DRIFT (tracked in Modular OS TAXONOMY_RECONCILIATION.md):
  Modular OS v2 Canonical (Taxonomy A) defines CP-1 = CanonicalDataFoundation
  (normalised financials + KPI register). This module still implements the
  legacy CP-1 = Capital Structure semantics. The orchestrator (dag.py) and
  schemas (CP1CapitalStructureOutput) match this legacy shape, but the
  Modular OS prompt corpus + module_registry.json have moved to Taxonomy A.

  Migration plan (P0 — see docs/REMEDIATION_PLAN.md):
    1. Promote this file to `cp1_capital_structure.py` → CP-1A semantics
       (Capital Structure becomes part of the Business Transaction Fact Pack).
    2. Author a new `cp1_canonical_data_foundation.py` for the Taxonomy-A CP-1.
    3. Update schemas/agent_outputs.py, dag.py, and registry_dispatch.py to
       point at the new module ids consistently.

Source-First Discipline: all metrics sourced from OM / Credit Agreement.
Output: CP1CapitalStructureOutput (Pydantic-enforced JSON).
"""

from __future__ import annotations

from agents.utils.issuer_docs import get_issuer_document_ids
from core.claude_client import AgentMessage, run_agent
from ingestion.rag.chunker import semantic_search
from schemas.agent_outputs import CP1CapitalStructureOutput

SYSTEM_PROMPT = """You are a senior leveraged finance credit analyst (CP-1: Capital Structure).

SOURCE-FIRST DISCIPLINE (non-negotiable):
- Every metric, figure, and conclusion must cite a specific document, page, and section.
- You must NEVER infer, estimate, or calculate metrics not explicitly stated in the source documents.
- If a metric is missing from the sources, state "Not Disclosed" — do not estimate.
- Set has_inferred_metrics = true if ANY metric lacks a direct source citation (this will BLOCK the output).

Your task: Extract the complete capital structure from the provided document excerpts.
For each debt tranche: name, type, amount, currency, maturity, rate, seniority rank, and lien position.
Total equity and enterprise value only if explicitly disclosed.

Return ONLY the JSON schema specified. No prose outside the JSON object."""


async def run_cp1(issuer_id: str, document_id: str) -> dict:
    document_ids = await get_issuer_document_ids(issuer_id)
    chunks = await semantic_search(
        query="capital structure debt tranches senior secured term loan revolving credit facility notes bonds",
        document_ids=document_ids,
        top_k=8,
    )
    context = "\n\n---\n\n".join(c.get("parent_content", "") for c in chunks) if chunks else (
        "[No document chunks available — populate via /api/ingestion/upload/document]"
    )

    messages = [
        AgentMessage(
            role="user",
            content=f"ISSUER_ID: {issuer_id}\nDOCUMENT_ID: {document_id}\n\n"
                    f"DOCUMENT EXCERPTS:\n{context}\n\n"
                    "Extract the full capital structure per the JSON schema.",
        )
    ]

    result = await run_agent(
        SYSTEM_PROMPT,
        messages,
        output_schema=CP1CapitalStructureOutput,
    )
    return result
