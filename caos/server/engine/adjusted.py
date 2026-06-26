"""Adjusted-EBITDA bridge — the reported-vs-adjusted reconciliation, folded into
CP-1 (the canonical foundation it adjusts).

Since the v2 taxonomy re-sync CP-1A is the BusinessTransactionFactPack
([factpack.py]); this reconciliation is embedded in CP-1's payload
(``runtime_output.adjusted_ebitda_reconciliation`` + the C-ADJ1 claim) and feeds
the materiality-gated CP-5 finding below.

The leverage an issuer markets rests on **add-backs** (synergies, run-rate cost
savings, restructuring, pro-forma) disclosed in the credit agreement / offering
memo. This module reads those documents, quantifies the add-backs, and answers
the question a credit analyst actually asks: *how much do the disclosed add-backs
flatter the marketed leverage?* The arithmetic strips ``pct`` off CP-1's EBITDA
(``E * (1 - pct)``), so it is correct **only when CP-1 carries the adjusted
(marketed) EBITDA** — the fixture / live-LLM basis. The runner therefore gates
this out for a **reported-basis CP-1** (EDGAR XBRL or issuer-disclosed): that
EBITDA already excludes add-backs, so re-stripping them would double-count and
report leverage *worse* than reported — see runner.py CP-1 wiring.

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

import logging
import re
from typing import List, Optional, Sequence, Tuple

from pydantic import BaseModel, Field

from config import get_settings
from engine import budget
from engine.gate import Finding
from engine.llm_safety import UNTRUSTED_RULE, extract_json, safe_chunk_id
from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload, cp1_leverage

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
) -> Optional[Tuple[float, List[str], str, bool]]:
    """Extract the add-back load as a fraction of EBITDA from an issuer's document
    chunks. ``chunks`` is ``(chunk_id, text)``. Returns ``(pct, categories,
    chunk_id, exact)`` for the first chunk that both mentions an add-back and states
    an "N% of EBITDA" load, else None. Deterministic path: the figure is regex-matched
    in that exact chunk, so ``exact`` is always True."""
    for chunk_id, text in chunks:
        low = text.lower()
        if not any(kw in low for kw in _ADDBACK_KW):
            continue
        m = _PCT_OF_EBITDA.search(text)
        if m:
            pct = float(m.group(1)) / 100.0
            if 0 < pct < 1:
                return pct, _categories(text), chunk_id, True
    return None


class _AddbackExtract(BaseModel):
    """Shape of the add-back extraction reply (L-2 typed boundary). The schema
    constrains types only; the domain range (0 < pct < 1) stays in the caller."""

    addback_pct: Optional[float] = None
    categories: List[str] = Field(default_factory=list)
    chunk_id: Optional[str] = None


async def _llm_addbacks(retrieve) -> Optional[Tuple[float, List[str], str, bool]]:
    """Claude reads the credit-agreement/OM chunks and returns the add-back load
    as a fraction of EBITDA + categories. Defensive: any failure → None (the
    caller falls back to the deterministic path)."""
    system = (
        "You read leveraged-finance credit documents and quantify EBITDA add-backs. "
        "From the SOURCE CHUNKS, return ONLY a JSON object: {\"addback_pct\": number "
        "(add-backs as a FRACTION of adjusted EBITDA, e.g. 0.18), \"categories\": "
        "[strings], \"chunk_id\": the id of the chunk you used}. If the documents do "
        "not disclose an add-back load, return {\"addback_pct\": null}. Never invent a figure.\n\n"
        + UNTRUSTED_RULE
    )
    res = await extract_json(retrieve, query=_RETRIEVE_QUERY, k=6, system=system, schema=_AddbackExtract)
    if res is None:
        return None
    data, hits = res  # `data` is a validated _AddbackExtract (types already checked)
    pct = data.addback_pct
    if pct is None or not (0 < pct < 1):  # domain range — the schema only checks shape
        return None
    chunk_id, exact = safe_chunk_id(data.chunk_id, hits)  # reject fabricated/absent ids
    return float(pct), list(data.categories), chunk_id, exact


async def extract_addbacks(retrieve) -> Optional[Tuple[float, List[str], str, bool]]:
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


async def reconcile_adjusted_ebitda(
    cp1: ModulePayload, retrieve
) -> Optional[Tuple[dict, ClaimSpec]]:
    """Reconcile CP-1's reported leverage against what it would be excluding the
    disclosed add-backs. Returns ``(reconciliation_dict, claim)`` for CP-1 to embed
    in its own payload (``runtime_output.adjusted_ebitda_reconciliation`` + claims),
    or None when there is no add-back disclosure or no CP-1 leverage/net debt to
    reconstruct EBITDA. ``retrieve(query, k)`` is the runner's issuer-scoped BM25.

    Folded into CP-1 (the canonical foundation) per the v2 taxonomy re-sync: CP-1A
    is now the BusinessTransactionFactPack ([factpack.py]); the reported-vs-adjusted
    bridge belongs with the reported basis it adjusts."""
    lev, nd = cp1_leverage(cp1)
    res = await extract_addbacks(retrieve)
    if res is None or lev is None or nd is None:
        return None

    pct, categories, chunk_id, exact = res
    ebitda = nd / lev                       # the EBITDA behind CP-1's leverage
    ebitda_excl = ebitda * (1 - pct)        # excluding the disclosed add-backs
    lev_excl = round(nd / ebitda_excl, 2)
    gap = round(lev_excl - lev, 2)

    recon = {
        "addback_pct": round(pct, 4),
        "addback_categories": categories,
        "leverage_current": round(lev, 2),
        "ebitda_excl_addbacks": round(ebitda_excl, 1),
        "leverage_excl_addbacks": lev_excl,
        "leverage_gap_turns": gap,
        "basis": "credit_agreement_disclosure",
    }
    claim = ClaimSpec(
        claim_id="C-ADJ1",
        claim_text=(
            f"Disclosed EBITDA add-backs are approximately {pct * 100:g}% of EBITDA; excluding "
            f"them, net leverage would be about {lev_excl:g}x versus {lev:g}x reported — a "
            f"{gap:g}-turn quality-of-EBITDA gap."
        ),
        evidence=[EvidenceSpec(
            evidence_id="E-ADJ1", extraction_type="documentary_fact",
            # Only a model-pinned, actually-retrieved chunk earns "Directly Sourced / High";
            # a substituted/absent id is downgraded so it never overstates provenance.
            lineage_class="Directly Sourced" if exact else "Inferred",
            source_locator="Add-back disclosure (ingested credit agreement / OM chunk)",
            confidence="High" if exact else "Medium", resolved_chunk_id=chunk_id,
        )],
    )
    return recon, claim


def reconciliation_finding(cp1: Optional[ModulePayload]) -> Optional[Finding]:
    """A CP-5 finding when the reported-vs-adjusted gap is material, else None.

    Reads the reconciliation CP-1 now embeds (``runtime_output
    .adjusted_ebitda_reconciliation``). MINOR by design — aggressive add-backs are a
    risk to scrutinise, not a defect that should block committee export."""
    if cp1 is None:
        return None
    ro = (cp1.runtime_output or {}).get("adjusted_ebitda_reconciliation") or {}
    pct, gap = ro.get("addback_pct"), ro.get("leverage_gap_turns")
    if pct is None or gap is None:
        return None
    if pct < _MATERIAL_PCT and abs(gap) < _MATERIAL_GAP_TURNS:
        return None  # immaterial — no noise
    return Finding(
        finding_id="CP-1A-RECON", severity="MINOR", lane=2, module_id="CP-1",
        affected_claim_id="C-ADJ1",
        description=(
            f"Add-backs are {pct * 100:.1f}% of EBITDA; excluding them net leverage would be "
            f"~{ro.get('leverage_excl_addbacks')}x (+{gap} turns vs {ro.get('leverage_current')}x "
            "reported). Assess add-back permanence and the covenant-defined EBITDA basis before "
            "relying on the adjusted leverage."
        ),
        required_remediation="Review the add-back composition/permanence; confirm covenant EBITDA basis.",
    )
