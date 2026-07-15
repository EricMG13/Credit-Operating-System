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
from engine.scenario_network import PropagationResult, PropagationSource, ShockInput, propagate
from identity import CallerIdentity, get_identity
from scenario import ScenarioError, translate_scenario
from tenancy import require_run_access

logger = logging.getLogger("caos")
router = APIRouter()

_SCENARIO_MAX_PER_MINUTE = 20


class ScenarioRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)


def _accepted_scenario_payload(run: Run, outputs) -> tuple[dict[str, dict], PropagationSource]:
    """Return only scenario-eligible module outputs plus visible source status."""
    if run.status != "complete":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Scenario propagation requires a completed run.",
        )
    if run.qa_status == "Blocked" or run.committee_status == "Blocked":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Scenario propagation is unavailable for a QA-Blocked run.",
        )
    included: list[str] = []
    excluded: list[str] = []
    payload: dict[str, dict] = {}
    for row in outputs:
        if row.qa_status == "Blocked":
            excluded.append(row.module_id)
            continue
        included.append(row.module_id)
        payload[row.module_id] = row.runtime_output if isinstance(row.runtime_output, dict) else {}
    source = PropagationSource(
        run_status=run.status,
        qa_status=run.qa_status,
        committee_status=run.committee_status,
        included_modules=sorted(included),
        excluded_modules=sorted(excluded),
    )
    return payload, source


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
    payload, source = _accepted_scenario_payload(run, outputs)
    return propagate(body, payload, source=source)
