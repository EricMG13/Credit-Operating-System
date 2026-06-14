"""Cross-issuer natural-language query over the curated metric store.

A question is translated into a constrained QuerySpec (validated against the
metric dictionary), executed as a parameterized query, and returned as ranked,
evidence-cited rows. Backs the Command Center NL query bar.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from database import get_db
from engine.metrics import catalog_dicts
from identity import CallerIdentity, get_identity
from nlquery import QueryError, execute, execute_semantic, plan

logger = logging.getLogger("caos")
router = APIRouter()

_QUERY_MAX_PER_MINUTE = 20


class NlQueryRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)


@router.get("/catalog")
async def get_catalog(caller: CallerIdentity = Depends(get_identity)):
    """The metric dictionary — keys, labels, units, polarity, descriptions."""
    return {"metrics": catalog_dicts()}


@router.post("/nl")
async def nl_query(
    body: NlQueryRequest,
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    if not rate_limit.hit(
        f"query:{caller.id}", max_attempts=_QUERY_MAX_PER_MINUTE, window_seconds=60
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Query rate limit reached — try again in a minute.",
        )
    try:
        mode, spec = await plan(body.question)
    except QueryError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Couldn't map that to a known metric — {e}. See /api/query/catalog.",
        ) from e
    # Structured questions rank the metric store; qualitative ones search evidence.
    if mode == "semantic":
        return await execute_semantic(db, spec)
    return await execute(db, spec)
