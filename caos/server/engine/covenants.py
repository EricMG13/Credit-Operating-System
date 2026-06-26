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

import logging
import re
from typing import Dict, List, Optional, Sequence, Tuple

from config import get_settings
from engine import budget
from engine.gate import Finding
from engine.llm_safety import UNTRUSTED_RULE, extract_json, safe_chunk_id
from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload, cp1_leverage

logger = logging.getLogger("caos.engine")

_RETRIEVE_QUERY = (
    "maximum permitted total leverage ratio financial maintenance covenant "
    "compliance certificate shall not permit as of the last day of any fiscal "
    "quarter; incremental incurrence debt capacity basket"
)
# Incremental / incurrence debt capacity: the $-amount tied to the incremental
# clause (same sentence), in millions or billions — NOT the first dollar figure
# anywhere in the chunk, which used to grab a preceding fee/figure and cite it as
# the basket (review run-2026-06-26 #1).
# ponytail: keyword-then-amount, same sentence. A reverse-order "$250M incremental",
# or a figure sitting between the keyword and the basket, degrades to None (an
# honest "not parsed" + limitation flag) rather than a wrong number. Widen to a
# two-sided proximity match if real agreements need it.
_INCREMENTAL_AMT = re.compile(
    r"(?:incremental|incurrence)[^.]{0,140}?\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(million|billion)",
    re.IGNORECASE,
)

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
        r"(total|consolidated|net|senior\s+secured|first[\s-]?lien)\s+leverage\s+ratio"
        r"[^.]{0,90}?(?:greater\s+than|exceed)\s*"
        r"(\d+(?:\.\d+)?)\s*(?::\s*1(?:\.0+)?|x\b|times\b|\s+to\s+1(?:\.0+)?)",
        re.IGNORECASE | re.DOTALL,
    ),
)
# A secured-basis cue anywhere in a covenant chunk — used for the compliance-cert
# shape, whose threshold match ("Maximum Permitted: N:1.00") carries no basis word.
_SECURED_BASIS = re.compile(r"(senior\s+secured|first[\s-]?lien)\s+(?:net\s+)?leverage", re.IGNORECASE)


def _normalize_basis(raw: object) -> Optional[str]:
    """Map a leverage-basis qualifier to {senior_secured, first_lien, total} or None.
    Tolerant of regex captures ('Senior Secured') and LLM tokens ('senior_secured')."""
    key = re.sub(r"[\s\-_]+", " ", (raw if isinstance(raw, str) else "").strip().lower())
    if key.startswith("senior secured"):
        return "senior_secured"
    if key.startswith("first lien"):
        return "first_lien"
    if key in ("total", "consolidated", "net", "total net", "consolidated net"):
        return "total"
    return None


def _maintenance_leverage_threshold(text: str) -> Optional[Tuple[float, Optional[str]]]:
    """(threshold turns, leverage basis) for the financial maintenance leverage
    covenant if present — matched on the compliance-certificate or covenant-clause
    shape, not an incurrence ratio test. Basis is 'senior_secured' / 'first_lien' /
    'total', or None when the matched shape carries no qualifier. Range-guarded."""
    # Compliance-certificate shape: the threshold match has no basis word; infer a
    # secured basis only when the chunk states one nearby, else leave it unknown.
    m = _MAINT_COVENANT_PATTERNS[0].search(text)
    if m:
        v = float(m.group(1))
        if 1.0 <= v <= 12.0:
            sec = _SECURED_BASIS.search(text)
            return v, (_normalize_basis(sec.group(1)) if sec else None)
    # Covenant-clause shape: the basis qualifier is captured directly.
    m = _MAINT_COVENANT_PATTERNS[1].search(text)
    if m:
        v = float(m.group(2))
        if 1.0 <= v <= 12.0:
            return v, _normalize_basis(m.group(1))
    return None


def derive_covenant_terms(
    chunks: Sequence[Tuple[str, str]]
) -> Optional[Dict[str, object]]:
    """Extract covenant terms from document chunks. ``chunks`` is ``(chunk_id,
    text)``. Returns ``{incremental_musd, leverage_covenant_x}`` (each a
    ``(value, chunk_id, exact)`` or None) plus ``leverage_covenant_basis`` — the
    leverage basis the maintenance covenant is measured on (senior_secured /
    first_lien / total / None) — or None if neither term is found. Deterministic
    path: each figure is regex-matched in that exact chunk, so ``exact`` is True."""
    incremental: Optional[Tuple[float, str, bool]] = None
    leverage_cov: Optional[Tuple[float, str, bool]] = None
    leverage_basis: Optional[str] = None
    for cid, text in chunks:
        low = text.lower()
        if incremental is None and "incremental" in low and ("capacity" in low or "incurrence" in low):
            m = _INCREMENTAL_AMT.search(text)
            if m:
                amt = float(m.group(1).replace(",", ""))
                if m.group(2).lower() == "billion":
                    amt *= 1000  # normalise to $M
                incremental = (amt, cid, True)
        if leverage_cov is None and "leverage" in low:
            res = _maintenance_leverage_threshold(text)
            if res is not None:
                val, leverage_basis = res
                leverage_cov = (val, cid, True)
    if incremental is None and leverage_cov is None:
        return None
    return {"incremental_musd": incremental, "leverage_covenant_x": leverage_cov,
            "leverage_covenant_basis": leverage_basis}


async def _llm_covenant_terms(retrieve) -> Optional[Dict[str, object]]:
    """Claude reads the agreement chunks and returns the covenant terms. Defensive:
    any failure → None (caller falls back to the deterministic path)."""
    system = (
        "You read leveraged-finance credit agreements / indentures. From the SOURCE "
        "CHUNKS return ONLY a JSON object: {\"incremental_musd\": number|null (day-one "
        "incremental / incurrence debt capacity in $millions), \"incremental_chunk_id\": "
        "id|null, \"leverage_covenant_x\": number|null (maximum net leverage maintenance "
        "covenant, in turns), \"leverage_basis\": \"total\"|\"senior_secured\"|\"first_lien\""
        "|null (the leverage basis that covenant is measured on), \"leverage_chunk_id\": "
        "id|null}. Use null when a term is not present. Never invent a figure.\n\n" + UNTRUSTED_RULE
    )
    res = await extract_json(retrieve, query=_RETRIEVE_QUERY, k=10, system=system)
    if res is None:
        return None
    data, hits = res
    incr = data.get("incremental_musd")
    lev = data.get("leverage_covenant_x")
    # Each term carries (value, chunk_id, exact); exact is False when the model
    # fabricated/omitted the id (safe_chunk_id substitutes the top hit) so the
    # caller can downgrade the citation instead of overstating provenance.
    lev_cov = None
    if isinstance(lev, (int, float)) and lev > 0:
        cid, exact = safe_chunk_id(data.get("leverage_chunk_id"), hits)
        lev_cov = (float(lev), cid, exact)
    incr_t = None
    if isinstance(incr, (int, float)) and incr > 0:
        cid, exact = safe_chunk_id(data.get("incremental_chunk_id"), hits)
        incr_t = (float(incr), cid, exact)
    out: Dict[str, object] = {
        "incremental_musd": incr_t,
        "leverage_covenant_x": lev_cov,
        "leverage_covenant_basis": _normalize_basis(data.get("leverage_basis")) if lev_cov else None,
    }
    return out if (out["incremental_musd"] or out["leverage_covenant_x"]) else None


async def extract_covenant_terms(retrieve) -> Optional[Dict[str, object]]:
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


async def synthesize_covenants(cp1: ModulePayload, retrieve) -> ModulePayload:
    """Build the CP-4C payload: capacity / headroom calculations against CP-1's
    leverage, each source-traced. ``retrieve(query, k)`` is the runner's BM25."""
    lev, nd = cp1_leverage(cp1)
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
        amt, cid, incr_exact = incr
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
                                       "High" if incr_exact else "Medium", resolved_chunk_id=cid)],
            ))
        else:
            claims.append(ClaimSpec(
                claim_id="C-CAP1",
                claim_text=f"The governing document provides ${amt:g}M of day-one incremental debt capacity.",
                evidence=[EvidenceSpec("E-CAP1", "table_value",
                                       "Directly Sourced" if incr_exact else "Inferred",
                                       "Incremental capacity (governing document)",
                                       "High" if incr_exact else "Medium", resolved_chunk_id=cid)],
            ))

    lev_cov = terms.get("leverage_covenant_x")
    # CP-1's net_leverage_adj_ltm is a total/consolidated headline metric. A TLB issuer's
    # maintenance covenant is often a *senior secured* / first-lien ratio (a narrower debt
    # basis) — comparing the two understates headroom, so label by basis and flag the
    # mismatch rather than silently calling everything a "total leverage covenant".
    cov_basis = terms.get("leverage_covenant_basis")
    cov_label = {"senior_secured": "senior secured", "first_lien": "first-lien"}.get(cov_basis, "total")
    covenant_structure = "maintenance" if lev_cov else "cov-lite"
    if lev_cov:
        thr, cid, cov_exact = lev_cov
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
                    f"The {cov_label} leverage covenant is set at {thr:g}x; current {lev:g}x leaves "
                    f"{headroom:g} turns of headroom (~{cushion:g}% EBITDA decline to a breach, net debt flat)."
                ),
                evidence=[EvidenceSpec("E-CAP2", "calculated_metric", "Calculated",
                                       "Financial maintenance covenant threshold + CP-1 leverage",
                                       "High" if cov_exact else "Medium", resolved_chunk_id=cid)],
            ))
            if cov_basis in ("senior_secured", "first_lien"):
                limitations.append(
                    f"Covenant is {cov_label} net leverage ({thr:g}x) but CP-1 net leverage is "
                    f"total/consolidated ({lev:g}x): the covenant tests a narrower (secured) debt "
                    "basis, so the computed headroom is conservative (overstates breach risk)."
                )
        else:
            claims.append(ClaimSpec(
                claim_id="C-CAP2",
                claim_text=f"The agreement sets a maximum {cov_label} leverage covenant of {thr:g}x (financial maintenance).",
                evidence=[EvidenceSpec("E-CAP2", "table_value",
                                       "Directly Sourced" if cov_exact else "Inferred",
                                       "Financial maintenance covenant threshold (governing document)",
                                       "High" if cov_exact else "Medium", resolved_chunk_id=cid)],
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
        if cov_basis in ("senior_secured", "first_lien"):
            runtime_output["covenant_basis"] = cov_basis

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
