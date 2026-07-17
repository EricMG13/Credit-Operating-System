"""Reporter — the deterministic composer at the end of the autonomous DAG (Phase 3).

Stage 6 of the Sentinel→Reporter pipeline. **Composition, not generation** (plan
§12.3): the LLM work happened in the Analyst; the Reporter assembles the
validated claims + the deterministic anomaly bullets + the Metric Engine exhibits
into a committee-shaped DRAFT artifact. No LLM here, no spend — every figure in
the report already passed the Phase-2 gate stack in the Analyst lane; the
Reporter only lays it out.

**Autonomous drafting, NOT publishing** (plan §13.3 anti-pattern + RT-2026-07-07-14):
the artifact ships with ``status="draft"``, ``ratified=False``,
``export_allowed=False``, and the ``AI-GENERATED, UNRATIFIED`` marking. It is
excluded from committee export until an analyst ratifies it via ``ratify()`` —
the same flywheel trust boundary the Query overlay uses. A draft is never a
committee pack.

Every anomaly appears exactly once: investigated anomalies with surviving claims
→ rendered as those (cited, claim-typed) claims; investigated anomalies whose
claims all failed the gates → rendered as a deterministic bullet (the signal is
still listed, honestly, without fabricated prose); sub-threshold anomalies →
deterministic bullets (no LLM pass). So the DAG never silently drops a flagged
signal, and never fills silence with fabrication.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Dict, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import Issuer
from engine.analyst import ValidatedClaim
from engine.anomaly import Anomaly
from engine.metricengine import build_metric_facts

logger = logging.getLogger("caos.reporter")

_MARKING = "AI-GENERATED, UNRATIFIED"


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _issuer_names(db: AsyncSession, issuer_ids: List[str]) -> Dict[str, str]:
    if not issuer_ids:
        return {}
    rows = (await db.execute(
        select(Issuer.id, Issuer.name).where(Issuer.id.in_(issuer_ids))
    )).all()
    return {r[0]: r[1] for r in rows}


async def compose_draft_report(
    db: AsyncSession,
    anomalies: List[Anomaly],
    claims: List[ValidatedClaim],
) -> dict:
    """The deterministic Reporter entry point.

    Returns a committee-shaped DRAFT grouping claims + anomaly bullets + Metric
    Engine exhibits by issuer, sections severity-ranked descending. The draft is
    ``ratified=False`` / ``export_allowed=False`` / marked ``AI-GENERATED,
    UNRATIFIED`` — never a committee pack until ``ratify()`` flips it. Empty
    input → an empty draft (the pipeline ran, found nothing, says so honestly)."""
    claims_by_issuer: Dict[str, List[ValidatedClaim]] = {}
    for c in claims:
        claims_by_issuer.setdefault(c.issuer_id or "_unknown", []).append(c)
    anomalies_by_issuer: Dict[str, List[Anomaly]] = {}
    for a in anomalies:
        anomalies_by_issuer.setdefault(a.issuer_id or "_unknown", []).append(a)

    issuer_ids = sorted(set(claims_by_issuer) | set(anomalies_by_issuer))
    names = await _issuer_names(db, [iid for iid in issuer_ids if iid != "_unknown"])

    sections: List[dict] = []
    for iid in issuer_ids:
        issuer_claims = claims_by_issuer.get(iid, [])
        issuer_anoms = anomalies_by_issuer.get(iid, [])
        # An anomaly is "covered" if any surviving claim cites its kind — those
        # render as claims; the rest render as deterministic bullets (sub-threshold
        # OR investigated-but-gates-dropped-all). No signal vanishes silently.
        covered_kinds = {c.anomaly_kind for c in issuer_claims}
        bullets = [a for a in issuer_anoms if a.kind not in covered_kinds]
        max_sev = max((a.severity for a in issuer_anoms), default=0.0)

        # Deterministic exhibit: the Metric Engine facts for this issuer (deltas +
        # peer z), rendered as a table — the numbers the claims narrate.
        exhibit: List[dict] = []
        try:
            if iid != "_unknown":
                facts = await build_metric_facts(db, iid, walk="metric-trend")
                exhibit = [{"id": f.id, "label": f.label, "text": f.text,
                            "numbers": list(f.numbers)} for f in facts]
        except Exception:  # noqa: BLE001 — exhibit is best-effort, never blocks the draft
            logger.exception("Reporter exhibit build failed for %s — continuing", iid)

        sections.append({
            "issuer_id": iid if iid != "_unknown" else None,
            "issuer_name": names.get(iid, iid if iid != "_unknown" else "Unknown"),
            "max_severity": max_sev,
            "claims": [
                {"text": c.text, "claim_type": c.claim_type,
                 "anomaly_kind": c.anomaly_kind, "anomaly_severity": c.anomaly_severity,
                 "chunk_ids": list(c.chunk_ids), "fact_ids": list(c.fact_ids),
                 "model": c.model}
                for c in sorted(issuer_claims, key=lambda c: c.anomaly_severity, reverse=True)
            ],
            "deterministic_bullets": [
                {"kind": a.kind, "severity": a.severity, "metric": a.metric,
                 "direction": a.direction, "chunk_id": a.chunk_id,
                 "context": dict(a.context or {})}
                for a in sorted(bullets, key=lambda a: a.severity, reverse=True)
            ],
            "exhibit": exhibit,
        })

    sections.sort(key=lambda s: s["max_severity"], reverse=True)

    n_claims = sum(len(s["claims"]) for s in sections)
    n_bullets = sum(len(s["deterministic_bullets"]) for s in sections)
    return {
        "status": "draft",
        "ai_generated": True,
        "ratified": False,
        "export_allowed": False,
        "marking": _MARKING,
        "generated_at": _utcnow_iso(),
        "sections": sections,
        "summary": {
            "n_sections": len(sections),
            "n_claims": n_claims,
            "n_deterministic_bullets": n_bullets,
            "n_anomalies": len(anomalies),
        },
    }


def ratify(draft: dict) -> dict:
    """The analyst-flywheel step: flip a draft to ratified + export-allowed. The
    Reporter NEVER auto-ratifies — autonomous drafting, not publishing. Returns a
    NEW dict (the original draft stays unratified for audit)."""
    if draft.get("status") != "draft":
        return draft  # only a draft can be ratified; don't mutate a non-draft
    return {**draft, "ratified": True, "export_allowed": True,
            "marking": "AI-GENERATED, RATIFIED", "ratified_at": _utcnow_iso()}


def is_exportable(draft: dict) -> bool:
    """The committee-export gate for an autonomous draft. Mirrors
    ``engine.report.committee_export_allowed`` for run-level packs: a draft is
    exportable only once ratified. The UI calls this before offering the export
    action so an unratified autonomous draft can never reach a committee pack.

    Composes with the web-provenance gate (engine/provenance.py): a web-grounded
    draft (``provenance="web"``) is export-blocked EVEN when ratified, until an
    analyst separately web-ratifies it — the plan's "separate provenance, separate
    marking." Vault drafts (the default) are unaffected by the web gate."""
    if not bool(draft.get("ratified")) or draft.get("status") != "draft":
        return False
    from engine import provenance
    return provenance.export_allowed(draft)
