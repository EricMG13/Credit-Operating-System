"""engine/gemini.py — the Gemini provider adapter: Anthropic-shaped normalization,
effort→thinking mapping, overload detection, and seam provider routing.

The adapter needs google-genai; the wider suite does not (lanes lazy-import it and
the key-gating keeps offline on Anthropic), so this file importorskips it.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

pytest.importorskip("google.genai")
from google.genai import types as _gtypes  # noqa: E402

from engine import gemini, llm_client  # noqa: E402

_HAS_THINKING_LEVEL = "thinking_level" in _gtypes.ThinkingConfig.model_fields


# ── normalize(): Gemini response → Anthropic-shaped ──────────────────────────
def _fake_resp(text=None, function_calls=None, usage=None, finish="STOP"):
    cand = SimpleNamespace(finish_reason=SimpleNamespace(name=finish))
    return SimpleNamespace(
        text=text, function_calls=function_calls or [],
        usage_metadata=usage, candidates=[cand],
    )


def test_normalize_text_nets_out_cache_and_folds_thoughts():
    um = SimpleNamespace(prompt_token_count=120, candidates_token_count=40,
                         thoughts_token_count=10, cached_content_token_count=20)
    r = gemini.normalize(_fake_resp(text="hello", usage=um, finish="STOP"))
    assert [b.type for b in r.content] == ["text"] and r.content[0].text == "hello"
    assert r.usage.input_tokens == 100          # prompt(120) − cached(20)
    assert r.usage.output_tokens == 50          # candidates(40) + thoughts(10)
    assert r.usage.cache_read_input_tokens == 20
    assert r.stop_reason == "end_turn"          # STOP → end_turn


def test_normalize_maps_max_tokens_finish():
    um = SimpleNamespace(prompt_token_count=1, candidates_token_count=1,
                         thoughts_token_count=0, cached_content_token_count=0)
    assert gemini.normalize(_fake_resp(text="x", usage=um, finish="MAX_TOKENS")).stop_reason == "max_tokens"


def test_normalize_synthesizes_tool_use_block():
    fc = SimpleNamespace(name="emit_module_payload", args={"k": "v"})
    um = SimpleNamespace(prompt_token_count=5, candidates_token_count=3,
                         thoughts_token_count=0, cached_content_token_count=0)
    r = gemini.normalize(_fake_resp(function_calls=[fc], usage=um, finish="STOP"))
    tu = [b for b in r.content if b.type == "tool_use"]
    assert len(tu) == 1 and tu[0].name == "emit_module_payload" and tu[0].input == {"k": "v"}
    assert r.stop_reason == "tool_use"          # tool_use present overrides finish


def test_normalize_tolerates_missing_usage_and_text():
    r = gemini.normalize(SimpleNamespace(text=None, function_calls=[], usage_metadata=None, candidates=None))
    assert r.content == [] and r.usage.input_tokens == 0 and r.usage.output_tokens == 0
    assert r.stop_reason == "end_turn"


# ── effort → thinking config ─────────────────────────────────────────────────
def test_thinking_config_25_uses_integer_budget():
    assert gemini._thinking_config("gemini-2.5-flash", "high").thinking_budget == 24576
    assert gemini._thinking_config("gemini-2.5-flash", "minimal").thinking_budget == 0
    assert gemini._thinking_config("gemini-2.5-pro", "minimal").thinking_budget == 128  # pro floor
    assert gemini._thinking_config("gemini-2.5-flash-lite", "low").thinking_budget == 1024


@pytest.mark.skipif(not _HAS_THINKING_LEVEL, reason="thinking_level needs google-genai 2.x (py3.10+)")
def test_thinking_config_3x_uses_level_enum():
    # google-genai 2.x coerces the level to a ThinkingLevel enum (.value "HIGH");
    # older SDKs keep the raw string. Normalise both to a lowercase string.
    def _level(tc):
        v = tc.thinking_level
        return getattr(v, "value", v).lower()
    assert _level(gemini._thinking_config("gemini-3.5-flash", "high")) == "high"
    # gemini-3 pro has no 'minimal' → clamps to 'low'
    assert _level(gemini._thinking_config("gemini-3.1-pro", "minimal")) == "low"


# ── translation ──────────────────────────────────────────────────────────────
def test_system_text_extracts_block_list():
    assert gemini._system_text("plain") == "plain"
    assert gemini._system_text([{"type": "text", "text": "a", "cache_control": {"type": "ephemeral"}}]) == "a"
    assert gemini._system_text(None) is None


def test_to_contents_maps_assistant_to_model():
    cts = gemini._to_contents([{"role": "user", "content": "hi"}, {"role": "assistant", "content": "yo"}])
    assert [c.role for c in cts] == ["user", "model"]


# ── overload detection ───────────────────────────────────────────────────────
def test_is_overloaded_false_for_non_apierror():
    assert gemini.is_overloaded(ValueError("nope")) is False


# ── seam provider routing ────────────────────────────────────────────────────
def test_provider_detection_by_model_id():
    assert llm_client._provider("gemini-2.5-flash") == "gemini"
    assert llm_client._provider("claude-opus-4-8") == "anthropic"
    assert llm_client._provider(None) == "anthropic"


@pytest.mark.asyncio
async def test_seam_routes_gemini_model_to_adapter(monkeypatch):
    """A gemini-* model id routes through _create_gemini → gemini.call, never the
    Anthropic client (passed as None to prove it), and the normalized response
    flows back through the trace unchanged."""
    seen = {}

    async def fake_call(**kw):
        seen.update(kw)
        return gemini._Response([gemini._TextBlock("ok")], gemini._Usage(1, 1), "end_turn")

    monkeypatch.setattr(gemini, "call", fake_call)
    resp = await llm_client.create(
        None, lane="t", model="gemini-2.5-flash", effort="low",
        max_tokens=10, system="s", messages=[{"role": "user", "content": "q"}],
    )
    assert seen["model"] == "gemini-2.5-flash" and seen["effort"] == "low"
    assert seen["max_tokens"] == 10
    assert resp.content[0].text == "ok"


def test_thinking_config_clamps_unknown_effort():
    assert gemini._thinking_config("gemini-2.5-flash", "ultra").thinking_budget == 8192  # -> medium
    assert gemini._thinking_config("gemini-2.5-flash", None).thinking_budget == 8192


def test_thinking_config_gemini3_never_crashes_on_old_sdk():
    # On google-genai 1.47 (no thinking_level) this must fall back to a budget, not raise.
    cfg = gemini._thinking_config("gemini-3.5-flash", "high")
    assert getattr(cfg, "thinking_level", None) is not None or getattr(cfg, "thinking_budget", None) is not None


def test_normalize_folds_tool_use_prompt_and_clamps_cache():
    um = SimpleNamespace(prompt_token_count=100, candidates_token_count=10, thoughts_token_count=0,
                         cached_content_token_count=30, tool_use_prompt_token_count=15)
    r = gemini.normalize(_fake_resp(text="x", usage=um))
    assert r.usage.input_tokens == 100 - 30 + 15            # net cached out, fold tool-use prompt in
    assert r.usage.cache_read_input_tokens == 30
    # budget reads input + cache_read + cache_creation -> must equal prompt + tool_use (no double-count)
    assert r.usage.input_tokens + r.usage.cache_read_input_tokens == 100 + 15


@pytest.mark.asyncio
async def test_seam_does_not_cross_providers_on_fallback(monkeypatch):
    """A Gemini overload must NOT retry on a non-gemini fallback id (operator could
    override MODEL_TIER_CHEAP to a Claude id) — re-raise instead."""
    from config import get_settings

    s = get_settings()
    monkeypatch.setattr(s, "model_tier_cheap", "claude-haiku-4-5-20251001")
    calls = []

    class _Overload(Exception):
        pass

    async def fake_call(**kw):
        calls.append(kw["model"])
        raise _Overload()

    monkeypatch.setattr(gemini, "call", fake_call)
    monkeypatch.setattr(gemini, "is_overloaded", lambda e: True)
    with pytest.raises(_Overload):
        await llm_client.create(None, lane="t", model="gemini-2.5-pro", effort="low",
                                max_tokens=10, system="s", messages=[{"role": "user", "content": "q"}])
    assert calls == ["gemini-2.5-pro"]  # never retried on the Claude fallback id
