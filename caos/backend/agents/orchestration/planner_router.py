"""CP-X: PlannerRouter — generates the DAG execution plan."""

from __future__ import annotations

from typing import Literal

FULL_RUN_PLAN = ["CP-1", "CP-1A", "CP-2", "CP-3", "CP-4", "CP-4C", "CP-5", "CP-5B", "CP-6E"]
DELTA_RUN_PLAN = ["CP-1B", "CP-2", "CP-4C", "CP-5", "CP-5B", "CP-6E"]


async def run_cpx(
    run_type: Literal["FULL_RUN", "DELTA_RUN"] | None,
    issuer_id: str,
    force_full: bool = False,
) -> list[str]:
    """
    Return ordered execution plan for the given run type.
    One-Owner-Per-Object: each CP module appears once in the plan.
    """
    if force_full or run_type == "FULL_RUN":
        return FULL_RUN_PLAN
    elif run_type == "DELTA_RUN":
        return DELTA_RUN_PLAN
    else:
        return FULL_RUN_PLAN  # Default to full run on ambiguity
