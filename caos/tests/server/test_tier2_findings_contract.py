"""Characterization + regression contract for the 5 CP-5 quality-gate
``*_finding`` functions, batched. Trip conditions were probe-verified against
the live functions; the cases marked FIX freeze the corrected behaviour from an
adversarial audit (workflow wzkak4tta) that confirmed 8 bugs across 4 of them.

A Finding flags a QA issue for analyst review; None means "no issue". A FALSE
NEGATIVE (None when it should flag) and a CRASH (a finding fn raising aborts the
whole CP-5 run, persisting zero findings) are the dangerous failures here.

Bugs closed (locked below):
  - leverage_plausibility_finding: divided the tolerance by signed ``lev`` -> every
    NEGATIVE asserted leverage (net-cash issuer) and any sign-flip silently
    escaped the MATERIAL cross-check. Fixed to abs(lev).
  - reconciliation_finding: a str pct/gap raised TypeError (failed the run); a NaN
    rendered "nan%" committee text; a negative pct was suppressed. Fixed with an
    is_finite_number guard + abs(pct).
  - monitoring_finding / peer_outlier_finding: a non-str list element crashed the
    join and aborted the run; a bare-string signal rendered "d e c l i n e d".
    Fixed with str()-coercion (+ a bare-string guard on monitoring).
"""

from __future__ import annotations

import pytest

from engine.adjusted import reconciliation_finding
from engine.earnings import monitoring_finding
from engine.metrics import leverage_plausibility_finding
from engine.peers import peer_outlier_finding
from engine.covenants import covlite_finding
from engine.schemas import ModulePayload

_NAN = float("nan")


def _trip(r):
    """Severity string if a Finding fired, else None."""
    return None if r is None else r.severity


def _mp(ro):
    return ModulePayload("CP-X", "X", "owned", ro)


# ── leverage_plausibility_finding (MATERIAL) ──────────────────────────────────
def _lev(lev, nd, eb):
    return _mp({"normalized_financials": {"net_leverage_adj_ltm": lev,
               "net_debt_ltm": nd, "adj_ebitda": {"LTM": eb}}})


LEV_CASES = [
    ("none_payload", None, None),
    ("consistent_within_band", _lev(5.68, 2391.0, 421.0), None),   # 2391/421=5.68
    ("positive_disagree", _lev(5.0, 2000.0, 200.0), "MATERIAL"),   # 10.0 vs 5.0
    ("boundary_within_5pct", _lev(9.6, 2000.0, 200.0), None),      # 10 vs 9.6 = 4.2%
    ("just_over_5pct", _lev(9.4, 2000.0, 200.0), "MATERIAL"),      # 10 vs 9.4 = 6.4%
    # FIX: net-cash issuer (negative leverage) grossly inconsistent -> now flags
    ("neg_lev_disagree_FIX", _lev(-5.0, -200.0, 200.0), "MATERIAL"),  # -1.0 vs -5.0
    # FIX: sign-flip (asserted net-cash, recomputed positively levered) -> flags
    ("sign_flip_FIX", _lev(-5.0, 100.0, 20.0), "MATERIAL"),        # +5.0 vs -5.0
    ("neg_lev_consistent", _lev(-5.0, -1000.0, 200.0), None),      # -5.0 vs -5.0
    ("missing_net_debt", _lev(5.0, None, 200.0), None),
    ("zero_ebitda_no_crash", _lev(5.0, 2000.0, 0.0), None),
    ("zero_lev", _lev(0.0, 2000.0, 200.0), None),
    ("nan_lev", _lev(_NAN, 2000.0, 200.0), None),
]


@pytest.mark.parametrize("name,cp1,expected", LEV_CASES, ids=[c[0] for c in LEV_CASES])
def test_leverage_plausibility(name, cp1, expected):
    assert _trip(leverage_plausibility_finding(cp1)) == expected


# ── reconciliation_finding (MINOR) ────────────────────────────────────────────
def _rec(pct, gap):
    return _mp({"adjusted_ebitda_reconciliation": {
        "addback_pct": pct, "leverage_gap_turns": gap,
        "leverage_excl_addbacks": 6.0, "leverage_current": 5.5}})


REC_CASES = [
    ("none_payload", None, None),
    ("recon_absent", _mp({}), None),
    ("fields_none", _rec(None, None), None),
    ("both_immaterial", _rec(0.05, 0.2), None),
    ("pct_material", _rec(0.25, 0.1), "MINOR"),
    ("gap_material_negative", _rec(0.05, -0.9), "MINOR"),     # abs(gap) counts
    ("pct_at_threshold", _rec(0.10, 0.0), "MINOR"),           # strict < -> 0.10 material
    ("gap_at_threshold", _rec(0.05, 0.5), "MINOR"),
    # FIX: str pct/gap no longer crash the run -> degrade to None
    ("str_pct_no_crash_FIX", _rec("0.25", 0.2), None),
    ("str_gap_no_crash_FIX", _rec(0.05, "0.9"), None),
    # FIX: NaN no longer renders "nan%" text -> None
    ("nan_pct_FIX", _rec(_NAN, 0.2), None),
    ("nan_gap_FIX", _rec(0.2, _NAN), None),
    # FIX: negative add-back pct judged on magnitude (abs) -> flags
    ("neg_pct_material_FIX", _rec(-0.30, 0.1), "MINOR"),
]


@pytest.mark.parametrize("name,cp1,expected", REC_CASES, ids=[c[0] for c in REC_CASES])
def test_reconciliation(name, cp1, expected):
    assert _trip(reconciliation_finding(cp1)) == expected


# ── peer_outlier_finding (MINOR, pass-through) ────────────────────────────────
PEER_CASES = [
    ("none_payload", None, None),
    ("runtime_none", _mp(None), None),
    ("missing_key", _mp({"peer_scope": "BB peers"}), None),
    ("empty_outliers", _mp({"outlier_metrics": []}), None),
    ("single_outlier", _mp({"outlier_metrics": ["Net Leverage"], "peer_scope": "BB peers"}), "MINOR"),
    ("multi_outlier", _mp({"outlier_metrics": ["Net Leverage", "FCF/Debt"]}), "MINOR"),
    # FIX: a non-str element no longer crashes the join / aborts the run
    ("nonstr_element_no_crash_FIX", _mp({"outlier_metrics": ["lev", None]}), "MINOR"),
]


@pytest.mark.parametrize("name,cp1,expected", PEER_CASES, ids=[c[0] for c in PEER_CASES])
def test_peer_outlier(name, cp1, expected):
    assert _trip(peer_outlier_finding(cp1)) == expected


# ── covlite_finding (MINOR, flag) — no bugs; case-sensitivity is by design ─────
COV_CASES = [
    ("none_payload", None, None),
    ("cov_lite_exact", _mp({"covenant_structure": "cov-lite"}), "MINOR"),
    ("maintenance", _mp({"covenant_structure": "maintenance"}), None),
    ("missing_key", _mp({"calculations": []}), None),
    ("empty_runtime", _mp({}), None),
    ("runtime_none", _mp(None), None),
    ("wrong_case_by_design", _mp({"covenant_structure": "Cov-Lite"}), None),
    ("trailing_space_by_design", _mp({"covenant_structure": "cov-lite "}), None),
]


@pytest.mark.parametrize("name,cp1,expected", COV_CASES, ids=[c[0] for c in COV_CASES])
def test_covlite(name, cp1, expected):
    assert _trip(covlite_finding(cp1)) == expected


# ── monitoring_finding (MINOR, pass-through) ──────────────────────────────────
MON_CASES = [
    ("none_payload", None, None),
    ("empty_runtime", _mp({}), None),
    ("missing_key", _mp({"summary": {}}), None),
    ("empty_signals", _mp({"monitoring_signals": []}), None),
    ("signals_none", _mp({"monitoring_signals": None}), None),
    ("single_signal", _mp({"monitoring_signals": ["Revenue -8% YoY"]}), "MINOR"),
    ("multi_signal", _mp({"monitoring_signals": ["Rev -8%", "Margin -3pp"]}), "MINOR"),
    ("falsy_scalar", _mp({"monitoring_signals": 0}), None),
    # FIX: a non-str element no longer crashes the join / aborts the run
    ("nonstr_element_no_crash_FIX", _mp({"monitoring_signals": [{"m": "x"}, 5]}), "MINOR"),
    # FIX: a bare string is treated as one signal, not char-split
    ("bare_string_FIX", _mp({"monitoring_signals": "declined"}), "MINOR"),
]


@pytest.mark.parametrize("name,cp1,expected", MON_CASES, ids=[c[0] for c in MON_CASES])
def test_monitoring(name, cp1, expected):
    assert _trip(monitoring_finding(cp1)) == expected


# ── targeted text assertions for the join/format fixes ────────────────────────
def test_monitoring_bare_string_not_char_split():
    r = monitoring_finding(_mp({"monitoring_signals": "declined"}))
    assert r.description == "Monitoring signals: declined"


def test_peer_and_monitoring_coerce_nonstr_without_crash():
    # both must produce a Finding (string description), never raise
    assert "None" in peer_outlier_finding(_mp({"outlier_metrics": ["lev", None]})).description
    assert monitoring_finding(_mp({"monitoring_signals": [5]})).description == "Monitoring signals: 5"
