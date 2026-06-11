"""CP-5: Integrity QA — programmatic middleware validating all agent outputs."""

from __future__ import annotations

from core.severity_engine import get_severity_engine


async def run_cp5(module_id: str, payload: dict) -> dict:
    """
    Run the severity engine against an agent payload.
    Returns serialized IntegrityReport.
    A CRITICAL verdict sets blocked=True — the DAG node will not propagate downstream.
    """
    engine = get_severity_engine()
    report = engine.evaluate(module_id, payload)
    return report.model_dump()
