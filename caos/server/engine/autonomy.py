"""Autonomy orchestrator — chains the Sentinel→Reporter DAG into one invokable cycle.

The DAG stages exist as standalone functions (sentinel.detect_tickets /
changed_issuers, anomaly.detect_anomalies, analyst.investigate,
reporter.compose_draft_report); this module is the thin glue that runs them in
order so the autonomous pipeline is executable end-to-end. No LLM here — the
orchestrator only routes; the LLM spend lives in the Analyst stage and is gated
by ``queryanswer.available()`` (keyless → deterministic-bullets-only draft).

Change-driven, never schedule-driven (the plan's invariant): the Sentinel's
fingerprint-diff decides which issuers get re-scanned; ``prior_fingerprints`` is
the snapshot the caller persisted from the previous cycle. On the first run
(``prior_fingerprints=None``) every issuer is "new-coverage" → a full scan; on
every later run only the issuers whose fingerprint moved are scanned. The cycle
returns the new ``current_fingerprints`` so the caller (route / cron) can persist
it as the prior for the next run.

The single-worker module-level prior in the route is a recorded Phase-1 boundary
(mirrors the existing single-flight lock); the advisory-locks + task-queue slice
(Phase 3 remainder) moves it to Postgres for multi-worker.
"""

from __future__ import annotations

import logging
from typing import Dict, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import Issuer
from engine import queryanswer
from engine.analyst import investigate
from engine.anomaly import detect_anomalies
from engine.queryinsights import fingerprint_issuer
from engine.reporter import compose_draft_report
from engine.sentinel import changed_issuers, detect_tickets

logger = logging.getLogger("caos.autonomy")


async def _current_fingerprints(db: AsyncSession) -> Dict[str, str]:
    """{issuer_id: fingerprint} for every issuer in coverage. A per-issuer
    fingerprint failure is logged and skipped — one bad issuer never aborts the
    cycle (the deterministic-first fault isolation)."""
    issuer_ids = (await db.execute(select(Issuer.id))).scalars().all()
    out: Dict[str, str] = {}
    for iid in issuer_ids:
        try:
            out[iid] = await fingerprint_issuer(db, iid)
        except Exception:  # noqa: BLE001 — fault-isolated per issuer
            logger.exception("fingerprint_issuer failed for %s — skipping", iid)
    return out


async def run_cycle(
    db: AsyncSession,
    prior_fingerprints: Optional[Dict[str, str]] = None,
) -> dict:
    """The autonomous-pipeline entry point. Chains:

    1. Sentinel — diff current vs prior fingerprints → tickets.
    2. ``changed_issuers`` — route new-coverage + changed (not dropped) to scan.
    3. Anomaly Detector — scan the changed issuers (peer context = full universe).
    4. Analyst — HEAVY grounded pass per CRITICAL anomaly (only if the model lane
       is available; keyless → skip, the draft is deterministic-bullets-only).
    5. Reporter — compose the ``AI-GENERATED, UNRATIFIED`` draft.

    Returns ``{draft, current_fingerprints, tickets, n_changed, n_anomalies,
    n_claims}``. The caller persists ``current_fingerprints`` as the prior for the
    next cycle. Each stage is fault-isolated; a failure composes an honest draft
    from whatever survived (never fabricates, never aborts)."""
    current = await _current_fingerprints(db)
    tickets = detect_tickets(current, prior_fingerprints or {})
    changed = changed_issuers(tickets)

    anomalies = []
    if changed:
        try:
            anomalies = await detect_anomalies(db, issuer_ids=changed)
        except Exception:  # noqa: BLE001 — fault-isolated
            logger.exception("Anomaly Detector failed — composing empty-anomaly draft")

    claims = []
    if anomalies and queryanswer.available():
        try:
            claims = await investigate(db, anomalies)
        except Exception:  # noqa: BLE001 — fault-isolated
            logger.exception("Analyst batch failed — composing draft from anomalies only")

    draft = await compose_draft_report(db, anomalies, claims)
    return {
        "draft": draft,
        "current_fingerprints": current,
        "tickets": [t.__dict__ for t in tickets],
        "n_changed": len(changed),
        "n_anomalies": len(anomalies),
        "n_claims": len(claims),
    }
