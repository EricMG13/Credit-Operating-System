"""CP-3B RecoveryInstrumentPreference — rank the debt stack by expected recovery.

Two steps, both deterministic:
  1. Scan retrieved agreement / offering chunks (the idiom of [legal.py]) for the
     tranches that make up the capital structure (RCF, 1L, 2L, secured/unsecured
     notes, sub), ordered by seniority. Each tranche is evidence-traced to the
     chunk it was named in.
  2. Run an absolute-priority recovery waterfall over those tranches against a
     distressed enterprise value (a multiple of CP-1 LTM EBITDA), giving an
     expected recovery % per tranche and a preference ranking (most-preferred =
     highest expected recovery). Claims that share a seniority rank are treated
     as pari-passu and split the value reaching that rank pro-rata by claim; the
     waterfall cascades rank-by-rank. No LLM; degrades to a seniority-only read
     when no agreement text is ingested or CP-1 supplies no EBITDA.
"""

from __future__ import annotations

import re
from itertools import groupby
from typing import List, Optional, Tuple

from engine.periods import is_finite_number, latest_annual, safe_mul
from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload
from engine.textscan import amount_musd, scan

_QUERY = "term loan revolving credit facility senior secured notes second lien subordinated capital structure"

# Distressed enterprise value assumed for the waterfall, as a multiple of LTM EBITDA.
_DISTRESS_EV_MULTIPLE = 5.0

_TRANCHES: Tuple[Tuple[str, str, int, str], ...] = (
    ("Revolving credit facility", "RCF", 0, r"revolving credit facilit|\brcf\b|revolver"),
    ("First-lien term loan", "1L", 0, r"first[-\s]lien|term loan b\b|\btlb\b"),
    ("Senior secured notes", "SSN", 0, r"senior secured note"),
    ("Second-lien term loan", "2L", 1, r"second[-\s]lien|\b2l\b"),
    ("Senior unsecured notes", "SUN", 2, r"senior unsecured note|senior note"),
    ("Subordinated notes", "SUB", 3, r"subordinat"),
)

# Precompiled regexes to avoid compiling inside scan loops
_TRANCHES_COMPILED = {
    "RCF": re.compile(r"revolving credit facilit|\brcf\b|revolver", re.IGNORECASE),
    "1L": re.compile(r"first[-\s]lien|term loan b\b|\btlb\b", re.IGNORECASE),
    "SSN": re.compile(r"senior secured note", re.IGNORECASE),
    "2L": re.compile(r"second[-\s]lien|\b2l\b", re.IGNORECASE),
    "SUN": re.compile(r"senior unsecured note|senior note", re.IGNORECASE),
    "SUB": re.compile(r"subordinat", re.IGNORECASE),
}


def scan_tranches(chunks: List[Tuple[str, str]]) -> List[dict]:
    """Detect each tranche (once) with its size when stated, most-senior first."""
    found = [{"tranche": label, "code": code, "seniority_rank": rank,
              "amount_musd": amount_musd(text, _TRANCHES_COMPILED[code]), "chunk_id": cid}
             for (label, code, rank, pattern), cid, text in scan(chunks, _TRANCHES, key=1)]
    found.sort(key=lambda t: t["seniority_rank"])
    return found


def recovery_waterfall(tranches: List[dict], distressed_ev: float) -> List[dict]:
    """Run the recovery waterfall over a distressed enterprise value.

    Credit reading (what an analyst is verifying line by line):
    - ``distressed_ev`` is the *recovery enterprise value*: the whole pie a creditor
      committee has to distribute in a distress/restructuring scenario (upstream this is
      roughly 5x LTM EBITDA). It is the only value that ever gets distributed.
    - Absolute priority BETWEEN seniority ranks, pari-passu pro-rata WITHIN a rank.
    """
    remaining_ev, waterfall, indeterminate = float(distressed_ev), [], False
    for _rank, group_iter in groupby(tranches, key=lambda t: t["seniority_rank"]):
        group = list(group_iter)
        claims = [t["amount_musd"] for t in group]

        if not all(is_finite_number(c) and c > 0 for c in claims):
            indeterminate = True

        if indeterminate:
            for t in group:
                waterfall.append({
                    **t, "recovery_musd": None, "recovery_pct": None,
                    "amount_musd": t["amount_musd"] if is_finite_number(t["amount_musd"]) else None
                })
        else:
            rank_claim = sum(claims)
            for t, claim in zip(group, claims):
                rec = min(claim, remaining_ev * claim / rank_claim) if remaining_ev > 0 else 0.0
                waterfall.append({**t, "recovery_musd": round(rec, 1), "recovery_pct": round(100 * rec / claim, 1)})
            remaining_ev = max(0.0, remaining_ev - rank_claim)
    return waterfall


def _distressed_ev(cp1: Optional[ModulePayload]) -> Optional[float]:
    nf = (cp1.runtime_output or {}).get("normalized_financials", {}) if cp1 is not None else {}
    eb = latest_annual(nf.get("adj_ebitda") or {})
    # eb > 0 (not just truthy): the guard already rejects NaN/0, but a NEGATIVE LTM
    # EBITDA (a loss year) would give a negative distressed EV (e.g. eb=-421 -> -2105),
    # which is truthy, so the waterfall would run with remaining_ev<0 and assert a
    # High-confidence "~0% expected recovery" across every tranche. A 5x multiple on
    # negative EBITDA is meaningless — degrade to the seniority-only branch instead.
    # safe_mul (not raw *): a finite-but-huge EBITDA would overflow to inf and only
    # be caught at the persistence gate — degrade to the seniority-only branch instead.
    ev = safe_mul(eb, _DISTRESS_EV_MULTIPLE) if is_finite_number(eb) and eb > 0 else None
    return round(ev, 1) if ev is not None else None


async def synthesize_recovery_preference(retrieve, cp1: Optional[ModulePayload] = None) -> ModulePayload:
    """Build the CP-3B payload: tranche scan → recovery waterfall → preference rank."""
    hits = await retrieve(_QUERY, 6)
    found = scan_tranches([(h.chunk_id, h.text) for h in hits])

    if not found:
        return ModulePayload(
            module_id="CP-3B", module_name="RecoveryInstrumentPreference",
            owned_object="recovery_instrument_preference",
            runtime_output={"tranches": [], "preference": [],
                            "note": "No debt tranches identified in ingested agreement text."},
            confidence="Insufficient Information",
            limitation_flags=["No capital-structure disclosure detected in ingested sources."],
            downstream_consumers=["CP-6A"],
        )

    # Size the stack where amounts were stated; % of structure is recovery-relevant.
    # Funded debt EXCLUDES the RCF: an undrawn revolver commitment is not funded debt.
    funded = [t for t in found if t["code"] != "RCF" and is_finite_number(t["amount_musd"])]
    total = round(sum(t["amount_musd"] for t in funded), 1) if funded else None
    for t in found:
        t["pct_of_structure"] = (round(100 * t["amount_musd"] / total, 1)
                                 if total and t["code"] != "RCF"
                                 and is_finite_number(t["amount_musd"]) else None)

    ev = _distressed_ev(cp1)
    waterfall_basis = (f"absolute-priority waterfall (pari-passu within rank) vs ${ev:g}M "
                       f"distressed EV ({_DISTRESS_EV_MULTIPLE:g}x LTM EBITDA)") if ev else None
    rows = recovery_waterfall(found, ev) if ev else [
        {**t, "recovery_musd": None, "recovery_pct": None} for t in found]

    # Preference: highest expected recovery first; seniority breaks ties.
    ranked = sorted(rows, key=lambda t: (-(t["recovery_pct"] if t["recovery_pct"] is not None else -1),
                                         t["seniority_rank"]))
    preference = [{"rank": i + 1, "code": t["code"], "tranche": t["tranche"],
                   "recovery_pct": t["recovery_pct"]} for i, t in enumerate(ranked)]

    top = preference[0]
    pref_txt = (f"{top['code']} preferred (~{top['recovery_pct']:g}% expected recovery)"
                if ev and top["recovery_pct"] is not None
                else f"{top['code']} preferred (seniority-only; no EV to score recovery)")
    limitations = [] if ev else [
        "CP-1 supplied no LTM EBITDA; recovery not waterfalled — preference is seniority-only."]
    if total is None:
        limitations.append("No tranche sizes parsed; waterfall ran on named tranches only.")
    if ev and any(is_finite_number(r["amount_musd"]) and r["amount_musd"] > 0
                  and r["recovery_pct"] is None for r in rows):
        limitations.append(
            "An unsized senior tranche broke the waterfall; recovery for tranches "
            "junior to it is left indeterminate rather than over-credited.")
    ranks = [t["seniority_rank"] for t in found]
    if ev and len(ranks) != len(set(ranks)):
        limitations.append(
            "Lien priority assumed pari-passu within each seniority rank (RCF, first-lien "
            "term loan and senior secured notes treated as first-lien pari-passu, sharing "
            "collateral pro-rata by claim); actual intercreditor sharing — and any "
            "super-senior/super-priority RCF or junior/split-collateral secured notes — is "
            "not parsed from the agreement text.")

    return ModulePayload(
        module_id="CP-3B", module_name="RecoveryInstrumentPreference",
        owned_object="recovery_instrument_preference",
        runtime_output={
            "tranches": [{"tranche": t["tranche"], "code": t["code"], "seniority_rank": t["seniority_rank"],
                          "amount_musd": t["amount_musd"], "pct_of_structure": t["pct_of_structure"],
                          "recovery_musd": t["recovery_musd"], "recovery_pct": t["recovery_pct"],
                          "chunk_id": t["chunk_id"]} for t in rows],
            "preference": preference,
            "seniority_order": [t["code"] for t in found],
            "total_debt_musd": total,
            "distressed_ev_musd": ev,
            "waterfall_basis": waterfall_basis or "seniority-only (no distressed EV available)",
            "register_basis": "keyword scan of ingested agreement / offering chunks",
        },
        confidence="High" if ev else "Medium",
        downstream_consumers=["CP-6A"],
        limitation_flags=limitations,
        # Lineage honesty (audit 2026-07-10 SPEC-3): with a computed waterfall the
        # claim asserts recovery PERCENTAGES derived from the assumed 5.0x EV —
        # that is a calculation on an assumption, not a quoted document fact, and
        # stamping it Directly Sourced/High let the module grade its own
        # assumption as source-quoted (CP-5B saw nothing). The tranche chunks
        # stay anchored via resolved_chunk_id either way; the seniority-only
        # (no-EV) claim really is the directly-sourced tranche scan.
        claims=[ClaimSpec(
            claim_id="C-CAP1",
            claim_text=(f"Recovery preference across {len(found)} tranche(s): {pref_txt}"
                        + (f"; {waterfall_basis}." if waterfall_basis else ".")),
            evidence=[EvidenceSpec(
                evidence_id=f"E-CAP-{i}",
                extraction_type="calculated_metric" if ev else "quoted_text",
                lineage_class="Calculated" if ev else "Directly Sourced",
                source_locator=("Absolute-priority waterfall over tranches disclosed in the "
                                "ingested chunk (5.0x EV assumption)" if ev
                                else "Agreement / offering disclosure (ingested chunk)"),
                confidence="Medium" if ev else "High",
                resolved_chunk_id=t["chunk_id"]) for i, t in enumerate(found)],
        )],
    )
