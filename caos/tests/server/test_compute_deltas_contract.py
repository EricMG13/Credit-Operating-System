"""Characterization + regression contract for engine.earnings.compute_deltas.

Trip values probe-verified against the live function; carried through the
best-of-N rewrite that landed candidate c6 (domain-legible) with a NARROW NaN
guard grafted at row construction. Freezes the "what changed" math AND the fix.

Crux: ebitda_margin = round(100*e/r, 1) iff r numeric & truthy & e numeric (else
None; r truthy is the ÷0 guard; negative r -> negative margin). *_growth_pct via
_yoy over the last two numeric periods (None if prev falsy). margin_change_pp =
round(last_margin - prior_margin, 1) — percentage POINTS, distinct from the
percent growth. signals in order rev/eb/margin; compress at margin_change <= -1.0.

NaN fix (locked): a non-finite NUMBER (NaN/inf) is dropped to None at row build,
so it never leaks into margin / growth / margin_change. A non-numeric placeholder
like "n/a" is NOT a float and is left untouched (skipped downstream as before).
"""

from __future__ import annotations

import pytest

from engine.earnings import compute_deltas

_NAN = float("nan")
_INF = float("inf")


def _nf(rev, eb):
    return {"revenue": rev, "adj_ebitda": eb}


def _row(p, r, e, m):
    return {"period": p, "revenue": r, "adj_ebitda": e, "ebitda_margin": m}


def _sum(rg, eg, mc, lp, pp):
    return {"revenue_growth_pct": rg, "ebitda_growth_pct": eg, "margin_change_pp": mc,
            "latest_period": lp, "prior_period": pp}


def _out(rows, summary, signals):
    return {"periods": rows, "summary": summary, "monitoring_signals": signals}


CASES = [
    ("growth_2p", _nf({"FY23": 100.0, "FY24": 120.0}, {"FY23": 20.0, "FY24": 30.0}),
     _out([_row("FY23", 100.0, 20.0, 20.0), _row("FY24", 120.0, 30.0, 25.0)],
          _sum(20.0, 50.0, 5.0, "FY24", "FY23"), [])),
    ("decline_2p", _nf({"FY23": 100.0, "FY24": 90.0}, {"FY23": 25.0, "FY24": 20.0}),
     _out([_row("FY23", 100.0, 25.0, 25.0), _row("FY24", 90.0, 20.0, 22.2)],
          _sum(-10.0, -20.0, -2.8, "FY24", "FY23"),
          ["Revenue declined 10% YoY (FY23→FY24).",
           "Adjusted EBITDA declined 20% YoY (FY23→FY24).",
           "EBITDA margin compressed 2.8pp YoY."])),
    ("single_period", _nf({"FY24": 100.0}, {"FY24": 20.0}),
     _out([_row("FY24", 100.0, 20.0, 20.0)], _sum(None, None, None, "FY24", None), [])),
    ("empty", {}, _out([], _sum(None, None, None, None, None), [])),
    ("no_revenue_key", {"adj_ebitda": {"FY23": 20.0, "FY24": 22.0}},
     _out([_row("FY23", None, 20.0, None), _row("FY24", None, 22.0, None)],
          _sum(None, 10.0, None, "FY24", "FY23"), [])),
    ("zero_revenue_margin_none", _nf({"FY23": 0.0, "FY24": 100.0}, {"FY23": 5.0, "FY24": 20.0}),
     _out([_row("FY23", 0.0, 5.0, None), _row("FY24", 100.0, 20.0, 20.0)],
          _sum(None, 300.0, None, "FY24", "FY23"), [])),
    ("prev_zero_yoy_none", _nf({"FY23": 0.0, "FY24": 100.0}, {"FY23": 0.0, "FY24": 20.0}),
     _out([_row("FY23", 0.0, 0.0, None), _row("FY24", 100.0, 20.0, 20.0)],
          _sum(None, None, None, "FY24", "FY23"), [])),
    ("three_periods", _nf({"FY22": 80.0, "FY23": 100.0, "FY24": 90.0},
                          {"FY22": 16.0, "FY23": 25.0, "FY24": 20.0}),
     _out([_row("FY22", 80.0, 16.0, 20.0), _row("FY23", 100.0, 25.0, 25.0),
           _row("FY24", 90.0, 20.0, 22.2)],
          _sum(-10.0, -20.0, -2.8, "FY24", "FY23"),
          ["Revenue declined 10% YoY (FY23→FY24).",
           "Adjusted EBITDA declined 20% YoY (FY23→FY24).",
           "EBITDA margin compressed 2.8pp YoY."])),
    ("margin_compress_exactly_1pp", _nf({"FY23": 100.0, "FY24": 100.0}, {"FY23": 21.0, "FY24": 20.0}),
     _out([_row("FY23", 100.0, 21.0, 21.0), _row("FY24", 100.0, 20.0, 20.0)],
          _sum(0.0, -4.8, -1.0, "FY24", "FY23"),
          ["Adjusted EBITDA declined 4.8% YoY (FY23→FY24).",
           "EBITDA margin compressed 1pp YoY."])),
    # non-numeric placeholder LEFT UNTOUCHED in the row (the case c4 broke)
    ("mixed_nonnumeric", _nf({"FY23": "n/a", "FY24": 120.0}, {"FY23": 20.0, "FY24": 30.0}),
     _out([_row("FY23", "n/a", 20.0, None), _row("FY24", 120.0, 30.0, 25.0)],
          _sum(None, 50.0, None, "FY24", "FY23"), [])),
    ("negative_revenue", _nf({"FY23": -100.0, "FY24": -120.0}, {"FY23": 20.0, "FY24": 30.0}),
     _out([_row("FY23", -100.0, 20.0, -20.0), _row("FY24", -120.0, 30.0, -25.0)],
          _sum(20.0, 50.0, -5.0, "FY24", "FY23"),
          ["EBITDA margin compressed 5pp YoY."])),
    ("rounding_margin", _nf({"FY23": 300.0, "FY24": 700.0}, {"FY23": 100.0, "FY24": 200.0}),
     _out([_row("FY23", 300.0, 100.0, 33.3), _row("FY24", 700.0, 200.0, 28.6)],
          _sum(133.3, 100.0, -4.7, "FY24", "FY23"),
          ["EBITDA margin compressed 4.7pp YoY."])),
    # FIX: NaN revenue -> dropped to None; no NaN in margin / revenue_growth / margin_change
    ("nan_revenue_to_none", _nf({"FY23": 100.0, "FY24": _NAN}, {"FY23": 20.0, "FY24": 30.0}),
     _out([_row("FY23", 100.0, 20.0, 20.0), _row("FY24", None, 30.0, None)],
          _sum(None, 50.0, None, "FY24", "FY23"), [])),
    # FIX: NaN ebitda -> dropped to None
    ("nan_ebitda_to_none", _nf({"FY23": 100.0, "FY24": 120.0}, {"FY23": 20.0, "FY24": _NAN}),
     _out([_row("FY23", 100.0, 20.0, 20.0), _row("FY24", 120.0, None, None)],
          _sum(20.0, None, None, "FY24", "FY23"), [])),
    # FIX: inf likewise dropped
    ("inf_revenue_to_none", _nf({"FY23": 100.0, "FY24": _INF}, {"FY23": 20.0, "FY24": 30.0}),
     _out([_row("FY23", 100.0, 20.0, 20.0), _row("FY24", None, 30.0, None)],
          _sum(None, 50.0, None, "FY24", "FY23"), [])),
]


@pytest.mark.parametrize("name,nf,expected", CASES, ids=[c[0] for c in CASES])
def test_compute_deltas_golden(name, nf, expected):
    assert compute_deltas(nf) == expected


def test_nan_never_leaks_into_summary():
    d = compute_deltas(_nf({"FY23": 100.0, "FY24": _NAN}, {"FY23": 20.0, "FY24": _NAN}))
    vals = [d["periods"][-1]["ebitda_margin"], d["summary"]["revenue_growth_pct"],
            d["summary"]["ebitda_growth_pct"], d["summary"]["margin_change_pp"]]
    assert all(v is None for v in vals)  # no NaN survives anywhere
