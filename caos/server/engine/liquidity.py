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

from engine.periods import latest
from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload
from engine.textscan import amount_musd, scan

_QUERY = "liquidity revolving credit facility undrawn availability cash and cash equivalents maturity"

# (label, keyword pattern). A nearby $ amount, if present, is captured.
_SOURCES: Tuple[Tuple[str, str], ...] = (
    ("Undrawn revolving credit facility", r"undrawn|available (?:under|capacity)|revolv"),
    ("Cash and cash equivalents", r"cash and cash equivalents|cash on hand|cash balance"),
    ("Maturity wall", r"matur(?:es|ity|ities)|debt maturit"),
)


def scan_liquidity(chunks: List[Tuple[str, str]]) -> List[dict]:
    """Flag each liquidity source (once), capturing a nearby amount when present."""
    return [{"source": label,
             "amount_musd": amount_musd(text, re.compile(pattern, re.IGNORECASE)),
             "chunk_id": cid}
            for (label, pattern), cid, text in scan(chunks, _SOURCES)]


def _interest_runway_months(disclosed_liquidity: Optional[float], cp1: Optional[ModulePayload]):
    """Months the disclosed liquidity alone would service cash interest, from CP-1's
    canonical financials. A liquidity-stress lens (EBITDA→0), NOT a full
    months-to-empty — that needs amort/capex/maturity uses we don't source. Returns
    (annual_cash_interest_musd, months) or (None, None) when inputs are absent."""
    if not isinstance(disclosed_liquidity, (int, float)) or cp1 is None:
        return None, None
    nf = (cp1.runtime_output or {}).get("normalized_financials") or {}
    eb, cov = latest(nf.get("adj_ebitda") or {}), nf.get("interest_coverage_ltm")
    if not (isinstance(eb, (int, float)) and isinstance(cov, (int, float)) and cov):
        return None, None
    cash_interest = round(eb / cov, 1)
    if not cash_interest:
        return None, None
    return cash_interest, round(disclosed_liquidity * 12 / cash_interest, 1)


async def synthesize_liquidity(retrieve, cp1: Optional[ModulePayload] = None) -> ModulePayload:
    """Build the CP-2E payload by scanning retrieved liquidity disclosures."""
    hits = await retrieve(_QUERY, 6)
    found = scan_liquidity([(h.chunk_id, h.text) for h in hits])

    if not found:
        return ModulePayload(
            module_id="CP-2E", module_name="LiquidityMaturityAnalysis",
            owned_object="liquidity_maturity_analysis",
            runtime_output={"sources": [], "note": "No liquidity-source disclosure detected in ingested sources."},
            confidence="Insufficient Information",
            limitation_flags=["No liquidity / maturity disclosure detected in ingested sources."],
            downstream_consumers=["CP-6A"],
        )

    quantified = [f for f in found if isinstance(f["amount_musd"], (int, float))]
    total = round(sum(f["amount_musd"] for f in quantified), 1) if quantified else None
    cash_interest, runway = _interest_runway_months(total, cp1)

    summary = (f"~${total:g}M of disclosed liquidity across {len(quantified)} quantified source(s)"
               if quantified else f"{len(found)} liquidity source(s) disclosed (amounts not parsed)")
    if runway is not None:
        summary += f" — covers ~{runway:g} months of cash interest"
    return ModulePayload(
        module_id="CP-2E", module_name="LiquidityMaturityAnalysis",
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
