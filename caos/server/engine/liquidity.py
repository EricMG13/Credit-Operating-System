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

from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload
from engine.textscan import scan

_QUERY = "liquidity revolving credit facility undrawn availability cash and cash equivalents maturity"

# (label, keyword pattern). A nearby $ amount, if present, is captured.
_SOURCES: Tuple[Tuple[str, str], ...] = (
    ("Undrawn revolving credit facility", r"undrawn|available (?:under|capacity)|revolv"),
    ("Cash and cash equivalents", r"cash and cash equivalents|cash on hand|cash balance"),
    ("Maturity wall", r"matur(?:es|ity|ities)|debt maturit"),
)

# "$1,234.5 million / billion / m / bn" → normalised to $M.
_AMOUNT = re.compile(r"\$?\s?([\d,]+(?:\.\d+)?)\s*(billion|bn|million|m)\b", re.IGNORECASE)


def _amount_musd(text: str, keyword: re.Pattern) -> Optional[float]:
    """First dollar amount within ~120 chars of a keyword hit, normalised to $M."""
    m = keyword.search(text)
    if not m:
        return None
    window = text[max(0, m.start() - 120): m.end() + 120]
    a = _AMOUNT.search(window)
    if not a:
        return None
    val = float(a.group(1).replace(",", ""))
    return round(val * 1000, 1) if a.group(2).lower() in ("billion", "bn") else round(val, 1)


def scan_liquidity(chunks: List[Tuple[str, str]]) -> List[dict]:
    """Flag each liquidity source (once), capturing a nearby amount when present."""
    return [{"source": label,
             "amount_musd": _amount_musd(text, re.compile(pattern, re.IGNORECASE)),
             "chunk_id": cid}
            for (label, pattern), cid, text in scan(chunks, _SOURCES)]


async def synthesize_liquidity(retrieve) -> ModulePayload:
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

    total = round(sum(f["amount_musd"] for f in found if isinstance(f["amount_musd"], (int, float))), 1)
    quantified = [f for f in found if isinstance(f["amount_musd"], (int, float))]
    summary = (f"~${total:g}M of disclosed liquidity across {len(quantified)} quantified source(s)"
               if quantified else f"{len(found)} liquidity source(s) disclosed (amounts not parsed)")
    return ModulePayload(
        module_id="CP-2E", module_name="LiquidityMaturityAnalysis",
        owned_object="liquidity_maturity_analysis",
        runtime_output={
            "sources": [{"source": f["source"], "amount_musd": f["amount_musd"], "chunk_id": f["chunk_id"]}
                        for f in found],
            "disclosed_liquidity_musd": total if quantified else None,
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
