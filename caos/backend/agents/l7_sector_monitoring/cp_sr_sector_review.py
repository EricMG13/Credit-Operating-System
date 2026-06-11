"""
CP-SR: SectorReview agent (P3, L7).

Standalone sector-level review. Optional inputs: email intelligence, CP-MON alert
feed, prior review, CP-1 issuer context. Downstream (enrichment): CP-5, CP-6A, CP-6E;
loop: CP-MON. 7-section output + sector_credit_posture (6-value enum).
"""

from __future__ import annotations

import json
from typing import Any

from core.claude_client import AgentMessage, run_agent
from governance.payloads import CPSRSectorReviewPayload
from governance.prompts import load_active_prompt

MODULE_ID = "CP-SR"


async def run_cp_sr(
    sector: str,
    source_package: str = "",
    email_intelligence: list[dict[str, Any]] | None = None,
    cp_mon_alerts: list[dict[str, Any]] | None = None,
    prior_review: dict[str, Any] | None = None,
) -> dict:
    system_prompt = load_active_prompt(MODULE_ID)

    parts = [f"SECTOR: {sector}", f"\nSOURCE PACKAGE:\n{source_package or '[none provided]'}"]
    if email_intelligence:
        parts.append("\nEMAIL INTELLIGENCE (Step A.2 — apply REF_CP-EMAIL tiers/staleness):\n"
                     + json.dumps(email_intelligence)[:4000])
    if cp_mon_alerts:
        parts.append("\nCP-MON ALERT FEED:\n" + json.dumps(cp_mon_alerts)[:3000])
    if prior_review:
        parts.append("\nPRIOR CP-SR REVIEW (validate/refresh):\n" + json.dumps(prior_review)[:3000])

    messages = [AgentMessage(role="user", content=(
        "\n".join(parts) + "\n\n"
        "Produce the 7-section sector review (executive summary, sector overview, key credit "
        "drivers, risk assessment, comparative table, early warning dashboard, strategic "
        "implications), score the 6 investigation dimensions (1–5), and assign a sector_credit_posture "
        "from the 6-value enum with justification. Show confidence levels and source tiers. "
        "Emit the canonical envelope."))]
    return await run_agent(system_prompt, messages, output_schema=CPSRSectorReviewPayload)
