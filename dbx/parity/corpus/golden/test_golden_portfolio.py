"""Golden-master drift alarm for the deterministic portfolio engine.

Freezes ``engine.portfolio.compute_exposure`` / ``check_constraints`` output on the
real Test CLO I holdings (``test_clo_positions.json`` — 381 CLO positions parsed
off the uploaded Holdings sheet's ``Holdings`` par column). Any future change to
the aggregation math must be confirmed correct and the GOLDEN values re-frozen —
a silent numeric drift fails here.

Note: these are the *holdings-authoritative* figures ($763M par / 381 / 349), which
by design differ from the user's exposure CSV ($634M / 383 / 350) — a different
snapshot. The engine computes the true posture from the current holdings.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SERVER_DIR = HERE.parents[2] / "server"
sys.path.insert(0, str(SERVER_DIR))

from engine import portfolio as pf  # noqa: E402

POSITIONS = json.loads((HERE / "test_clo_positions.json").read_text())

GOLDEN = {
    "n_positions": 381,
    "n_obligors": 349,
    "n_sectors": 54,
    "total_par": 763000000.0,
    "total_nav": 755090650.0,
    "warf": 2405.0,
    "wa_rating": "B",
    "wa_margin": 300.539,
    "wa_price": 99.037,
    "first_lien_pct": 99.13,
    "top10_pct_nav": 8.48,
    "single_name_obligor": "Cushman & Wakefield US Borrower LLC",
    "single_name_pct": 1.06,
    "top_sector": "Commercial Support Services",
    "top_sector_pct": 11.72,
    "rating_dist": {"IG": 2.91, "BB": 22.02, "B": 71.15, "CCC": 0.34, "Unrated": 3.58},
}


def test_golden_exposure_no_drift():
    ex = pf.compute_exposure(POSITIONS)
    for k in ("n_positions", "n_obligors", "n_sectors", "total_par", "total_nav", "warf",
              "wa_rating", "wa_margin", "wa_price", "first_lien_pct", "top10_pct_nav"):
        assert ex[k] == GOLDEN[k], f"{k}: {ex[k]} != {GOLDEN[k]}"
    assert ex["single_name_max"]["obligor"] == GOLDEN["single_name_obligor"]
    assert ex["single_name_max"]["pct_nav"] == GOLDEN["single_name_pct"]
    assert ex["sectors"][0]["sector"] == GOLDEN["top_sector"]
    assert ex["sectors"][0]["pct_nav"] == GOLDEN["top_sector_pct"]
    assert {r["bucket"]: r["pct_nav"] for r in ex["rating_dist"]} == GOLDEN["rating_dist"]


def test_golden_compliance_on_real_book():
    """Compliance status computed against the real exposure — the parameter-aware
    mapping (min-1L vs max-2L; largest vs Nth-largest sector) on live data."""
    ex = pf.compute_exposure(POSITIONS)
    cons = [
        {"code": "C-01", "category": "Single Name", "parameter": "Max single issuer exposure",
         "limit_text": "≤ 2.5% NAV", "limit_value": 2.5, "limit_op": "<="},
        {"code": "C-06", "category": "Sector", "parameter": "Max single sector (largest)",
         "limit_text": "≤ 10.0% NAV", "limit_value": 10.0, "limit_op": "<="},
        {"code": "C-09", "category": "Instrument", "parameter": "Min 1st Lien / Senior Secured",
         "limit_text": "≥ 90.0% NAV", "limit_value": 90.0, "limit_op": ">="},
        {"code": "C-10", "category": "Instrument", "parameter": "Max 2nd Lien / Unsecured",
         "limit_text": "≤ 10.0% NAV", "limit_value": 10.0, "limit_op": "<="},
    ]
    comp = {r["code"]: r for r in pf.check_constraints(cons, ex)}
    assert comp["C-01"]["current"] == 1.06 and comp["C-01"]["status"] == "Pass"
    # HealthCare/Commercial-Support largest sector 11.72% > 10% cap → a real breach.
    assert comp["C-06"]["current"] == 11.72 and comp["C-06"]["status"] == "Breach"
    assert comp["C-09"]["current"] == 99.13 and comp["C-09"]["status"] == "Pass"
    # 2nd lien = 100 − 99.13 = 0.87%, NOT the 1st-lien figure.
    assert comp["C-10"]["current"] == 0.87 and comp["C-10"]["status"] == "Pass"
