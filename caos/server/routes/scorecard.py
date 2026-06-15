"""Loan Scorecard — documentation-protection score for a single deal.

Reads the deal's ``deal_terms`` (whatever a covenant-review extraction or the demo
seed populated) and runs the deterministic methodology in [engine/scorecard.py]:
6 quality scores → 5 sub-scores → a weighted composite, on the 1 (most
protective) → 5 (deficient) scale. No analysis happens at request time beyond the
pure scoring; every score returns the input drivers that produced it.

When the deal has covenant-review-document-grounded terms the basis is
``covenant_review``; otherwise the score is computed from the empirical signals
alone (``methodology``) — the fallback behaviour the surface flags to the analyst.
See docs/SCORECARD_SCHEMA.md.
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import Deal, DealTerm, Issuer, get_db
from engine import scorecard as sc
from identity import CallerIdentity, get_identity

router = APIRouter()


# ─── Response models ─────────────────────────────────────────────────────────
class DriverOut(BaseModel):
    label: str
    detail: str
    contribution: Optional[float] = None


class ScoreOut(BaseModel):
    key: str
    label: str
    value: Optional[float]
    band: Optional[str]
    confidence: str
    basis: str
    drivers: List[DriverOut]


class ScorecardOut(BaseModel):
    deal_id: str
    deal_label: str
    issuer_id: str
    issuer_name: Optional[str] = None
    seniority: Optional[str] = None          # 1L | 2L | None
    basis: str                               # covenant_review | methodology | mixed | none
    composite: ScoreOut
    sub_scores: List[ScoreOut]
    quality_scores: List[ScoreOut]
    limitation_flags: List[str]


def _to_out(r: sc.ScoreResult) -> ScoreOut:
    return ScoreOut(
        key=r.key, label=r.label, value=r.value, band=r.band,
        confidence=r.confidence, basis=r.basis,
        drivers=[DriverOut(label=d.label, detail=d.detail, contribution=d.contribution) for d in r.drivers],
    )


def _term_view(dt: DealTerm) -> sc.TermValue:
    # Doc-grounded == traces to an actual document chunk (vs a seeded/empirical
    # value), which is what separates the covenant-review basis from methodology.
    doc_grounded = bool(dt.document_chunk_id) and dt.lineage_class not in (
        "Untraced", "Insufficient Information",
    )
    return sc.TermValue(num=dt.value_num, text=dt.value_text, confidence=dt.confidence, doc_grounded=doc_grounded)


# ─── Endpoint ────────────────────────────────────────────────────────────────
@router.get("/{deal_id}", response_model=ScorecardOut)
async def get_scorecard(
    deal_id: str,
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    deal = await db.get(Deal, deal_id)
    if deal is None:
        raise HTTPException(404, "Deal not found")

    issuer = await db.get(Issuer, deal.issuer_id)
    rows = (await db.execute(select(DealTerm).where(DealTerm.deal_id == deal_id))).scalars().all()
    terms = {dt.term_key: _term_view(dt) for dt in rows}

    card = sc.score_deal(terms, label=deal.label)
    seniority = sc.detect_seniority(deal.label, terms)

    return ScorecardOut(
        deal_id=deal.id, deal_label=deal.label, issuer_id=deal.issuer_id,
        issuer_name=(issuer.name if issuer else None), seniority=seniority, basis=card.basis,
        composite=_to_out(card.composite),
        sub_scores=[_to_out(s) for s in card.sub_scores],
        quality_scores=[_to_out(q) for q in card.quality_scores],
        limitation_flags=card.limitation_flags,
    )
