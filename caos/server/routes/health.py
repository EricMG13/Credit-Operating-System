from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from llm import llm_configured

logger = logging.getLogger(__name__)
router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    version: str
    llm: str
    db: str


@router.get("/health", response_model=HealthResponse)
async def health(response: Response, db: AsyncSession = Depends(get_db, scope="function")):
    # Readiness, not just liveness: probe the DB so the container is only marked
    # healthy when it can actually serve. A failure returns 503 so the Docker
    # healthcheck / proxy gate holds traffic instead of routing to a dead DB. D3.
    try:
        await db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:  # noqa: BLE001 — any DB error means not-ready
        logger.warning("health DB probe failed", exc_info=True)
        db_status = "error"
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return HealthResponse(
        status="ok" if db_status == "ok" else "degraded",
        version="2.0.0",
        llm="configured" if llm_configured() else "demo-fallback",
        db=db_status,
    )
