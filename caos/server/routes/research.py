"""Deep Research endpoints — durable background job + polling (M-3).

POST /api/research persists a ResearchJob and spawns a background task, returning
the job id immediately — so a dropped client/proxy connection no longer aborts the
multi-minute run (audit M-3). GET /api/research/{id} polls it, scoped to the owner.
Execution degrades to a canned demo report when no model key is configured.
"""

from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from database import AnalysisContextRecord, ResearchJob, get_db
from deepresearch import ResearchBrief, Source
from identity import CallerIdentity, get_identity

logger = logging.getLogger("caos")
router = APIRouter()

# Deep research is an expensive, multi-search LLM call — keep the per-caller
# creation rate well below the chat endpoint. Polling GET is not rate-limited.
_RESEARCH_MAX_PER_MINUTE = 3


class ResearchJobCreated(BaseModel):
    id: str
    status: str


class ResearchJobStatus(BaseModel):
    id: str
    status: str  # running | complete | failed
    report: Optional[str] = None
    sources: List[Source] = []
    demo: bool = False
    truncated: bool = False
    progress: Optional[dict] = None  # live {"sources": n, "searches": m} while running
    error: Optional[str] = None
    context_id: Optional[str] = None
    authority: dict = Field(default_factory=dict)


@router.post("", response_model=ResearchJobCreated, status_code=status.HTTP_201_CREATED)
async def create_research(
    brief: ResearchBrief,
    request: Request,
    context_id: Optional[str] = Query(default=None, max_length=36),
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    if not rate_limit.hit(
        f"research:{caller.id}", max_attempts=_RESEARCH_MAX_PER_MINUTE, window_seconds=60
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Deep-research rate limit reached — try again in a minute.",
        )

    context = None
    if context_id:
        context = (await db.execute(select(AnalysisContextRecord).where(
            AnalysisContextRecord.id == context_id,
            AnalysisContextRecord.analyst_id == caller.id,
        ))).scalar_one_or_none()
        if context is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Analysis context not found.")
    # Created 'queued' (model default): the durable executor claims + executes it, so
    # a redeploy re-claims from `brief` instead of losing the job. On SQLite the
    # in-process executor picks it up via enqueue; on Postgres the QueueWorker loop does.
    job = ResearchJob(
        analyst_id=caller.id,
        context_id=context_id,
        brief=brief.model_dump(),
        authority={
            "origin": "live",
            "method": "grounded-research",
            "freshness": "unknown",
            "as_of": None,
            "source_ids": [],
            "run_id": None,
            "version_id": None,
            "confidence": None,
            "approval_state": "draft",
            "analyst_override": None,
        },
    )
    db.add(job)
    await db.flush()
    if context is not None:
        context.artifacts = {
            **(context.artifacts or {}),
            "research_job_id": job.id,
        }
    await db.commit()
    # Execution outlives the request, so a dropped connection doesn't lose the run.
    # The client polls GET below.
    request.app.state.research_executor.enqueue(job.id)
    return ResearchJobCreated(id=job.id, status=job.status)


@router.get("", response_model=List[ResearchJobStatus])
async def list_research(
    context_id: Optional[str] = Query(default=None, max_length=36),
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    if context_id:
        context = (await db.execute(select(AnalysisContextRecord).where(
            AnalysisContextRecord.id == context_id,
            AnalysisContextRecord.analyst_id == caller.id,
        ))).scalar_one_or_none()
        if context is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Analysis context not found.")
    stmt = select(ResearchJob).where(ResearchJob.analyst_id == caller.id)
    if context_id:
        stmt = stmt.where(ResearchJob.context_id == context_id)
    rows = (await db.execute(stmt.order_by(ResearchJob.created_at.desc()).limit(100))).scalars().all()
    return [ResearchJobStatus(
        id=job.id,
        status=job.status,
        report=job.report,
        sources=[Source(**s) for s in (job.sources or [])],
        demo=job.demo,
        truncated=job.truncated,
        progress=job.progress,
        error=job.error,
        context_id=job.context_id,
        authority=job.authority or {},
    ) for job in rows]


@router.get("/{job_id}", response_model=ResearchJobStatus)
async def get_research(
    job_id: str,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    job = await db.get(ResearchJob, job_id)
    # 404 (not 403) when missing OR not the caller's own job — never leak the
    # existence of another analyst's research across users (per-user isolation).
    if job is None or job.analyst_id != caller.id:
        raise HTTPException(status_code=404, detail="Research job not found.")
    return ResearchJobStatus(
        id=job.id,
        status=job.status,
        report=job.report,
        sources=[Source(**s) for s in (job.sources or [])],
        demo=job.demo,
        truncated=job.truncated,
        progress=job.progress,
        error=job.error,
        context_id=job.context_id,
        authority=job.authority or {},
    )
