"""Regression guard from the 2026-07-04 engine-math correctness audit.

capstructure._distressed_ev: a NEGATIVE LTM adj-EBITDA must degrade to None
(seniority-only), not publish a "-$500M distressed EV" figure. The old guard
`is_finite_number(eb) and eb` passed a nonzero negative through. Reachable for
the loss-making / distressed population CP-3B is scored on.

(The sibling liquidity negative-runway passthrough surfaced by the same audit is
NOT changed here — it is a deliberate, golden-master-pinned design choice; see
test_interest_runway_contract.py 'cov_negative' / 'liq_negative'. Flagged for the
methodology owner rather than overridden.)
"""
from __future__ import annotations

from types import SimpleNamespace

from engine.capstructure import _distressed_ev


def _cp1(**nf):
    return SimpleNamespace(runtime_output={"normalized_financials": nf})


def test_distressed_ev_positive_ebitda_scales_5x():
    assert _distressed_ev(_cp1(adj_ebitda={"LTM": 100.0})) == 500.0


def test_distressed_ev_negative_ebitda_degrades_to_none():
    # loss-making issuer: no positive going-concern EV to distribute
    assert _distressed_ev(_cp1(adj_ebitda={"LTM": -100.0})) is None


def test_distressed_ev_zero_ebitda_degrades_to_none():
    assert _distressed_ev(_cp1(adj_ebitda={"LTM": 0.0})) is None
