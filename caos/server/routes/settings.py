"""Workspace settings — a read-only, non-secret snapshot of the running config.

Backs the Settings page's "Workspace configuration" view. These are env-driven
(config.py) and applied at boot, so this endpoint reports current values only —
it never writes. Secrets (API keys, DB URL, storage paths, EDGAR UA) are
deliberately excluded; booleans expose whether a key/UA is present, not its value.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from database import Analyst, get_db
from deepresearch import _EFFORT, _MAX_SEARCHES, _MAX_TOKENS as _DR_MAX_TOKENS
from identity import CallerIdentity, get_identity
from llm import llm_configured

router = APIRouter()


class AnalystSettings(BaseModel):
    model_lanes: dict = Field(default_factory=dict)
    email_intelligence: dict = Field(default_factory=dict)


@router.get("")
async def read_settings(caller: CallerIdentity = Depends(get_identity)):
    s = get_settings()
    return {
        "model": s.anthropic_model,
        "llm_configured": llm_configured(),  # bool only — never the key
        "gemini_configured": bool(s.gemini_api_key),  # bool only — gemini tiers active when set
        "openrouter_configured": bool(s.openrouter_api_key),  # bool only — DeepSeek/OpenRouter hybrid
        "governance": {
            "council_enabled": s.council_enabled,
            "council_seats": s.council_seats,
            "council_peer_round": s.council_peer_round,
            "council_cross_model": s.council_cross_model,
            "debate_enabled": s.debate_enabled,
        },
        "model_tiers": {
            "cheap": s.model_tier_cheap,
            "fast": s.model_tier_fast,
            "strong": s.model_tier_strong,
            "top": s.model_tier_top,
        },
        "engine_cost": {
            "run_token_budget": s.run_token_budget,
            "advisor_enabled": s.advisor_enabled,
            "synth_executor_model": s.synth_executor_model,
            "advisor_model": s.advisor_model,
        },
        "deep_research": {
            "effort": _EFFORT,
            "max_searches": _MAX_SEARCHES,
            "max_tokens": _DR_MAX_TOKENS,
        },
        "retrieval": {
            "edgar_enabled": bool(s.edgar_user_agent),
            "markitdown_enabled": bool(s.markitdown_cmd),
        },
        "workspace": {
            "environment": s.environment,
            "demo_seed": s.caos_demo_seed,
            "max_upload_mb": s.max_upload_mb,
            "run_concurrency": s.caos_run_concurrency,
        },
        "analyst": getattr(caller, "id", None),
    }


@router.get("/analyst", response_model=AnalystSettings)
async def read_analyst_settings(
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db),
):
    analyst = await db.get(Analyst, caller.id)
    raw = analyst.settings if analyst is not None and isinstance(analyst.settings, dict) else {}
    return AnalystSettings(
        model_lanes=raw.get("model_lanes") or {},
        email_intelligence=raw.get("email_intelligence") or {},
    )


@router.put("/analyst", response_model=AnalystSettings)
async def write_analyst_settings(
    body: AnalystSettings,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db),
):
    analyst = await db.get(Analyst, caller.id)
    if analyst is None:
        # No persisted profile for this identity (e.g. proxy/local caller without a
        # profile row) — nothing to write to. 404 rather than a silent 200 that would
        # tell the client the save stuck when it didn't.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No analyst profile — settings not saved.")
    analyst.settings = body.model_dump()
    await db.commit()
    return body
