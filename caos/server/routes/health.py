from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Request, Response, status
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
    workers: dict[str, str]


@router.get("/health", response_model=HealthResponse)
async def health(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db, scope="function"),
):
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
    workers: dict[str, str] = {}
    for label, attr in (
        ("runs", "executor"),
        ("research", "research_executor"),
        ("autonomy", "pipeline_executor"),
        ("reports", "research_report_executor"),
    ):
        executor = getattr(request.app.state, attr, None)
        check = getattr(executor, "health", None)
        if callable(check):
            try:
                worker_status = str(check().get("status", "degraded"))
            except Exception:  # noqa: BLE001 — health must report, not raise
                logger.warning("health worker probe failed: %s", label, exc_info=True)
                worker_status = "degraded"
        else:
            # SQLite uses bounded in-process task executors rather than pollers.
            # Missing state during startup is degraded; a started executor with no
            # health method is the expected local in-process implementation.
            worker_status = "ok" if executor is not None else "degraded"
        workers[label] = worker_status

    workers_ok = all(value == "ok" for value in workers.values())
    if not workers_ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return HealthResponse(
        status="ok" if db_status == "ok" and workers_ok else "degraded",
        version="2.0.0",
        llm="configured" if llm_configured() else "demo-fallback",
        db=db_status,
        workers=workers,
    )
