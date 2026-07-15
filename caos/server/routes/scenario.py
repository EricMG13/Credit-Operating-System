"""Scenario builder endpoint — translate a natural-language scenario into the
driver deltas the Model Builder applies to re-center its forward lens.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from database import ModuleOutput, Run, get_db
from engine.scenario_network import PropagationResult, ShockInput, propagate
from identity import CallerIdentity, get_identity
from scenario import ScenarioError, translate_scenario
from tenancy import require_run_access

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
            status_code=422,
            detail=f"Couldn't read that as a scenario — {e}. Try naming a driver "
                   "(growth, margin, rates, capex).",
        ) from e


@router.post("/propagate", response_model=PropagationResult)
async def scenario_propagate(
    body: ShockInput,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    if not rate_limit.hit(
        f"scenario-propagate:{caller.id}",
        max_attempts=_SCENARIO_MAX_PER_MINUTE,
        window_seconds=60,
    ):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Scenario rate limit reached — try again in a minute.")
    run = await require_run_access(caller, await db.get(Run, body.run_id), db)
    if run.issuer_id != body.issuer_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    outputs = (await db.execute(
        select(ModuleOutput).where(ModuleOutput.run_id == body.run_id)
    )).scalars().all()
    payload = {row.module_id: (row.runtime_output or {}) for row in outputs}
    return propagate(body, payload)
