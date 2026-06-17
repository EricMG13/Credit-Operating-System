"""CP-3D TradingLiquidityAnalysis — refinancing / LME vulnerability score.

Deterministic: scores how exposed the credit is to coercive liability management
(uptier / drop-down) and a hard refinancing, from CP-1 leverage and CP-2B
downside fragility — the two structural drivers of LME risk. The maturity wall
itself needs a maturity schedule (not in CP-1), so that is flagged, not invented.
No documents, no LLM.
"""

from __future__ import annotations

from typing import List, Optional, Tuple

from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload

_MAX_SCORE = 10


def score_vulnerability(leverage: Optional[float], fragility: Optional[str]) -> Tuple[int, str, List[str]]:
    score = 0
    drivers: List[str] = []
    if isinstance(leverage, (int, float)):
        if leverage >= 6.0:
            score += 4
            drivers.append(f"high leverage {leverage:g}x")
        elif leverage >= 5.0:
            score += 2
            drivers.append(f"elevated leverage {leverage:g}x")
    if fragility == "HIGH":
        score += 4
        drivers.append("high downside fragility")
    elif fragility == "MODERATE":
        score += 2
        drivers.append("moderate downside fragility")
    score = min(_MAX_SCORE, score)
    band = "HIGH" if score >= 6 else "MODERATE" if score >= 3 else "LOW"
    return score, band, drivers


async def synthesize_refinancing(cp1: ModulePayload, cp2b: Optional[ModulePayload]) -> ModulePayload:
    """Build the CP-3D payload from CP-1 leverage + CP-2B fragility."""
    leverage = (cp1.runtime_output or {}).get("normalized_financials", {}).get("net_leverage_adj_ltm")
    fragility = (cp2b.runtime_output or {}).get("fragility") if cp2b is not None else None

    if not isinstance(leverage, (int, float)):
        return ModulePayload(
            module_id="CP-3D", module_name="TradingLiquidityAnalysis",
            owned_object="trading_liquidity_analysis",
            runtime_output={"note": "CP-1 provided no leverage; no refinancing/LME read computed."},
            confidence="Insufficient Information",
            limitation_flags=["CP-1 provided no leverage; LME vulnerability not scored."],
            downstream_consumers=["CP-6A"],
        )

    score, band, drivers = score_vulnerability(leverage, fragility)
    return ModulePayload(
        module_id="CP-3D", module_name="TradingLiquidityAnalysis",
        owned_object="trading_liquidity_analysis",
        runtime_output={
            "lme_vulnerability_score": score, "lme_vulnerability_band": band,
            "drivers": drivers,
            "note": "Maturity-wall timing requires a maturity schedule (not ingested); score reflects structural drivers only.",
        },
        confidence="High", downstream_consumers=["CP-6A"],
        claims=[ClaimSpec(
            claim_id="C-REF1",
            claim_text=(f"LME / refinancing vulnerability {band} ({score}/{_MAX_SCORE})"
                        + (f" — {', '.join(drivers)}." if drivers else ".")),
            evidence=[EvidenceSpec("E-REF1", "upstream_artifact", "Calculated",
                                   "Derived from CP-1 leverage and CP-2B downside fragility", "Medium")],
        )],
    )
