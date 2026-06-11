"""Issuer Q&A chat — LLM follow-up questions grounded in run outputs.

Backs the deep-dive "ASK <issuer>" window. The client assembles the grounding
context (issuer profile, IC verdict, sizing, covenants, recovery, triggers,
evidence drivers, plus the module outputs currently in view) as the first
user message; this endpoint forwards the conversation to Claude and returns
the reply. Replies are capped at 1024 tokens; the per-user rate limit keeps
rapid-fire questions from burning quota.
"""

from __future__ import annotations

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, model_validator

from api.middleware.jwt import get_current_user
from core import rate_limit
from core.claude_client import AgentMessage, AgentResponseError, run_agent
from core.config import get_settings
from db.models import User

logger = structlog.get_logger()
router = APIRouter()
settings = get_settings()

_CHAT_MAX_PER_MINUTE = 10

SYSTEM_PROMPT = (
    "You are the Credit OS analyst assistant. Answer follow-up questions about "
    "ONE issuer for a credit analyst, grounded ONLY in the run context supplied "
    "in the conversation. Terse desk-note tone, under 150 words, plain text. "
    "Cite module codes (CP-x) and evidence ids (E-xx) where they support a "
    "point. If the answer isn't in the supplied data, say so and name the "
    "module that would produce it. Never invent figures."
)


_MAX_TOTAL_CHARS = 60_000  # caps single-request LLM cost (~15k tokens)


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=20000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=32)

    @model_validator(mode="after")
    def _cap_total_payload(self) -> "ChatRequest":
        total = sum(len(m.content) for m in self.messages)
        if total > _MAX_TOTAL_CHARS:
            raise ValueError(
                f"conversation payload too large ({total} chars > {_MAX_TOTAL_CHARS}); "
                "trim history and retry"
            )
        return self


class ChatResponse(BaseModel):
    reply: str


@router.post("/issuer", response_model=ChatResponse)
async def issuer_chat(
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
):
    allowed = await rate_limit.hit(
        f"chat:{current_user.id}", max_attempts=_CHAT_MAX_PER_MINUTE, window_seconds=60,
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Chat rate limit reached — try again in a minute.",
        )

    try:
        reply = await run_agent(
            SYSTEM_PROMPT,
            [AgentMessage(role=m.role, content=m.content) for m in body.messages],
            model=settings.anthropic_model_fast,
            max_tokens=1024,
            temperature=0.2,
        )
    except AgentResponseError as e:
        raise HTTPException(status_code=502, detail=f"Model returned no answer: {e}") from e
    except Exception as e:  # surface upstream API failures as a retryable error
        logger.warning("issuer chat call failed", error=str(e))
        raise HTTPException(status_code=502, detail="Chat backend unavailable — try again.") from e

    return ChatResponse(reply=str(reply))
