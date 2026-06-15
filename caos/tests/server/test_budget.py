"""Per-run token budget: the RunBudget primitives, usage accrual, and the
enforcement seam — when the budget is spent, an LLM module degrades to its
deterministic path instead of making the call.
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

import engine.adjusted as adj
from config import get_settings
from engine import budget
from conftest import wait_for_run
from engine.fixtures import REFERENCE_ISSUER_ID


def _retrieve():
    async def retrieve(query, k=6):
        return [SimpleNamespace(
            chunk_id="c-om",
            text="Adjusted EBITDA add-backs represent 18.2 percent of adjusted EBITDA.")]
    return retrieve


# ── Primitives ───────────────────────────────────────────────────────────────
def test_run_budget_primitives():
    b = budget.RunBudget(limit=100)
    assert not b.exhausted() and b.remaining() == 100
    b.record(60, 30)
    assert b.used == 90 and not b.exhausted()
    b.record(20)
    assert b.exhausted() and b.remaining() == 0
    assert budget.RunBudget(limit=0).remaining() is None  # unlimited


def test_record_usage_and_llm_allowed():
    b = budget.RunBudget(limit=120)
    budget.set_budget(b)
    try:
        assert budget.llm_allowed() is True
        budget.record_usage(SimpleNamespace(usage=SimpleNamespace(input_tokens=100, output_tokens=50)))
        assert b.used == 150
        assert budget.llm_allowed() is False  # over the 120 cap
    finally:
        budget.set_budget(None)
    assert budget.llm_allowed() is True  # no budget set → always allowed


# ── Enforcement seam (no real LLM; _llm_addbacks is monkeypatched) ───────────
def test_exhausted_budget_skips_llm_and_falls_back(monkeypatch):
    called = {"llm": False}

    async def fake_llm(retrieve):
        called["llm"] = True
        return (0.99, [], "llm")

    monkeypatch.setattr(adj, "_llm_addbacks", fake_llm)
    s = get_settings()
    prev = s.anthropic_api_key
    s.anthropic_api_key = "x"  # would normally take the LLM path
    try:
        async def go():
            budget.set_budget(budget.RunBudget(limit=10, used=10))  # exhausted
            return await adj.extract_addbacks(_retrieve())
        res = asyncio.run(go())
        assert called["llm"] is False                  # the budget gate prevented the call
        assert res[0] == pytest.approx(0.182)          # deterministic regex used instead
    finally:
        s.anthropic_api_key = prev
        budget.set_budget(None)


def test_remaining_budget_allows_llm(monkeypatch):
    async def fake_llm(retrieve):
        return (0.25, ["synergies"], "llm")

    monkeypatch.setattr(adj, "_llm_addbacks", fake_llm)
    s = get_settings()
    prev = s.anthropic_api_key
    s.anthropic_api_key = "x"
    try:
        async def go():
            budget.set_budget(budget.RunBudget(limit=1000, used=0))  # room left
            return await adj.extract_addbacks(_retrieve())
        res = asyncio.run(go())
        assert res[0] == pytest.approx(0.25)  # LLM path used
    finally:
        s.anthropic_api_key = prev
        budget.set_budget(None)


# ── Integration: a fixture run spends no tokens ──────────────────────────────
def test_fixture_run_records_zero_tokens():
    from fastapi.testclient import TestClient
    from main import app

    with TestClient(app) as c:
        run = wait_for_run(c, c.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID}).json()["id"])
        got = c.get(f"/api/runs/{run['id']}").json()
        assert got["tokens_used"] == 0
