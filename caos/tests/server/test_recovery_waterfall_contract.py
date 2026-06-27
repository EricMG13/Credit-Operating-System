"""Golden-master contract for engine.capstructure.recovery_waterfall.

Captured from the live function at git e797760 and carried through the best-of-N
rewrite that landed candidate c6 (domain-legible). These freeze the exact
observable behaviour so a future "cleaner" rewrite cannot silently change the
math. Every expected value is real output, not aspiration.

Contract crux a rewrite MUST keep:
  1. Absolute-priority cascade in LIST ORDER. The function does NOT sort; it
     ignores ``seniority_rank`` — the caller pre-orders senior->junior.
  2. Each sized tranche recovers ``min(claim, remaining)``; consumed claim
     reduces ``remaining``, floored at 0 (never negative).
  3. ``recovery_pct`` denominator is the tranche's own ``amount_musd`` (claim).
  4. Rounding is Python ``round(x, 1)`` — banker's/half-even over the float
     representation. 250/800 = 31.25 -> 31.2, NOT 31.3. Do not swap in Decimal.
  5. A non-positive/non-numeric ``amount_musd`` (None, 0, negative) sets a sticky
     BREAK: that tranche AND every tranche after it get None/None.
  6. ``distressed_ev`` is coerced with ``float()``; negative/zero EV -> 0.0.
  7. Output rows are fresh dicts preserving ALL original keys plus the two
     recovery keys; the input is never mutated.
  8. INCIDENTAL: a missing ``amount_musd`` key raises KeyError (asserted so a
     future defensive change is a conscious choice, not an accident).
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
def test_recovery_waterfall_golden(name, tranches, ev, expected):
    assert recovery_waterfall(tranches, ev) == expected


def test_does_not_mutate_input():
    tranches = [_t("RCF", 0, 200.0), _t("1L", 1, 800.0)]
    before = [dict(t) for t in tranches]
    recovery_waterfall(tranches, 500.0)
    assert tranches == before


def test_ignores_seniority_rank_uses_list_order():
    rows = recovery_waterfall(
        [_t("JUNIOR", 99, 200.0), _t("SENIOR", 0, 800.0)], 200.0)
    assert rows[0]["code"] == "JUNIOR" and rows[0]["recovery_pct"] == 100.0
    assert rows[1]["code"] == "SENIOR" and rows[1]["recovery_pct"] == 0.0


def test_missing_amount_key_raises_keyerror():
    """Incidental but pinned: indexing t['amount_musd'] raises on a missing key."""
    with pytest.raises(KeyError):
        recovery_waterfall([{"code": "X", "seniority_rank": 0}], 100.0)
