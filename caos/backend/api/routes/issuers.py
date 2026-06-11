"""Issuer registry CRUD endpoints."""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.middleware.jwt import get_current_admin, get_current_user
from db.models import Document, Issuer, User
from db.session import get_db

router = APIRouter()


class IssuerCreate(BaseModel):
    name: str
    ticker: str | None = None
    industry: str | None = None
    country: str | None = None


class IssuerResponse(BaseModel):
    id: UUID
    name: str
    ticker: str | None
    industry: str | None
    country: str | None

    model_config = {"from_attributes": True}


@router.get("/", response_model=list[IssuerResponse])
async def list_issuers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Issuer).order_by(Issuer.name))
    return result.scalars().all()


@router.post("/", response_model=IssuerResponse, status_code=201)
async def create_issuer(
    body: IssuerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    issuer = Issuer(**body.model_dump())
    db.add(issuer)
    await db.flush()
    await db.refresh(issuer)
    return issuer


@router.get("/{issuer_id}", response_model=IssuerResponse)
async def get_issuer(
    issuer_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    issuer = await db.get(Issuer, issuer_id)
    if not issuer:
        raise HTTPException(404, "Issuer not found")
    return issuer


@router.delete("/{issuer_id}", status_code=204)
async def delete_issuer(
    issuer_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    issuer = await db.get(Issuer, issuer_id)
    if not issuer:
        raise HTTPException(404, "Issuer not found")
    await db.delete(issuer)


class IssuerDocumentResponse(BaseModel):
    id: UUID
    doc_type: str
    file_name: str
    uploaded_at: datetime
    fiscal_period: str | None

    model_config = {"from_attributes": True}


@router.get("/{issuer_id}/documents", response_model=list[IssuerDocumentResponse])
async def list_issuer_documents(
    issuer_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List documents uploaded for an issuer, newest first.

    The frontend uses this to pick a trigger document for a DAG run instead of
    submitting the all-zeros sentinel UUID.
    """
    result = await db.execute(
        select(Document)
        .where(Document.issuer_id == issuer_id)
        .order_by(Document.uploaded_at.desc())
    )
    return result.scalars().all()
