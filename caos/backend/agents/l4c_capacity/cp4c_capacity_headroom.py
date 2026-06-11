"""CP-4C: Covenant Capacity & Headroom Agent. Calculates headroom % and triggers severity alerts."""

from __future__ import annotations

from sqlalchemy import select

from core.claude_client import AgentMessage, run_agent
from db.models import CovenantSnapshot, FinancialSnapshot
from db.session import AsyncSessionLocal
from schemas.agent_outputs import CP4CCapacityOutput

SYSTEM_PROMPT = """You are a senior leveraged finance analyst (CP-4C: Covenant Capacity Headroom).

You will receive current financial metrics and covenant limits extracted from CP-2 and CP-4.
For each covenant:
1. Calculate headroom % = (limit - actual) / limit × 100
2. Assign severity:
   - OK:       headroom > 25%
   - WARNING:  headroom ≤ 25% (i.e., >75% utilized)
   - CRITICAL: headroom ≤ 10% (i.e., >90% utilized)

Also calculate:
- Liquidity runway in months (cash / monthly cash burn) — only if cash and burn rate are provided.
- RCF availability (commitment - drawn) — only if both figures are provided.

SOURCE-FIRST DISCIPLINE: Use only the figures provided. If a covenant limit or actual value
is missing, set the headroom_pct to null and severity to "OK" — do NOT estimate.

Return only the JSON schema."""


async def run_cp4c(issuer_id: str) -> dict:
    async with AsyncSessionLocal() as db:
        fin = await db.execute(
            select(FinancialSnapshot)
            .where(FinancialSnapshot.issuer_id == issuer_id)
            .order_by(FinancialSnapshot.period_end_date.desc())
            .limit(1)
        )
        fin = fin.scalar_one_or_none()

        covenants = await db.execute(
            select(CovenantSnapshot)
            .where(CovenantSnapshot.issuer_id == issuer_id)
            .order_by(CovenantSnapshot.created_at.desc())
        )
        covenants = covenants.scalars().all()

    fin_data = f"""
FINANCIAL SNAPSHOT:
  Net Leverage: {getattr(fin, 'net_leverage', 'N/A')}x
  Interest Coverage: {getattr(fin, 'interest_coverage', 'N/A')}x
  FCF: ${getattr(fin, 'fcf', 'N/A')}mm
"""
    covenant_data = "\n".join(
        f"  {c.covenant_name}: Limit={c.limit_value}, Actual={c.actual_value}"
        for c in covenants
    ) if covenants else "  [No covenant snapshots — run CP-4 first]"

    messages = [AgentMessage(
        role="user",
        content=f"ISSUER_ID: {issuer_id}\n\n{fin_data}\nCOVENANT DATA:\n{covenant_data}\n\n"
                "Calculate headroom for all covenants and assess severity.",
    )]
    return await run_agent(SYSTEM_PROMPT, messages, output_schema=CP4CCapacityOutput)
