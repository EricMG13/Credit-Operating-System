"""Golden-master contract for engine.macro.compute_rate_sensitivity.

Captured from the live function at git e797760+, carried through the best-of-N
rewrite that landed candidate c6 (domain-legible) with c4's `_finite` NaN/inf
guard grafted on. Freezes the exact observable behaviour so a future rewrite
cannot silently change the rate-shock math, the cov=0 asymmetry, or a guard.

Contract crux a rewrite MUST keep:
  1. Returns None iff net_debt_ltm is not a finite number, OR latest(adj_ebitda)
     is not a finite number, OR EBITDA is falsy (0).
  2. base_interest = round(EBITDA / coverage, 1) only when coverage is numeric,
     finite & truthy; else None.
  3. ASYMMETRY: base_interest_coverage = ``cov if isinstance(cov, num) else None``
     — no truthiness check. cov == 0 (finite) -> base_interest_musd None but
     base_interest_coverage 0. (A NaN/inf coverage maps to None via the grafted
     _finite guard — NaN is not a usable ratio.)
  4. Two shocks (100, 200) bps. incremental = round(net_debt*bps/10000, 1) [1dp];
     new_interest = round(base_interest + incremental, 1) (None if base None);
     stressed = round(EBITDA / new_interest, 2) [2dp] (None if new_interest falsy).
     Intermediates are rounded BEFORE reuse.
  5. No sign guard on outputs: negative net_debt -> negative incremental (coverage
     IMPROVES); negative EBITDA -> negative base_interest.
  6. NaN/inf in net_debt / EBITDA / coverage all degrade safely (grafted fix).
  7. Rounding is Python round() — half-even over the float repr.
"""

from __future__ import annotations

import pytest

from engine.macro import compute_rate_sensitivity

_ASSUMPTION = "Assumes 100% floating-rate and unhedged (no hedge register ingested)."
_NAN = float("nan")
_INF = float("inf")


def _nf(net_debt=2000.0, cov=2.0, eb=400.0, eb_dict=None):
    d = {}
    if net_debt is not None:
        d["net_debt_ltm"] = net_debt
    if cov is not None:
        d["interest_coverage_ltm"] = cov
    d["adj_ebitda"] = eb_dict if eb_dict is not None else (
        {"LTM_Q1_26": eb} if eb is not None else {})
    return d


def _scen(bps, add, cov):
    return {"rate_shock_bps": bps, "incremental_interest_musd": add,
            "stressed_interest_coverage": cov}


def _out(net_debt_musd, base_int, base_cov, scenarios):
    return {"net_debt_musd": net_debt_musd, "base_interest_musd": base_int,
            "base_interest_coverage": base_cov, "scenarios": scenarios,
            "assumption": _ASSUMPTION}


CASES = [
    ("typical", _nf(),
     _out(2000.0, 200.0, 2.0, [_scen(100, 20.0, 1.82), _scen(200, 40.0, 1.67)])),
    ("no_net_debt", _nf(net_debt=None), None),
    ("net_debt_str", _nf(net_debt="2000"), None),
    ("eb_zero", _nf(eb=0.0), None),
    ("eb_empty", _nf(eb_dict={}), None),
    ("cov_missing", _nf(cov=None),
     _out(2000.0, None, None, [_scen(100, 20.0, None), _scen(200, 40.0, None)])),
    ("cov_str", _nf(cov="2"),
     _out(2000.0, None, None, [_scen(100, 20.0, None), _scen(200, 40.0, None)])),
    # ASYMMETRY: finite 0 coverage -> base_interest_musd None BUT base_interest_coverage 0
    ("cov_zero", _nf(cov=0),
     _out(2000.0, None, 0, [_scen(100, 20.0, None), _scen(200, 40.0, None)])),
    ("net_debt_negative", _nf(net_debt=-2000.0),
     _out(-2000.0, 200.0, 2.0, [_scen(100, -20.0, 2.22), _scen(200, -40.0, 2.5)])),
    ("eb_negative", _nf(eb=-400.0),
     _out(2000.0, -200.0, 2.0, [_scen(100, 20.0, 2.22), _scen(200, 40.0, 2.5)])),
    ("small_net_debt_add_rounding", _nf(net_debt=37.0, cov=2.1, eb=421.0),
     _out(37.0, 200.5, 2.1, [_scen(100, 0.4, 2.1), _scen(200, 0.7, 2.09)])),
    ("rounding_add", _nf(net_debt=2550.0),
     _out(2550.0, 200.0, 2.0, [_scen(100, 25.5, 1.77), _scen(200, 51.0, 1.59)])),
    ("rounding_chain", _nf(net_debt=1234.0, cov=3.0, eb=421.0),
     _out(1234.0, 140.3, 3.0, [_scen(100, 12.3, 2.76), _scen(200, 24.7, 2.55)])),
    ("base_interest_rounds", _nf(net_debt=2000.0, cov=2.1, eb=421.0),
     _out(2000.0, 200.5, 2.1, [_scen(100, 20.0, 1.91), _scen(200, 40.0, 1.75)])),
    ("net_debt_int", _nf(net_debt=2000),
     _out(2000.0, 200.0, 2.0, [_scen(100, 20.0, 1.82), _scen(200, 40.0, 1.67)])),
    ("multi_period_eb", _nf(eb_dict={"FY22": 999.0, "FY24": 100.0, "LTM_Q1_26": 400.0}),
     _out(2000.0, 200.0, 2.0, [_scen(100, 20.0, 1.82), _scen(200, 40.0, 1.67)])),
    ("extreme_large", _nf(net_debt=1e7, cov=2.0, eb=2e6),
     _out(1e7, 1e6, 2.0, [_scen(100, 1e5, 1.82), _scen(200, 2e5, 1.67)])),
    # NaN/inf hardening (grafted _finite guard)
    ("nan_net_debt", _nf(net_debt=_NAN), None),
    ("inf_net_debt", _nf(net_debt=_INF), None),
    ("nan_ebitda", _nf(eb_dict={"LTM_Q1_26": _NAN}), None),
    # NaN/inf coverage -> coverage treated as absent (base None, base_cov None)
    ("nan_coverage", _nf(cov=_NAN),
     _out(2000.0, None, None, [_scen(100, 20.0, None), _scen(200, 40.0, None)])),
    ("inf_coverage", _nf(cov=_INF),
     _out(2000.0, None, None, [_scen(100, 20.0, None), _scen(200, 40.0, None)])),
]


@pytest.mark.parametrize("name,nf,expected", CASES, ids=[c[0] for c in CASES])
def test_rate_sensitivity_golden(name, nf, expected):
    assert compute_rate_sensitivity(nf) == expected


def test_always_two_scenarios_at_100_200_bps():
    s = compute_rate_sensitivity(_nf())
    assert [x["rate_shock_bps"] for x in s["scenarios"]] == [100, 200]
