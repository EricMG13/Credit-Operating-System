"""
CP-MON: CreditPulse agent / service (P3, L7).

Continuous issuer-level signal monitor. Reads CP-0/1/1B/2/2B + email + market data;
emits a scored/tagged signal register and alert notifications. Orchestration
downstream (F5-pinned): CP-X, CP-SR, CP-1, CP-3D. Does NOT write back to CP-0.

This module also exposes `prepare_email_signals` — a deterministic pre-pass that
classifies inbound emails (REF_CP-EMAIL) and routes them, so the LLM receives
tier/staleness/routing-annotated context.
"""

from __future__ import annotations

import json
from typing import Any

from core.claude_client import AgentMessage, run_agent
from governance.email_routing import (
    CATEGORY_META,
    EmailCategory,
    classify_email,
    is_stale,
    route_event,
)
from governance.payloads import CPMONCreditPulsePayload
from governance.prompts import load_active_prompt

MODULE_ID = "CP-MON"

# Map an email category to a standard routing event where unambiguous.
_CATEGORY_TO_EVENT = {
    EmailCategory.RATING_ACTION: "rating_downgrade",
    EmailCategory.SELL_SIDE_NEWS: "new_issue",
}


def prepare_email_signals(emails: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Classify + annotate inbound emails per REF_CP-EMAIL (deterministic pre-pass)."""
    annotated: list[dict[str, Any]] = []
    for e in emails:
        cat = classify_email(e.get("subject", ""), e.get("sender", ""), e.get("body", ""))
        meta = CATEGORY_META[cat]
        routing = None
        if cat in _CATEGORY_TO_EVENT:
            try:
                routing = route_event(_CATEGORY_TO_EVENT[cat])
            except KeyError:
                routing = None
        annotated.append({
            **e,
            "email_category": cat.value,
            "source_tier": meta.tier,
            "staleness_rule": meta.note,
            "routing": routing,
        })
    return annotated


async def run_cp_mon(
    issuer_identifier: str | None = None,
    watchlist_id: str | None = None,
    sector_code: str | None = None,
    time_window: str = "30d",
    emails: list[dict[str, Any]] | None = None,
    market_data: dict[str, Any] | None = None,
) -> dict:
    if not (issuer_identifier or watchlist_id or sector_code):
        raise ValueError("CP-MON requires one of: issuer_identifier, watchlist_id, sector_code")

    system_prompt = load_active_prompt(MODULE_ID)
    annotated_emails = prepare_email_signals(emails or [])

    target = issuer_identifier or watchlist_id or sector_code
    parts = [f"TARGET: {target}", f"TIME_WINDOW: {time_window}"]
    if annotated_emails:
        parts.append("\nCLASSIFIED EMAIL FEED (REF_CP-EMAIL tiers applied):\n"
                     + json.dumps(annotated_emails)[:5000])
    if market_data:
        parts.append("\nMARKET DATA:\n" + json.dumps(market_data)[:2500])

    messages = [AgentMessage(role="user", content=(
        "\n".join(parts) + "\n\n"
        "Extract issuer-specific signals; tag each with credit implications; score materiality "
        "(0–1) and assign an alert tier (Critical>=0.85, Material 0.60–0.84, Noteworthy 0.40–0.59, "
        "Logged<0.40); deduplicate and cluster; preserve the source reference for auditability. "
        "Route Critical/Material signals to the relevant downstream module via CP-X. "
        "Emit the canonical envelope (downstream_consumers = CP-X, CP-SR, CP-1, CP-3D)."))]
    return await run_agent(system_prompt, messages, output_schema=CPMONCreditPulsePayload)
