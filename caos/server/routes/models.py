"""Saved Model Builder state."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from database import Issuer, SavedModel, get_db
from identity import CallerIdentity, get_identity

router = APIRouter()

_WRITE_MAX_PER_MINUTE = 30


class SavedModelBody(BaseModel):
    payload: dict = Field(default_factory=dict)


class SavedModelOut(BaseModel):
    issuer_id: str
    analyst_id: str
    payload: dict
    updated_at: datetime


@router.get("/{issuer_id}", response_model=Optional[SavedModelOut])
async def get_saved_model(
    issuer_id: str,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(
        select(SavedModel).where(SavedModel.issuer_id == issuer_id, SavedModel.analyst_id == caller.id)
    )).scalar_one_or_none()
    if row is None:
        return None
    return SavedModelOut(
        issuer_id=row.issuer_id, analyst_id=row.analyst_id,
        payload=row.payload, updated_at=row.updated_at,
    )


@router.put("/{issuer_id}", response_model=SavedModelOut)
async def save_model(
    issuer_id: str,
    body: SavedModelBody,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db),
):
    if not rate_limit.hit(
        f"model-save:{caller.id}", max_attempts=_WRITE_MAX_PER_MINUTE, window_seconds=60
    ):
        raise HTTPException(429, "Model-save rate limit reached — try again in a minute.")
    if await db.get(Issuer, issuer_id) is None:
        raise HTTPException(404, "Issuer not found")
    row = (await db.execute(
        select(SavedModel).where(SavedModel.issuer_id == issuer_id, SavedModel.analyst_id == caller.id)
    )).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if row is None:
        row = SavedModel(issuer_id=issuer_id, analyst_id=caller.id, payload=body.payload, updated_at=now)
        db.add(row)
    else:
        row.payload = body.payload
        row.updated_at = now
    await db.commit()
    return SavedModelOut(issuer_id=issuer_id, analyst_id=caller.id, payload=body.payload, updated_at=now)
