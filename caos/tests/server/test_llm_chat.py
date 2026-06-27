"""ask_issuer truncation handling — a 1024-token-capped reply must be flagged,
not returned as if complete (same class as the deep-research L2 fix). Mocks the
Anthropic client so it runs offline with no API key."""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import llm


def _fake_client(text, stop_reason):
    content = [SimpleNamespace(type="text", text=text)] if text is not None else []

    class _Messages:
        async def create(self, **_):
            return SimpleNamespace(content=content, stop_reason=stop_reason)

    return SimpleNamespace(messages=_Messages())


def _ask(monkeypatch, text, stop_reason):
    monkeypatch.setattr(llm, "llm_configured", lambda: True)
    monkeypatch.setattr(llm, "_get_client", lambda: _fake_client(text, stop_reason))
    return asyncio.run(llm.ask_issuer([llm.ChatTurn(role="user", content="hi")]))


def test_truncated_reply_is_flagged(monkeypatch):
    reply = _ask(monkeypatch, "partial desk note", "max_tokens")
    assert reply.startswith("partial desk note")
    assert "truncated" in reply.lower()


def test_complete_reply_is_unflagged(monkeypatch):
    reply = _ask(monkeypatch, "full desk note", "end_turn")
    assert reply == "full desk note"
    assert "truncated" not in reply.lower()


def test_truncated_with_no_text_returns_note_not_500(monkeypatch):
    reply = _ask(monkeypatch, None, "max_tokens")
    assert "truncated" in reply.lower()


def test_client_constructed_with_explicit_timeout(monkeypatch):
    """P-1: the request-lane Anthropic client must carry an explicit timeout (the
    SDK default is ~10 min, which would pin a stuck request lane open). Assert the
    constructor gets timeout=caos_llm_timeout_s, not the SDK default."""
    import anthropic

    import llm

    captured = {}

    def _fake_ctor(**kwargs):
        captured.update(kwargs)
        return object()

    monkeypatch.setattr(anthropic, "AsyncAnthropic", _fake_ctor)
    monkeypatch.setattr(llm.settings, "anthropic_api_key", "sk-test")
    monkeypatch.setattr(llm.settings, "caos_llm_timeout_s", 120.0)
    monkeypatch.setattr(llm, "_client", None)  # force a fresh construction

    llm._get_client()
    assert captured.get("timeout") == 120.0
    assert captured.get("api_key") == "sk-test"
