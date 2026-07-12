"""Analyst agent — the LLM fourth stage of the autonomous agent DAG (Phase 3).

Consumes the severity-ranked ``Anomaly`` records the Anomaly Detector emits and,
for each CRITICAL one, runs a HEAVY grounded pass that explains the flagged,
pre-quantified pattern in cited prose. The pass reuses the Query answer lane's
``_generate`` so the **entire Phase-2 gate stack** runs on every Analyst claim —
citation gate → numeric gate → fact cross-reference → bounded self-correction →
LIGHT-tier entailment demote — with zero gate duplication. ``_generate`` does not
persist (only ``answer()`` does), so the Analyst's claims are transient inputs to
the Reporter, not cached answers.

Spend is routed by severity, not schedule (the plan's invariant): only anomalies
with ``severity >= _INVESTIGATE_SEVERITY`` get an LLM pass, and the batch is
capped at ``max_per_run``. Lower-severity anomalies are still listed by the
Reporter as deterministic bullet points without an LLM pass. Per-anomaly fault
isolation: a failure (timeout, no grounding, parse error) returns ``[]`` for that
anomaly and never aborts the batch — the deterministic surface stays up.

Every emitted ``ValidatedClaim`` carries the source anomaly's kind + severity so
the Reporter can rank and group without re-querying, and the surviving chunk/fact
refs so each claim stays one click from its evidence — the same provenance
discipline the Query lanes enforce.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from engine.anomaly import Anomaly
from engine import presets
from engine.queryanswer import _generate

logger = logging.getLogger("caos.analyst")

# Spend routing by severity (Phase 4 model-tier routing). The Anomaly Detector
# flags at robust-z ≥ 3.0; the Analyst routes every flagged anomaly to a pass,
# but the MODEL TIER scales with severity so spend is proportional to signal:
#   severity ≥ 5.0 → HEAVY (clearly extreme — a PM must see this explained)
#   3.0 ≤ severity < 5.0 → LIGHT (material but routine — a cheaper pass)
# Below 3.0 the Anomaly Detector does not emit, so every emitted anomaly gets a
# pass. The full Phase-2 gate stack runs identically on either tier — a weaker
# LIGHT model simply produces more drop-heavy replies (more self-correction
# retries, still bounded), never ungated claims.
_INVESTIGATE_LIGHT_SEVERITY = 3.0
_INVESTIGATE_HEAVY_SEVERITY = 5.0
# Spend bound: at most this many LLM passes per investigate() call, regardless of
# how many anomalies surfaced. Prevents a noisy vault from blowing the budget on
# one Sentinel run; covers HEAVY + LIGHT combined.
_MAX_PER_RUN = 8


@dataclass
class ValidatedClaim:
    """One Analyst-generated, gate-surviving claim about a flagged anomaly.

    Carries the source anomaly's kind + severity so the Reporter ranks and groups
    without re-querying, and the surviving chunk/fact refs so the claim stays one
    click from its evidence. ``claim_type`` is the Phase-2 epistemic label
    (observation / causal-hypothesis / risk-flag) — the entailment gate may have
    demoted an observation to a hypothesis, which is the point of the label."""

    text: str
    claim_type: str  # observation | causal-hypothesis | risk-flag
    issuer_id: Optional[str]
    anomaly_kind: str
    anomaly_severity: float
    chunk_ids: List[str] = field(default_factory=list)
    fact_ids: List[str] = field(default_factory=list)
    model: Optional[str] = None


def _question_for(anomaly: Anomaly) -> str:
    """The seed question handed to the answer lane. Phrased so the model explains
    the flagged pattern from evidence rather than re-discovering it — the LLM's
    job narrows from "find something interesting" to "explain this pre-quantified
    signal," which is where LLMs are reliable (plan §12.2)."""
    ctx = anomaly.context or {}
    ctx_bit = ""
    if "change_point_period" in ctx:
        ctx_bit = f" Change-point at {ctx['change_point_period']}."
    elif "peer_scope" in ctx:
        ctx_bit = f" Peer scope: {ctx['peer_scope']}."
    return (f"Explain this flagged credit signal for {anomaly.issuer_name}: "
            f"{anomaly.kind} on {anomaly.metric} ({anomaly.direction}, "
            f"severity {anomaly.severity:g}).{ctx_bit} Cite the source chunks "
            f"and metric facts that explain the move; label each claim "
            f"observation, causal-hypothesis, or risk-flag.")


def tier_for(anomaly: Anomaly) -> str:
    """The model-tier router: HEAVY for clearly-extreme anomalies (severity ≥ 5.0),
    LIGHT for material-but-routine ones (3.0 ≤ severity < 5.0). The full Phase-2
    gate stack runs on either tier; the tier only scales spend with signal."""
    if anomaly.severity >= _INVESTIGATE_HEAVY_SEVERITY:
        return presets.HEAVY
    return presets.LIGHT


async def investigate_anomaly(db: AsyncSession, anomaly: Anomaly,
                              *, tier: Optional[str] = None) -> List[ValidatedClaim]:
    """One grounded pass for one anomaly through the full Phase-2 gate stack.

    Reuses ``queryanswer._generate`` (Metric Engine → retrieval → packer →
    self-correction → entailment) so every gate runs without duplication. Returns
    ``[]`` on any failure (timeout, no grounding, parse error) — fault-isolated,
    the batch never aborts. ``_generate`` does not persist, so the Analyst's
    claims are transient Reporter inputs. ``tier`` defaults to ``tier_for(anomaly)``
    (HEAVY for critical, LIGHT for material) — Phase-4 spend routing."""
    if tier is None:
        tier = tier_for(anomaly)
    question = _question_for(anomaly)
    try:
        payload = await _generate(db, question, capability_id=None,
                                  issuer_id=anomaly.issuer_id, tier=tier)
    except Exception:  # noqa: BLE001 — fault-isolated per anomaly
        logger.exception("Analyst investigation failed for %s %s — returning []",
                         anomaly.kind, anomaly.issuer_id)
        return []
    if payload.get("unavailable"):
        return []  # gates dropped everything — honest silence, no fabrication
    model = payload.get("model")
    out: List[ValidatedClaim] = []
    for s in payload.get("sentences", []):
        out.append(ValidatedClaim(
            text=s["text"],
            claim_type=s.get("claim_type", "observation"),
            issuer_id=anomaly.issuer_id,
            anomaly_kind=anomaly.kind,
            anomaly_severity=anomaly.severity,
            chunk_ids=list(s.get("chunk_ids", [])),
            fact_ids=list(s.get("fact_ids", [])),
            model=model,
        ))
    return out


async def investigate(db: AsyncSession, anomalies: List[Anomaly],
                      *, max_per_run: int = _MAX_PER_RUN) -> List[ValidatedClaim]:
    """The Analyst batch entry point. Iterates the severity-ranked anomalies
    (``detect_anomalies`` already sorts descending), runs a grounded pass for each
    flagged one (``severity ≥ _INVESTIGATE_LIGHT_SEVERITY``), routing HEAVY for
    critical (≥5.0) and LIGHT for material (3.0–5.0). Capped at ``max_per_run``
    LLM passes total (HEAVY + LIGHT combined). Sub-threshold anomalies are skipped
    (the Reporter lists them as deterministic bullets). Per-anomaly fault-isolated;
    empty input → []."""
    out: List[ValidatedClaim] = []
    spent = 0
    for anomaly in anomalies:
        if anomaly.severity < _INVESTIGATE_LIGHT_SEVERITY:
            continue  # below the LIGHT bar — no LLM spend
        if spent >= max_per_run:
            logger.info("Analyst cap reached (%d passes) — %d anomalies uninvestigated",
                        spent, sum(1 for a in anomalies
                                   if a.severity >= _INVESTIGATE_LIGHT_SEVERITY) - spent)
            break
        claims = await investigate_anomaly(db, anomaly, tier=tier_for(anomaly))
        out.extend(claims)
        spent += 1
    return out


def should_investigate(anomaly: Anomaly) -> bool:
    """The severity router: True when an anomaly gets an Analyst LLM pass (HEAVY
    or LIGHT). Mirrors ``investigate``'s gate so the Reporter can know in advance
    which anomalies will carry LLM claims vs deterministic bullets."""
    return anomaly.severity >= _INVESTIGATE_LIGHT_SEVERITY
