"""
CP-5B: Traceability Validator.
Validates that every material conclusion carries a complete evidence chain:
  [Evidence] -> [Risk Mechanic] -> [Credit Implication]
Used for UI click-to-source mapping.
"""

from __future__ import annotations


async def run_cp5b(all_outputs: list[dict]) -> dict:
    """
    Build a unified evidence chain index across all agent outputs.
    Maps material conclusions to their source evidence for frontend deep-linking.
    """
    evidence_index: list[dict] = []
    violations: list[str] = []

    for output in all_outputs:
        module_id = output.get("module_id", "UNKNOWN")
        conclusions = output.get("material_conclusions", [])

        for c in conclusions:
            chain = c.get("evidence_chain", [])
            if not chain:
                violations.append(f"{module_id}: conclusion '{c.get('label')}' missing evidence chain")
                continue

            for link in chain:
                evidence_index.append({
                    "module_id": module_id,
                    "conclusion_label": c.get("label"),
                    "conclusion_value": c.get("value"),
                    "evidence": link.get("evidence"),
                    "source_doc": link.get("source_doc"),
                    "risk_mechanic": link.get("risk_mechanic"),
                    "credit_implication": link.get("credit_implication"),
                })

    return {
        "module_id": "CP-5B",
        "evidence_index": evidence_index,
        "violations": violations,
        "total_conclusions": sum(len(o.get("material_conclusions", [])) for o in all_outputs),
        "total_evidence_links": len(evidence_index),
        "traceability_score": (
            round(len(evidence_index) / max(1, sum(len(o.get("material_conclusions", [])) for o in all_outputs)) * 100, 1)
        ),
    }
