"""
CP-6A: ICDebateChallenge agent (P1).

The IC-debate convergence point — 16 upstream analytical feeds. Internally
adopts Bull / Bear / IC-Chair personas and must force a decision-useful
ic_action_bias (8-value enum). Downstream: CP-6E.
"""

from __future__ import annotations

import json
from typing import Any

from core.claude_client import AgentMessage, run_agent
from governance.payloads import CP6AICDebatePayload
from governance.prompts import load_active_prompt

MODULE_ID = "CP-6A"

# The 16 upstream modules CP-6A debates over (route map / ACTIVE_PROMPT).
UPSTREAM_MODULES = [
    "CP-1", "CP-1A", "CP-1B", "CP-1C", "CP-2", "CP-2B", "CP-2C", "CP-2D",
    "CP-2E", "CP-2F", "CP-3", "CP-3B", "CP-3C", "CP-3D", "CP-4", "CP-4C",
]


async def run_cp6a(issuer_id: str, upstream: dict[str, dict[str, Any]] | None = None) -> dict:
    upstream = upstream or {}
    system_prompt = load_active_prompt(MODULE_ID)

    present = [m for m in UPSTREAM_MODULES if m in upstream]
    missing = [m for m in UPSTREAM_MODULES if m not in upstream]

    blocks = "\n\n".join(
        f"### {m} ({reg_owned(m)})\n{json.dumps(upstream[m])[:2500]}" for m in present
    ) or "[No upstream module artifacts provided]"

    messages = [
        AgentMessage(
            role="user",
            content=f"ISSUER_ID: {issuer_id}\n"
                    f"UPSTREAM PRESENT: {', '.join(present) or 'none'}\n"
                    f"UPSTREAM MISSING (note as limitations, do not fabricate): {', '.join(missing) or 'none'}\n\n"
                    f"UPSTREAM ARTIFACTS:\n{blocks}\n\n"
                    "Run the adversarial IC debate (Bull opening -> Bear cross-examination via the "
                    "Zero-Bound Chain -> IC Chair adjudication). Weight source-backed evidence over "
                    "opinion. Force a single ic_action_bias from the 8-value enum, name the single "
                    "greatest uncertainty, and set the primary credit_implication (13-value enum). "
                    "Do not produce a balanced narrative. Emit the canonical envelope.",
        )
    ]
    return await run_agent(system_prompt, messages, output_schema=CP6AICDebatePayload)


def reg_owned(module_id: str) -> str:
    """Best-effort owned_object label for a module (for prompt readability)."""
    try:
        from governance.registry import load_registry
        m = load_registry().modules.get(module_id)
        return m.owned_object if m else module_id
    except Exception:
        return module_id
