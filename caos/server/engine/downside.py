"""CP-2B DownsidePathwayAnalysis — stress the leverage and coverage.

Pure computation off CP-1's leverage / coverage: applies EBITDA-decline shocks,
recomputes net leverage and interest coverage at each, and reports the shock at
which leverage crosses a distress threshold — the "fragility" read a downside
analyst wants. Deterministic, runs for any issuer CP-1 gave a leverage figure;
no documents, no LLM (the same idiom as [earnings.py]).
"""

from __future__ import annotations

from typing import Optional

from engine.periods import is_finite_number
from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload

# EBITDA-decline scenarios, and the net leverage at/above which the credit is
# treated as distressed (a conventional leveraged-loan distress marker).
_SHOCKS = (0.10, 0.20, 0.30)
_BREACH_X = 7.0


def compute_pathways(nf: dict) -> Optional[dict]:
    """Stressed leverage/coverage under EBITDA-decline shocks, or None if no leverage.

    Credit model (held-flat-debt sensitivity, NOT a cash-sweep path)
    ----------------------------------------------------------------
    Net debt is held FLAT while EBITDA is shocked down by ``s`` (10/20/30%).
    Because net leverage = net debt / EBITDA, holding the numerator fixed and
    cutting the denominator by ``(1 - s)`` scales leverage UP by ``1/(1 - s)``:

        stressed_net_leverage = current_leverage / (1 - s)

    This is the standard FIRST-ORDER downside sensitivity — it deliberately
    ignores cash sweeps, amortization, and debt paydown, so it reads as the
    immediate leverage shock, not a forward-modelled trajectory. By the same
    logic, interest coverage = EBITDA / interest scales DOWN by ``(1 - s)``:

        stressed_interest_coverage = current_coverage * (1 - s)

    Breach threshold (the distress marker)
    --------------------------------------
    ``_BREACH_X`` = 7.0x net leverage is the conventional leveraged-loan
    distress marker — the level at/above which the credit is treated as
    distressed. ``shock_to_breach_pct`` is the SMALLEST EBITDA decline (10/20/30)
    whose stressed leverage first reaches 7.0x (inclusive); None if even a 30%
    decline keeps leverage under 7.0x.

    Fragility ladder (how little EBITDA loss tips into distress)
    -----------------------------------------------------------
    Reads off how soon a moderate EBITDA decline pushes the credit to >=7.0x:
        HIGH     — already distressed (lev >= 7.0x) OR breaches by a 10% shock
        MODERATE — breaches by a 20% shock (but not 10%)
        LOW      — survives a 30% shock without breaching
    (``lev >= 7.0`` is logically redundant with breach-by-10% — a credit already
    at/above 7.0x trivially clears 7.0x at the first 10% shock — but both are
    kept to state the "already distressed" intent explicitly.)

    Input guards: a leverage that is non-numeric OR non-finite (NaN/inf) returns
    None — a NaN would pass ``isinstance`` and every ``>= 7.0`` test (NaN
    comparisons are False), leaking NaN into the output and silently reading LOW
    fragility for an issuer whose leverage is unknown (which feeds CP-3D).
    Coverage gets the same finite check, yielding per-scenario None.
    """
    lev = nf.get("net_leverage_adj_ltm")
    if not is_finite_number(lev):
        return None  # CP-1 gave no usable (finite) leverage figure — nothing to stress.
    cov = nf.get("interest_coverage_ltm")

    scenarios = []
    shock_to_breach: Optional[int] = None
    for s in _SHOCKS:
        # EBITDA down by s, net debt flat -> leverage UP (divide by 1 - s),
        # coverage DOWN (multiply by 1 - s).
        sl = round(lev / (1 - s), 2)
        # Inline the finite check (not a stored bool) so the TypeGuard narrows cov to
        # float here — a non-finite coverage yields a per-scenario None, never a NaN.
        sc = round(cov * (1 - s), 2) if is_finite_number(cov) else None
        scenarios.append({
            "ebitda_shock_pct": round(s * 100),  # 0.10 -> 10, 0.20 -> 20, 0.30 -> 30
            "stressed_net_leverage": sl,
            "stressed_interest_coverage": sc,
        })
        # First shock whose stressed leverage reaches the 7.0x distress marker.
        if shock_to_breach is None and sl >= _BREACH_X:
            shock_to_breach = round(s * 100)

    # Fragility ladder: already-distressed or breaches by 10% -> HIGH; by 20% ->
    # MODERATE; survives a 30% shock -> LOW.
    if lev >= _BREACH_X or (shock_to_breach is not None and shock_to_breach <= 10):
        fragility = "HIGH"
    elif shock_to_breach is not None and shock_to_breach <= 20:
        fragility = "MODERATE"
    else:
        fragility = "LOW"

    return {
        "current_net_leverage": round(float(lev), 2),
        "breach_threshold_x": _BREACH_X,  # 7.0x leveraged-loan distress marker
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
        # The shock holds net debt fixed (stressed leverage = current/(1-shock)) —
        # a first-order sensitivity, not a cash-sweep/amortizing path. Disclose it
        # so committee reads the fragility correctly. (#35)
        limitation_flags=["Net debt held flat under the EBITDA shock — first-order "
                          "sensitivity, not a cash-sweep / amortizing path."],
        claims=[ClaimSpec(
            claim_id="C-DOWN1",
            claim_text=(f"Downside fragility {p['fragility']}: {breach_txt} "
                        f"(from {p['current_net_leverage']:g}x today; net debt held flat)."),
            evidence=[EvidenceSpec("E-DOWN1", "upstream_artifact", "Calculated",
                                   "Derived from CP-1 leverage/coverage under EBITDA stress", "High")],
        )],
    )
