"""Deterministic, source-backed exhibits for a completed Deep Research job.

The research model supplies narrative and URLs. These figures are deliberately
separate: they are constructed from finite CAOS metric facts tied to the exact
issuer run selected in the analysis context.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import AnalysisContextRecord, MetricFact, ResearchJob, Run
from engine.periods import is_finite_number


def _figure(
    *,
    figure_id: str,
    kind: str,
    title: str,
    unit: str,
    as_of: str | None,
    source_ids: list[str],
    accessible_summary: str,
    columns: list[dict[str, str]],
    rows: list[dict[str, Any]],
    encodings: dict[str, str],
) -> dict[str, Any]:
    return {
        "id": figure_id,
        "kind": kind,
        "title": title,
        "unit": unit,
        "as_of": as_of,
        "source_ids": source_ids,
        "accessible_summary": accessible_summary,
        "columns": columns,
        "rows": rows,
        "encodings": encodings,
    }


async def build_research_figures(db: AsyncSession, job: ResearchJob) -> list[dict[str, Any]]:
    """Build bounded semantic figure records, or no figures when lineage is absent.

    A free-text research subject is not sufficient to infer an issuer. The context
    must explicitly bind exactly one issuer and its run; this avoids a plausible
    chart being attached to the wrong issuer when names are ambiguous.
    """
    if job.demo or not job.context_id:
        return []
    context = await db.get(AnalysisContextRecord, job.context_id)
    if context is None or len(context.issuer_ids or []) != 1:
        return []
    issuer_id = context.issuer_ids[0]
    run_id = (context.artifacts or {}).get("issuer_run_id")
    if not isinstance(run_id, str) or not run_id:
        return []
    run = await db.get(Run, run_id)
    if run is None or run.issuer_id != issuer_id:
        return []
    facts = list((await db.execute(
        select(MetricFact)
        .where(
            MetricFact.issuer_id == issuer_id,
            MetricFact.run_id == run.id,
            MetricFact.metric_key.in_(("net_leverage", "interest_coverage", "composite_percentile")),
        )
        .order_by(MetricFact.metric_key, MetricFact.period, MetricFact.id)
    )).scalars().all())
    good_facts = [fact for fact in facts if is_finite_number(fact.value)]
    if not good_facts:
        return []

    as_of = str(run.as_of_date) if run.as_of_date else None
    figures: list[dict[str, Any]] = []
    labels = {"net_leverage": "Net leverage", "interest_coverage": "Interest coverage"}
    trend_by_metric = {
        metric_key: [fact for fact in good_facts if fact.metric_key == metric_key]
        for metric_key in labels
    }
    # A line with one point per unrelated metric is a plausible-looking non-
    # trend. Render only series that carry at least two periods of their own.
    trend = [
        fact
        for metric_key in labels
        if len(trend_by_metric[metric_key]) >= 2
        for fact in trend_by_metric[metric_key]
    ]
    if trend:
        rows = [
            {"period": fact.period, "value": float(fact.value), "series": labels[fact.metric_key]}
            for fact in trend
        ]
        latest = rows[-1]
        figures.append(_figure(
            figure_id="leverage-coverage-trend",
            kind="line",
            title="Leverage and coverage trend",
            unit="x",
            as_of=as_of,
            source_ids=[fact.id for fact in trend],
            accessible_summary=(
                f"Verified CAOS facts show {latest['series'].lower()} at {latest['value']:.2f}x "
                f"in {latest['period']}."
            ),
            columns=[
                {"key": "period", "label": "Period"},
                {"key": "series", "label": "Metric"},
                {"key": "value", "label": "Value (x)"},
            ],
            rows=rows,
            encodings={"x": "period", "y": "value", "series": "series"},
        ))
    percentile = [fact for fact in good_facts if fact.metric_key == "composite_percentile"]
    if percentile:
        latest = percentile[-1]
        figures.append(_figure(
            figure_id="relative-value-position",
            kind="bar",
            title="Relative-value position",
            unit="percentile",
            as_of=as_of,
            source_ids=[latest.id],
            accessible_summary=(
                f"The verified relative-value composite percentile is {float(latest.value):.1f} "
                f"for {latest.period}."
            ),
            columns=[
                {"key": "label", "label": "Measure"},
                {"key": "value", "label": "Percentile"},
            ],
            rows=[{"label": "Composite percentile", "value": float(latest.value)}],
            encodings={"x": "label", "y": "value"},
        ))
    return figures
