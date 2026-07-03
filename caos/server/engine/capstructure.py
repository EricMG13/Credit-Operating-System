"""CP-3B RecoveryInstrumentPreference — rank the debt stack by expected recovery.

Two steps, both deterministic:
  1. Scan retrieved agreement / offering chunks (the idiom of [legal.py]) for the
     tranches that make up the capital structure (RCF, 1L, 2L, secured/unsecured
     notes, sub), ordered by seniority. Each tranche is evidence-traced to the
     chunk it was named in.
  2. Run an absolute-priority recovery waterfall over those tranches against a
     distressed enterprise value (a multiple of CP-1 LTM EBITDA), giving an
     expected recovery % per tranche and a preference ranking (most-preferred =
     highest expected recovery). No LLM; degrades to a seniority-only read when
     no agreement text is ingested or CP-1 supplies no EBITDA.

ponytail: flat distressed EV = 5.0x LTM EBITDA, strict absolute priority, no
fees/super-priority/structural-subordination haircut. Refine the multiple per
sector (or take a CP-2B distressed-EBITDA input) if recovery precision matters.
"""

from __future__ import annotations

import re
from typing import List, Optional, Tuple

from engine.periods import is_finite_number, latest
from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload
from engine.textscan import amount_musd, scan

_QUERY = "term loan revolving credit facility senior secured notes second lien subordinated capital structure"

# Distressed enterprise value assumed for the waterfall, as a multiple of LTM EBITDA.
_DISTRESS_EV_MULTIPLE = 5.0

# (label, tranche code, seniority rank [lower = more senior], pattern).
_TRANCHES: Tuple[Tuple[str, str, int, str], ...] = (
    ("Revolving credit facility", "RCF", 0, r"revolving credit facilit|\brcf\b|revolver"),
    ("First-lien term loan", "1L", 1, r"first[-\s]lien|term loan b\b|\btlb\b"),
    ("Senior secured notes", "SSN", 2, r"senior secured note"),
    ("Second-lien term loan", "2L", 3, r"second[-\s]lien|\b2l\b"),
    ("Senior unsecured notes", "SUN", 4, r"senior unsecured note|senior note"),
    ("Subordinated notes", "SUB", 5, r"subordinat"),
)


def scan_tranches(chunks: List[Tuple[str, str]]) -> List[dict]:
    """Detect each tranche (once) with its size when stated, most-senior first."""
    found = [{"tranche": label, "code": code, "seniority_rank": rank,
              "amount_musd": amount_musd(text, re.compile(pattern, re.IGNORECASE)), "chunk_id": cid}
             for (label, code, rank, pattern), cid, text in scan(chunks, _TRANCHES, key=1)]
    found.sort(key=lambda t: t["seniority_rank"])
    return found


def recovery_waterfall(tranches: List[dict], distressed_ev: float) -> List[dict]:
    """Run the absolute-priority recovery waterfall over a distressed enterprise value.

    Credit reading (what an analyst is verifying line by line):

    - ``distressed_ev`` is the *recovery enterprise value*: the whole pie a creditor
      committee has to split in a distress/restructuring scenario (upstream this is
      roughly 5x LTM EBITDA). It is the only value that ever gets distributed.
    - The ``tranches`` list arrives already ordered senior -> junior (the caller sorts
      on ``seniority_rank``). The *absolute priority rule* then applies in that order:
      a senior claim must be paid in full before any junior claim recovers a cent.
      This function trusts the incoming order and does NOT re-sort.
    - Each tranche's *claim* is its principal outstanding, ``amount_musd`` ($M). Walking
      senior -> junior we hand each tranche ``min(claim, value still on the table)`` and
      shrink the remaining value by the full claim. ``recovery_pct`` is that tranche's
      own recovery divided by its own claim -- cents on the dollar for THAT tranche, not
      for the structure.
    - An *unsized* senior tranche (claim unknown) makes everything below it
      indeterminate: if we don't know how much a senior layer absorbs, we cannot know
      how much value reaches the juniors behind it. So that tranche and ALL juniors are
      reported as null (None) rather than guessed. Crediting juniors against the full
      remaining EV -- as if the unsized senior claimed nothing -- would systematically
      over-state their recovery; refusing to guess is the conservative, defensible read.

    Worked check (RCF 200, 1L 800, 2L 200 against EV 1000): RCF takes 200 (100%),
    1L takes 800 (100%), 0 is left, 2L recovers 0 (0%) -- the 2L is wiped, as expected
    when senior claims (1000) exactly consume the pie (1000).
    """
    # Total value available to distribute, narrowed as senior claims are satisfied.
    # float() coerces ints/strings; a non-positive EV simply leaves nothing to hand out.
    remaining_ev = float(distressed_ev)

    waterfall: List[dict] = []

    # Once an unsized senior claim appears, every junior recovery is indeterminate.
    # This latch never resets: it is sticky senior -> junior, by design.
    indeterminate = False

    for tranche in tranches:
        claim = tranche["amount_musd"]  # principal outstanding ($M); KeyError if absent, by contract

        # A claim is "sized" only if it is a real positive number. None, 0, a negative,
        # or a non-numeric all count as unsized and trip the indeterminate cascade.
        claim_is_sized = is_finite_number(claim) and claim > 0
        if not claim_is_sized:
            indeterminate = True

        if indeterminate:
            # Unknown senior claim above (or at) this tranche -> recovery cannot be stated.
            # Null a non-finite echo too: `{**tranche}` would otherwise carry a NaN
            # amount straight into the payload (the BE2-1 raw-NaN class) even though
            # every COMPUTED field is already guarded.
            row = {**tranche, "recovery_musd": None, "recovery_pct": None}
            if not is_finite_number(row.get("amount_musd")):
                row["amount_musd"] = None
            waterfall.append(row)
            continue

        # Absolute priority: this tranche takes the lesser of its claim and what is left.
        recovery = min(claim, remaining_ev) if remaining_ev > 0 else 0.0

        # The full claim is removed from the pie even if it was only partly satisfied;
        # remaining value is floored at 0 so it can never go negative.
        remaining_ev = max(0.0, remaining_ev - claim)

        waterfall.append({
            **tranche,  # fresh dict: preserve every original key, never mutate the input
            "recovery_musd": round(recovery, 1),
            # Recovery rate on THIS tranche's own claim. round(x, 1) is banker's
            # (half-even) rounding over the float repr -- e.g. 250/800 = 31.25 -> 31.2.
            "recovery_pct": round(100 * recovery / claim, 1),
        })

    return waterfall


def _distressed_ev(cp1: Optional[ModulePayload]) -> Optional[float]:
    nf = (cp1.runtime_output or {}).get("normalized_financials", {}) if cp1 is not None else {}
    eb = latest(nf.get("adj_ebitda") or {})
    return round(eb * _DISTRESS_EV_MULTIPLE, 1) if is_finite_number(eb) and eb else None


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
    sized = [t for t in found if is_finite_number(t["amount_musd"])]
    total = round(sum(t["amount_musd"] for t in sized), 1) if sized else None
    for t in found:
        t["pct_of_structure"] = (round(100 * t["amount_musd"] / total, 1)
                                 if total and is_finite_number(t["amount_musd"]) else None)

    ev = _distressed_ev(cp1)
    waterfall_basis = (f"absolute-priority waterfall vs ${ev:g}M distressed EV "
                       f"({_DISTRESS_EV_MULTIPLE:g}x LTM EBITDA)") if ev else None
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
