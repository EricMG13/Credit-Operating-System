"""Characterization + regression contract for engine.relval.build_scorecard.

Trip values probe-verified against the live function; carried through the
best-of-N rewrite that landed candidate c6 (domain-legible) with c4's one-line
NaN/inf filter grafted (the bug was a run-aborting crash, not a silent leak).

Crux: None when no comparison carries a finite numeric percentile. composite =
round(mean) -> INT, banker's rounding (58.5 -> 58, the band-boundary killer).
recommendation: composite >= 60 OVERWEIGHT; < 40 UNDERWEIGHT; else NEUTRAL
(exact 60 -> OW, exact 40 -> NEUTRAL). scorecard preserves each percentile's
value AND type (int/float/bool); optional fields via .get -> None. peer_scope
default "peers".

NaN fix (locked): a NaN/inf percentile is a float that passed the old isinstance
filter, so round(sum/len) raised ValueError and aborted the CP-3 run. Now filtered
via is_finite_number (which still accepts bool/int/0/float), so a NaN is treated
as unscored.
"""

from __future__ import annotations

import pytest

from engine.relval import build_scorecard

_NAN = float("nan")
_INF = float("inf")


def _c(pct, **extra):
    d = {"percentile": pct}
    d.update(extra)
    return d


def _sc(pct, metric=None, label=None, iv=None, pm=None):
    return {"metric": metric, "label": label, "percentile": pct,
            "issuer_value": iv, "peer_median": pm}


def _out(scorecard, composite, rec, n, scope="peers"):
    return {"scorecard": scorecard, "composite_percentile": composite,
            "recommendation": rec, "metrics_scored": n, "peer_scope": scope}


CASES = [
    ("three_ow",
     {"comparisons": [_c(70.0, metric="lev", label="Net Leverage", issuer_value=5.0, peer_median=6.0),
                      _c(80.0, metric="cov"), _c(90.0)], "peer_scope": "BB peers"},
     _out([_sc(70.0, "lev", "Net Leverage", 5.0, 6.0), _sc(80.0, "cov"), _sc(90.0)],
          80, "OVERWEIGHT", 3, "BB peers")),
    ("single_neutral", {"comparisons": [_c(55.0)]}, _out([_sc(55.0)], 55, "NEUTRAL", 1)),
    ("uw", {"comparisons": [_c(30.0), _c(35.0)]}, _out([_sc(30.0), _sc(35.0)], 32, "UNDERWEIGHT", 2)),
    ("empty_comparisons", {"comparisons": []}, None),
    ("no_comparisons_key", {"peer_scope": "x"}, None),
    ("none_numeric", {"comparisons": [_c("n/a"), _c(None)]}, None),
    ("mixed_numeric", {"comparisons": [_c(70.0), _c("n/a"), _c(90.0)]},
     _out([_sc(70.0), _sc(90.0)], 80, "OVERWEIGHT", 2)),
    ("boundary_ow_60", {"comparisons": [_c(60.0)]}, _out([_sc(60.0)], 60, "OVERWEIGHT", 1)),
    ("boundary_uw_40", {"comparisons": [_c(40.0)]}, _out([_sc(40.0)], 40, "NEUTRAL", 1)),
    ("boundary_39_uw", {"comparisons": [_c(39.0)]}, _out([_sc(39.0)], 39, "UNDERWEIGHT", 1)),
    ("boundary_59_neutral", {"comparisons": [_c(59.0)]}, _out([_sc(59.0)], 59, "NEUTRAL", 1)),
    ("round_595_to_60", {"comparisons": [_c(59.0), _c(60.0)]},
     _out([_sc(59.0), _sc(60.0)], 60, "OVERWEIGHT", 2)),
    ("round_585_to_58", {"comparisons": [_c(58.0), _c(59.0)]},
     _out([_sc(58.0), _sc(59.0)], 58, "NEUTRAL", 2)),       # banker's: NOT 59
    ("round_395_to_40", {"comparisons": [_c(39.0), _c(40.0)]},
     _out([_sc(39.0), _sc(40.0)], 40, "NEUTRAL", 2)),
    ("int_percentiles", {"comparisons": [_c(70), _c(80)]},
     _out([_sc(70), _sc(80)], 75, "OVERWEIGHT", 2)),
    ("bool_percentile", {"comparisons": [_c(True), _c(False)]},
     _out([_sc(True), _sc(False)], 0, "UNDERWEIGHT", 2)),    # is_finite_number accepts bool
    ("default_scope", {"comparisons": [_c(70.0)]}, _out([_sc(70.0)], 70, "OVERWEIGHT", 1)),
    # FIX: NaN/inf percentile filtered as unscored (was: ValueError aborting the run)
    ("nan_filtered", {"comparisons": [_c(_NAN), _c(80.0)]},
     _out([_sc(80.0)], 80, "OVERWEIGHT", 1)),
    ("inf_filtered", {"comparisons": [_c(_INF), _c(70.0)]},
     _out([_sc(70.0)], 70, "OVERWEIGHT", 1)),
    ("all_nan_none", {"comparisons": [_c(_NAN), _c(_INF)]}, None),
]


@pytest.mark.parametrize("name,rt,expected", CASES, ids=[c[0] for c in CASES])
def test_build_scorecard_golden(name, rt, expected):
    assert build_scorecard(rt) == expected


def test_nan_percentile_no_longer_crashes():
    """The run-aborting ValueError is gone: a NaN is filtered, not fed to round()."""
    r = build_scorecard({"comparisons": [{"percentile": _NAN}, {"percentile": 80.0}]})
    assert r is not None and r["composite_percentile"] == 80 and r["metrics_scored"] == 1
