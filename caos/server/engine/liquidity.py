"""CP-2E LiquidityMaturityAnalysis — liquidity-sources register.

Deterministic scan over retrieved financial / agreement chunks (the idiom of
[legal.py]) for the liquidity sources an analyst bridges: undrawn revolver, cash
on hand, and any disclosed maturity wall. Where a dollar amount sits next to the
keyword it is captured; otherwise the source is recorded qualitatively. A full
12-month bridge / months-to-empty needs the cash + RCF figures, so a thin scan
degrades to Insufficient rather than inventing a runway. No LLM.
"""

from __future__ import annotations

import re
from typing import List, Optional, Tuple

from engine.periods import is_finite_number, latest
from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload
from engine.textscan import amount_musd, scan

_QUERY = "liquidity revolving credit facility undrawn availability cash and cash equivalents maturity"

# A USE of liquidity (debt coming due), not a source — kept in the sources register
# as a disclosed fact, but excluded from the liquidity sum + runway. (review run-2 #B1)
_MATURITY_WALL = "Maturity wall"

# (label, keyword pattern). A nearby $ amount, if present, is captured.
_SOURCES: Tuple[Tuple[str, str], ...] = (
    ("Undrawn revolving credit facility", r"undrawn|available (?:under|capacity)|revolv"),
    ("Cash and cash equivalents", r"cash and cash equivalents|cash on hand|cash balance"),
    (_MATURITY_WALL, r"matur(?:es|ity|ities)|debt maturit"),
)


def scan_liquidity(chunks: List[Tuple[str, str]]) -> List[dict]:
    """Flag each liquidity source (once), capturing a nearby amount when present."""
    return [{"source": label,
             "amount_musd": amount_musd(text, re.compile(pattern, re.IGNORECASE)),
             "chunk_id": cid}
            for (label, pattern), cid, text in scan(chunks, _SOURCES)]


def _interest_runway_months(
    disclosed_liquidity: Optional[float], cp1: Optional[ModulePayload]
) -> Tuple[Optional[float], Optional[float]]:
    """Months of *cash interest* the disclosed liquidity alone could service.

    The credit question: if operating cash flow went to zero, how long could the
    borrower keep paying interest out of liquidity on hand? This is a
    LIQUIDITY-STRESS LENS (the EBITDA->0 case), NOT a full months-to-empty — a
    true runway would also burn amortisation, capex and maturities, uses the
    engine does not source, so we model only the interest line.

    Inputs (all in $mm, sourced from CP-1's canonical/normalized financials):
      - disclosed_liquidity : undrawn revolver + cash on hand, as quantified upstream.
      - latest(adj_ebitda)  : most recent LTM adjusted EBITDA.
      - interest_coverage_ltm : EBITDA / cash interest (the LTM coverage ratio).

    The math an analyst can re-derive by hand:
      coverage = EBITDA / interest        =>  annual cash interest = EBITDA / coverage
      monthly interest = annual / 12
      runway (months)  = liquidity / monthly = liquidity * 12 / annual cash interest

    Worked check: EBITDA 421, coverage 2.1x  =>  interest = 421/2.1 ~ 200.5;
      liquidity 500  =>  500 * 12 / 200.5 ~ 29.9 months (~2.5 yrs of interest cover).

    Rounding note (load-bearing): annual cash interest is rounded to one decimal
    FIRST, then runway is computed from that rounded figure — we report the same
    interest number we divide by, so the two outputs reconcile. (round() is
    banker's/half-even, matching CP-1 presentation.)

    Degrade-don't-invent: each guard below returns (None, None) so the module
    falls back to "Insufficient" rather than fabricating a runway. Returns
    (annual_cash_interest_musd, runway_months) on success.
    """
    # Guard (a): liquidity was never quantified (or is NaN/inf), or CP-1 is absent.
    if not is_finite_number(disclosed_liquidity) or cp1 is None:
        return None, None

    nf = (cp1.runtime_output or {}).get("normalized_financials") or {}
    ebitda = latest(nf.get("adj_ebitda") or {})  # latest LTM adj. EBITDA ($mm)
    coverage = nf.get("interest_coverage_ltm")   # EBITDA / cash interest (x)

    # Guard (b): missing/NaN/inf EBITDA or coverage, or coverage == 0 (would divide
    # by zero backing out interest — and a 0x coverage carries no interest burden).
    if not (is_finite_number(ebitda) and is_finite_number(coverage) and coverage):
        return None, None

    # Back out implied annual cash interest from coverage, rounded for reporting.
    annual_cash_interest = round(ebitda / coverage, 1)

    # Guard (c): implied interest rounds to 0.0 — no interest line to amortise
    # liquidity against (and it would be the denominator of the runway divide).
    if not annual_cash_interest:
        return None, None

    # Runway = liquidity / monthly interest = liquidity * 12 / annual interest.
    # No output guard by design: zero liquidity -> 0.0 months; negative liquidity
    # or negative coverage flow straight through as signed months/interest.
    return annual_cash_interest, round(disclosed_liquidity * 12 / annual_cash_interest, 1)


async def synthesize_liquidity(retrieve, cp1: Optional[ModulePayload] = None) -> ModulePayload:
    """Build the CP-2E payload by scanning retrieved liquidity disclosures."""
    hits = await retrieve(_QUERY, 6)
    found = scan_liquidity([(h.chunk_id, h.text) for h in hits])

    if not found:
        return ModulePayload(
            module_id="CP-2E", module_name="LiquidityCashFlowBridge",
            owned_object="liquidity_maturity_analysis",
            runtime_output={"sources": [], "note": "No liquidity-source disclosure detected in ingested sources."},
            confidence="Insufficient Information",
            limitation_flags=["No liquidity / maturity disclosure detected in ingested sources."],
            downstream_consumers=["CP-6A"],
        )

    # Sum only true liquidity SOURCES — the maturity wall is a use, not a source, so it
    # must not inflate disclosed liquidity or the interest runway. (review run-2 #B1)
    quantified = [f for f in found
                  if f["source"] != _MATURITY_WALL and isinstance(f["amount_musd"], (int, float))]
    total = round(sum(f["amount_musd"] for f in quantified), 1) if quantified else None
    cash_interest, runway = _interest_runway_months(total, cp1)

    summary = (f"~${total:g}M of disclosed liquidity across {len(quantified)} quantified source(s)"
               if quantified else f"{len(found)} liquidity source(s) disclosed (amounts not parsed)")
    if runway is not None:
        summary += f" — covers ~{runway:g} months of cash interest"
    return ModulePayload(
        module_id="CP-2E", module_name="LiquidityCashFlowBridge",
        owned_object="liquidity_maturity_analysis",
        runtime_output={
            "sources": [{"source": f["source"], "amount_musd": f["amount_musd"], "chunk_id": f["chunk_id"]}
                        for f in found],
            "disclosed_liquidity_musd": total,
            "annual_cash_interest_musd": cash_interest,
            "months_liquidity_covers_interest": runway,
            "register_basis": "keyword scan of ingested financial / agreement chunks",
        },
        confidence="High" if quantified else "Medium", downstream_consumers=["CP-6A"],
        claims=[ClaimSpec(
            claim_id="C-LIQ1",
            claim_text=f"Liquidity sources: {summary}.",
            evidence=[EvidenceSpec(
                f"E-LIQ-{i}", "quoted_text", "Directly Sourced",
                "Liquidity disclosure (ingested chunk)", "High",
                resolved_chunk_id=f["chunk_id"]) for i, f in enumerate(found)],
        )],
    )
