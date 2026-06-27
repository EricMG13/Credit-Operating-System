"""CP-3D RefinancingLMERisk — refinancing / LME vulnerability score.

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
    # CP-3D RefinancingLMERisk rubric. Two structural drivers of exposure to
    # coercive liability management (uptier / drop-down) and hard refinancing:
    #   1. CP-1 leverage     — thinner equity cushion => creditor-on-creditor leverage
    #   2. CP-2B fragility   — weaker downside => higher odds of a coercive exchange
    # Maturity wall is NOT scored here (needs a maturity schedule, not in CP-1).
    score = 0
    drivers: List[str] = []

    # Driver 1 — CP-1 leverage. Exclusive bands: 6.0x is "high" (+4) only, never
    # double-counted into "elevated". {leverage:g} prints 6.0->"6", 5.68->"5.68".
    if isinstance(leverage, (int, float)):
        if leverage >= 6.0:
            # >= 6.0x  => HIGH LME exposure (minimal cushion to defend)  -> +4 pts
            score += 4
            drivers.append(f"high leverage {leverage:g}x")
        elif leverage >= 5.0:
            # >= 5.0x  => ELEVATED LME exposure (cushion thinning)        -> +2 pts
            score += 2
            drivers.append(f"elevated leverage {leverage:g}x")

    # Driver 2 — CP-2B downside fragility. Exact, case-sensitive labels.
    if fragility == "HIGH":
        # HIGH downside fragility (most likely to be coerced)            -> +4 pts
        score += 4
        drivers.append("high downside fragility")
    elif fragility == "MODERATE":
        # MODERATE downside fragility                                    -> +2 pts
        score += 2
        drivers.append("moderate downside fragility")

    # Cap at the rubric ceiling. Drivers top out at 4+4=8, so _MAX_SCORE (10)
    # never binds today — kept as the contractual ceiling for future drivers.
    score = min(_MAX_SCORE, score)

    # Vulnerability band off the 0-10 score:
    #   >= 6  => HIGH      (both drivers firing, or one strong + one moderate)
    #   >= 3  => MODERATE  (one strong driver, or two moderate signals)
    #   else  => LOW
    band = "HIGH" if score >= 6 else "MODERATE" if score >= 3 else "LOW"
    return score, band, drivers


async def synthesize_refinancing(cp1: ModulePayload, cp2b: Optional[ModulePayload]) -> ModulePayload:
    """Build the CP-3D payload from CP-1 leverage + CP-2B fragility."""
    leverage = (cp1.runtime_output or {}).get("normalized_financials", {}).get("net_leverage_adj_ltm")
    fragility = (cp2b.runtime_output or {}).get("fragility") if cp2b is not None else None

    if not isinstance(leverage, (int, float)):
        return ModulePayload(
            module_id="CP-3D", module_name="RefinancingLMERisk",
            owned_object="refinancing_lme_risk",
            runtime_output={"note": "CP-1 provided no leverage; no refinancing/LME read computed."},
            confidence="Insufficient Information",
            limitation_flags=["CP-1 provided no leverage; LME vulnerability not scored."],
            downstream_consumers=["CP-6A"],
        )

    score, band, drivers = score_vulnerability(leverage, fragility)
    return ModulePayload(
        module_id="CP-3D", module_name="RefinancingLMERisk",
        owned_object="refinancing_lme_risk",
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
