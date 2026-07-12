"""Analyst QA flags — the Deep-Dive register's "FLAG TO QA · CP-5" lane.

An analyst flag is an audit-trail escalation on a module/step output. It is
recorded and listable, and deliberately separate from engine qa_findings so a
flag can never gate a run or block a committee export.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import audit
import rate_limit
from database import AnalystQaFlag, get_db
from identity import CallerIdentity, get_identity

router = APIRouter()

_FLAGS_MAX_PER_MINUTE = 30
_LIST_CAP = 200


class QaFlagCreate(BaseModel):
    module_id: str = Field(min_length=2, max_length=16)
    step_ref: Optional[str] = Field(default=None, max_length=120)
    note: Optional[str] = Field(default=None, max_length=2000)
    issuer_id: Optional[str] = Field(default=None, max_length=36)
    run_id: Optional[str] = Field(default=None, max_length=36)


class QaFlagOut(BaseModel):
    id: str
    issuer_id: Optional[str]
    run_id: Optional[str]
    module_id: str
    step_ref: Optional[str]
    note: Optional[str]
    analyst_id: Optional[str]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


@router.post("/flags", response_model=QaFlagOut, status_code=201)
async def create_flag(
    body: QaFlagCreate,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    if not rate_limit.hit(f"qa-flags:{caller.id}", max_attempts=_FLAGS_MAX_PER_MINUTE, window_seconds=60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Flag rate limit reached — try again in a minute.")
    flag = AnalystQaFlag(
        issuer_id=body.issuer_id,
        run_id=body.run_id,
        module_id=body.module_id,
        step_ref=body.step_ref,
        note=(body.note or "").strip() or None,
        analyst_id=caller.id,
    )
    db.add(flag)
    await db.flush()  # populate flag.id (client-side uuid default) for the audit row
    audit.write(db, analyst_id=caller.id, action="qa_flag.create",
                target_type="qa_flag", target_id=flag.id,
                after={"module_id": flag.module_id, "issuer_id": flag.issuer_id, "run_id": flag.run_id})
    await db.commit()
    await db.refresh(flag)
    return QaFlagOut.model_validate(flag)


@router.get("/flags", response_model=List[QaFlagOut])
async def list_flags(
    module_id: Optional[str] = Query(default=None, max_length=16),
    step_ref: Optional[str] = Query(default=None, max_length=120),
    issuer_id: Optional[str] = Query(default=None, max_length=36),
    run_id: Optional[str] = Query(default=None, max_length=36),
    db: AsyncSession = Depends(get_db, scope="function"),
    _caller: CallerIdentity = Depends(get_identity),
):
    q = select(AnalystQaFlag).order_by(AnalystQaFlag.created_at.desc()).limit(_LIST_CAP)
    if module_id:
        q = q.where(AnalystQaFlag.module_id == module_id)
    if step_ref:
        q = q.where(AnalystQaFlag.step_ref == step_ref)
    if issuer_id:
        q = q.where(AnalystQaFlag.issuer_id == issuer_id)
    if run_id:
        q = q.where(AnalystQaFlag.run_id == run_id)
    rows = await db.execute(q)
    return [QaFlagOut.model_validate(f) for f in rows.scalars().all()]
