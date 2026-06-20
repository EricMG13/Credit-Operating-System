"""CP-2B DownsidePathwayAnalysis — stress the leverage and coverage.

Pure computation off CP-1's leverage / coverage: applies EBITDA-decline shocks,
recomputes net leverage and interest coverage at each, and reports the shock at
which leverage crosses a distress threshold — the "fragility" read a downside
analyst wants. Deterministic, runs for any issuer CP-1 gave a leverage figure;
no documents, no LLM (the same idiom as [earnings.py]).
"""

from __future__ import annotations

from typing import Optional

from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload

# EBITDA-decline scenarios, and the net leverage at/above which the credit is
# treated as distressed (a conventional leveraged-loan distress marker).
_SHOCKS = (0.10, 0.20, 0.30)
_BREACH_X = 7.0


def compute_pathways(nf: dict) -> Optional[dict]:
    """Leverage/coverage under EBITDA stress, or None if CP-1 gave no leverage.

    Net debt is held fixed under the EBITDA shock, so stressed leverage is just
    ``current / (1 - shock)`` — the standard first-order downside sensitivity.
    """
    lev = nf.get("net_leverage_adj_ltm")
    if not isinstance(lev, (int, float)):
        return None
    cov = nf.get("interest_coverage_ltm")

    scenarios = []
    shock_to_breach: Optional[int] = None
    for s in _SHOCKS:
        sl = round(lev / (1 - s), 2)
        sc = round(cov * (1 - s), 2) if isinstance(cov, (int, float)) else None
        scenarios.append({
            "ebitda_shock_pct": round(s * 100),
            "stressed_net_leverage": sl,
            "stressed_interest_coverage": sc,
        })
        if shock_to_breach is None and sl >= _BREACH_X:
            shock_to_breach = round(s * 100)

    if lev >= _BREACH_X or (shock_to_breach is not None and shock_to_breach <= 10):
        fragility = "HIGH"
    elif shock_to_breach is not None and shock_to_breach <= 20:
        fragility = "MODERATE"
    else:
        fragility = "LOW"

    return {
        "current_net_leverage": round(float(lev), 2),
        "breach_threshold_x": _BREACH_X,
        "scenarios": scenarios,
        "shock_to_breach_pct": shock_to_breach,
        "fragility": fragility,
    }


async def synthesize_downside(cp1: ModulePayload) -> ModulePayload:
    """Build the CP-2B payload from CP-1's canonical financials."""
    nf = (cp1.runtime_output or {}).get("normalized_financials") or {}
    p = compute_pathways(nf)
    if p is None:
        return ModulePayload(
            module_id="CP-2B", module_name="DownsidePathway",
            owned_object="downside_pathway",
            runtime_output={"scenarios": [], "note": "CP-1 provided no leverage to stress."},
            confidence="Insufficient Information",
            limitation_flags=["CP-1 provided no net leverage; no downside pathway computed."],
            downstream_consumers=["CP-6A"],
        )

    sb = p["shock_to_breach_pct"]
    breach_txt = (f"a {sb}% EBITDA decline lifts net leverage to ~{_BREACH_X:g}x"
                  if sb is not None
                  else f"net leverage stays below {_BREACH_X:g}x through a 30% EBITDA decline")
    return ModulePayload(
        module_id="CP-2B", module_name="DownsidePathway",
        owned_object="downside_pathway", runtime_output=p, confidence="High",
        downstream_consumers=["CP-6A"],
        claims=[ClaimSpec(
            claim_id="C-DOWN1",
            claim_text=(f"Downside fragility {p['fragility']}: {breach_txt} "
                        f"(from {p['current_net_leverage']:g}x today)."),
            evidence=[EvidenceSpec("E-DOWN1", "upstream_artifact", "Calculated",
                                   "Derived from CP-1 leverage/coverage under EBITDA stress", "High")],
        )],
    )
