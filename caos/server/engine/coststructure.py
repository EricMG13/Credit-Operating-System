"""CP-2 CostStructure — derive input-cost (energy) exposure from the issuer's
own documents, with a source-cited claim that flows through the CP-5B lineage
check and the CP-5 gate.

Deterministic (regex over retrieved chunks via
``engine.metrics.derive_energy_cost_pct``), so it works for any issuer with
ingested documents without a fixture or an LLM call — the run-time, QA-gated
counterpart to the seed-time energy_cost_pct derivation in seed.py.
"""

from __future__ import annotations

from engine.metrics import derive_energy_cost_pct
from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload

# Retrieval query that surfaces the cost-structure / energy disclosure.
_QUERY = "energy power natural gas fuel input cost of goods sold"


async def synthesize_cost_structure(issuer_name: str, retrieve) -> ModulePayload:
    """Build the CP-2 payload by extracting energy-as-%-of-COGS from retrieved
    source chunks. ``retrieve(query, k)`` is the runner's issuer-scoped BM25."""
    hits = await retrieve(_QUERY, 4)
    derived = derive_energy_cost_pct([(h.chunk_id, "", h.text) for h in hits])

    if derived is None:
        # Ran cleanly but the sources disclose no energy cost split — no metric,
        # no claim (so no orphan-claim finding), just a logged limitation.
        return ModulePayload(
            module_id="CP-2",
            module_name="CostStructure",
            owned_object="cost_structure",
            runtime_output={
                "energy_cost_pct": None,
                "cost_base": "COGS",
                "note": "No energy cost-of-COGS disclosure found in ingested sources.",
            },
            confidence="Insufficient Information",
            limitation_flags=["No energy cost-structure disclosure in ingested sources."],
            downstream_consumers=[],
        )

    value, chunk_id, _doc = derived
    return ModulePayload(
        module_id="CP-2",
        module_name="CostStructure",
        owned_object="cost_structure",
        runtime_output={
            "energy_cost_pct": value,
            "cost_base": "COGS",
            "method": "extracted_from_disclosure",
        },
        confidence="High",
        downstream_consumers=[],
        claims=[
            ClaimSpec(
                claim_id="C-CS1",
                claim_text=(
                    f"Energy is approximately {value:g} percent of cost of goods sold — "
                    "a key margin sensitivity to energy-price inflation."
                ),
                # Calculated lineage + a resolved chunk → CP-5B raises no finding.
                evidence=[EvidenceSpec(
                    evidence_id="E-CS1",
                    extraction_type="calculated_metric",
                    lineage_class="Calculated",
                    source_locator="Cost-structure disclosure (ingested document chunk)",
                    confidence="High",
                    resolved_chunk_id=chunk_id,
                )],
            )
        ],
    )
