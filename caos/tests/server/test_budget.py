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


def test_cost_telemetry_prefers_provider_cost_and_never_guesses_unknown_models():
    provider_usage = SimpleNamespace(
        input_tokens=10,
        output_tokens=5,
        cache_read_input_tokens=0,
        cache_creation_input_tokens=0,
        cost=0.000123,
    )
    assert budget._estimated_cost(provider_usage, "deepseek/deepseek-v4-pro") == pytest.approx(0.000123)

    unknown = SimpleNamespace(
        input_tokens=10,
        output_tokens=5,
        cache_read_input_tokens=0,
        cache_creation_input_tokens=0,
    )
    assert budget._estimated_cost(unknown, "future-provider/model") is None
    assert budget._estimated_cost(unknown, "claude-opus-4-8") == pytest.approx(
        (10 * 5 + 5 * 25) / 1_000_000
    )


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


# ── H-1: per-run budget is cumulative across re-claims, not per-attempt ───────
@pytest.mark.asyncio
async def test_execute_run_rehydrates_budget_from_prior_attempt(seeded_db):
    """A re-claimed run must carry its prior token spend, not reset to 0 — else
    run_token_budget caps each attempt separately and a flapping run bills N×."""
    from database import AsyncSessionLocal, Run
    from run_executor import execute_run_by_id

    async with AsyncSessionLocal() as s:
        run = Run(issuer_id=REFERENCE_ISSUER_ID, analyst_id="t", tokens_used=5000)
        s.add(run)
        await s.commit()
        run_id = run.id

    await execute_run_by_id(run_id)  # fixture synth spends 0 more tokens

    async with AsyncSessionLocal() as s:
        run = await s.get(Run, run_id)
        assert run.status == "complete"
        # Before the fix the budget restarted at 0 and overwrote tokens_used → 0.
        assert run.tokens_used == 5000, "prior-attempt spend was reset (H-1 regression)"


@pytest.mark.asyncio
async def test_failed_attempt_persists_token_spend(seeded_db, monkeypatch):
    """When an attempt fails mid-run, the tokens it already spent must survive the
    mark-failed rollback, so the next re-claim resumes the budget rather than
    granting a fresh full one."""
    from database import AsyncSessionLocal, Run
    import run_executor

    async def spend_then_boom(session, run):
        budget.set_budget(budget.RunBudget(limit=120000, used=run.tokens_used or 0))
        budget.current_budget().record(7000, 0)  # this attempt spent 7000
        raise RuntimeError("died mid-run")

    monkeypatch.setattr(run_executor, "execute_run", spend_then_boom)

    async with AsyncSessionLocal() as s:
        run = Run(issuer_id=REFERENCE_ISSUER_ID, analyst_id="t")
        s.add(run)
        await s.commit()
        run_id = run.id

    try:
        await run_executor.execute_run_by_id(run_id)
        async with AsyncSessionLocal() as s:
            run = await s.get(Run, run_id)
            assert run.status == "failed"
            # Before the fix the rollback in _mark_run_failed discarded this spend.
            assert run.tokens_used == 7000, "failed-attempt spend was lost (H-1 regression)"
    finally:
        budget.set_budget(None)  # don't leak the contextvar into other tests
