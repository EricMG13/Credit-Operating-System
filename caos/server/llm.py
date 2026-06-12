"""Issuer Q&A chat backed by Claude.

Uses the official Anthropic SDK with claude-opus-4-8. The API key comes from
ANTHROPIC_API_KEY (a Databricks secret in deployment). When no key is
configured the endpoint degrades to a deterministic demo reply so the app
remains fully demoable.
"""

from __future__ import annotations

from typing import List, Optional

import anthropic
from pydantic import BaseModel

from config import get_settings

settings = get_settings()

SYSTEM_PROMPT = (
    "You are the Credit OS analyst assistant. Answer follow-up questions about "
    "ONE issuer for a credit analyst, grounded ONLY in the run context supplied "
    "in the conversation. Terse desk-note tone, under 150 words, plain text. "
    "Cite module codes (CP-x) and evidence ids (E-xx) where they support a "
    "point. If the answer isn't in the supplied data, say so and name the "
    "module that would produce it. Never invent figures."
)

_DEMO_REPLY = (
    "Demo mode — no model key configured. Grounded answers come from the run "
    "context once ANTHROPIC_API_KEY is set for the app. From the supplied "
    "context: see CP-1 for the add-back register (E-09), CP-4C for incurrence "
    "capacity, and CP-6E for sizing posture."
)


class ChatTurn(BaseModel):
    role: str  # "user" | "assistant"
    content: str


_client: Optional[anthropic.AsyncAnthropic] = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


def llm_configured() -> bool:
    return bool(settings.anthropic_api_key)


async def ask_issuer(messages: List[ChatTurn]) -> str:
    if not llm_configured():
        return _DEMO_REPLY

    response = await _get_client().messages.create(
        model=settings.anthropic_model,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": m.role, "content": m.content} for m in messages],
    )
    for block in response.content:
        if block.type == "text":
            return block.text
    raise RuntimeError(f"Model returned no text (stop_reason={response.stop_reason}).")
