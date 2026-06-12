"""Identity endpoint.

Authentication is handled by the Databricks Apps platform (workspace OAuth at
the edge); this endpoint just reflects the forwarded identity so the frontend
can display who is signed in. In local dev it returns a stable local analyst.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from identity import CallerIdentity, get_identity

router = APIRouter()


class MeResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool


@router.get("/me", response_model=MeResponse)
async def me(caller: CallerIdentity = Depends(get_identity)):
    return MeResponse(
        id=caller.id,
        email=caller.email,
        full_name=caller.full_name,
        role=caller.role,
        is_active=caller.is_active,
    )
