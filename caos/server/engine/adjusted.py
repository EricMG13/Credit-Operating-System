"""CP-1A AdjustedEBITDABridge — the covenant-adjusted counterpart to CP-1's
reported foundation, and the reported-vs-adjusted reconciliation.

CP-1 (EDGAR) gives leverage on a **reported GAAP basis**. The leverage an
issuer markets rests on **add-backs** (synergies, run-rate cost savings,
restructuring, pro-forma) disclosed in the credit agreement / offering memo.
This module reads those documents, quantifies the add-backs, and answers the
question a credit analyst actually asks: *how much do the disclosed add-backs
flatter the leverage?*

It emits ``leverage_excl_addbacks`` and the gap in turns, and — when the gap is
material — a CP-5 finding so committee sees the quality-of-EBITDA risk. The
finding is **informational (MINOR)**: a high add-back load is a risk signal to
scrutinise, not a data defect that should block export.

Two extractors behind one interface, mirroring [synth.py] / [coststructure.py]:

  - deterministic ``derive_addbacks`` — regex over retrieved chunks for the
    disclosed "N% of adjusted EBITDA"; fully offline, the tested default.
  - ``_llm_addbacks`` — Claude reads the credit-agreement chunks and returns the
    add-back percentage + categories; used only when a key is configured, with
    the deterministic path as the fallback.
"""

from __future__ import annotations

import json
import logging
import re
from typing import List, Optional, Sequence, Tuple

from config import get_settings
from engine import budget
from engine.gate import Finding
from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload

logger = logging.getLogger("caos.engine")

# Materiality thresholds — below these the add-backs don't move the credit view,
# so no finding is raised (avoids noise on routine, lightly-adjusted credits).
_MATERIAL_PCT = 0.10        # add-backs ≥ 10% of EBITDA
_MATERIAL_GAP_TURNS = 0.5   # or the gap is ≥ 0.5x of leverage

# "N percent of (adjusted) EBITDA" — the actual add-back load, not a covenant cap
# ("25 percent over a trailing 24 month period" has no "of EBITDA" and won't match).
_PCT_OF_EBITDA = re.compile(
    r"(\d+(?:\.\d+)?)\s*(?:percent|%)\s+of\s+(?:its\s+|the\s+|consolidated\s+)*(?:adjusted\s+)?ebitda",
    re.IGNORECASE,
)
_ADDBACK_KW = ("add-back", "add back", "addback")
_CATEGORY_KW = {
    "synergies": ("synerg",),
    "cost savings": ("cost saving", "cost-saving"),
    "run-rate": ("run-rate", "run rate"),
    "restructuring": ("restructuring",),
    "transaction / non-recurring": ("transaction", "non-recurring", "nonrecurring", "one-time", "one time"),
    "stock-based comp": ("stock-based", "stock based", "share-based"),
    "pro forma": ("pro forma", "pro-forma"),
}

_RETRIEVE_QUERY = "adjusted EBITDA add-backs add back synergies cost savings run-rate pro forma"


def _categories(text: str) -> List[str]:
    low = text.lower()
    return [label for label, kws in _CATEGORY_KW.items() if any(k in low for k in kws)]


def derive_addbacks(
    chunks: Sequence[Tuple[str, str]]
) -> Optional[Tuple[float, List[str], str]]:
    """Extract the add-back load as a fraction of EBITDA from an issuer's document
    chunks. ``chunks`` is ``(chunk_id, text)``. Returns ``(pct, categories,
    chunk_id)`` for the first chunk that both mentions an add-back and states an
    "N% of EBITDA" load, else None. Deterministic and offline."""
    for chunk_id, text in chunks:
        low = text.lower()
        if not any(kw in low for kw in _ADDBACK_KW):
            continue
        m = _PCT_OF_EBITDA.search(text)
        if m:
            pct = float(m.group(1)) / 100.0
            if 0 < pct < 1:
                return pct, _categories(text), chunk_id
    return None


async def _llm_addbacks(retrieve) -> Optional[Tuple[float, List[str], str]]:
    """Claude reads the credit-agreement/OM chunks and returns the add-back load
    as a fraction of EBITDA + categories. Defensive: any failure → None (the
    caller falls back to the deterministic path)."""
    import anthropic

    settings = get_settings()
    hits = await retrieve(_RETRIEVE_QUERY, 6)
    if not hits:
        return None
    grounding = "\n\n".join(f"[chunk {h.chunk_id}]\n{h.text}" for h in hits)
    system = (
        "You read leveraged-finance credit documents and quantify EBITDA add-backs. "
        "From the SOURCE CHUNKS, return ONLY a JSON object: {\"addback_pct\": number "
        "(add-backs as a FRACTION of adjusted EBITDA, e.g. 0.18), \"categories\": "
        "[strings], \"chunk_id\": the id of the chunk you used}. If the documents do "
        "not disclose an add-back load, return {\"addback_pct\": null}. Never invent a figure."
    )
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    resp = await client.messages.create(
        model=settings.anthropic_model, max_tokens=400,
        system=system, messages=[{"role": "user", "content": f"SOURCE CHUNKS:\n{grounding}"}],
    )
    budget.record_usage(resp)
    text = next((b.text for b in resp.content if b.type == "text"), "")
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return None
    data = json.loads(match.group(0))
    pct = data.get("addback_pct")
    if not isinstance(pct, (int, float)) or not (0 < float(pct) < 1):
        return None
    chunk_id = str(data.get("chunk_id") or (hits[0].chunk_id if hits else ""))
    cats = [str(c) for c in (data.get("categories") or []) if isinstance(c, str)]
    return float(pct), cats, chunk_id


async def extract_addbacks(retrieve) -> Optional[Tuple[float, List[str], str]]:
    """Add-back load via the LLM when a key is set and budget remains (else the
    deterministic regex fallback)."""
    if get_settings().anthropic_api_key and budget.llm_allowed():
        try:
            res = await _llm_addbacks(retrieve)
            if res is not None:
                return res
        except Exception as e:  # noqa: BLE001 — network/parse → deterministic path
            logger.warning("LLM add-back extraction failed, using regex: %s", e)
    hits = await retrieve(_RETRIEVE_QUERY, 6)
    return derive_addbacks([(h.chunk_id, h.text) for h in hits])


def _cp1_leverage(cp1: ModulePayload) -> Tuple[Optional[float], Optional[float]]:
    """(current net leverage, net debt) from a CP-1 payload, or (None, None)."""
    nf = (cp1.runtime_output or {}).get("normalized_financials") or {}
    lev = nf.get("net_leverage_adj_ltm")
    nd = nf.get("net_debt_ltm")
    if isinstance(lev, (int, float)) and lev and isinstance(nd, (int, float)) and nd:
        return float(lev), float(nd)
    return None, None


async def synthesize_adjusted(cp1: ModulePayload, retrieve) -> ModulePayload:
    """Build the CP-1A payload: reconcile CP-1's leverage against what it would be
    excluding the disclosed add-backs. ``retrieve(query, k)`` is the runner's
    issuer-scoped BM25."""
    lev, nd = _cp1_leverage(cp1)
    res = await extract_addbacks(retrieve)

    if res is None or lev is None:
        # Ran cleanly but no add-back disclosure (or no CP-1 leverage to compare):
        # no metric, no claim (so no orphan finding), just a logged limitation.
        reason = ("No EBITDA add-back disclosure found in ingested sources."
                  if res is None else "CP-1 did not provide a reported net leverage to reconcile.")
        return ModulePayload(
            module_id="CP-1A", module_name="AdjustedEBITDABridge",
            owned_object="adjusted_ebitda_reconciliation",
            runtime_output={"addback_pct": None, "note": reason},
            confidence="Insufficient Information", limitation_flags=[reason],
            downstream_consumers=["CP-2", "CP-3", "CP-4C", "CP-RENDER"],
        )

    pct, categories, chunk_id = res
    ebitda = nd / lev                       # the EBITDA behind CP-1's leverage
    ebitda_excl = ebitda * (1 - pct)        # excluding the disclosed add-backs
    lev_excl = round(nd / ebitda_excl, 2)
    gap = round(lev_excl - lev, 2)

    return ModulePayload(
        module_id="CP-1A", module_name="AdjustedEBITDABridge",
        owned_object="adjusted_ebitda_reconciliation",
        runtime_output={
            "addback_pct": round(pct, 4),
            "addback_categories": categories,
            "leverage_current": round(lev, 2),
            "ebitda_excl_addbacks": round(ebitda_excl, 1),
            "leverage_excl_addbacks": lev_excl,
            "leverage_gap_turns": gap,
            "basis": "credit_agreement_disclosure",
        },
        confidence="High",
        downstream_consumers=["CP-2", "CP-3", "CP-4C", "CP-RENDER"],
        claims=[ClaimSpec(
            claim_id="C-ADJ1",
            claim_text=(
                f"Disclosed EBITDA add-backs are approximately {pct * 100:g}% of EBITDA; excluding "
                f"them, net leverage would be about {lev_excl:g}x versus {lev:g}x reported — a "
                f"{gap:g}-turn quality-of-EBITDA gap."
            ),
            evidence=[EvidenceSpec(
                evidence_id="E-ADJ1", extraction_type="documentary_fact",
                lineage_class="Directly Sourced",
                source_locator="Add-back disclosure (ingested credit agreement / OM chunk)",
                confidence="High", resolved_chunk_id=chunk_id,
            )],
        )],
    )


def reconciliation_finding(cp1a: Optional[ModulePayload]) -> Optional[Finding]:
    """A CP-5 finding when the reported-vs-adjusted gap is material, else None.

    MINOR by design — aggressive add-backs are a risk to scrutinise, not a defect
    that should block committee export."""
    if cp1a is None:
        return None
    ro = cp1a.runtime_output or {}
    pct, gap = ro.get("addback_pct"), ro.get("leverage_gap_turns")
    if pct is None or gap is None:
        return None
    if pct < _MATERIAL_PCT and abs(gap) < _MATERIAL_GAP_TURNS:
        return None  # immaterial — no noise
    return Finding(
        finding_id="CP-1A-RECON", severity="MINOR", lane=2, module_id="CP-1A",
        affected_claim_id="C-ADJ1",
        description=(
            f"Add-backs are {pct * 100:.1f}% of EBITDA; excluding them net leverage would be "
            f"~{ro.get('leverage_excl_addbacks')}x (+{gap} turns vs {ro.get('leverage_current')}x "
            "reported). Assess add-back permanence and the covenant-defined EBITDA basis before "
            "relying on the adjusted leverage."
        ),
        required_remediation="Review the add-back composition/permanence; confirm covenant EBITDA basis.",
    )
