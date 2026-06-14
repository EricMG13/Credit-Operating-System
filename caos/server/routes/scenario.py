"""Scenario builder endpoint — translate a natural-language scenario into the
driver deltas the Model Builder applies to re-center its forward lens.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

import rate_limit
from identity import CallerIdentity, get_identity
from scenario import ScenarioError, translate_scenario

logger = logging.getLogger("caos")
router = APIRouter()

_SCENARIO_MAX_PER_MINUTE = 20


class ScenarioRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)


@router.post("/nl")
async def scenario_nl(
    body: ScenarioRequest,
    caller: CallerIdentity = Depends(get_identity),
):
    if not rate_limit.hit(
        f"scenario:{caller.id}", max_attempts=_SCENARIO_MAX_PER_MINUTE, window_seconds=60
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Scenario rate limit reached — try again in a minute.",
        )
    try:
        return await translate_scenario(body.text)
    except ScenarioError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Couldn't read that as a scenario — {e}. Try naming a driver "
                   "(growth, margin, rates, capex).",
        ) from e
