"""CP-3 RelativeValueAnalysis — a peer scorecard and a relative-value lean.

Aggregates CP-1C's per-metric peer percentiles into a composite score and maps it
to a fundamental relative-value recommendation. Deterministic off CP-1C — no
documents, no LLM (the same idiom as [peers.py]). The percentiles already respect
each metric's polarity (CP-1C: higher percentile = stronger), so a high composite
means strong fundamentals versus the peer set.
"""

from __future__ import annotations

from typing import Optional

from engine.periods import is_finite_number
from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload

# Composite-percentile bands for the recommendation.
_OVERWEIGHT, _UNDERWEIGHT = 60, 40


def build_scorecard(cp1c_rt: dict) -> Optional[dict]:
    """Composite peer percentile + relative-value lean from CP-1C comparisons.

    Reads like the credit analyst's relative-value worksheet:

    - CP-1C hands us one peer percentile per metric, already polarity-adjusted so
      that **higher always means stronger versus the peer set** (e.g. lower
      leverage maps to a *higher* percentile). So we never re-sign anything here:
      a metric's percentile is "how this issuer ranks against peers on that line,
      0-100 (100 = best in the cohort)."
    - A metric only counts if it carries a finite numeric percentile — without one
      the issuer can't be ranked against peers, so it is left out of the score (not
      scored as zero).
    - The composite is the *equal-weighted mean* of those per-metric percentiles:
      a single 0-100 read of "how strong is this issuer versus its peers." No
      metric is weighted above another — it is the plain average rank.
    - That composite is mapped to a relative-value lean via the desk's bands:
      >= 60th percentile -> OVERWEIGHT (rich / strong fundamentals vs peers),
      < 40th -> UNDERWEIGHT (weak vs peers), the 40-59 middle -> NEUTRAL.

    Returns None when no comparison can be ranked (nothing to score against peers).
    Output feeds CP-6A / CP-6E.
    """
    comparisons = cp1c_rt.get("comparisons") or []

    # Keep only metrics CP-1C could rank against peers (a FINITE numeric percentile).
    # is_finite_number accepts bool/int/0/float but rejects NaN/inf — a NaN
    # percentile is a float that would slip past a plain isinstance check and then
    # crash round() with "cannot convert float NaN to integer", aborting the run.
    ranked = [c for c in comparisons if is_finite_number(c.get("percentile"))]
    if not ranked:
        return None  # No peer-rankable metric -> no relative-value read.

    # Composite = equal-weighted mean peer percentile, rounded to a whole rank
    # (0-100 strength versus peers; round() is banker's rounding by design).
    composite = round(sum(c["percentile"] for c in ranked) / len(ranked))

    # Map the composite strength to the desk's relative-value lean.
    if composite >= _OVERWEIGHT:        # >= 60th pct: strong vs peers
        recommendation = "OVERWEIGHT"
    elif composite < _UNDERWEIGHT:      # < 40th pct: weak vs peers
        recommendation = "UNDERWEIGHT"
    else:                               # 40-59th pct: in line with peers
        recommendation = "NEUTRAL"

    # Per-metric rows, preserving each percentile's value and type verbatim.
    scorecard = [
        {
            "metric": c.get("metric"),
            "label": c.get("label"),
            "percentile": c["percentile"],
            "issuer_value": c.get("issuer_value"),
            "peer_median": c.get("peer_median"),
        }
        for c in ranked
    ]

    return {
        "scorecard": scorecard,
        "composite_percentile": composite,
        "recommendation": recommendation,
        # Corpus CP-3 (REF-05): "RV conclusions require dated market evidence.
        # If absent, RV = Unclear." No market feed exists (spreads/price are
        # Phase-2), so the lean is fundamentals-only by construction — say so
        # in the payload rather than let the label overclaim a market-relative
        # read (audit 2026-07-10 SPEC-5). CP-3C sizing still consumes the lean.
        "rv_basis": "fundamentals_only",
        "market_evidence": "none (no market data feed — corpus RV = Unclear)",
        "metrics_scored": len(ranked),
        "peer_scope": cp1c_rt.get("peer_scope", "peers"),
    }


async def synthesize_relative_value(cp1c: ModulePayload) -> ModulePayload:
    """Build the CP-3 payload from CP-1C's peer comparisons."""
    sc = build_scorecard(cp1c.runtime_output or {})
    if sc is None:
        return ModulePayload(
            module_id="CP-3", module_name="RelativeValueSecuritySelection",
            owned_object="relative_value_analysis",
            runtime_output={"scorecard": [], "note": "CP-1C produced no peer comparisons to score."},
            confidence="Insufficient Information",
            limitation_flags=["No peer comparisons available for a relative-value read."],
            downstream_consumers=["CP-6A", "CP-6E"],
        )
    return ModulePayload(
        module_id="CP-3", module_name="RelativeValueSecuritySelection",
        owned_object="relative_value_analysis", runtime_output=sc, confidence="High",
        downstream_consumers=["CP-6A", "CP-6E"],
        # Corpus CP-3 prohibits stating RV without dated market evidence; the
        # claim says "fundamentals lean", not "relative value", and the flag
        # carries the market-data gap into the QA/limitations surface (SPEC-5).
        limitation_flags=["No dated market evidence (spreads/price are an external "
                          "Phase-2 feed): the recommendation is a fundamentals-vs-peers "
                          "lean, not a market relative-value read (corpus RV = Unclear)."],
        claims=[ClaimSpec(
            claim_id="C-RV1",
            claim_text=(f"Across {sc['metrics_scored']} peer metrics vs {sc['peer_scope']}, "
                        f"composite {sc['composite_percentile']}th percentile → "
                        f"{sc['recommendation']} fundamentals lean (no market data — "
                        "not a priced relative-value call)."),
            evidence=[EvidenceSpec("E-RV1", "upstream_artifact", "Calculated",
                                   "Derived from CP-1C peer comparisons", "Medium")],
        )],
    )
