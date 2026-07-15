"""Golden-master contract for engine.downside.compute_pathways.

Probe-verified against the live function, carried through the best-of-N rewrite
that landed candidate c6 (domain-legible) with c4's math.isfinite NaN/inf guard
grafted on. Freezes the downside-stress math + fragility ladder.

Crux: stressed_net_leverage = round(lev/(1-s),2) [(1-s) denominator];
stressed_interest_coverage = round(cov*(1-s),2) if cov finite-numeric else None;
ebitda_shock_pct = round(s*100) (int 10/20/30). shock_to_breach_pct = first shock
pct where stressed leverage >= 7.0 (inclusive), else None. fragility = HIGH if
lev>=7.0 OR breach<=10; MODERATE for any later modeled breach; LOW only when no
modeled shock breaches. None iff leverage is
not a finite number (the grafted NaN/inf guard).
"""

from __future__ import annotations

import pytest

from engine.downside import compute_pathways

_NAN = float("nan")
_INF = float("inf")


def _scen(pct, sl, sc):
    return {"ebitda_shock_pct": pct, "stressed_net_leverage": sl,
            "stressed_interest_coverage": sc}


def _out(current, scenarios, shock_to_breach, fragility):
    return {"current_net_leverage": current, "breach_threshold_x": 7.0,
            "scenarios": scenarios, "shock_to_breach_pct": shock_to_breach,
            "fragility": fragility}


CASES = [
    ("canonical", {"net_leverage_adj_ltm": 5.68, "interest_coverage_ltm": 2.1},
     _out(5.68, [_scen(10, 6.31, 1.89), _scen(20, 7.1, 1.68), _scen(30, 8.11, 1.47)], 20, "MODERATE")),
    ("no_lev", {"interest_coverage_ltm": 2.1}, None),
    ("lev_none", {"net_leverage_adj_ltm": None, "interest_coverage_ltm": 2.1}, None),
    ("lev_str", {"net_leverage_adj_ltm": "5.68", "interest_coverage_ltm": 2.1}, None),
    ("lev7_high", {"net_leverage_adj_ltm": 7.0, "interest_coverage_ltm": 2.0},
     _out(7.0, [_scen(10, 7.78, 1.8), _scen(20, 8.75, 1.6), _scen(30, 10.0, 1.4)], 10, "HIGH")),
    ("lev63_breach10", {"net_leverage_adj_ltm": 6.3, "interest_coverage_ltm": 2.0},
     _out(6.3, [_scen(10, 7.0, 1.8), _scen(20, 7.87, 1.6), _scen(30, 9.0, 1.4)], 10, "HIGH")),
    ("lev629_breach20", {"net_leverage_adj_ltm": 6.29, "interest_coverage_ltm": 2.0},
     _out(6.29, [_scen(10, 6.99, 1.8), _scen(20, 7.86, 1.6), _scen(30, 8.99, 1.4)], 20, "MODERATE")),
    ("lev56_breach20", {"net_leverage_adj_ltm": 5.6, "interest_coverage_ltm": 2.0},
     _out(5.6, [_scen(10, 6.22, 1.8), _scen(20, 7.0, 1.6), _scen(30, 8.0, 1.4)], 20, "MODERATE")),
    ("lev50_breach30", {"net_leverage_adj_ltm": 5.0, "interest_coverage_ltm": 2.0},
     _out(5.0, [_scen(10, 5.56, 1.8), _scen(20, 6.25, 1.6), _scen(30, 7.14, 1.4)], 30, "MODERATE")),
    ("lev49_breach30", {"net_leverage_adj_ltm": 4.9, "interest_coverage_ltm": 2.0},
     _out(4.9, [_scen(10, 5.44, 1.8), _scen(20, 6.12, 1.6), _scen(30, 7.0, 1.4)], 30, "MODERATE")),
    ("lev40_nobreach", {"net_leverage_adj_ltm": 4.0, "interest_coverage_ltm": 2.0},
     _out(4.0, [_scen(10, 4.44, 1.8), _scen(20, 5.0, 1.6), _scen(30, 5.71, 1.4)], None, "LOW")),
    ("lev10_high", {"net_leverage_adj_ltm": 10.0, "interest_coverage_ltm": 3.0},
     _out(10.0, [_scen(10, 11.11, 2.7), _scen(20, 12.5, 2.4), _scen(30, 14.29, 2.1)], 10, "HIGH")),
    ("cov_missing", {"net_leverage_adj_ltm": 5.68},
     _out(5.68, [_scen(10, 6.31, None), _scen(20, 7.1, None), _scen(30, 8.11, None)], 20, "MODERATE")),
    ("cov_str", {"net_leverage_adj_ltm": 5.68, "interest_coverage_ltm": "2.1"},
     _out(5.68, [_scen(10, 6.31, None), _scen(20, 7.1, None), _scen(30, 8.11, None)], 20, "MODERATE")),
    ("cov_negative", {"net_leverage_adj_ltm": 5.68, "interest_coverage_ltm": -2.1},
     _out(5.68, [_scen(10, 6.31, -1.89), _scen(20, 7.1, -1.68), _scen(30, 8.11, -1.47)], 20, "MODERATE")),
    ("cov_zero", {"net_leverage_adj_ltm": 5.68, "interest_coverage_ltm": 0.0},
     _out(5.68, [_scen(10, 6.31, 0.0), _scen(20, 7.1, 0.0), _scen(30, 8.11, 0.0)], 20, "MODERATE")),
    # Non-positive leverage → None (Insufficient), NOT a scored pathway: the
    # held-flat-debt algebra is meaningless for net-cash / negative-EBITDA
    # issuers, and the old goldens pinned exactly the bug — a -5x issuer (the
    # most distressed read) scored fragility LOW at High confidence, feeding
    # CP-3D (audit 2026-07-10 ENG-13).
    ("lev_negative", {"net_leverage_adj_ltm": -5.0, "interest_coverage_ltm": 2.0}, None),
    ("lev_zero", {"net_leverage_adj_ltm": 0.0, "interest_coverage_ltm": 2.0}, None),
    ("lev_int", {"net_leverage_adj_ltm": 6, "interest_coverage_ltm": 2},
     _out(6.0, [_scen(10, 6.67, 1.8), _scen(20, 7.5, 1.6), _scen(30, 8.57, 1.4)], 20, "MODERATE")),
    # ── NaN/inf hardening (grafted math.isfinite guard) ──
    ("nan_leverage", {"net_leverage_adj_ltm": _NAN, "interest_coverage_ltm": 2.0}, None),
    ("inf_leverage", {"net_leverage_adj_ltm": _INF, "interest_coverage_ltm": 2.0}, None),
    # NaN/inf coverage -> stressed coverage None per scenario (leverage still scored)
    ("nan_coverage", {"net_leverage_adj_ltm": 5.68, "interest_coverage_ltm": _NAN},
     _out(5.68, [_scen(10, 6.31, None), _scen(20, 7.1, None), _scen(30, 8.11, None)], 20, "MODERATE")),
    ("inf_coverage", {"net_leverage_adj_ltm": 5.68, "interest_coverage_ltm": _INF},
     _out(5.68, [_scen(10, 6.31, None), _scen(20, 7.1, None), _scen(30, 8.11, None)], 20, "MODERATE")),
]


@pytest.mark.parametrize("name,nf,expected", CASES, ids=[c[0] for c in CASES])
def test_compute_pathways_golden(name, nf, expected):
    assert compute_pathways(nf) == expected


def test_shock_pct_is_int():
    pcts = [s["ebitda_shock_pct"] for s in compute_pathways({"net_leverage_adj_ltm": 5.0})["scenarios"]]
    assert pcts == [10, 20, 30] and all(isinstance(p, int) for p in pcts)
