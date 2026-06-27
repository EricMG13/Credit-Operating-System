"""Characterization contract for engine.portfoliofit.assess_fit (CP-3C).

Probe-verified against the live function; carried through the best-of-N rewrite
that landed candidate c6 (domain-legible, comment/docstring-only). No defensive
graft: assess_fit does no division/round, so a NaN leverage is simply not >= 6.0
(no flag, no crash) — there is no latent bug to fix here.

Crux: None when recommendation not in {OVERWEIGHT, NEUTRAL, UNDERWEIGHT}.
sleeve_fit/suggested_sizing from _FIT. One high-leverage flag iff leverage is
numeric AND >= 6.0 (inclusive); {leverage:g} formats 6.0->"6", 6.5->"6.5".
composite_percentile passed through; note constant.
"""

from __future__ import annotations

import pytest

from engine.portfoliofit import assess_fit

_NAN = float("nan")
_NOTE = "Concentration/correlation checks require a portfolio feed (not ingested)."


def _out(sleeve, sizing, rec, composite, flags):
    return {"sleeve_fit": sleeve, "suggested_sizing": sizing, "rv_recommendation": rec,
            "composite_percentile": composite, "risk_flags": flags, "note": _NOTE}


def _flag(g):
    return [f"High leverage ({g}x) — counts against the risk budget."]


CASES = [
    ("ow_high_lev", {"recommendation": "OVERWEIGHT", "composite_percentile": 80}, 7.0,
     _out("core", "full target size", "OVERWEIGHT", 80, _flag("7"))),
    ("neutral_low_lev", {"recommendation": "NEUTRAL", "composite_percentile": 55}, 3.0,
     _out("satellite", "half target size", "NEUTRAL", 55, [])),
    ("uw_no_lev", {"recommendation": "UNDERWEIGHT", "composite_percentile": 32}, None,
     _out("tactical only", "minimal / pass", "UNDERWEIGHT", 32, [])),
    ("rec_missing", {}, 7.0, None),
    ("rec_none", {"recommendation": None}, 7.0, None),
    ("rec_lowercase", {"recommendation": "overweight"}, 7.0, None),
    ("rec_garbage", {"recommendation": "BUY"}, 7.0, None),
    ("lev_exactly_6", {"recommendation": "OVERWEIGHT"}, 6.0,
     _out("core", "full target size", "OVERWEIGHT", None, _flag("6"))),
    ("lev_599_no_flag", {"recommendation": "OVERWEIGHT"}, 5.99,
     _out("core", "full target size", "OVERWEIGHT", None, [])),
    ("lev_int_6", {"recommendation": "OVERWEIGHT"}, 6,
     _out("core", "full target size", "OVERWEIGHT", None, _flag("6"))),
    ("lev_65_format", {"recommendation": "OVERWEIGHT"}, 6.5,
     _out("core", "full target size", "OVERWEIGHT", None, _flag("6.5"))),
    ("lev_nan_no_crash", {"recommendation": "OVERWEIGHT"}, _NAN,
     _out("core", "full target size", "OVERWEIGHT", None, [])),
    ("lev_str_no_flag", {"recommendation": "NEUTRAL"}, "7.0",
     _out("satellite", "half target size", "NEUTRAL", None, [])),
    ("lev_negative_no_flag", {"recommendation": "NEUTRAL"}, -5.0,
     _out("satellite", "half target size", "NEUTRAL", None, [])),
    ("no_composite_key", {"recommendation": "NEUTRAL"}, 3.0,
     _out("satellite", "half target size", "NEUTRAL", None, [])),
]


@pytest.mark.parametrize("name,cp3_rt,lev,expected", CASES, ids=[c[0] for c in CASES])
def test_assess_fit_golden(name, cp3_rt, lev, expected):
    assert assess_fit(cp3_rt, lev) == expected


def test_three_recommendations_map_distinctly():
    sleeves = {assess_fit({"recommendation": r}, None)["sleeve_fit"]
               for r in ("OVERWEIGHT", "NEUTRAL", "UNDERWEIGHT")}
    assert sleeves == {"core", "satellite", "tactical only"}
