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
from engine.periods import is_finite_number, safe_div
from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload, cp1_leverage

logger = logging.getLogger("caos.engine")

_RETRIEVE_QUERY = (
    "maximum permitted total leverage ratio financial maintenance covenant "
    "compliance certificate shall not permit as of the last day of any fiscal "
    "quarter; incremental incurrence debt capacity basket; restricted payments "
    "builder basket available amount; cross-default material indebtedness in "
    "excess of; EBITDA definition add-backs cost savings synergies cap percent"
)
# Incremental / incurrence debt capacity: the $-amount tied to the incremental
# clause (same sentence), in millions or billions — NOT the first dollar figure
# anywhere in the chunk, which used to grab a preceding fee/figure and cite it as
# the basket (review review-2026-06-26 #1).
# ponytail: keyword-then-amount, same sentence. A reverse-order "$250M incremental",
# or a figure sitting between the keyword and the basket, degrades to None (an
# honest "not parsed" + limitation flag) rather than a wrong number. Widen to a
# two-sided proximity match if real agreements need it.
_INCREMENTAL_AMT = re.compile(
    r"(?:incremental|incurrence)[^.]{0,140}?\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(million|billion)",
    re.IGNORECASE,
)

# Restricted-payments / builder-basket capacity — same keyword-then-amount,
# same-sentence convention (and the same known ceiling) as _INCREMENTAL_AMT.
_RP_BASKET_AMT = re.compile(
    r"(?:restricted\s+payments?|builder\s+basket|available\s+amount|general\s+basket)"
    r"[^.]{0,140}?\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(million|billion)",
    re.IGNORECASE,
)

# Cross-default / cross-acceleration threshold. The $-figure usually sits under
# the "Material Indebtedness" definition the default clause references, so anchor
# on either phrase, then an excess-of verb, then the amount — same sentence.
_CROSS_DEFAULT_AMT = re.compile(
    r"(?:cross[-\s]?default|cross[-\s]?accelerat\w+|material\s+indebtedness)"
    r"[^.]{0,160}?(?:in\s+excess\s+of|exceed(?:s|ing)?|greater\s+than|more\s+than|at\s+least)"
    r"[^.]{0,60}?\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(million|billion)",
    re.IGNORECASE,
)

# Covenant-EBITDA add-back cap ("cost savings ... shall not exceed 25% of
# EBITDA" / "caps cost-saving add-backs at 25 percent"). Two shapes so the
# capping verb can sit on either side of the add-back keyword. Distinct from the
# *disclosed load* ("add-backs represent 18.2 percent"), which adjusted.py owns —
# a cap requires a capping verb, so "represent"/"are" never match here.
_ADDBACK_CAP_PATTERNS = (
    re.compile(
        r"(?:add[-\s]?backs?|cost[-\s]sav\w+|synerg\w+)"
        r"[^.]{0,160}?(?:shall\s+not\s+exceed|not\s+to\s+exceed|capped\s+at|limited\s+to|cap\s+of)"
        r"[^.]{0,40}?(\d{1,2}(?:\.\d+)?)\s*(?:%|percent)",
        re.IGNORECASE,
    ),
    re.compile(
        r"caps?\b[^.]{0,80}?add[-\s]?backs?[^.]{0,60}?(?:at|to)\s*(\d{1,2}(?:\.\d+)?)\s*(?:%|percent)",
        re.IGNORECASE,
    ),
)


def _amount_match(pattern: "re.Pattern", text: str) -> Optional[float]:
    """First keyword-anchored $-amount in ``text`` per ``pattern``, normalised to $M."""
    m = pattern.search(text)
    if not m:
        return None
    amt = float(m.group(1).replace(",", ""))
    if m.group(2).lower() == "billion":
        amt *= 1000
    return amt


def _addback_cap(text: str) -> Optional[float]:
    """Covenant add-back cap as a fraction of EBITDA (e.g. 0.25), range-guarded."""
    for pat in _ADDBACK_CAP_PATTERNS:
        m = pat.search(text)
        if m:
            v = float(m.group(1))
            if 0 < v <= 60:
                return v / 100.0
    return None

# The financial *maintenance* leverage covenant — distinct from the many incurrence
# ratio tests an agreement also carries (e.g. "…the Secured Leverage Ratio does not
# exceed 3.25 to 1.00…" / "…on a Pro Forma Basis…"). Two canonical shapes, both
# supporting the real ratio format "N:1.00":
#   1. compliance certificate — "Maximum Permitted: 5.75:1.00"
#   2. the covenant clause — "shall not permit the [Total/Net] Leverage Ratio … to
#      be greater than 5.75 to 1.00"
# Anchoring on these shapes (not a bare ratio) keeps us off the incurrence tests.
_MAINT_COVENANT_PATTERNS = (
    re.compile(r"maximum\s+permitted\s*(?:leverage\s+ratio\s*)?[:\-]?\s*(\d+(?:\.\d+)?)\s*(?::\s*1(?:\.0+)?|to\s+1(?:\.0+)?|x\b)", re.IGNORECASE),
    re.compile(
        r"shall\s+not\s+permit[^.]{0,350}?"
        r"\b(total|consolidated|net|senior\s+secured|first[\s-]?lien|consolidated\s+total|total\s+net|consolidated\s+net)?\s*leverage\s+ratio"
        r"[^.]{0,200}?(?:greater\s+than|exceed|be\s+more\s+than|less\s+than|maximum\s+of)\s*"
        r"(\d+(?:\.\d+)?)\s*(?::\s*1(?:\.0+)?|x\b|times\b|\s+to\s+1(?:\.0+)?)",
        re.IGNORECASE | re.DOTALL,
    ),
)

# A secured-basis cue anywhere in a covenant chunk — used for the compliance-cert
# shape, whose threshold match ("Maximum Permitted: N:1.00") carries no basis word.
_SECURED_BASIS = re.compile(r"(senior\s+secured|first[\s-]?lien)\s+(?:net\s+)?leverage", re.IGNORECASE)
_BASIS_RE = re.compile(r"[\s\-_]+")


def _normalize_basis(raw: object) -> Optional[str]:
    """Map a leverage-basis qualifier to {senior_secured, first_lien, total} or None.
    Tolerant of regex captures ('Senior Secured') and LLM tokens ('senior_secured')."""
    key = _BASIS_RE.sub(" ", (raw if isinstance(raw, str) else "").strip().lower())
    if key.startswith("senior secured"):
        return "senior_secured"
    if key.startswith("first lien"):
        return "first_lien"
    if key in ("total", "consolidated", "net", "total net", "consolidated net"):
        return "total"
    return None


def _maintenance_leverage_threshold(text: str) -> Optional[Tuple[float, Optional[str]]]:
    """(threshold turns, leverage basis) for the financial maintenance leverage covenant if present."""
    m = _MAINT_COVENANT_PATTERNS[0].search(text)
    if m and 1.0 <= float(m.group(1)) <= 12.0:
        sec = _SECURED_BASIS.search(text)
        return float(m.group(1)), (_normalize_basis(sec.group(1)) if sec else None)
    m = _MAINT_COVENANT_PATTERNS[1].search(text)
    if m and 1.0 <= float(m.group(2)) <= 12.0:
        return float(m.group(2)), _normalize_basis(m.group(1))
    return None


# Precompiled checks to avoid lowercasing text chunks and allocating strings
_INCR_CHECK_1 = re.compile(r"incremental", re.I)
_INCR_CHECK_2 = re.compile(r"capacity|incurrence", re.I)
_LEV_CHECK = re.compile(r"leverage", re.I)
_RP_CHECK = re.compile(r"restricted\s+payment|builder\s+basket|available\s+amount|general\s+basket", re.I)
_CD_CHECK_1 = re.compile(r"material\s+indebtedness", re.I)
_CD_CHECK_2 = re.compile(r"default|accelerat", re.I)
_CROSS_CHECK = re.compile(r"cross", re.I)
_AB_CHECK = re.compile(r"add-back|add\s+back|addback|cost-sav|cost\s+sav|synerg", re.I)


def derive_covenant_terms(
    chunks: Sequence[Tuple[str, str]]
) -> Optional[Dict[str, object]]:
    """Extract covenant terms from document chunks. ``chunks`` is ``(chunk_id,
    text)``. Returns ``{incremental_musd, leverage_covenant_x, rp_basket_musd,
    cross_default_musd, addback_cap_pct}`` (each a ``(value, chunk_id, exact)``
    or None) plus ``leverage_covenant_basis`` — the leverage basis the
    maintenance covenant is measured on (senior_secured / first_lien / total /
    None) — or None if no term is found. Deterministic path: each figure is
    regex-matched in that exact chunk, so ``exact`` is True."""
    incremental: Optional[Tuple[float, str, bool]] = None
    leverage_cov: Optional[Tuple[float, str, bool]] = None
    rp_basket: Optional[Tuple[float, str, bool]] = None
    cross_default: Optional[Tuple[float, str, bool]] = None
    addback_cap: Optional[Tuple[float, str, bool]] = None
    leverage_basis: Optional[str] = None
    for cid, text in chunks:
        if incremental is None and _INCR_CHECK_1.search(text) and _INCR_CHECK_2.search(text):
            m = _INCREMENTAL_AMT.search(text)
            if m:
                amt = float(m.group(1).replace(",", ""))
                if m.group(2).lower() == "billion":
                    amt *= 1000  # normalise to $M
                incremental = (amt, cid, True)
        if leverage_cov is None and _LEV_CHECK.search(text):
            res = _maintenance_leverage_threshold(text)
            if res is not None:
                val, leverage_basis = res
                leverage_cov = (val, cid, True)
        if rp_basket is None and _RP_CHECK.search(text):
            amt2 = _amount_match(_RP_BASKET_AMT, text)
            if amt2 is not None:
                rp_basket = (amt2, cid, True)
        if cross_default is None and (_CD_CHECK_1.search(text) or (_CROSS_CHECK.search(text) and _CD_CHECK_2.search(text))):
            amt3 = _amount_match(_CROSS_DEFAULT_AMT, text)
            if amt3 is not None:
                cross_default = (amt3, cid, True)
        if addback_cap is None and _AB_CHECK.search(text):
            cap = _addback_cap(text)
            if cap is not None:
                addback_cap = (cap, cid, True)
    if all(t is None for t in (incremental, leverage_cov, rp_basket, cross_default, addback_cap)):
        return None
    return {"incremental_musd": incremental, "leverage_covenant_x": leverage_cov,
            "leverage_covenant_basis": leverage_basis, "rp_basket_musd": rp_basket,
            "cross_default_musd": cross_default, "addback_cap_pct": addback_cap}


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
        "id|null, \"rp_basket_musd\": number|null (restricted payments / builder basket "
        "capacity in $millions), \"rp_chunk_id\": id|null, \"cross_default_musd\": "
        "number|null (cross-default / material-indebtedness threshold in $millions), "
        "\"cross_default_chunk_id\": id|null, \"addback_cap_pct\": number|null (covenant "
        "EBITDA add-back / cost-savings cap as a FRACTION of EBITDA, e.g. 0.25), "
        "\"addback_cap_chunk_id\": id|null}. Use null when a term is not present. "
        "Never invent a figure.\n\n" + UNTRUSTED_RULE
    )
    res = await extract_json(retrieve, query=_RETRIEVE_QUERY, k=10, system=system)
    if res is None:
        return None
    data, hits = res

    # Each term carries (value, chunk_id, exact); exact is False when the model
    # fabricated/omitted the id (safe_chunk_id substitutes the top hit) so the
    # caller can downgrade the citation instead of overstating provenance.
    def amount_term(value: object, id_key: str) -> Optional[Tuple[float, str, bool]]:
        if is_finite_number(value) and not isinstance(value, bool) and value > 0:
            cid, exact = safe_chunk_id(data.get(id_key), hits)
            return (float(value), cid, exact)
        return None

    lev_cov = amount_term(data.get("leverage_covenant_x"), "leverage_chunk_id")
    incr_t = amount_term(data.get("incremental_musd"), "incremental_chunk_id")
    rp_t = amount_term(data.get("rp_basket_musd"), "rp_chunk_id")
    xd_t = amount_term(data.get("cross_default_musd"), "cross_default_chunk_id")

    cap_t = None
    cap_raw = data.get("addback_cap_pct")
    if is_finite_number(cap_raw) and not isinstance(cap_raw, bool) and cap_raw > 0:
        v = float(cap_raw)
        if 1 <= v <= 60:
            v /= 100.0  # model answered in percent despite the FRACTION ask
        if 0 < v < 1:
            cid, exact = safe_chunk_id(data.get("addback_cap_chunk_id"), hits)
            cap_t = (v, cid, exact)

    out: Dict[str, object] = {
        "incremental_musd": incr_t,
        "leverage_covenant_x": lev_cov,
        "leverage_covenant_basis": _normalize_basis(data.get("leverage_basis")) if lev_cov else None,
        "rp_basket_musd": rp_t,
        "cross_default_musd": xd_t,
        "addback_cap_pct": cap_t,
    }
    return out if any((incr_t, lev_cov, rp_t, xd_t, cap_t)) else None


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


async def synthesize_covenants(cp1: ModulePayload, retrieve) -> ModulePayload:  # noqa: C901
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
    # safe_div (not raw /): an overflowing |nd / lev| otherwise hands the
    # pro-forma calc an inf EBITDA, which renders as a garbage 0.0x pf leverage.
    ebitda = safe_div(nd, lev) if (is_finite_number(lev) and lev and is_finite_number(nd) and nd) else None
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
        # Explicit finiteness on BOTH operands (not just `lev is not None`): cp1_leverage
        # now returns None for a NaN lev, but gate here too so a non-finite thr (or a
        # future lev source that skips that gate) degrades to the sourced-threshold /
        # no-headroom branch below instead of emitting a NaN headroom/cushion. Guard
        # thr != 0 so the cushion divide can't blow up.
        if is_finite_number(lev) and is_finite_number(thr) and thr != 0:
            headroom = round(thr - lev, 2)
            cushion = round((1 - lev / thr) * 100, 1)
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

    rp = terms.get("rp_basket_musd")
    if rp:
        amt, cid, rp_exact = rp
        claims.append(ClaimSpec(
            claim_id="C-CAP3",
            claim_text=f"The restricted payments / builder basket provides ${amt:g}M of capacity.",
            evidence=[EvidenceSpec("E-CAP3", "table_value",
                                   "Directly Sourced" if rp_exact else "Inferred",
                                   "Restricted payments basket (governing document)",
                                   "High" if rp_exact else "Medium", resolved_chunk_id=cid)],
        ))

    xd = terms.get("cross_default_musd")
    if xd:
        amt, cid, xd_exact = xd
        claims.append(ClaimSpec(
            claim_id="C-CAP4",
            claim_text=(f"Cross-default trips on a default of other indebtedness above ${amt:g}M "
                        "(material-indebtedness threshold)."),
            evidence=[EvidenceSpec("E-CAP4", "table_value",
                                   "Directly Sourced" if xd_exact else "Inferred",
                                   "Cross-default threshold (governing document)",
                                   "High" if xd_exact else "Medium", resolved_chunk_id=cid)],
        ))

    # Add-back cap audit: the covenant's own EBITDA definition vs the add-back
    # load the issuer actually discloses (CP-1's embedded reported-vs-adjusted
    # reconciliation). Load > cap = adjustments beyond the definition — the
    # "phantom EBITDA" read. Both operands gated (unvalidated runtime_output).
    cap = terms.get("addback_cap_pct")
    addback_audit: Optional[dict] = None
    if cap:
        cap_pct, cid, cap_exact = cap
        recon = (cp1.runtime_output or {}).get("adjusted_ebitda_reconciliation") or {}
        load = recon.get("addback_pct")
        if is_finite_number(load) and is_finite_number(cap_pct) and cap_pct > 0:
            load_f = float(load)
            util = round(load_f / cap_pct * 100, 1)
            breach = load_f > cap_pct
            addback_audit = {
                "disclosed_addback_pct": round(load_f, 4),
                "cap_pct": round(cap_pct, 4),
                "utilization_pct": util,
                "breach": breach,
            }
            calcs.append({
                "name": "EBITDA add-back cap utilization",
                "formula": "disclosed add-backs / covenant add-back cap",
                "numerator": round(load_f * 100, 1), "denominator": round(cap_pct * 100, 1),
                "period": "LTM", "value": util, "unit": "%",
                "source": "Add-back cap (governing document) + CP-1 add-back disclosure",
            })
            claims.append(ClaimSpec(
                claim_id="C-CAP5",
                claim_text=(
                    f"Disclosed add-backs ({load_f * 100:g}% of EBITDA) exceed the covenant cap "
                    f"({cap_pct * 100:g}%) — adjustments beyond the governing definition."
                    if breach else
                    f"Disclosed add-backs ({load_f * 100:g}% of EBITDA) use {util:g}% of the "
                    f"{cap_pct * 100:g}% covenant add-back cap."
                ),
                evidence=[EvidenceSpec("E-CAP5", "calculated_metric", "Calculated",
                                       "Add-back cap (governing document) + CP-1 add-back disclosure",
                                       "High" if cap_exact else "Medium", resolved_chunk_id=cid)],
            ))
        else:
            claims.append(ClaimSpec(
                claim_id="C-CAP5",
                claim_text=f"The EBITDA definition caps add-backs at {cap_pct * 100:g}% of EBITDA.",
                evidence=[EvidenceSpec("E-CAP5", "table_value",
                                       "Directly Sourced" if cap_exact else "Inferred",
                                       "EBITDA add-back cap (governing document)",
                                       "High" if cap_exact else "Medium", resolved_chunk_id=cid)],
            ))

    runtime_output: dict = {"calculations": calcs, "covenant_structure": covenant_structure}
    if is_finite_number(lev):
        runtime_output["current_net_leverage"] = round(lev, 2)
    if lev_cov:
        runtime_output["leverage_covenant_x"] = lev_cov[0]
        if cov_basis in ("senior_secured", "first_lien"):
            runtime_output["covenant_basis"] = cov_basis
    if rp:
        runtime_output["rp_basket_musd"] = rp[0]
    if xd:
        runtime_output["cross_default_musd"] = xd[0]
    if cap:
        runtime_output["addback_cap_pct"] = cap[0]
    if addback_audit is not None:
        runtime_output["addback_audit"] = addback_audit

    return ModulePayload(
        module_id="CP-4C", module_name="CovenantCapacityCalculator",
        owned_object="covenant_capacity_calculation",
        runtime_output=runtime_output,
        confidence="High",
        limitation_flags=limitations,
        downstream_consumers=["CP-6A", "CP-6E", "CP-RENDER"],
        claims=claims,
    )


def addback_cap_finding(cp4c: Optional[ModulePayload]) -> Optional[Finding]:
    """A MINOR (informational) finding when disclosed add-backs exceed the covenant
    add-back cap — a quality-of-EBITDA red flag to scrutinise, not a defect. None
    otherwise. Operands re-gated here: runtime_output is unvalidated at this
    boundary (a persisted/replayed payload could carry NaN)."""
    if cp4c is None:
        return None
    audit = (cp4c.runtime_output or {}).get("addback_audit") or {}
    # Container-level twin of the finite gates below: a truthy non-dict here
    # (replay/LLM producer) would raise in the QA phase and abort the run (BE3-6).
    if not isinstance(audit, dict):
        return None
    if audit.get("breach") is not True:
        return None
    disclosed, cap = audit.get("disclosed_addback_pct"), audit.get("cap_pct")
    if not (is_finite_number(disclosed) and is_finite_number(cap)):
        return None
    return Finding(
        finding_id="CP-4C-ADDBACK-CAP", severity="MINOR", lane=3, module_id="CP-4C",
        description=(
            f"Disclosed EBITDA add-backs ({float(disclosed) * 100:g}% of EBITDA) exceed the "
            f"covenant add-back cap ({float(cap) * 100:g}%): adjustments beyond the governing "
            "definition inflate marketed EBITDA relative to covenant EBITDA. Reconcile the "
            "disclosed adjustments against the credit-agreement definition."
        ),
        required_remediation="Re-derive covenant EBITDA strictly per the agreement definition.",
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
