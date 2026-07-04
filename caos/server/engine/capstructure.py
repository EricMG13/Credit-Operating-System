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

ponytail: flat distressed EV = 5.0x LTM EBITDA, absolute priority BETWEEN ranks
and pari-passu (pro-rata) WITHIN a rank, no fees/super-priority/structural-
subordination haircut. Lien priority is assumed, not parsed from the
intercreditor agreement: RCF + first-lien term loan + senior secured notes
default to the same first-lien rank. Refine the multiple per sector (or take a
CP-2B distressed-EBITDA input) if recovery precision matters.
"""

from __future__ import annotations

import re
from itertools import groupby
from typing import List, Optional, Tuple

from engine.periods import is_finite_number, latest
from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload
from engine.textscan import amount_musd, scan

_QUERY = "term loan revolving credit facility senior secured notes second lien subordinated capital structure"

# Distressed enterprise value assumed for the waterfall, as a multiple of LTM EBITDA.
_DISTRESS_EV_MULTIPLE = 5.0

# (label, tranche code, seniority rank [lower = more senior], pattern).
# RCF, first-lien term loan and senior secured notes share rank 0: in a typical US
# leveraged/LBO structure they are first-lien pari-passu (same collateral, same
# priority) and split it pro-rata by claim. The tool cannot read the intercreditor
# agreement, so this is a default assumption, surfaced as a limitation_flag — a
# super-senior/super-priority RCF or a junior/1.5-lien/split-collateral SSN is not
# modelled. 2L (junior secured) < senior unsecured < subordinated below that.
_TRANCHES: Tuple[Tuple[str, str, int, str], ...] = (
    ("Revolving credit facility", "RCF", 0, r"revolving credit facilit|\brcf\b|revolver"),
    ("First-lien term loan", "1L", 0, r"first[-\s]lien|term loan b\b|\btlb\b"),
    ("Senior secured notes", "SSN", 0, r"senior secured note"),
    ("Second-lien term loan", "2L", 1, r"second[-\s]lien|\b2l\b"),
    ("Senior unsecured notes", "SUN", 2, r"senior unsecured note|senior note"),
    ("Subordinated notes", "SUB", 3, r"subordinat"),
)


def scan_tranches(chunks: List[Tuple[str, str]]) -> List[dict]:
    """Detect each tranche (once) with its size when stated, most-senior first."""
    found = [{"tranche": label, "code": code, "seniority_rank": rank,
              "amount_musd": amount_musd(text, re.compile(pattern, re.IGNORECASE)), "chunk_id": cid}
             for (label, code, rank, pattern), cid, text in scan(chunks, _TRANCHES, key=1)]
    found.sort(key=lambda t: t["seniority_rank"])
    return found


def recovery_waterfall(tranches: List[dict], distressed_ev: float) -> List[dict]:
    """Run the recovery waterfall over a distressed enterprise value.

    Credit reading (what an analyst is verifying line by line):

    - ``distressed_ev`` is the *recovery enterprise value*: the whole pie a creditor
      committee has to split in a distress/restructuring scenario (upstream this is
      roughly 5x LTM EBITDA). It is the only value that ever gets distributed.
    - The ``tranches`` list arrives already ordered senior -> junior (the caller sorts
      on ``seniority_rank``). *Absolute priority* applies BETWEEN ranks — every claim in
      a senior rank must be satisfied before any junior rank recovers a cent — while
      claims sharing a rank are *pari-passu* and split the value reaching that rank
      pro-rata by claim size. This function trusts the incoming order and does NOT
      re-sort; it pools consecutive same-rank tranches (the caller keeps them adjacent).
    - Each tranche's *claim* is its principal outstanding, ``amount_musd`` ($M). A rank
      with total claim ``S`` facing ``R`` remaining value hands each member
      ``min(claim, R * claim / S)`` — full claim when ``R >= S``, else its pro-rata share
      — then ``R`` shrinks by the full ``S`` (floored at 0). ``recovery_pct`` is a
      tranche's own recovery over its own claim: cents on the dollar for THAT tranche.
      A single-member rank collapses to plain ``min(claim, R)`` — strict priority.
    - An *unsized* claim (unknown, 0, negative) makes its whole rank AND everything below
      indeterminate: we cannot pro-rata a pool whose total is unknown, and we cannot know
      how much value reaches the juniors behind it. Those tranches are reported null
      (None) rather than guessed — over-crediting them would systematically over-state
      recovery; refusing to guess is the conservative, defensible read.

    Worked check (1L 500 + SSN 500 pari at rank 0, EV 600): S=1000, each takes
    600*500/1000 = 300 (60%) — the two first-lien classes recover equally, not 100%/20%.
    """
    # Total value available to distribute, narrowed as senior ranks are satisfied.
    # float() coerces ints/strings; a non-positive EV simply leaves nothing to hand out.
    remaining_ev = float(distressed_ev)

    waterfall: List[dict] = []

    # Once an unsized claim appears in a rank, every claim in it and below is
    # indeterminate. This latch never resets: it is sticky senior -> junior, by design.
    indeterminate = False

    # Pool consecutive same-rank tranches: absolute priority between ranks,
    # pari-passu (pro-rata) within one. KeyError on a missing seniority_rank, by contract.
    for _rank, group_iter in groupby(tranches, key=lambda t: t["seniority_rank"]):
        group = list(group_iter)
        claims = [t["amount_musd"] for t in group]  # principal ($M); KeyError if absent, by contract

        # A rank is sized only if EVERY pari-passu claim in it is a real positive number.
        # None, 0, a negative or a non-numeric anywhere in the pool trips the cascade.
        if not all(is_finite_number(c) and c > 0 for c in claims):
            indeterminate = True

        if indeterminate:
            # Unknown claim at or above this rank -> recovery cannot be stated.
            # Null a non-finite echo too: `{**tranche}` would otherwise carry a NaN
            # amount straight into the payload (the BE2-1 raw-NaN class) even though
            # every COMPUTED field is already guarded.
            for tranche in group:
                row = {**tranche, "recovery_musd": None, "recovery_pct": None}
                if not is_finite_number(row.get("amount_musd")):
                    row["amount_musd"] = None
                waterfall.append(row)
            continue

        # Pari-passu pool: total claim at this rank, guarded > 0 so the pro-rata never
        # divides by zero (every claim is a positive finite number by the check above).
        rank_claim = sum(claims)
        for tranche, claim in zip(group, claims):
            # Each member's share of the value reaching this rank, pro-rata by claim,
            # capped at its own claim. The cap only bites when remaining_ev >= rank_claim
            # (the whole rank is made whole).
            recovery = (min(claim, remaining_ev * claim / rank_claim)
                        if remaining_ev > 0 and rank_claim > 0 else 0.0)
            waterfall.append({
                **tranche,  # fresh dict: preserve every original key, never mutate the input
                "recovery_musd": round(recovery, 1),
                # Recovery rate on THIS tranche's own claim. round(x, 1) is banker's
                # (half-even) rounding over the float repr -- e.g. 250/800 = 31.25 -> 31.2.
                "recovery_pct": round(100 * recovery / claim, 1),
            })

        # The full rank claim leaves the pie even if only partly satisfied; remaining
        # value is floored at 0 so it can never go negative. Juniors split what is left.
        remaining_ev = max(0.0, remaining_ev - rank_claim)

    return waterfall


def _distressed_ev(cp1: Optional[ModulePayload]) -> Optional[float]:
    nf = (cp1.runtime_output or {}).get("normalized_financials", {}) if cp1 is not None else {}
    eb = latest(nf.get("adj_ebitda") or {})
    # Require a POSITIVE EBITDA: a loss-making issuer has no positive going-concern
    # EV to distribute, and `eb` alone (truthy) would pass a negative through to a
    # nonsensical "-$500M distressed EV" figure in the payload. Degrade to
    # seniority-only (None), exactly as the eb == 0 case already does.
    return round(eb * _DISTRESS_EV_MULTIPLE, 1) if is_finite_number(eb) and eb > 0 else None


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
    # (It still claims pari-passu in the distress waterfall, where a revolver is assumed
    # drawn — so total_debt_musd and the waterfall claims can legitimately differ.)
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

    # Preference: highest expected recovery first; seniority breaks ties (and
    # orders the rows when no EV is available to score recovery).
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
    # Disclose the pari-passu assumption only when it actually bit — i.e. two or more
    # tranches shared a seniority rank (duplicate rank in the found stack).
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
        claims=[ClaimSpec(
            claim_id="C-CAP1",
            claim_text=(f"Recovery preference across {len(found)} tranche(s): {pref_txt}"
                        + (f"; {waterfall_basis}." if waterfall_basis else ".")),
            evidence=[EvidenceSpec(
                f"E-CAP-{i}", "quoted_text", "Directly Sourced",
                "Agreement / offering disclosure (ingested chunk)", "High",
                resolved_chunk_id=t["chunk_id"]) for i, t in enumerate(found)],
        )],
    )
