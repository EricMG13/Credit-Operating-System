"""CP-2F MacroSectorOverlay — base-rate sensitivity on the debt stack.

Deterministic off CP-1: shocks the base rate +100/+200bps against net debt,
computes the incremental annual interest and the stressed interest coverage. No
hedge register is ingested, so it assumes 100% floating and unhedged (flagged) —
the conservative read. No documents, no LLM (the idiom of [earnings.py]).
"""

from __future__ import annotations

from typing import Optional

from engine.periods import latest
from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload

_SHOCKS_BPS = (100, 200)


def compute_rate_sensitivity(nf: dict) -> Optional[dict]:
    """Interest / coverage under base-rate shocks, or None if CP-1 lacks net debt."""
    net_debt = nf.get("net_debt_ltm")
    eb = latest(nf.get("adj_ebitda") or {})
    if not isinstance(net_debt, (int, float)) or not isinstance(eb, (int, float)) or not eb:
        return None
    cov = nf.get("interest_coverage_ltm")
    base_interest = round(eb / cov, 1) if isinstance(cov, (int, float)) and cov else None

    scenarios = []
    for bps in _SHOCKS_BPS:
        add = round(net_debt * bps / 10000, 1)  # $M incremental annual interest
        new_interest = round(base_interest + add, 1) if base_interest else None
        new_cov = round(eb / new_interest, 2) if new_interest else None
        scenarios.append({"rate_shock_bps": bps, "incremental_interest_musd": add,
                          "stressed_interest_coverage": new_cov})

    return {
        "net_debt_musd": round(float(net_debt), 1),
        "base_interest_musd": base_interest,
        "base_interest_coverage": cov if isinstance(cov, (int, float)) else None,
        "scenarios": scenarios,
        "assumption": "Assumes 100% floating-rate and unhedged (no hedge register ingested).",
    }


async def synthesize_macro(cp1: ModulePayload) -> ModulePayload:
    """Build the CP-2F payload from CP-1's net debt / coverage."""
    nf = (cp1.runtime_output or {}).get("normalized_financials") or {}
    s = compute_rate_sensitivity(nf)
    if s is None:
        return ModulePayload(
            module_id="CP-2F", module_name="MacroSectorOverlay",
            owned_object="macro_sector_overlay",
            runtime_output={"scenarios": [], "note": "CP-1 provided no net debt to stress for rate sensitivity."},
            confidence="Insufficient Information",
            limitation_flags=["CP-1 provided no net debt; no rate sensitivity computed."],
            downstream_consumers=["CP-6A"],
        )

    sc100 = s["scenarios"][0]
    cov_txt = (f"interest coverage {s['base_interest_coverage']:g}x → {sc100['stressed_interest_coverage']:g}x"
               if sc100["stressed_interest_coverage"] is not None
               else "coverage not computable (no base interest)")
    return ModulePayload(
        module_id="CP-2F", module_name="MacroSectorOverlay",
        owned_object="macro_sector_overlay", runtime_output=s, confidence="High",
        downstream_consumers=["CP-6A"],
        limitation_flags=[s["assumption"]],
        claims=[ClaimSpec(
            claim_id="C-MAC1",
            claim_text=(f"A +100bps base-rate move adds ~${sc100['incremental_interest_musd']:g}M "
                        f"annual interest ({cov_txt}), assuming unhedged floating debt."),
            evidence=[EvidenceSpec("E-MAC1", "upstream_artifact", "Calculated",
                                   "Derived from CP-1 net debt / interest coverage under rate stress", "Medium")],
        )],
    )
