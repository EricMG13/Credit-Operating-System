"""Regression guards for reconcile_adjusted_ebitda's divisions.

Locks the defensive fixes from the engine NaN/zero-division sweep:
  * pct >= 1 (add-backs claim >=100% of EBITDA) -> ebitda_excl <= 0 -> would
    crash on nd / ebitda_excl. The LLM path bounds pct to (0,1); the regex
    fallback does not, so this is reachable. Now returns None.
  * NaN/non-finite leverage or net debt -> None (not a NaN-poisoned payload).
  * The normal path is unchanged.
"""

from __future__ import annotations

import asyncio

import pytest

import engine.adjusted as adj
from engine.schemas import ModulePayload


def _cp1(lev, nd, ebitda=None):
    nf = {"net_leverage_adj_ltm": lev, "net_debt_ltm": nd}
    if ebitda is not None:
        nf["adj_ebitda"] = {"LTM_Q1_26": ebitda}
    return ModulePayload("CP-1", "", "canonical_financials", {"normalized_financials": nf})


async def _retrieve(q, k):
    return []


def _stub_addbacks(monkeypatch, res):
    async def fake(retrieve):
        return res
    monkeypatch.setattr(adj, "extract_addbacks", fake)


def test_full_addback_pct_does_not_divide_by_zero(monkeypatch):
    # pct = 1.0 -> ebitda_excl = ebitda * 0 = 0 -> nd / 0 would crash. Now None.
    _stub_addbacks(monkeypatch, (1.0, ["all"], "c0", True))
    cp1 = _cp1(5.0, 500.0, ebitda=100.0)
    assert asyncio.run(adj.reconcile_adjusted_ebitda(cp1, _retrieve)) is None


def test_over_full_addback_pct_is_none(monkeypatch):
    # pct > 1 -> ebitda_excl < 0 -> non-sensical excl leverage. Now None.
    _stub_addbacks(monkeypatch, (1.5, ["all"], "c0", True))
    cp1 = _cp1(5.0, 500.0, ebitda=100.0)
    assert asyncio.run(adj.reconcile_adjusted_ebitda(cp1, _retrieve)) is None


def test_nan_leverage_returns_none(monkeypatch):
    _stub_addbacks(monkeypatch, (0.2, ["synergies"], "c0", True))
    cp1 = _cp1(float("nan"), 500.0, ebitda=100.0)
    assert asyncio.run(adj.reconcile_adjusted_ebitda(cp1, _retrieve)) is None


def test_normal_reconciliation_unchanged(monkeypatch):
    _stub_addbacks(monkeypatch, (0.2, ["synergies"], "c0", True))
    cp1 = _cp1(5.0, 500.0, ebitda=100.0)
    res = asyncio.run(adj.reconcile_adjusted_ebitda(cp1, _retrieve))
    assert res is not None
    recon, _claim = res
    # EBITDA 100, excl add-backs 80 -> 500/80 = 6.25x vs 5.0x reported, 1.25-turn gap.
    assert recon["ebitda_excl_addbacks"] == 80.0
    assert recon["leverage_excl_addbacks"] == 6.25
    assert recon["leverage_gap_turns"] == 1.25
