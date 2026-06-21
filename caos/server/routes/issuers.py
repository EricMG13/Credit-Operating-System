"""Issuer registry endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import Document, Issuer, get_db
from identity import CallerIdentity, get_identity

router = APIRouter()


class IssuerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    ticker: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    figi: Optional[str] = Field(default=None, max_length=32)


class IssuerResponse(BaseModel):
    id: str
    name: str
    ticker: Optional[str]
    industry: Optional[str]
    country: Optional[str]
    figi: Optional[str]

    model_config = {"from_attributes": True}


class IssuerDocumentResponse(BaseModel):
    id: str
    doc_type: str
    run_mode: Optional[str]
    file_name: str
    uploaded_at: datetime
    fiscal_period: Optional[str]

    model_config = {"from_attributes": True}


# Issuers and their documents are a *shared coverage universe* — every
# authenticated analyst sees every issuer (per the buy-side-desk model). The
# `caller` dependency below is therefore load-bearing for authentication (it
# enforces the 401 edge-auth gate in identity.py) but intentionally NOT used to
# scope queries: there is no per-user ownership boundary here by design. If
# need-to-know access control is ever required (e.g. an MNPI information
# barrier — see review W2), scope these queries by `caller` then.
@router.get("/", response_model=List[IssuerResponse])
async def list_issuers(
    q: Optional[str] = Query(
        default=None,
        max_length=255,
        description="Case-insensitive substring match across name, ticker, industry, country, and FIGI.",
    ),
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    stmt = select(Issuer).order_by(Issuer.name)
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Issuer.name.ilike(like),
                Issuer.ticker.ilike(like),
                Issuer.industry.ilike(like),
                Issuer.country.ilike(like),
                Issuer.figi.ilike(like),
            )
        )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/", response_model=IssuerResponse, status_code=201)
async def create_issuer(
    body: IssuerCreate,
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    issuer = Issuer(**body.model_dump())
    db.add(issuer)
    await db.flush()
    await db.refresh(issuer)
    return issuer


@router.get("/{issuer_id}", response_model=IssuerResponse)
async def get_issuer(
    issuer_id: str,
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    issuer = await db.get(Issuer, issuer_id)
    if not issuer:
        raise HTTPException(404, "Issuer not found")
    return issuer


@router.get("/{issuer_id}/documents", response_model=List[IssuerDocumentResponse])
async def list_issuer_documents(
    issuer_id: str,
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    result = await db.execute(
        select(Document)
        .where(Document.issuer_id == issuer_id)
        .order_by(Document.uploaded_at.desc())
    )
    return result.scalars().all()
