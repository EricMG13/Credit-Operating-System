"""Golden-master contract for engine.liquidity._interest_runway_months.

Captured from the live function at git e797760+, carried through the best-of-N
rewrite that landed candidate c6 (domain-legible) with c4's `_finite_number`
NaN/inf guard grafted on. Freezes the exact observable behaviour so a future
rewrite cannot silently change the runway math or drop a guard.

Contract crux a rewrite MUST keep:
  1. Always returns a 2-tuple ``(annual_cash_interest_musd, months)`` or
     ``(None, None)``. cash_interest = ``round(latest(adj_ebitda)/coverage, 1)``;
     months = ``round(liquidity*12/cash_interest, 1)``.
  2. months divides by the ALREADY-ROUNDED cash_interest, not raw eb/cov.
     Killer: eb=10, cov=3 -> cash_interest=round(3.333,1)=3.3; liq=100 ->
     months=round(100*12/3.3,1)=363.6 (a raw-denominator rewrite gives 360.0).
  3. Three (None,None) guards: (a) liquidity not a finite number OR cp1 is None;
     (b) latest(adj_ebitda) / coverage not finite numbers OR coverage falsy (0);
     (c) cash_interest rounds to 0.0. Guards (a)/(b) reject NaN/inf (the grafted
     fix: a NaN coverage otherwise survives isinstance + bool(NaN) truthiness and
     poisons the divide).
  4. No guard on OUTPUTS: zero liquidity -> 0.0 months; negative liquidity ->
     negative months; negative coverage -> negative cash_interest & months.
  5. ``latest()`` picks the value at the largest trailing-year period key.
  6. Rounding is Python ``round(x, 1)`` — half-even over the float repr.
"""

from __future__ import annotations

import math

import pytest

from engine.liquidity import _interest_runway_months
from engine.schemas import ModulePayload

_NAN = float("nan")
_INF = float("inf")


def _cp1(eb=421.0, cov=2.1, eb_dict=None, ro="default"):
    if ro == "none":
        return ModulePayload("CP-1", "X", "canonical_financials", None)
    nf = {"interest_coverage_ltm": cov,
          "adj_ebitda": eb_dict if eb_dict is not None
          else {"FY24": eb - 6, "LTM_Q1_26": eb}}
    return ModulePayload("CP-1", "X", "canonical_financials",
                         {"normalized_financials": nf})


CASES = [
    ("typical_500", 500.0, _cp1(), (200.5, 29.9)),
    ("typical_1000", 1000.0, _cp1(), (200.5, 59.9)),
    ("cp1_none", 500.0, None, (None, None)),
    ("liq_none", None, _cp1(), (None, None)),
    ("liq_str", "500", _cp1(), (None, None)),
    ("ro_none", 500.0, _cp1(ro="none"), (None, None)),
    ("cov_zero", 500.0, _cp1(cov=0), (None, None)),
    ("cov_missing", 500.0, _cp1(cov=None), (None, None)),
    ("ebitda_empty", 500.0, _cp1(eb_dict={}), (None, None)),
    ("cash_interest_rounds_zero", 500.0, _cp1(eb=0.04, cov=1.0), (None, None)),
    # months divides by the ROUNDED cash_interest (3.3), not raw 3.333
    ("rounded_denominator", 100.0, _cp1(eb=10.0, cov=3.0), (3.3, 363.6)),
    ("clean_120", 1000.0, _cp1(eb=240.0, cov=2.0), (120.0, 100.0)),
    # sign + zero edges (NO output guard)
    ("liq_zero", 0.0, _cp1(), (200.5, 0.0)),
    ("liq_negative", -500.0, _cp1(), (200.5, -29.9)),
    ("cov_negative", 500.0, _cp1(cov=-2.1), (-200.5, -29.9)),
    ("liq_bool_false", False, _cp1(), (200.5, 0.0)),
    ("ebitda_multi_period", 500.0,
     _cp1(eb_dict={"FY22": 999.0, "FY24": 100.0, "LTM_Q1_26": 421.0}), (200.5, 29.9)),
    ("extreme_large", 1e6, _cp1(eb=5e5, cov=2.0), (250000.0, 48.0)),
    # NaN/inf hardening (grafted _finite_number guard) -> all degrade to (None,None)
    ("nan_coverage", 500.0, _cp1(cov=_NAN), (None, None)),
    ("inf_coverage", 500.0, _cp1(cov=_INF), (None, None)),
    ("nan_ebitda", 500.0, _cp1(eb_dict={"LTM_Q1_26": _NAN}), (None, None)),
    ("nan_liquidity", _NAN, _cp1(), (None, None)),
    ("inf_liquidity", _INF, _cp1(), (None, None)),
]


@pytest.mark.parametrize("name,liq,cp1,expected", CASES, ids=[c[0] for c in CASES])
def test_interest_runway_golden(name, liq, cp1, expected):
    assert _interest_runway_months(liq, cp1) == expected


def test_always_returns_two_tuple():
    for liq, cp1 in [(500.0, _cp1()), (None, None), (500.0, _cp1(cov=0))]:
        r = _interest_runway_months(liq, cp1)
        assert isinstance(r, tuple) and len(r) == 2
