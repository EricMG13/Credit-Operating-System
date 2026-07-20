"""Versioned thesis memory and predictions-vs-realized."""

from __future__ import annotations

import asyncio
from datetime import date, datetime, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
import vault_export
from database import (
    Decision,
    Issuer,
    ThesisPrediction,
    ThesisVersion,
    get_db,
    register_rollback_cleanup,
)
from engine.periods import is_finite_number
from identity import CallerIdentity, get_identity, get_write_identity
from tenancy import require_issuer

router = APIRouter()

_THESIS_WRITE_MAX_PER_MINUTE = 30


class PredictionIn(BaseModel):
    metric: str = Field(min_length=1, max_length=120)
    horizon: date
    predicted: float


class ThesisVersionIn(BaseModel):
    issuer_id: str = Field(min_length=1, max_length=36)
    thesis_md: str = Field(min_length=1, max_length=50_000)
    trigger: Literal["manual", "decision", "alert", "model_override"] = "manual"
    linked_decision_id: Optional[str] = Field(default=None, max_length=36)
    linked_alert_key: Optional[str] = Field(default=None, max_length=160)
    predictions: List[PredictionIn] = Field(default_factory=list, max_length=50)


class PredictionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    metric: str
    horizon: date
    predicted: float
    realized: Optional[float]


class ThesisVersionOut(BaseModel):
    id: str
    issuer_id: str
    version: int
    thesis_md: str
    trigger: str
    linked_decision_id: Optional[str]
    linked_alert_key: Optional[str]
    created_by: Optional[str]
    created_at: datetime
    predictions: List[PredictionOut] = []


async def create_thesis_version(
    db: AsyncSession,
    body: ThesisVersionIn,
    caller: CallerIdentity,
) -> ThesisVersion:
    issuer = (await db.execute(
        select(Issuer).where(Issuer.id == body.issuer_id).with_for_update()
    )).scalar_one_or_none()
    require_issuer(caller, issuer)
    if body.linked_decision_id:
        decision = await db.get(Decision, body.linked_decision_id)
        if decision is None or decision.issuer_id != body.issuer_id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Linked decision does not belong to issuer")
    current = (await db.execute(
        select(func.max(ThesisVersion.version)).where(ThesisVersion.issuer_id == body.issuer_id)
    )).scalar() or 0
    row = ThesisVersion(
        issuer_id=body.issuer_id,
        version=current + 1,
        thesis_md=body.thesis_md.strip(),
        trigger=body.trigger,
        linked_decision_id=body.linked_decision_id,
        linked_alert_key=body.linked_alert_key,
        created_by=caller.id,
    )
    db.add(row)
    await db.flush()
    for prediction in body.predictions:
        if not is_finite_number(prediction.predicted):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Prediction must be finite")
        db.add(ThesisPrediction(
            thesis_version_id=row.id,
            metric=prediction.metric.strip(),
            horizon=prediction.horizon,
            predicted=prediction.predicted,
        ))
    await db.flush()
    return row


async def _out(db: AsyncSession, row: ThesisVersion) -> ThesisVersionOut:
    predictions = (await db.execute(
        select(ThesisPrediction).where(ThesisPrediction.thesis_version_id == row.id)
        .order_by(ThesisPrediction.horizon, ThesisPrediction.metric)
    )).scalars().all()
    return ThesisVersionOut(
        id=row.id, issuer_id=row.issuer_id, version=row.version,
        thesis_md=row.thesis_md, trigger=row.trigger,
        linked_decision_id=row.linked_decision_id,
        linked_alert_key=row.linked_alert_key, created_by=row.created_by,
        created_at=row.created_at,
        predictions=[PredictionOut.model_validate(p) for p in predictions],
    )


async def _vault_user_thesis(
    db: AsyncSession,
    row: ThesisVersion,
    caller: CallerIdentity,
    vault_dir: str,
) -> None:
    """Write one append-only analyst note and bind its issuer wikilink.

    The route-owned database transaction is still open. If any work below
    fails before commit, the registered cleanup removes only the new note; an
    ambiguous commit-time failure retains it for reconciliation.
    """
    issuer = await db.get(Issuer, row.issuer_id)
    require_issuer(caller, issuer)
    assert issuer is not None  # narrowed by require_issuer
    body, linked = vault_export.autolink_issuers(
        f"{issuer.name}\n\n## Investment thesis\n\n{row.thesis_md}",
        [(issuer.name, issuer.ticker)],
    )
    if issuer.name not in linked:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "Investment Thesis could not be linked to the issuer vault record.",
        )
    subject = issuer.ticker or issuer.name
    title = vault_export.memo_note_title(f"{subject} Investment Thesis V{row.version}")
    markdown = vault_export.render_memo(
        title,
        "research",
        caller.email,
        f"thesis-version:{row.id}",
        body,
        date=datetime.now(timezone.utc).date().isoformat(),
    )
    try:
        path = await asyncio.to_thread(vault_export.write_memo, vault_dir, title, markdown)
    except OSError as exc:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "Investment Thesis vault write failed; no thesis version was saved.",
        ) from exc

    register_rollback_cleanup(db, lambda: path.unlink(missing_ok=True))
    try:
        await vault_export.sync_analyst_memos(db)
    except Exception as exc:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "Investment Thesis vault link failed; no thesis version was saved.",
        ) from exc


@router.post("", response_model=ThesisVersionOut, status_code=status.HTTP_201_CREATED)
async def create_thesis(
    body: ThesisVersionIn,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_write_identity),
):
    if not rate_limit.hit(
        f"thesis:{caller.id}",
        max_attempts=_THESIS_WRITE_MAX_PER_MINUTE,
        window_seconds=60,
    ):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Thesis rate limit reached — try again in a minute.",
        )
    # Direct POSTs are analyst-authored regardless of the caller-supplied
    # trigger label. System decision/committee events call
    # ``create_thesis_version`` directly and retain their existing DB-only
    # governed-history contract.
    from config import get_settings

    settings = get_settings()
    if not settings.vault_export_dir:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Investment Thesis vault is not configured; no thesis version was saved.",
        )
    row = await create_thesis_version(db, body, caller)
    await _vault_user_thesis(db, row, caller, settings.vault_export_dir)
    return await _out(db, row)


@router.get("", response_model=List[ThesisVersionOut])
async def list_thesis(
    issuer_id: str = Query(...),
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    require_issuer(caller, await db.get(Issuer, issuer_id))
    rows = (await db.execute(
        select(ThesisVersion).where(ThesisVersion.issuer_id == issuer_id)
        .order_by(ThesisVersion.version.desc()).limit(100)
    )).scalars().all()
    predictions = (await db.execute(
        select(ThesisPrediction).where(
            ThesisPrediction.thesis_version_id.in_([row.id for row in rows])
        ).order_by(ThesisPrediction.horizon, ThesisPrediction.metric)
    )).scalars().all() if rows else []
    by_version: dict[str, list[PredictionOut]] = {row.id: [] for row in rows}
    for prediction in predictions:
        by_version[prediction.thesis_version_id].append(PredictionOut.model_validate(prediction))
    return [ThesisVersionOut(
        id=row.id, issuer_id=row.issuer_id, version=row.version,
        thesis_md=row.thesis_md, trigger=row.trigger,
        linked_decision_id=row.linked_decision_id,
        linked_alert_key=row.linked_alert_key, created_by=row.created_by,
        created_at=row.created_at, predictions=by_version[row.id],
    ) for row in rows]


class RealizedIn(BaseModel):
    realized: float


@router.patch("/predictions/{prediction_id}", response_model=PredictionOut)
async def realize_prediction(
    prediction_id: str,
    body: RealizedIn,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_write_identity),
):
    if not is_finite_number(body.realized):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Realized value must be finite")
    prediction = await db.get(ThesisPrediction, prediction_id)
    if prediction is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Prediction not found")
    version = await db.get(ThesisVersion, prediction.thesis_version_id)
    require_issuer(caller, await db.get(Issuer, version.issuer_id if version else ""))
    prediction.realized = body.realized
    await db.flush()
    return PredictionOut.model_validate(prediction)
