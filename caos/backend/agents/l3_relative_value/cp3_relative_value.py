"""CP-3: Relative Value Agent. Compares issuer to peer set using market data runs."""

from __future__ import annotations

from sqlalchemy import select

from core.claude_client import AgentMessage, run_agent
from db.models import FinancialSnapshot, MarketDataRun
from db.session import AsyncSessionLocal
from schemas.agent_outputs import CP3RelativeValueOutput

SYSTEM_PROMPT = """You are a senior leveraged finance relative value analyst (CP-3: Relative Value).

You will receive market data (spreads, YTW, DM) and fundamental data (net leverage) for the subject issuer
and a set of comparables. Your task:

1. Assess whether the subject issuer trades CHEAP, FAIR, or RICH vs. comparables.
2. All conclusions must reference specific spread/leverage figures from the provided data.
3. Do NOT cite market color or consensus views not present in the data.
4. Provide a concise RV commentary (2-3 sentences, factual).

SOURCE-FIRST DISCIPLINE: If comparable data is insufficient, state "Insufficient comparable data"
rather than making relative assessments. Do not infer implied fair value from general market knowledge.

Return only the JSON schema."""


async def run_cp3(issuer_id: str) -> dict:
    async with AsyncSessionLocal() as db:
        # Get latest market data for subject
        subject_mdr = await db.execute(
            select(MarketDataRun)
            .where(MarketDataRun.issuer_id == issuer_id)
            .order_by(MarketDataRun.run_date.desc())
            .limit(1)
        )
        subject_mdr = subject_mdr.scalar_one_or_none()

        # Get latest financials for subject
        subject_fin = await db.execute(
            select(FinancialSnapshot)
            .where(FinancialSnapshot.issuer_id == issuer_id)
            .order_by(FinancialSnapshot.period_end_date.desc())
            .limit(1)
        )
        subject_fin = subject_fin.scalar_one_or_none()

        # Get comparables (all other issuers' latest market data + financials)
        all_mdr = await db.execute(
            select(MarketDataRun).order_by(MarketDataRun.run_date.desc()).limit(20)
        )
        all_mdr = all_mdr.scalars().all()

    market_summary = f"""
SUBJECT ISSUER ({issuer_id}):
  Spread: {getattr(subject_mdr, 'spread_bps', 'N/A')} bps
  YTW: {getattr(subject_mdr, 'ytw_pct', 'N/A')}%
  Net Leverage: {getattr(subject_fin, 'net_leverage', 'N/A')}x

COMPARABLES (from pricing runs):
{chr(10).join(f"  Instrument: {m.instrument}, Spread: {m.spread_bps} bps, YTW: {m.ytw_pct}%" for m in all_mdr[:10])}
"""

    messages = [AgentMessage(
        role="user",
        content=f"ISSUER_ID: {issuer_id}\n\n{market_summary}\n\nAssess relative value.",
    )]
    return await run_agent(SYSTEM_PROMPT, messages, output_schema=CP3RelativeValueOutput)
