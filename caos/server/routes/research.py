"""Deep Research endpoint — backs the Deep Research concept.

POST /api/research takes a structured brief and returns a synthesized,
web-grounded credit-research report (Markdown + cited sources). Degrades to a
canned demo report when no model key is configured.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

import rate_limit
from deepresearch import ResearchBrief, ResearchResult, run_deep_research
from identity import CallerIdentity, get_identity

logger = logging.getLogger("caos")
router = APIRouter()

# Deep research is an expensive, multi-search LLM call — keep the per-caller
# rate well below the chat endpoint.
_RESEARCH_MAX_PER_MINUTE = 3


@router.post("", response_model=ResearchResult)
async def deep_research(
    brief: ResearchBrief,
    caller: CallerIdentity = Depends(get_identity),
):
    if not rate_limit.hit(
        f"research:{caller.id}", max_attempts=_RESEARCH_MAX_PER_MINUTE, window_seconds=60
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Deep-research rate limit reached — try again in a minute.",
        )

    try:
        return await run_deep_research(brief)
    except Exception as e:  # noqa: BLE001
        logger.warning("deep research call failed: %s", e)
        raise HTTPException(
            status_code=502, detail="Research backend unavailable — try again."
        ) from e
