"""CP-3C PortfolioFitAnalysis — sleeve fit and a sizing posture.

Deterministic off CP-3's relative-value recommendation and CP-1's leverage: maps
the issuer to a portfolio sleeve and a suggested sizing bucket, and raises risk-
budget flags. Concentration / correlation checks need a live portfolio feed (not
ingested), so those are flagged, not invented. No documents, no LLM.
"""

from __future__ import annotations

from typing import Optional

from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload

_FIT = {
    "OVERWEIGHT": ("core", "full target size"),
    "NEUTRAL": ("satellite", "half target size"),
    "UNDERWEIGHT": ("tactical only", "minimal / pass"),
}


def assess_fit(cp3_rt: dict, leverage: Optional[float]) -> Optional[dict]:
    rec = cp3_rt.get("recommendation")
    if rec not in _FIT:
        return None
    sleeve, sizing = _FIT[rec]
    flags = []
    if isinstance(leverage, (int, float)) and leverage >= 6.0:
        flags.append(f"High leverage ({leverage:g}x) — counts against the risk budget.")
    return {
        "sleeve_fit": sleeve, "suggested_sizing": sizing,
        "rv_recommendation": rec, "composite_percentile": cp3_rt.get("composite_percentile"),
        "risk_flags": flags,
        "note": "Concentration/correlation checks require a portfolio feed (not ingested).",
    }


async def synthesize_portfolio_fit(cp3: ModulePayload, cp1: Optional[ModulePayload]) -> ModulePayload:
    """Build the CP-3C payload from CP-3's recommendation + CP-1 leverage."""
    leverage = (((cp1.runtime_output or {}).get("normalized_financials") or {}).get("net_leverage_adj_ltm")
                if cp1 is not None else None)
    fit = assess_fit(cp3.runtime_output or {}, leverage)
    if fit is None:
        return ModulePayload(
            module_id="CP-3C", module_name="PortfolioFitAnalysis",
            owned_object="portfolio_fit_analysis",
            runtime_output={"note": "CP-3 produced no relative-value recommendation to size."},
            confidence="Insufficient Information",
            limitation_flags=["No relative-value recommendation available for a portfolio-fit read."],
            downstream_consumers=["CP-6E"],
        )
    return ModulePayload(
        module_id="CP-3C", module_name="PortfolioFitAnalysis",
        owned_object="portfolio_fit_analysis", runtime_output=fit, confidence="High",
        downstream_consumers=["CP-6E"],
        claims=[ClaimSpec(
            claim_id="C-FIT1",
            claim_text=(f"Fits the {fit['sleeve_fit']} sleeve at {fit['suggested_sizing']} "
                        f"({fit['rv_recommendation']} relative value)."),
            evidence=[EvidenceSpec("E-FIT1", "upstream_artifact", "Calculated",
                                   "Derived from CP-3 recommendation and CP-1 leverage", "Medium")],
        )],
    )
