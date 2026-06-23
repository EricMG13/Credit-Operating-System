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
