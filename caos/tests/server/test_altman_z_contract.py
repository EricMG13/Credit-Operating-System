"""Golden-master contract for engine.distress.altman_z_double_prime.

Captured from the live function at git e797760+, carried through the best-of-N
rewrite that landed candidate c6 (domain-legible) with c4's None/NaN/inf guard
grafted on, HARDENED by an adversarial gap-hunt (mutation isolators + NaN/None
cases), and RE-CAPTURED 2026-07-16 when the erroneous +3.25 EM-Score intercept
was removed (audit 2026-07-10 ENG-1: the constant belongs to Altman's
emerging-markets variant, which is read against bond-rating equivalents — not
the 2.6/1.1 zones; pairing them shifted every issuer ~3.25 toward "safe").
Every expected value below was verified by executing the live function, not
hand-math; boundary/rounding isolators were reconstructed for the no-constant
scale.

Contract crux a rewrite MUST keep:
  1. KEYWORD-ONLY signature, EXACT param names — caller does
     altman_z_double_prime(ebit=ebit, **bs) (edgar_cp1.py:295).
  2. Z'' = 6.56*X1 + 3.26*X2 + 6.72*X3 + 1.05*X4 (NO intercept) ; X1=(CA-CL)/TA,
     X2=RE/TA, X3=EBIT/TA, X4=BE/total_liabilities (NOT /TA). All 4 constants exact.
  3. None iff a denominator <= 0, OR any input None/NaN/inf (grafted guard).
  4. z = round(<formula>, 2) — Python half-even over the float repr (raw 3.775 -> 3.77).
  5. Zone strict: z>2.6 safe, z<1.1 distress, 2.6 and 1.1 are GREY.
"""

from __future__ import annotations

import pytest

from engine.distress import altman_z_double_prime

_NAN = float("nan")
_INF = float("inf")

_CANON = dict(current_assets=1500, current_liabilities=800, total_assets=5000,
              retained_earnings=1000, ebit=300, total_liabilities=3500, book_equity=1500)


CASES = [
    ("canonical", _CANON, (2.42, "grey")),
    ("ta_zero", dict(current_assets=0, current_liabilities=0, total_assets=0,
                     retained_earnings=0, ebit=0, total_liabilities=0, book_equity=0), None),
    ("ta_negative", dict(current_assets=100, current_liabilities=50, total_assets=-5000,
                         retained_earnings=0, ebit=0, total_liabilities=3500, book_equity=0), None),
    ("tl_zero", dict(current_assets=100, current_liabilities=50, total_assets=5000,
                     retained_earnings=0, ebit=0, total_liabilities=0, book_equity=0), None),
    ("tl_negative", dict(current_assets=100, current_liabilities=50, total_assets=5000,
                         retained_earnings=0, ebit=0, total_liabilities=-100, book_equity=0), None),
    # All X-terms zero => Z'' = 0.0 = deep distress. (Under the removed +3.25
    # intercept this used to read 3.25 "safe" — the ENG-1 smoking gun: an issuer
    # with zero equity, zero earnings and zero working capital is not safe.)
    ("all_zero_terms", dict(current_assets=0, current_liabilities=0, total_assets=5000,
                            retained_earnings=0, ebit=0, total_liabilities=3500, book_equity=0),
     (0.0, "distress")),
    ("neg_working_cap", dict(current_assets=200, current_liabilities=900, total_assets=5000,
                             retained_earnings=100, ebit=50, total_liabilities=3500, book_equity=1000),
     (-0.49, "distress")),
    ("distressed", dict(current_assets=300, current_liabilities=900, total_assets=5000,
                        retained_earnings=-2000, ebit=-400, total_liabilities=4800, book_equity=200),
     (-2.59, "distress")),
    ("insolvent_neg_equity", dict(current_assets=300, current_liabilities=900, total_assets=5000,
                                  retained_earnings=-3000, ebit=-500, total_liabilities=6000, book_equity=-1000),
     (-3.59, "distress")),
    # EBIT/TA = 260/672 puts Z'' exactly on the 2.6 boundary -> grey (strict >).
    ("boundary_safe_is_grey", dict(current_assets=0, current_liabilities=0, total_assets=672,
                                   retained_earnings=0, ebit=260, total_liabilities=100, book_equity=0),
     (2.6, "grey")),
    ("grey_mid", dict(current_assets=0, current_liabilities=0, total_assets=672,
                      retained_earnings=0, ebit=180, total_liabilities=100, book_equity=0),
     (1.8, "grey")),
    # EBIT/TA = 110/672 puts Z'' exactly on the 1.1 boundary -> grey (strict <).
    ("boundary_distress_is_grey", dict(current_assets=0, current_liabilities=0, total_assets=672,
                                       retained_earnings=0, ebit=110, total_liabilities=100, book_equity=0),
     (1.1, "grey")),
    ("just_below_distress", dict(current_assets=0, current_liabilities=0, total_assets=672,
                                 retained_earnings=0, ebit=109, total_liabilities=100, book_equity=0),
     (1.09, "distress")),
    ("rounding_sample", dict(current_assets=1234, current_liabilities=567, total_assets=8900,
                             retained_earnings=345, ebit=123, total_liabilities=6700, book_equity=2200),
     (1.06, "distress")),
    ("extreme_large", dict(current_assets=1.5e9, current_liabilities=8e8, total_assets=5e9,
                           retained_earnings=1e9, ebit=3e8, total_liabilities=3.5e9, book_equity=1.5e9),
     (2.42, "grey")),
    ("tiny", dict(current_assets=1.5, current_liabilities=0.8, total_assets=5.0,
                  retained_earnings=1.0, ebit=0.3, total_liabilities=3.5, book_equity=1.5),
     (2.42, "grey")),

    # ── Mutation isolators (adversarial gap-hunt; all values verified live) ──
    ("iso_x2_x3", dict(current_assets=100, current_liabilities=100, total_assets=100,
                       retained_earnings=50, ebit=10, total_liabilities=80, book_equity=0), (2.3, "grey")),
    ("iso_x3_x4", dict(current_assets=100, current_liabilities=100, total_assets=100,
                       retained_earnings=0, ebit=10, total_liabilities=50, book_equity=40), (1.51, "grey")),
    ("iso_x1_x3", dict(current_assets=140, current_liabilities=100, total_assets=100,
                       retained_earnings=0, ebit=5, total_liabilities=80, book_equity=0), (2.96, "safe")),
    ("iso_x1_x2", dict(current_assets=150, current_liabilities=100, total_assets=100,
                       retained_earnings=10, ebit=0, total_liabilities=80, book_equity=0), (3.61, "safe")),
    # raw z = 6.72*377.5/672 = 3.7749999... -> 3.77 (a decimal-HALF_UP rewrite gives 3.78)
    ("rounding_halfeven_3775", dict(current_assets=0, current_liabilities=0, total_assets=672,
                                    retained_earnings=0, ebit=377.5, total_liabilities=100, book_equity=0), (3.77, "safe")),
    # X4 = 5/200 = 0.025; rounding x4 first (0.03) flips 2.6 grey -> 2.61 safe
    ("intermediate_round_boundary", dict(current_assets=10, current_liabilities=10, total_assets=672,
                                         retained_earnings=0, ebit=257.375, total_liabilities=200, book_equity=5), (2.6, "grey")),
    # raw z = 6.72*264.5/672 = 2.645... -> 2.65 safe (round(.,1) gives 2.6 grey)
    ("precision_2dp_not_1dp", dict(current_assets=0, current_liabilities=0, total_assets=672,
                                   retained_earnings=0, ebit=264.5, total_liabilities=100, book_equity=0), (2.65, "safe")),
    # X4 denominator = total_liabilities (not total_assets), TA != TL
    ("x4_denom_is_TL_boundary", dict(current_assets=0, current_liabilities=0, total_assets=300,
                                     retained_earnings=0, ebit=0, total_liabilities=100, book_equity=-100), (-1.05, "distress")),
    ("x4_denom_is_TL_value", dict(current_assets=0, current_liabilities=0, total_assets=100,
                                  retained_earnings=0, ebit=0, total_liabilities=400, book_equity=200), (0.53, "distress")),
    ("x4_denom_is_TL_unit", dict(current_assets=0, current_liabilities=0, total_assets=200,
                                 retained_earnings=0, ebit=0, total_liabilities=100, book_equity=100), (1.05, "distress")),

    # ── NaN/None hardening (grafted guard) -> None ──
    ("nan_total_assets", {**_CANON, "total_assets": _NAN}, None),
    ("nan_book_equity", {**_CANON, "book_equity": _NAN}, None),
    ("inf_ebit", {**_CANON, "ebit": _INF}, None),
    ("none_current_assets", {**_CANON, "current_assets": None}, None),
    ("none_total_liabilities", {**_CANON, "total_liabilities": None}, None),
]


@pytest.mark.parametrize("name,kw,expected", CASES, ids=[c[0] for c in CASES])
def test_altman_z_golden(name, kw, expected):
    assert altman_z_double_prime(**kw) == expected


def test_is_keyword_only():
    with pytest.raises(TypeError):
        altman_z_double_prime(1500, 800, 5000, 1000, 300, 3500, 1500)  # type: ignore


def test_returns_tuple_of_float_and_zone():
    r = altman_z_double_prime(**_CANON)
    assert isinstance(r, tuple) and len(r) == 2
    assert isinstance(r[0], float) and r[1] in ("safe", "grey", "distress")
