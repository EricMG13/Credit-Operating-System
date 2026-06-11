"""CP-3C: PortfolioFitPositionSizing agent (P1). Upstream: CP-3 + portfolio constraints. Downstream: CP-6E."""

from __future__ import annotations

import json
from typing import Any

from core.claude_client import AgentMessage, run_agent
from governance.payloads import CP3CPortfolioFitPayload
from governance.prompts import load_active_prompt

MODULE_ID = "CP-3C"


async def run_cp3c(
    issuer_id: str,
    cp3_output: dict[str, Any] | None = None,
    portfolio_constraints: dict[str, Any] | None = None,
) -> dict:
    system_prompt = load_active_prompt(MODULE_ID)
    upstream = ""
    if cp3_output:
        upstream += f"\nCP-3 RV:\n{json.dumps(cp3_output)[:3500]}\n"
    if portfolio_constraints:
        upstream += f"\nPORTFOLIO CONSTRAINTS:\n{json.dumps(portfolio_constraints)[:2500]}\n"
    messages = [AgentMessage(role="user", content=(
        f"ISSUER_ID: {issuer_id}\n{upstream}\n"
        "Assess portfolio fit and recommend a sizing posture using the 5-input sizing evidence gate "
        "(portfolio constraints, liquidity, mandate, rating, relative value). Only assign a non-"
        "'Requires More Work' posture when the gate inputs are present. Record the constraint register. "
        "Emit the canonical envelope."))]
    return await run_agent(system_prompt, messages, output_schema=CP3CPortfolioFitPayload)
