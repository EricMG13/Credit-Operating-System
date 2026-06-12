from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from llm import llm_configured

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    version: str
    llm: str


@router.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        version="2.0.0",
        llm="configured" if llm_configured() else "demo-fallback",
    )
