"""CP-4C CovenantCapacityCalculator — covenant capacity, headroom, and the
cov-lite read, computed from the issuer's governing documents + CP-1.

The daily leveraged-finance job: *how much room is there before something
breaks?* This module reads the credit agreement / indenture (vaulted via the
EDGAR lane or uploaded), extracts the covenant terms, and computes source-traced
capacity calculations against CP-1's leverage:

  - **Pro-forma leverage after day-one incremental** — drawing the stated
    incremental/incurrence capacity, what does net leverage become.
  - **Maintenance leverage-covenant headroom** — turns of cushion and the % EBITDA
    decline to a breach, when a financial maintenance covenant exists.
  - **Cov-lite detection** — when no maintenance covenant is found (the norm for
    modern TLBs): a real early-warning gap, surfaced as an informational finding.

Every calculation carries formula · numerator · denominator · period · source
trace (CP-5/CP-5B requirement). Deterministic-first (regex over retrieved
chunks), with an LLM seam for real agreements, mirroring [adjusted.py]/[coststructure.py].
"""

from __future__ import annotations

import json
import logging
import re
from typing import Dict, List, Optional, Sequence, Tuple

from config import get_settings
from engine import budget
from engine.gate import Finding
from engine.llm_safety import UNTRUSTED_RULE, safe_chunk_id, wrap_untrusted
from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload

logger = logging.getLogger("caos.engine")

_RETRIEVE_QUERY = (
    "maximum permitted total leverage ratio financial maintenance covenant "
    "compliance certificate shall not permit as of the last day of any fiscal "
    "quarter; incremental incurrence debt capacity basket"
)
_MILLION = re.compile(r"(\d[\d,]*(?:\.\d+)?)\s*million", re.IGNORECASE)

# The financial *maintenance* leverage covenant — distinct from the many incurrence
# ratio tests an agreement also carries (e.g. "…the Secured Leverage Ratio does not
# exceed 3.25 to 1.00…" / "…on a Pro Forma Basis…"). Two canonical shapes, both
# supporting the real ratio format "N:1.00":
#   1. compliance certificate — "Maximum Permitted: 5.75:1.00"
#   2. the covenant clause — "shall not permit the [Total/Net] Leverage Ratio … to
#      be greater than 5.75 to 1.00"
# Anchoring on these shapes (not a bare ratio) keeps us off the incurrence tests.
_MAINT_COVENANT_PATTERNS = (
    re.compile(r"maximum\s+permitted\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*:\s*1(?:\.0+)?", re.IGNORECASE),
    re.compile(
        r"shall\s+not\s+permit[^.]{0,160}?"
        r"(?:total|consolidated|net|senior\s+secured|first[\s-]?lien)\s+leverage\s+ratio"
        r"[^.]{0,90}?(?:greater\s+than|exceed)\s*"
        r"(\d+(?:\.\d+)?)\s*(?::\s*1(?:\.0+)?|x\b|times\b|\s+to\s+1(?:\.0+)?)",
        re.IGNORECASE | re.DOTALL,
    ),
)


def _maintenance_leverage_threshold(text: str) -> Optional[float]:
    """The financial maintenance leverage covenant threshold (turns) if present —
    matched on the compliance-certificate or covenant-clause shape, not an
    incurrence ratio test. Range-guarded to plausible covenant levels."""
    for pat in _MAINT_COVENANT_PATTERNS:
        m = pat.search(text)
        if m:
            v = float(m.group(1))
            if 1.0 <= v <= 12.0:
                return v
    return None


def derive_covenant_terms(
    chunks: Sequence[Tuple[str, str]]
) -> Optional[Dict[str, Optional[Tuple[float, str]]]]:
    """Extract covenant terms from document chunks. ``chunks`` is ``(chunk_id,
    text)``. Returns ``{incremental_musd, leverage_covenant_x}`` (each a
    ``(value, chunk_id)`` or None), or None if neither is found. Deterministic."""
    incremental: Optional[Tuple[float, str]] = None
    leverage_cov: Optional[Tuple[float, str]] = None
    for cid, text in chunks:
        low = text.lower()
        if incremental is None and "incremental" in low and ("capacity" in low or "incurrence" in low):
            m = _MILLION.search(text)
            if m:
                incremental = (float(m.group(1).replace(",", "")), cid)
        if leverage_cov is None and "leverage" in low:
            v = _maintenance_leverage_threshold(text)
            if v is not None:
                leverage_cov = (v, cid)
    if incremental is None and leverage_cov is None:
        return None
    return {"incremental_musd": incremental, "leverage_covenant_x": leverage_cov}


async def _llm_covenant_terms(retrieve) -> Optional[Dict[str, Optional[Tuple[float, str]]]]:
    """Claude reads the agreement chunks and returns the covenant terms. Defensive:
    any failure → None (caller falls back to the deterministic path)."""
    import anthropic

    settings = get_settings()
    hits = await retrieve(_RETRIEVE_QUERY, 10)
    if not hits:
        return None
    grounding = "\n\n".join(f"[chunk {h.chunk_id}]\n{h.text}" for h in hits)
    system = (
        "You read leveraged-finance credit agreements / indentures. From the SOURCE "
        "CHUNKS return ONLY a JSON object: {\"incremental_musd\": number|null (day-one "
        "incremental / incurrence debt capacity in $millions), \"incremental_chunk_id\": "
        "id|null, \"leverage_covenant_x\": number|null (maximum net leverage maintenance "
        "covenant, in turns), \"leverage_chunk_id\": id|null}. Use null when a term is not "
        "present. Never invent a figure.\n\n" + UNTRUSTED_RULE
    )
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    resp = await client.messages.create(
        model=settings.anthropic_model, max_tokens=400,
        system=system,
        messages=[{"role": "user", "content": f"SOURCE CHUNKS:\n{wrap_untrusted(grounding)}"}],
    )
    budget.record_usage(resp)
    text = next((b.text for b in resp.content if b.type == "text"), "")
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return None
    data = json.loads(match.group(0))
    incr = data.get("incremental_musd")
    lev = data.get("leverage_covenant_x")
    out: Dict[str, Optional[Tuple[float, str]]] = {
        "incremental_musd": (float(incr), safe_chunk_id(data.get("incremental_chunk_id"), hits))
        if isinstance(incr, (int, float)) and incr > 0 else None,
        "leverage_covenant_x": (float(lev), safe_chunk_id(data.get("leverage_chunk_id"), hits))
        if isinstance(lev, (int, float)) and lev > 0 else None,
    }
    return out if (out["incremental_musd"] or out["leverage_covenant_x"]) else None


async def extract_covenant_terms(retrieve) -> Optional[Dict[str, Optional[Tuple[float, str]]]]:
    """Covenant terms via the LLM when a key is set and budget remains (else the
    deterministic regex fallback)."""
    if get_settings().anthropic_api_key and budget.llm_allowed():
        try:
            res = await _llm_covenant_terms(retrieve)
            if res is not None:
                return res
        except Exception as e:  # noqa: BLE001
            logger.warning("LLM covenant extraction failed, using regex: %s", e)
    hits = await retrieve(_RETRIEVE_QUERY, 10)
    return derive_covenant_terms([(h.chunk_id, h.text) for h in hits])


def _cp1_leverage(cp1: ModulePayload) -> Tuple[Optional[float], Optional[float]]:
    nf = (cp1.runtime_output or {}).get("normalized_financials") or {}
    lev, nd = nf.get("net_leverage_adj_ltm"), nf.get("net_debt_ltm")
    if isinstance(lev, (int, float)) and lev and isinstance(nd, (int, float)) and nd:
        return float(lev), float(nd)
    return None, None


async def synthesize_covenants(cp1: ModulePayload, retrieve) -> ModulePayload:
    """Build the CP-4C payload: capacity / headroom calculations against CP-1's
    leverage, each source-traced. ``retrieve(query, k)`` is the runner's BM25."""
    lev, nd = _cp1_leverage(cp1)
    terms = await extract_covenant_terms(retrieve)

    if terms is None:
        reason = "No covenant capacity disclosures found in ingested sources."
        return ModulePayload(
            module_id="CP-4C", module_name="CovenantCapacityCalculator",
            owned_object="covenant_capacity_calculation",
            runtime_output={"calculations": [], "note": reason},
            confidence="Insufficient Information", limitation_flags=[reason],
            downstream_consumers=["CP-6A", "CP-6E", "CP-RENDER"],
        )

    # Leverage lets us *compute* capacity/headroom; without it we still surface the
    # covenant terms as directly-sourced facts (e.g. the EDGAR CP-1 path, which does
    # not yet derive leverage — see #27 — should not hide a real covenant).
    ebitda = (nd / lev) if (lev and nd) else None
    calcs: List[dict] = []
    claims: List[ClaimSpec] = []
    limitations: List[str] = []

    incr = terms.get("incremental_musd")
    if incr:
        amt, cid = incr
        if ebitda is not None:
            pf_nd = nd + amt
            pf_lev = round(pf_nd / ebitda, 2)
            calcs.append({
                "name": "Pro-forma net leverage after day-one incremental",
                "formula": "(net debt + incremental capacity) / LTM adj. EBITDA",
                "numerator": round(pf_nd, 1), "denominator": round(ebitda, 1),
                "period": "LTM", "value": pf_lev, "unit": "x",
                "source": "Incremental capacity (governing document) + CP-1",
            })
            claims.append(ClaimSpec(
                claim_id="C-CAP1",
                claim_text=(
                    f"Drawing the ${amt:g}M day-one incremental capacity takes pro-forma net "
                    f"leverage from {lev:g}x to {pf_lev:g}x."
                ),
                evidence=[EvidenceSpec("E-CAP1", "calculated_metric", "Calculated",
                                       "Incremental capacity (governing document) + CP-1 net debt / EBITDA",
                                       "High", resolved_chunk_id=cid)],
            ))
        else:
            claims.append(ClaimSpec(
                claim_id="C-CAP1",
                claim_text=f"The governing document provides ${amt:g}M of day-one incremental debt capacity.",
                evidence=[EvidenceSpec("E-CAP1", "table_value", "Directly Sourced",
                                       "Incremental capacity (governing document)",
                                       "High", resolved_chunk_id=cid)],
            ))

    lev_cov = terms.get("leverage_covenant_x")
    covenant_structure = "maintenance" if lev_cov else "cov-lite"
    if lev_cov:
        thr, cid = lev_cov
        if lev is not None:
            headroom = round(thr - lev, 2)
            cushion = round((1 - lev / thr) * 100, 1) if thr else 0.0
            calcs.append({
                "name": "Net leverage covenant headroom",
                "formula": "covenant threshold − current net leverage",
                "numerator": thr, "denominator": lev, "period": "LTM",
                "value": headroom, "unit": "turns", "ebitda_cushion_pct": cushion,
                "source": "Financial maintenance covenant (governing document)",
            })
            claims.append(ClaimSpec(
                claim_id="C-CAP2",
                claim_text=(
                    f"The total leverage covenant is set at {thr:g}x; current {lev:g}x leaves "
                    f"{headroom:g} turns of headroom (~{cushion:g}% EBITDA cushion to a breach)."
                ),
                evidence=[EvidenceSpec("E-CAP2", "calculated_metric", "Calculated",
                                       "Financial maintenance covenant threshold + CP-1 leverage",
                                       "High", resolved_chunk_id=cid)],
            ))
        else:
            claims.append(ClaimSpec(
                claim_id="C-CAP2",
                claim_text=f"The agreement sets a maximum total leverage covenant of {thr:g}x (financial maintenance).",
                evidence=[EvidenceSpec("E-CAP2", "table_value", "Directly Sourced",
                                       "Financial maintenance covenant threshold (governing document)",
                                       "High", resolved_chunk_id=cid)],
            ))
            limitations.append(
                "CP-1 did not provide net leverage — covenant threshold is sourced, but headroom is not computed."
            )

    if covenant_structure == "cov-lite":
        limitations.append(
            "No financial maintenance leverage covenant identified in ingested sources "
            "(cov-lite): no leverage-based early-warning trip before a payment default."
        )

    runtime_output: dict = {"calculations": calcs, "covenant_structure": covenant_structure}
    if lev is not None:
        runtime_output["current_net_leverage"] = round(lev, 2)
    if lev_cov:
        runtime_output["leverage_covenant_x"] = lev_cov[0]

    return ModulePayload(
        module_id="CP-4C", module_name="CovenantCapacityCalculator",
        owned_object="covenant_capacity_calculation",
        runtime_output=runtime_output,
        confidence="High",
        limitation_flags=limitations,
        downstream_consumers=["CP-6A", "CP-6E", "CP-RENDER"],
        claims=claims,
    )


def covlite_finding(cp4c: Optional[ModulePayload]) -> Optional[Finding]:
    """A MINOR (informational) finding when the structure is cov-lite — a real
    early-warning gap, not a defect. None otherwise."""
    if cp4c is None:
        return None
    if (cp4c.runtime_output or {}).get("covenant_structure") != "cov-lite":
        return None
    return Finding(
        finding_id="CP-4C-COVLITE", severity="MINOR", lane=3, module_id="CP-4C",
        description=(
            "Cov-lite: no financial maintenance leverage covenant identified — lenders get "
            "no leverage-based early-warning trip before a payment default. Confirm against "
            "the full agreement and weight the structural risk accordingly."
        ),
        required_remediation="Confirm covenant package against the executed credit agreement.",
    )
