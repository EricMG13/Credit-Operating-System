"""Deep Research endpoints — durable background job + polling (M-3).

POST /api/research persists a ResearchJob and spawns a background task, returning
the job id immediately — so a dropped client/proxy connection no longer aborts the
multi-minute run (audit M-3). GET /api/research/{id} polls it, scoped to the owner.
Execution degrades to a canned demo report when no model key is configured.
"""

from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from database import ResearchJob, get_db
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


@router.post("", response_model=ResearchJobCreated, status_code=status.HTTP_201_CREATED)
async def create_research(
    brief: ResearchBrief,
    request: Request,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db),
):
    if not rate_limit.hit(
        f"research:{caller.id}", max_attempts=_RESEARCH_MAX_PER_MINUTE, window_seconds=60
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Deep-research rate limit reached — try again in a minute.",
        )

    job = ResearchJob(status="running", analyst_id=caller.id, brief=brief.model_dump())
    db.add(job)
    await db.commit()
    # Fire-and-forget: execution outlives the request, so a dropped connection
    # doesn't lose the run. The client polls GET below.
    request.app.state.research_executor.enqueue(job.id)
    return ResearchJobCreated(id=job.id, status=job.status)


@router.get("/{job_id}", response_model=ResearchJobStatus)
async def get_research(
    job_id: str,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db),
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
    )
