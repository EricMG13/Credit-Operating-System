"""
CP-6E: Portfolio Debate Agent (multi-agent sub-graph).
Three distinct personas debate the investment posture:
  - RV_TRADER:  Relative value / pricing focus
  - COMPLIANCE: Regulatory / covenant / MNPI risk focus
  - CIO:        Portfolio construction / top-down conviction focus

Uses LLM-as-Judge for posture consistency across personas.
"""

from __future__ import annotations

import asyncio
from typing import Any

from core.claude_client import AgentMessage, run_agent
from schemas.agent_outputs import CP6EDebateOutput, DebateAgent

RV_TRADER_PROMPT = """You are an RV Trader on a leveraged finance desk (CP-6E Debate: RV_TRADER persona).

Your focus: relative value, spread levels vs. fair value, entry/exit price.
Assess whether the issuer offers compelling risk/reward at current levels.
Posture options: BUY (attractive entry), HOLD (fair), SELL (expensive / deteriorating RV), AVOID (structural issue).
Conviction 1-5: how strong is your view given the available data?

Provide your posture, conviction, thesis (2-3 sentences), key risks, and key supports.
Respond in JSON only (a single DebateAgent object)."""

COMPLIANCE_PROMPT = """You are a Compliance/Risk Officer on a leveraged finance desk (CP-6E Debate: COMPLIANCE persona).

Your focus: covenant headroom, MNPI risk, regulatory capital implications, structural risks.
Flag any conditions that would restrict the fund's ability to trade freely.
Posture: can the fund HOLD this position without restriction (HOLD), or should exposure be reduced (SELL/AVOID)?

Provide posture, conviction (1-5), thesis, key risks, key supports in JSON (DebateAgent object)."""

CIO_PROMPT = """You are the CIO of a leveraged finance credit fund (CP-6E Debate: CIO persona).

Your focus: portfolio construction, concentration risk, sector allocation, top-down macro view.
Assess where this issuer fits in the portfolio context. Consider position sizing risk.
Posture: BUY (add exposure), HOLD (maintain), SELL (reduce), AVOID (do not add).

Provide posture, conviction (1-5), thesis, key risks, key supports in JSON (DebateAgent object)."""

SYNTHESIS_PROMPT = """You are synthesizing a three-way portfolio debate into a final investment recommendation.

You will receive three analyst views (RV Trader, Compliance, CIO).
Determine consensus posture:
  - If all agree: use that posture
  - If majority agree: use majority posture
  - If split 1-1-1: SPLIT
Compute composite score (1-100): weighted average of conviction × posture (BUY=+, SELL/AVOID=-, HOLD=neutral).
Write a final recommendation (3-5 sentences) synthesizing all views.

Return the full CP6EDebateOutput JSON schema."""


async def _run_persona(persona: str, prompt: str, context: str) -> dict:
    messages = [AgentMessage(
        role="user",
        content=f"ISSUER CONTEXT:\n{context}\n\nProvide your {persona} debate posture.",
    )]
    # output_schema enforces structured output — no manual JSON parsing required
    return await run_agent(prompt, messages, output_schema=DebateAgent, temperature=0.2)


async def run_cp6e(state: dict[str, Any]) -> dict:
    """Run the three-persona portfolio debate in parallel, then synthesize."""
    issuer_id = state.get("issuer_id", "")

    # Build context from upstream outputs
    context_parts = []
    if state.get("cp2_output"):
        cp2 = state["cp2_output"]
        ltm = cp2.get("ltm_period", {})
        context_parts.append(
            f"FUNDAMENTALS (LTM): Revenue=${ltm.get('revenue_mm')}mm, "
            f"EBITDA=${ltm.get('ebitda_mm')}mm, "
            f"Net Leverage={ltm.get('net_leverage_x')}x"
        )
    if state.get("cp3_output"):
        cp3 = state["cp3_output"]
        context_parts.append(
            f"RELATIVE VALUE: Spread={cp3.get('subject_spread_bps')} bps, "
            f"RV Verdict={cp3.get('fair_value_verdict')}"
        )
    if state.get("cp4c_output"):
        cp4c = state["cp4c_output"]
        critical = [h for h in cp4c.get("headroom_items", []) if h.get("severity") == "CRITICAL"]
        if critical:
            context_parts.append(f"COVENANT ALERTS (CRITICAL): {[h['covenant_name'] for h in critical]}")
    if state.get("cp5_reports"):
        blocked = [r["module_id"] for r in state["cp5_reports"] if r.get("blocked")]
        if blocked:
            context_parts.append(f"GOVERNANCE BLOCKS: {blocked}")

    context = "\n".join(context_parts) or f"ISSUER_ID: {issuer_id} [Limited data available]"

    # Run three personas in parallel
    rv_task, comp_task, cio_task = await asyncio.gather(
        _run_persona("RV_TRADER", RV_TRADER_PROMPT, context),
        _run_persona("COMPLIANCE", COMPLIANCE_PROMPT, context),
        _run_persona("CIO", CIO_PROMPT, context),
        return_exceptions=True,
    )

    debate_agents = []
    for persona, result in [("RV_TRADER", rv_task), ("COMPLIANCE", comp_task), ("CIO", cio_task)]:
        if isinstance(result, Exception):
            debate_agents.append({
                "persona": persona, "posture": "HOLD", "conviction": 1,
                "thesis": f"Error during debate: {result}",
                "key_risks": [], "key_supports": [],
            })
        else:
            result["persona"] = persona
            debate_agents.append(result)

    # Synthesize
    debate_summary = "\n".join(
        f"{d['persona']}: {d.get('posture')} (conviction {d.get('conviction')}) — {d.get('thesis', '')}"
        for d in debate_agents
    )
    synthesis_messages = [AgentMessage(
        role="user",
        content=f"THREE-WAY DEBATE:\n{debate_summary}\n\nISSUER CONTEXT:\n{context}\n\nSynthesize into final recommendation.",
    )]
    synthesis = await run_agent(
        SYNTHESIS_PROMPT, synthesis_messages,
        output_schema=CP6EDebateOutput,
    )
    if isinstance(synthesis, dict):
        synthesis["debate_agents"] = debate_agents
    return synthesis
