"""CP-3 RelativeValueAnalysis — a peer scorecard and a relative-value lean.

Aggregates CP-1C's per-metric peer percentiles into a composite score and maps it
to a fundamental relative-value recommendation. Deterministic off CP-1C — no
documents, no LLM (the same idiom as [peers.py]). The percentiles already respect
each metric's polarity (CP-1C: higher percentile = stronger), so a high composite
means strong fundamentals versus the peer set.
"""

from __future__ import annotations

from typing import Optional

from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload

# Composite-percentile bands for the recommendation.
_OVERWEIGHT, _UNDERWEIGHT = 60, 40


def build_scorecard(cp1c_rt: dict) -> Optional[dict]:
    """Composite percentile + recommendation from CP-1C comparisons, or None when
    there are no scored peer metrics."""
    comps = cp1c_rt.get("comparisons") or []
    scored = [c for c in comps if isinstance(c.get("percentile"), (int, float))]
    if not scored:
        return None
    composite = round(sum(c["percentile"] for c in scored) / len(scored))
    rec = ("OVERWEIGHT" if composite >= _OVERWEIGHT
           else "UNDERWEIGHT" if composite < _UNDERWEIGHT else "NEUTRAL")
    scorecard = [{
        "metric": c.get("metric"), "label": c.get("label"), "percentile": c["percentile"],
        "issuer_value": c.get("issuer_value"), "peer_median": c.get("peer_median"),
    } for c in scored]
    return {
        "scorecard": scorecard, "composite_percentile": composite,
        "recommendation": rec, "metrics_scored": len(scored),
        "peer_scope": cp1c_rt.get("peer_scope", "peers"),
    }


async def synthesize_relative_value(cp1c: ModulePayload) -> ModulePayload:
    """Build the CP-3 payload from CP-1C's peer comparisons."""
    sc = build_scorecard(cp1c.runtime_output or {})
    if sc is None:
        return ModulePayload(
            module_id="CP-3", module_name="RelativeValueAnalysis",
            owned_object="relative_value_analysis",
            runtime_output={"scorecard": [], "note": "CP-1C produced no peer comparisons to score."},
            confidence="Insufficient Information",
            limitation_flags=["No peer comparisons available for a relative-value read."],
            downstream_consumers=["CP-6A", "CP-6E"],
        )
    return ModulePayload(
        module_id="CP-3", module_name="RelativeValueAnalysis",
        owned_object="relative_value_analysis", runtime_output=sc, confidence="High",
        downstream_consumers=["CP-6A", "CP-6E"],
        claims=[ClaimSpec(
            claim_id="C-RV1",
            claim_text=(f"Across {sc['metrics_scored']} peer metrics vs {sc['peer_scope']}, "
                        f"composite {sc['composite_percentile']}th percentile → "
                        f"{sc['recommendation']} relative value."),
            evidence=[EvidenceSpec("E-RV1", "upstream_artifact", "Calculated",
                                   "Derived from CP-1C peer comparisons", "Medium")],
        )],
    )
