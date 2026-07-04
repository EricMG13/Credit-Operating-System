"""Contract for engine.capstructure.recovery_waterfall.

Every expected value here is derived from the credit model directly, NOT pinned
from a prior implementation — the waterfall models absolute priority BETWEEN
seniority ranks and pari-passu (pro-rata by claim) sharing WITHIN a rank, so the
old strict-list-order golden master would have frozen a known bug (two first-lien
classes recovering 100%/20% instead of splitting the collateral 60%/60%).

Contract crux an implementation MUST keep:
  1. Claims are pooled by CONSECUTIVE seniority_rank. The function does NOT re-sort;
     the caller pre-orders senior->junior and keeps equal ranks adjacent. Absolute
     priority applies BETWEEN ranks (a senior rank is satisfied before any junior
     rank recovers a cent); within a rank the members are pari-passu.
  2. A rank with total claim S facing remaining value R hands each member
     ``min(claim, R * claim / S)`` and then reduces R by the FULL S, floored at 0
     (never negative). A single-member rank collapses to ``min(claim, R)`` — the
     strict-priority special case.
  3. Pari-passu members recover at the SAME rate regardless of claim size (their
     recovery_pct is equal until the rank is made whole).
  4. ``recovery_pct`` denominator is the tranche's own ``amount_musd`` (claim).
  5. Rounding is Python ``round(x, 1)`` — banker's/half-even over the float
     representation. 250/800 = 31.25 -> 31.2, NOT 31.3. Do not swap in Decimal.
  6. A non-positive/non-numeric ``amount_musd`` (None, 0, negative) anywhere in a
     rank sets a sticky BREAK: that WHOLE rank AND every rank after it get
     None/None (a pool whose total is unknown cannot be split pro-rata, and value
     reaching juniors behind it is unknowable).
  7. ``distressed_ev`` is coerced with ``float()``; negative/zero EV -> 0.0.
  8. Output rows are fresh dicts preserving ALL original keys plus the two
     recovery keys; the input is never mutated.
  9. INCIDENTAL: a missing ``amount_musd`` or ``seniority_rank`` key raises
     KeyError (asserted so a future defensive change is a conscious choice).
"""

from __future__ import annotations

import pytest

from engine.capstructure import recovery_waterfall


def _t(code, rank, amt):
    return {"code": code, "seniority_rank": rank, "amount_musd": amt, "extra": "keepme"}


def _row(code, rank, amt, musd, pct):
    return {"code": code, "seniority_rank": rank, "amount_musd": amt,
            "extra": "keepme", "recovery_musd": musd, "recovery_pct": pct}


CASES = [
    # --- pari-passu within a rank (the corrected behaviour) ---
    # Two first-lien classes at rank 0 split 600 of value pro-rata: 60%/60%, NOT 100%/20%.
    ("pari_equal_split_600",
     [_t("1L", 0, 500.0), _t("SSN", 0, 500.0)], 600.0,
     [_row("1L", 0, 500.0, 300.0, 60.0),
      _row("SSN", 0, 500.0, 300.0, 60.0)]),
    # EV exceeds the pooled claim -> both made whole (the min() cap bites).
    ("pari_full_recovery",
     [_t("1L", 0, 500.0), _t("SSN", 0, 500.0)], 1200.0,
     [_row("1L", 0, 500.0, 500.0, 100.0),
      _row("SSN", 0, 500.0, 500.0, 100.0)]),
    # Uneven claims still recover at the SAME rate — the pari-passu invariant.
    ("pari_uneven_claims_same_rate",
     [_t("1L", 0, 750.0), _t("SSN", 0, 250.0)], 500.0,
     [_row("1L", 0, 750.0, 375.0, 50.0),
      _row("SSN", 0, 250.0, 125.0, 50.0)]),
    # EV exactly equals the pooled claim -> 100% each, nothing left for juniors.
    ("pari_boundary_ev_eq_pool",
     [_t("1L", 0, 500.0), _t("SSN", 0, 500.0)], 1000.0,
     [_row("1L", 0, 500.0, 500.0, 100.0),
      _row("SSN", 0, 500.0, 500.0, 100.0)]),
    # Pari-passu senior rank consumes the pie; the junior rank is wiped.
    ("pari_then_junior_wiped",
     [_t("1L", 0, 500.0), _t("SSN", 0, 500.0), _t("2L", 1, 400.0)], 600.0,
     [_row("1L", 0, 500.0, 300.0, 60.0),
      _row("SSN", 0, 500.0, 300.0, 60.0),
      _row("2L", 1, 400.0, 0.0, 0.0)]),
    # Senior rank made whole, junior rank splits the residual (200/300 = 66.7%).
    ("pari_junior_gets_residual",
     [_t("1L", 0, 400.0), _t("SSN", 0, 400.0), _t("2L", 1, 300.0)], 1000.0,
     [_row("1L", 0, 400.0, 400.0, 100.0),
      _row("SSN", 0, 400.0, 400.0, 100.0),
      _row("2L", 1, 300.0, 200.0, 66.7)]),
    # One unsized member breaks the WHOLE rank (its sized peer goes None too) and juniors.
    ("pari_unsized_member_breaks_rank",
     [_t("1L", 0, 500.0), _t("SSN", 0, None), _t("2L", 1, 200.0)], 1000.0,
     [_row("1L", 0, 500.0, None, None),
      _row("SSN", 0, None, None, None),
      _row("2L", 1, 200.0, None, None)]),
    ("pari_zero_member_breaks_rank",
     [_t("1L", 0, 500.0), _t("SSN", 0, 0.0)], 1000.0,
     [_row("1L", 0, 500.0, None, None),
      _row("SSN", 0, 0.0, None, None)]),

    # --- distinct ranks: single-member pools behave as strict absolute priority ---
    ("typical_full_recovery",
     [_t("RCF", 0, 200.0), _t("1L", 1, 800.0), _t("2L", 3, 200.0)], 1000.0,
     [_row("RCF", 0, 200.0, 200.0, 100.0),
      _row("1L", 1, 800.0, 800.0, 100.0),
      _row("2L", 3, 200.0, 0.0, 0.0)]),
    ("partial_recovery_500",
     [_t("RCF", 0, 200.0), _t("1L", 1, 800.0)], 500.0,
     [_row("RCF", 0, 200.0, 200.0, 100.0),
      _row("1L", 1, 800.0, 300.0, 37.5)]),
    ("boundary_ev_eq_senior",
     [_t("RCF", 0, 200.0), _t("1L", 1, 800.0)], 200.0,
     [_row("RCF", 0, 200.0, 200.0, 100.0),
      _row("1L", 1, 800.0, 0.0, 0.0)]),
    ("ev_zero",
     [_t("RCF", 0, 200.0), _t("1L", 1, 800.0)], 0.0,
     [_row("RCF", 0, 200.0, 0.0, 0.0),
      _row("1L", 1, 800.0, 0.0, 0.0)]),
    ("ev_negative",
     [_t("RCF", 0, 200.0), _t("1L", 1, 800.0)], -50.0,
     [_row("RCF", 0, 200.0, 0.0, 0.0),
      _row("1L", 1, 800.0, 0.0, 0.0)]),
    ("ev_int_coercion",
     [_t("RCF", 0, 100.0)], 250,
     [_row("RCF", 0, 100.0, 100.0, 100.0)]),
    ("unsized_senior_breaks",
     [_t("RCF", 0, 200.0), _t("1L", 1, None), _t("2L", 3, 200.0)], 1000.0,
     [_row("RCF", 0, 200.0, 200.0, 100.0),
      _row("1L", 1, None, None, None),
      _row("2L", 3, 200.0, None, None)]),
    ("zero_amount_breaks",
     [_t("RCF", 0, 200.0), _t("1L", 1, 0.0), _t("2L", 3, 200.0)], 1000.0,
     [_row("RCF", 0, 200.0, 200.0, 100.0),
      _row("1L", 1, 0.0, None, None),
      _row("2L", 3, 200.0, None, None)]),
    ("negative_amount_breaks",
     [_t("RCF", 0, 200.0), _t("1L", 1, -100.0), _t("2L", 3, 200.0)], 1000.0,
     [_row("RCF", 0, 200.0, 200.0, 100.0),
      _row("1L", 1, -100.0, None, None),
      _row("2L", 3, 200.0, None, None)]),
    ("empty", [], 1000.0, []),
    # ROUNDING half-even, the killer case: 250/800 = 31.25 -> round = 31.2.
    ("rounding_halfeven_3125",
     [_t("1L", 1, 800.0)], 250.0,
     [_row("1L", 1, 800.0, 250.0, 31.2)]),
    ("rounding_pct_third",
     [_t("X", 0, 3.0)], 1.0,
     [_row("X", 0, 3.0, 1.0, 33.3)]),
    ("rounding_pct_625",
     [_t("X", 0, 80.0)], 50.0,
     [_row("X", 0, 80.0, 50.0, 62.5)]),
    ("rounding_musd_third",
     [_t("X", 0, 1000.0)], 333.333,
     [_row("X", 0, 1000.0, 333.3, 33.3)]),
    ("extreme_large",
     [_t("RCF", 0, 1e9), _t("1L", 1, 5e8)], 2e9,
     [_row("RCF", 0, 1e9, 1e9, 100.0),
      _row("1L", 1, 5e8, 5e8, 100.0)]),
    ("extreme_tiny",
     [_t("X", 0, 0.0001)], 1.0,
     [_row("X", 0, 0.0001, 0.0, 100.0)]),
]


@pytest.mark.parametrize("name,tranches,ev,expected", CASES, ids=[c[0] for c in CASES])
def test_recovery_waterfall(name, tranches, ev, expected):
    assert recovery_waterfall(tranches, ev) == expected


def test_does_not_mutate_input():
    tranches = [_t("RCF", 0, 200.0), _t("1L", 1, 800.0)]
    before = [dict(t) for t in tranches]
    recovery_waterfall(tranches, 500.0)
    assert tranches == before


def test_distinct_ranks_cascade_in_list_order():
    """Distinct ranks are separate pools cascaded in LIST order — no re-sort. The
    listed-first tranche has priority even when its seniority_rank is numerically
    junior; equal adjacent ranks would instead pool pari-passu (see pari_* cases)."""
    rows = recovery_waterfall(
        [_t("JUNIOR", 99, 200.0), _t("SENIOR", 0, 800.0)], 200.0)
    assert rows[0]["code"] == "JUNIOR" and rows[0]["recovery_pct"] == 100.0
    assert rows[1]["code"] == "SENIOR" and rows[1]["recovery_pct"] == 0.0


def test_missing_amount_key_raises_keyerror():
    """Incidental but pinned: indexing t['amount_musd'] raises on a missing key."""
    with pytest.raises(KeyError):
        recovery_waterfall([{"code": "X", "seniority_rank": 0}], 100.0)


def test_missing_seniority_rank_raises_keyerror():
    """Incidental but pinned: the groupby key needs seniority_rank on every tranche."""
    with pytest.raises(KeyError):
        recovery_waterfall([{"code": "X", "amount_musd": 100.0}], 100.0)
