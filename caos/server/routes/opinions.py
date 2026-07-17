"""Append-only analyst investment views, kept distinct from system recommendations."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import (
    AnalysisContextRecord,
    AnalystLink,
    AnalystOpinionVersion,
    Issuer,
    Run,
    ThesisVersion,
    get_db,
)
from engine.periods import is_finite_number
from identity import CallerIdentity, get_identity, get_write_identity
from tenancy import require_issuer, require_run_access

router = APIRouter()

Stance = Literal["OVERWEIGHT", "NEUTRAL", "UNDERWEIGHT"]
EvidenceState = Literal["supported", "provisional"]


class AnalystOpinionIn(BaseModel):
    stance: Stance
    conviction: Optional[float] = Field(default=None, ge=0, le=100)
    rationale_md: str = Field(min_length=1, max_length=50_000)
    evidence_state: EvidenceState
    unresolved_items: list[str] = Field(default_factory=list, max_length=50)
    thesis_version_id: Optional[str] = Field(default=None, max_length=36)
    source_run_id: Optional[str] = Field(default=None, max_length=36)
    context_id: Optional[str] = Field(default=None, max_length=36)
    analyst_link_ids: list[str] = Field(default_factory=list, max_length=50)

    @model_validator(mode="after")
    def _provisional_view_names_its_gaps(self) -> "AnalystOpinionIn":
        self.unresolved_items = [item.strip() for item in self.unresolved_items if item.strip()]
        self.analyst_link_ids = list(dict.fromkeys(item.strip() for item in self.analyst_link_ids if item.strip()))
        if self.evidence_state == "provisional" and not self.unresolved_items:
            raise ValueError("A provisional analyst view must name at least one unresolved item.")
        if self.conviction is not None and not is_finite_number(self.conviction):
            raise ValueError("Conviction must be finite.")
        return self


class AnalystOpinionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    issuer_id: str
    analyst_id: str
    version: int
    stance: Stance
    conviction: Optional[float]
    rationale_md: str
    evidence_state: EvidenceState
    unresolved_items: list[str]
    thesis_version_id: Optional[str]
    source_run_id: Optional[str]
    context_id: Optional[str]
    analyst_link_ids: list[str]
    created_at: datetime


class AnalystOpinionHistory(BaseModel):
    current: Optional[AnalystOpinionOut]
    items: list[AnalystOpinionOut]


def _out(row: AnalystOpinionVersion) -> AnalystOpinionOut:
    return AnalystOpinionOut(
        id=row.id,
        issuer_id=row.issuer_id,
        analyst_id=row.analyst_id,
        version=row.version,
        stance=row.stance,  # type: ignore[arg-type]
        conviction=row.conviction,
        rationale_md=row.rationale_md,
        evidence_state=row.evidence_state,  # type: ignore[arg-type]
        unresolved_items=row.unresolved_items or [],
        thesis_version_id=row.thesis_version_id,
        source_run_id=row.source_run_id,
        context_id=row.context_id,
        analyst_link_ids=row.analyst_link_ids or [],
        created_at=row.created_at,
    )


async def _validate_refs(
    db: AsyncSession,
    caller: CallerIdentity,
    issuer_id: str,
    body: AnalystOpinionIn,
) -> None:
    if body.thesis_version_id:
        thesis = await db.get(ThesisVersion, body.thesis_version_id)
        if thesis is None or thesis.issuer_id != issuer_id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Thesis version does not belong to issuer.")
    if body.source_run_id:
        run = await db.get(Run, body.source_run_id)
        await require_run_access(caller, run, db)
        if run.issuer_id != issuer_id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Source run does not belong to issuer.")
    if body.context_id:
        context = await db.get(AnalysisContextRecord, body.context_id)
        if context is None or context.analyst_id != caller.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Analysis context not found.")
        if context.issuer_ids and issuer_id not in context.issuer_ids:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Analysis context does not include issuer.")
    if body.analyst_link_ids:
        links = list((await db.execute(
            select(AnalystLink).where(AnalystLink.id.in_(body.analyst_link_ids))
        )).scalars().all())
        if len(links) != len(body.analyst_link_ids) or any(link.target_issuer_id != issuer_id for link in links):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "A linked analyst memo does not belong to issuer.")


@router.get("/{issuer_id}/analyst-opinions", response_model=AnalystOpinionHistory)
async def list_analyst_opinions(
    issuer_id: str,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    issuer = await db.get(Issuer, issuer_id)
    require_issuer(caller, issuer)
    rows = list((await db.execute(
        select(AnalystOpinionVersion)
        .where(
            AnalystOpinionVersion.issuer_id == issuer_id,
            AnalystOpinionVersion.analyst_id == caller.id,
        )
        .order_by(AnalystOpinionVersion.version.desc())
    )).scalars().all())
    payload = [_out(row) for row in rows]
    return AnalystOpinionHistory(current=payload[0] if payload else None, items=payload)


@router.post("/{issuer_id}/analyst-opinions", response_model=AnalystOpinionOut, status_code=status.HTTP_201_CREATED)
async def create_analyst_opinion(
    issuer_id: str,
    body: AnalystOpinionIn,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_write_identity),
):
    issuer = (await db.execute(select(Issuer).where(Issuer.id == issuer_id).with_for_update())).scalar_one_or_none()
    require_issuer(caller, issuer)
    await _validate_refs(db, caller, issuer_id, body)
    current = (await db.execute(
        select(func.max(AnalystOpinionVersion.version)).where(
            AnalystOpinionVersion.issuer_id == issuer_id,
            AnalystOpinionVersion.analyst_id == caller.id,
        )
    )).scalar() or 0
    row = AnalystOpinionVersion(
        analyst_id=caller.id,
        issuer_id=issuer_id,
        version=int(current) + 1,
        stance=body.stance,
        conviction=body.conviction,
        rationale_md=body.rationale_md.strip(),
        evidence_state=body.evidence_state,
        unresolved_items=body.unresolved_items,
        thesis_version_id=body.thesis_version_id,
        source_run_id=body.source_run_id,
        context_id=body.context_id,
        analyst_link_ids=body.analyst_link_ids,
    )
    db.add(row)
    await db.flush()
    return _out(row)
