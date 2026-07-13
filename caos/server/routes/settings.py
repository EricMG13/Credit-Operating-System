"""Workspace settings — a read-only, non-secret snapshot of the running config.

Backs the Settings page's "Workspace configuration" view. These are env-driven
(config.py) and applied at boot, so this endpoint reports current values only —
it never writes. Secrets (API keys, DB URL, storage paths, EDGAR UA) are
deliberately excluded; booleans expose whether a key/UA is present, not its value.
"""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
from config import get_settings
from database import Analyst, get_db
from deepresearch import _EFFORT, _MAX_SEARCHES, _MAX_TOKENS as _DR_MAX_TOKENS
from identity import CallerIdentity, get_identity
from llm import llm_configured

router = APIRouter()

# Analyst settings are two small lane/preference maps. Cap the persisted JSON so
# this mutating endpoint can't bloat the Analyst.settings blob (replayed on every
# GET) without bound, and rate-guard it like every sibling write.
_MAX_SETTINGS_BYTES = 100_000
_WRITES_PER_MINUTE = 30


# Presentation-only role views. Never authorization — nothing server-side
# branches on this; it is a rendering hint the frontend persists per analyst.
_ROLE_VIEWS = ("analyst", "pm", "qa")


class AnalystSettings(BaseModel):
    model_lanes: dict = Field(default_factory=dict)
    email_intelligence: dict = Field(default_factory=dict)
    role_view: str = "analyst"
    # Per-analyst UI state that has nowhere else to live: Deep-Dive module pins
    # (workspace.deepdive_pins), recents (workspace.deepdive_recents), and
    # standing-view affirmations (workspace.affirmations — personal
    # annotations, NOT a governance action). Frontend caps each list; server
    # only enforces the overall 100KB blob cap below.
    workspace: dict = Field(default_factory=dict)
    revision: int = Field(default=0, ge=0)


class AnalystSettingsPatch(BaseModel):
    expected_revision: int = Field(ge=0)
    model_lanes: dict | None = None
    email_intelligence: dict | None = None
    role_view: str | None = None
    workspace: dict | None = None


def _settings_out(analyst: Analyst | None) -> AnalystSettings:
    raw = analyst.settings if analyst is not None and isinstance(analyst.settings, dict) else {}
    rv = raw.get("role_view")
    workspace = raw.get("workspace")
    return AnalystSettings(
        model_lanes=raw.get("model_lanes") or {},
        email_intelligence=raw.get("email_intelligence") or {},
        role_view=rv if rv in _ROLE_VIEWS else "analyst",
        workspace=workspace if isinstance(workspace, dict) else {},
        revision=analyst.settings_revision if analyst is not None else 0,
    )


def _settings_payload(body: AnalystSettings) -> dict:
    return body.model_dump(exclude={"revision"})


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
    db: AsyncSession = Depends(get_db, scope="function"),
):
    analyst = await db.get(Analyst, caller.id)
    # Old two-field blobs (and junk values) coerce to the analyst view — a GET
    # never 500s over a preference.
    return _settings_out(analyst)


@router.put("/analyst", response_model=AnalystSettings)
async def write_analyst_settings(
    body: AnalystSettings,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    if not rate_limit.hit(f"settings:{caller.id}", max_attempts=_WRITES_PER_MINUTE, window_seconds=60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Settings rate limit reached — try again in a minute.")
    if body.role_view not in _ROLE_VIEWS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "role_view must be one of: analyst, pm, qa.",
        )
    payload = _settings_payload(body)
    if len(json.dumps(payload)) > _MAX_SETTINGS_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Settings payload too large.")
    analyst = await db.get(Analyst, caller.id)
    if analyst is None:
        # No persisted profile for this identity (e.g. proxy/local caller without a
        # profile row) — nothing to write to. 404 rather than a silent 200 that would
        # tell the client the save stuck when it didn't.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No analyst profile — settings not saved.")
    analyst.settings = payload
    analyst.settings_revision += 1
    await db.commit()
    return _settings_out(analyst)


@router.patch("/analyst", response_model=AnalystSettings)
async def patch_analyst_settings(
    body: AnalystSettingsPatch,
    caller: CallerIdentity = Depends(get_identity),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    """Revision-checked partial update; the replacement PUT remains compatible."""
    if not rate_limit.hit(f"settings:{caller.id}", max_attempts=_WRITES_PER_MINUTE, window_seconds=60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Settings rate limit reached — try again in a minute.")
    analyst = await db.get(Analyst, caller.id)
    if analyst is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No analyst profile — settings not saved.")
    if body.expected_revision != analyst.settings_revision:
        raise HTTPException(status.HTTP_409_CONFLICT, {
            "message": "Settings changed elsewhere.",
            "current": _settings_out(analyst).model_dump(),
        })
    current = _settings_out(analyst)
    changes = body.model_dump(exclude={"expected_revision"}, exclude_none=True)
    next_settings = current.model_copy(update=changes)
    if next_settings.role_view not in _ROLE_VIEWS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "role_view must be one of: analyst, pm, qa.")
    payload = _settings_payload(next_settings)
    if len(json.dumps(payload)) > _MAX_SETTINGS_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Settings payload too large.")
    analyst.settings = payload
    analyst.settings_revision += 1
    await db.flush()
    return _settings_out(analyst)
