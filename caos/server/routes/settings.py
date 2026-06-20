"""Workspace settings — a read-only, non-secret snapshot of the running config.

Backs the Settings page's "Workspace configuration" view. These are env-driven
(config.py) and applied at boot, so this endpoint reports current values only —
it never writes. Secrets (API keys, DB URL, storage paths, EDGAR UA) are
deliberately excluded; booleans expose whether a key/UA is present, not its value.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from config import get_settings
from deepresearch import _EFFORT, _MAX_SEARCHES, _MAX_TOKENS as _DR_MAX_TOKENS
from identity import CallerIdentity, get_identity
from llm import llm_configured

router = APIRouter()


@router.get("")
async def read_settings(caller: CallerIdentity = Depends(get_identity)):
    s = get_settings()
    return {
        "model": s.anthropic_model,
        "llm_configured": llm_configured(),  # bool only — never the key
        "governance": {
            "council_enabled": s.council_enabled,
            "council_seats": s.council_seats,
            "council_peer_round": s.council_peer_round,
            "debate_enabled": s.debate_enabled,
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
    }
