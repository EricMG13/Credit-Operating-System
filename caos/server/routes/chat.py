"""Issuer Q&A chat endpoint — backs the deep-dive "ASK <issuer>" window."""

from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, model_validator

import rate_limit
from identity import CallerIdentity, get_identity
from llm import ChatTurn, ask_issuer

logger = logging.getLogger(__name__)
router = APIRouter()

_CHAT_MAX_PER_MINUTE = 10
_MAX_TOTAL_CHARS = 60_000  # caps single-request LLM cost


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=20000)


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(min_length=1, max_length=32)

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
    caller: CallerIdentity = Depends(get_identity),
):
    if not rate_limit.hit(
        f"chat:{caller.id}", max_attempts=_CHAT_MAX_PER_MINUTE, window_seconds=60
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Chat rate limit reached — try again in a minute.",
        )

    try:
        reply = await ask_issuer([ChatTurn(role=m.role, content=m.content) for m in body.messages])
    except Exception as e:
        logger.warning("issuer chat call failed: %s", e)
        raise HTTPException(status_code=502, detail="Chat backend unavailable — try again.") from e

    return ChatResponse(reply=reply)
