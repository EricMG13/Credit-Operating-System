"""Regression tests for the 2026-07-11 pre-production audit P0 fixes.

Each test FAILS on the pre-fix code and passes after. One check per fix; the
fix's file:line and the audit finding number are in each test's docstring.
"""

from __future__ import annotations

import math
from types import SimpleNamespace

import httpx
import pytest

from engine import budget, llm_client


# ── #2: non-Anthropic fallback must set run.degraded (engine/llm_client.py) ───
@pytest.mark.asyncio
async def test_openrouter_fallback_marks_run_degraded(monkeypatch):
    """A 429 on the primary that survives to a cheaper-model fallback must set the
    run-budget `degraded` flag so runner.py surfaces the "Degraded" banner. Pre-fix
    only the Anthropic path set it; the OpenRouter path (the DEFAULT provider) did
    not — a committee could read a silently-degraded tear-sheet as Committee Ready."""

    async def _noop_trace(*a, **k):
        return None

    monkeypatch.setattr(budget, "trace_llm", _noop_trace)

    calls = {"n": 0}
    sentinel = object()

    async def _fake_call(*, lane, model, **kwargs):
        calls["n"] += 1
        if calls["n"] == 1:  # primary → 429 overload
            req = httpx.Request("POST", "https://openrouter.ai")
            raise httpx.HTTPStatusError(
                "rate limited", request=req, response=httpx.Response(429, request=req)
            )
        return sentinel  # cheaper fallback succeeds

    monkeypatch.setattr("engine.openrouter.call", _fake_call)

    b = budget.RunBudget(limit=0)
    budget.set_budget(b)
    try:
        out = await llm_client._create_openrouter(
            lane="synth", model="deepseek/primary", fallback_model="deepseek/cheap",
            effort=None, system="s", messages=[{"role": "user", "content": "x"}], max_tokens=8,
        )
    finally:
        budget.set_budget(None)

    assert out is sentinel      # fell back to the cheaper model
    assert calls["n"] == 2      # primary raised, fallback ran
    assert b.degraded is True   # ← the fix (gemini path got the identical change)


def test_provider_fallback_is_a_material_cp1_gate_finding():
    from engine.runner import _provider_degradation_finding

    finding = _provider_degradation_finding(True)
    assert finding is not None
    assert finding.module_id == "CP-1"
    assert finding.severity == "MATERIAL"
    assert _provider_degradation_finding(False) is None


# ── #9: provider JSON parse is fail-closed on NaN/Infinity ────────────────────
def test_openrouter_tool_args_reject_non_finite():
    """OpenRouter tool-call arguments carry the CP-1 payload; a NaN in them must not
    survive into the tool input (engine/openrouter.py `_normalize_response`)."""
    from engine.openrouter import _normalize_response

    poisoned = {"choices": [{"finish_reason": "tool_calls", "message": {"tool_calls": [
        {"function": {"name": "emit", "arguments": '{"net_leverage_adj_ltm": NaN}'}}]}}]}
    tool = next(b for b in _normalize_response(poisoned).content if b.type == "tool_use")
    assert tool.input == {}  # NaN args rejected → empty, not a poisoned dict

    finite = {"choices": [{"finish_reason": "tool_calls", "message": {"tool_calls": [
        {"function": {"name": "emit", "arguments": '{"net_leverage_adj_ltm": 5.5}'}}]}}]}
    tool = next(b for b in _normalize_response(finite).content if b.type == "tool_use")
    assert tool.input == {"net_leverage_adj_ltm": 5.5}  # finite still parses


def test_edgar_get_json_rejects_non_finite(monkeypatch):
    """EDGAR JSON feeds financial fields; a NaN literal must fail closed as an
    EdgarError (edgar.py `_get_json`), never parse into a metric."""
    import edgar

    monkeypatch.setattr(edgar, "_http_get", lambda url, **k: b'{"v": NaN}')
    with pytest.raises(edgar.EdgarError):
        edgar._get_json("https://example/x")

    monkeypatch.setattr(edgar, "_http_get", lambda url, **k: b'{"v": 1.5}')
    assert edgar._get_json("https://example/x") == {"v": 1.5}  # finite still parses


# ── #14: safe_div parity — finite operands whose ratio overflows → None ───────
def test_robust_z_overflow_degrades_not_inf():
    """anomaly._robust_z: a small (but positive, normal) MAD with a huge value makes
    the raw z overflow float range with finite operands — must degrade to None, not
    emit ±inf into the anomaly severity ranking (engine/anomaly.py, via safe_div)."""
    from engine.anomaly import _robust_z

    assert _robust_z(1e301, [0.0, 1e-9, 2e-9]) is None  # MAD=1e-9, ratio → inf → None
    med, z = _robust_z(10.0, [1.0, 2.0, 3.0])           # normal spread → finite z
    assert math.isfinite(z) and z == 5.4


def test_macro_rate_sensitivity_overflow_degrades_not_inf():
    """macro.compute_rate_sensitivity: a subnormal coverage denominator makes
    EBITDA/coverage overflow to inf with finite operands — base_interest must be
    None, not inf on the CP-2F tear-sheet (engine/macro.py, via safe_div)."""
    from engine.macro import compute_rate_sensitivity

    out = compute_rate_sensitivity({
        "net_debt_ltm": 2400.0,
        "adj_ebitda": {"LTM": 400.0},
        "interest_coverage_ltm": 1e-308,  # 400 / 1e-308 → inf
    })
    assert out is not None
    assert out["base_interest_musd"] is None  # was inf pre-fix
    for sc in out["scenarios"]:
        c = sc["stressed_interest_coverage"]
        assert c is None or math.isfinite(c)


# ── #16: portfoliofit uses is_finite_number for the high-leverage flag ────────
def test_assess_fit_nan_leverage_raises_no_flag():
    """assess_fit: a NaN leverage must raise no high-leverage flag and not crash
    (engine/portfoliofit.py, is_finite_number instead of isinstance)."""
    from engine.portfoliofit import assess_fit

    out = assess_fit({"recommendation": "OVERWEIGHT"}, float("nan"))
    assert out is not None
    assert out["risk_flags"] == []  # NaN is rejected, no flag
    hi = assess_fit({"recommendation": "OVERWEIGHT"}, 7.0)
    assert any("High leverage" in f for f in hi["risk_flags"])  # real high-lev still flags


# ── #13: env boot guard refuses dev sentinel + a production secret ────────────
def test_require_sane_environment_rejects_dev_with_prod_secret():
    """config.require_sane_environment: a real deployment left on ENVIRONMENT=development
    (which silently re-enables the dev identity fallback) must fail closed if any
    production secret is set."""
    from config import require_sane_environment

    with pytest.raises(RuntimeError):  # dev sentinel + real edge secret
        require_sane_environment(SimpleNamespace(
            environment="development", edge_proxy_secret="real-edge-secret",
            session_secret="dev-insecure-session-secret"))
    with pytest.raises(RuntimeError):  # dev sentinel + real session secret
        require_sane_environment(SimpleNamespace(
            environment="development", edge_proxy_secret="",
            session_secret="a-real-random-secret"))
    # clean local dev (no prod secrets) → allowed
    require_sane_environment(SimpleNamespace(
        environment="development", edge_proxy_secret="",
        session_secret="dev-insecure-session-secret"))
    # deployed → not this guard's concern (the is_deployed guards handle it)
    require_sane_environment(SimpleNamespace(
        environment="production", edge_proxy_secret="x", session_secret="y"))


# ── #10: DB-scheme boot guard refuses a deployed boot on SQLite ───────────────
def test_require_postgres_in_production_rejects_sqlite_when_deployed():
    """config.require_postgres_in_production: deploy/docker-compose.yml hardcodes
    Postgres — a deployed boot on SQLite (no multi-writer support the async run
    executor relies on) must fail closed instead of surfacing later as sporadic
    'database is locked' errors under concurrent runs."""
    from config import require_postgres_in_production

    with pytest.raises(RuntimeError):  # deployed + SQLite
        require_postgres_in_production(SimpleNamespace(
            environment="production", database_url="sqlite+aiosqlite:///./caos.db"))
    # deployed + Postgres → allowed
    require_postgres_in_production(SimpleNamespace(
        environment="production", database_url="postgresql+asyncpg://caos:x@db:5432/caos"))
    # local dev on SQLite → not this guard's concern (is_deployed() is False)
    require_postgres_in_production(SimpleNamespace(
        environment="development", database_url="sqlite+aiosqlite:///./caos.db"))


def test_require_malware_scanner_in_production_fails_closed():
    from config import require_malware_scanner_in_production

    with pytest.raises(RuntimeError):
        require_malware_scanner_in_production(SimpleNamespace(
            environment="production", clamav_host=""
        ))
    require_malware_scanner_in_production(SimpleNamespace(
        environment="production", clamav_host="clamav"
    ))
    require_malware_scanner_in_production(SimpleNamespace(
        environment="development", clamav_host=""
    ))


# ── #15: extract_json always prepends the untrusted-input rule ────────────────
@pytest.mark.asyncio
async def test_extract_json_prepends_untrusted_rule(monkeypatch):
    """extract_json must inject UNTRUSTED_RULE into the system prompt itself so a new
    extractor can't ship without the "data, not instructions" rule (engine/llm_safety.py)."""
    from engine import llm_safety

    captured = {}

    class _Hit:
        chunk_id, text = "c1", "some filing text"

    async def _retrieve(q, k):
        return [_Hit()]

    class _Block:
        type = "text"
        text = '{"ok": 1}'

    class _Resp:
        content = [_Block()]

    async def _fake_create(client, **kwargs):
        captured["system"] = kwargs.get("system")
        return _Resp()

    monkeypatch.setattr(llm_safety.llm_client, "anthropic_client", lambda s: object())
    monkeypatch.setattr(llm_safety.llm_client, "create", _fake_create)

    out = await llm_safety.extract_json(_retrieve, query="q", k=3, system="MY CUSTOM SYSTEM")
    assert out is not None
    assert captured["system"].startswith(llm_safety.UNTRUSTED_RULE)
    assert "MY CUSTOM SYSTEM" in captured["system"]


# ── #6: SavedModel save recovers from a concurrent-insert conflict (no 500) ───
@pytest.mark.asyncio
async def test_save_model_recovers_from_insert_conflict():
    """The concurrent-first-save race: SELECT sees no row, INSERT commit raises
    IntegrityError (a peer won the insert), then the retry SELECT finds the row and
    UPDATEs it — returns 200, not 500 (routes/models.py save_model)."""
    from sqlalchemy.exc import IntegrityError

    from database import SavedModel
    from routes.models import SavedModelBody, save_model

    existing = SavedModel(issuer_id="i1", analyst_id="a1", payload={"old": 1}, updated_at=None)
    calls = {"commit": 0, "select": 0}

    class _Result:
        def __init__(self, row):
            self._row = row

        def scalar_one_or_none(self):
            return self._row

        def scalar_one(self):
            return self._row

    class _DB:
        async def get(self, model, pk):
            return object()  # Issuer exists

        async def execute(self, stmt):
            calls["select"] += 1
            # 1st SELECT: no row (race window); retry SELECT: the peer's committed row
            return _Result(None if calls["select"] == 1 else existing)

        def add(self, obj):
            pass

        async def commit(self):
            calls["commit"] += 1
            if calls["commit"] == 1:  # peer won the insert between our SELECT and commit
                raise IntegrityError("insert", {}, Exception("unique violation"))

        async def rollback(self):
            pass

    out = await save_model("i1", SavedModelBody(payload={"new": 2}),
                           caller=SimpleNamespace(id="a1"), db=_DB())
    assert calls["commit"] == 2          # first raised, retry committed (no 500)
    assert existing.payload == {"new": 2}  # peer's row updated with our payload
    assert out.payload == {"new": 2}
