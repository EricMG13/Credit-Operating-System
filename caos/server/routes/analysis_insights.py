"""Analyst-owned, cited insight versions shared across analysis surfaces."""

from __future__ import annotations

import base64
import binascii
import hashlib
import json
import math
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional, cast

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from analysis_contracts import (
    AnalysisArtifactRefs,
    AnalysisSurfaceName,
    AuthorityEnvelope,
    InsightArtifact,
    InsightClaim,
    InsightPage,
    InsightStatus,
)
from database import (
    AlertEvent,
    AnalysisContextRecord,
    AnalysisInsight,
    Decision,
    Issuer,
    MarketInstrument,
    MarketSnapshot,
    ModelCheckpoint,
    Portfolio,
    PortfolioConstraint,
    PortfolioPosition,
    ReportVersion,
    ResearchJob,
    Run,
    SourceManifest,
    get_db,
)
from engine import queryinsights
from identity import CallerIdentity, get_identity
from routes.analysis import _guard, _validate_artifact_refs, _validate_context_subjects

router = APIRouter()

_READ_ONLY_ROLES = {"viewer", "read-only", "read_only", "readonly"}
_GENERATION_RETRIES = 3


class InsightCreate(BaseModel):
    surface: AnalysisSurfaceName
    kind: str = Field(min_length=1, max_length=64)
    subject_refs: Optional[AnalysisArtifactRefs] = None
    force: bool = False


@dataclass(frozen=True)
class _SourceArtifact:
    evidence_id: str
    label: str
    version: dict[str, Any]
    numeric_facts: list[dict[str, Any]]


def _require_write(caller: CallerIdentity) -> None:
    """Use only authenticated principal capability, never presentation role_view."""
    if (caller.role or "").strip().lower() in _READ_ONLY_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Read-only callers cannot mutate insights.")


async def _owned_context(
    db: AsyncSession, context_id: str, analyst_id: str
) -> AnalysisContextRecord:
    row = (await db.execute(select(AnalysisContextRecord).where(
        AnalysisContextRecord.id == context_id,
        AnalysisContextRecord.analyst_id == analyst_id,
    ))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Analysis context not found.")
    return row


async def _owned_insight(db: AsyncSession, insight_id: str, analyst_id: str) -> AnalysisInsight:
    row = (await db.execute(select(AnalysisInsight).where(
        AnalysisInsight.id == insight_id,
        AnalysisInsight.analyst_id == analyst_id,
    ))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Insight not found.")
    return row


def _artifact(row: AnalysisInsight) -> InsightArtifact:
    return InsightArtifact(
        id=row.id,
        context_id=row.context_id,
        surface=cast(AnalysisSurfaceName, row.surface),
        kind=row.kind,
        status=cast(InsightStatus, row.status),
        subject_refs=AnalysisArtifactRefs.model_validate(row.subject_refs or {}),
        summary=row.summary,
        claims=[InsightClaim.model_validate(claim) for claim in (row.claims or [])],
        recommended_actions=row.recommended_actions or [],
        missing_dependencies=row.missing_dependencies or [],
        authority=AuthorityEnvelope.model_validate(row.authority or {}),
        source_fingerprint=row.source_fingerprint,
        version=row.version,
        model=row.model,
        generated_at=row.generated_at,
        ratified_at=row.ratified_at,
        rejected_at=row.rejected_at,
        lease_owner=row.lease_owner,
        lease_expires_at=row.lease_expires_at,
    )


def _fingerprint(basis: dict[str, Any]) -> str:
    canonical = json.dumps(basis, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _row_version(row: Any) -> dict[str, Any]:
    """Capture the source row itself, including hashes, versions and timestamps."""
    return {column.name: getattr(row, column.name) for column in row.__table__.columns}


def _numeric_facts(value: Any, *, prefix: str = "", limit: int = 100) -> list[dict[str, Any]]:
    facts: list[dict[str, Any]] = []

    def visit(item: Any, path: str) -> None:
        if len(facts) >= limit:
            return
        if isinstance(item, bool):
            return
        if isinstance(item, (int, float)) and math.isfinite(float(item)):
            facts.append({"label": path or "value", "value": float(item), "unit": None})
        elif isinstance(item, dict):
            for key in sorted(item):
                visit(item[key], f"{path}.{key}" if path else str(key))
        elif isinstance(item, list):
            for index, child in enumerate(item):
                visit(child, f"{path}[{index}]" if path else f"value[{index}]")

    visit(value, prefix)
    return facts


async def _portfolio_version(db: AsyncSession, portfolio: Portfolio) -> dict[str, Any]:
    positions = (await db.execute(
        select(PortfolioPosition)
        .where(PortfolioPosition.portfolio_id == portfolio.id)
        .order_by(PortfolioPosition.id)
    )).scalars().all()
    constraints = (await db.execute(
        select(PortfolioConstraint)
        .where(PortfolioConstraint.portfolio_id == portfolio.id)
        .order_by(PortfolioConstraint.id)
    )).scalars().all()
    return {
        "portfolio": _row_version(portfolio),
        "positions": [_row_version(row) for row in positions],
        "constraints": [_row_version(row) for row in constraints],
    }


async def _load_sources(
    db: AsyncSession,
    context: AnalysisContextRecord,
    refs: AnalysisArtifactRefs,
) -> tuple[list[_SourceArtifact], list[str]]:
    """Load the actual, already-authorized rows that may support a claim."""
    sources: list[_SourceArtifact] = []
    missing: list[str] = []

    for issuer_id in dict.fromkeys(context.issuer_ids or []):
        issuer_row = await db.get(Issuer, issuer_id)
        if issuer_row is not None:  # existence/access was enforced by the caller
            version = _row_version(issuer_row)
            sources.append(_SourceArtifact(
                evidence_id=f"issuer:{issuer_row.id}", label=issuer_row.name, version=version,
                numeric_facts=_numeric_facts(version),
            ))

    for instrument_id in dict.fromkeys(context.instrument_ids or []):
        instrument_row = await db.get(MarketInstrument, instrument_id)
        if instrument_row is None:
            continue
        snapshot = await db.get(MarketSnapshot, instrument_row.snapshot_id)
        version = {
            "instrument": _row_version(instrument_row),
            "snapshot": _row_version(snapshot) if snapshot is not None else None,
        }
        sources.append(_SourceArtifact(
            evidence_id=f"market-instrument:{instrument_row.id}", label=instrument_row.borrower,
            version=version, numeric_facts=_numeric_facts(version),
        ))

    ref_specs: tuple[tuple[Optional[str], Any, str, str], ...] = (
        (refs.issuer_run_id, Run, "run", "Issuer run"),
        (refs.source_manifest_id, SourceManifest, "source-manifest", "Source manifest"),
        (refs.research_job_id, ResearchJob, "research-job", "Research job"),
        (refs.model_checkpoint_id, ModelCheckpoint, "model-checkpoint", "Model checkpoint"),
        (refs.report_version_id, ReportVersion, "report-version", "Report version"),
        (refs.alert_event_id, AlertEvent, "alert-event", "Alert event"),
        (refs.decision_id, Decision, "decision", "Decision"),
        (refs.insight_id, AnalysisInsight, "insight", "Insight"),
    )
    for ref_id, model, prefix, label in ref_specs:
        if not ref_id:
            continue
        source_row = await db.get(model, ref_id)
        if source_row is not None:
            version = _row_version(source_row)
            sources.append(_SourceArtifact(
                evidence_id=f"{prefix}:{ref_id}", label=label,
                version=version, numeric_facts=_numeric_facts(version),
            ))

    if refs.portfolio_id:
        portfolio = await db.get(Portfolio, refs.portfolio_id)
        if portfolio is not None:
            version = await _portfolio_version(db, portfolio)
            sources.append(_SourceArtifact(
                evidence_id=f"portfolio:{portfolio.id}", label=portfolio.name,
                version=version, numeric_facts=_numeric_facts(version),
            ))
    if refs.sponsor_id:
        # Sponsor is currently an issuer attribute/grouping, not a durable artifact.
        missing.append("durable sponsor source artifact")
    return sources, missing


async def _generation_payload(
    db: AsyncSession,
    context: AnalysisContextRecord,
    *,
    surface: AnalysisSurfaceName,
    kind: str,
    refs: AnalysisArtifactRefs,
) -> tuple[dict[str, Any], dict[str, Any]]:
    sources, missing = await _load_sources(db, context, refs)
    basis: dict[str, Any] = {
        "context": {
            "name": context.name,
            "sector_id": context.sector_id,
            "portfolio_scope": context.portfolio_scope,
            "as_of": context.as_of,
        },
        "surface": surface,
        "kind": kind,
        "source_versions": [
            {"evidence_id": source.evidence_id, "version": source.version} for source in sources
        ],
    }

    if surface == "query":
        issuer_ids = list(dict.fromkeys(context.issuer_ids or []))
        scoped_ids = set(issuer_ids)
        pack = [
            entry for entry in await queryinsights.build_pack(db, issuer_ids)
            if entry.issuer_id in scoped_ids
        ]
        cards = queryinsights._deterministic_cards(pack)
        pack_by_id = {entry.id: entry for entry in pack}
        basis["query_evidence"] = [
            {
                "id": entry.id,
                "kind": entry.kind,
                "label": entry.label,
                "text": entry.text,
                "numbers": entry.numbers,
                "issuer_id": entry.issuer_id,
                "walk": entry.walk,
                "chunk_id": entry.chunk_id,
            }
            for entry in pack
        ]
        claims: list[dict[str, Any]] = []
        for card in cards:
            evidence_ids = [
                str(evidence["id"]) for evidence in card.get("evidence", [])
                if str(evidence.get("id", "")) in pack_by_id
            ]
            if not evidence_ids:
                continue
            numbers = [
                number for evidence_id in evidence_ids
                for number in pack_by_id[evidence_id].numbers
            ]
            claims.append({
                "id": str(card["id"]),
                "statement": f"{card['headline']}: {card['detail']}",
                "evidence_ids": evidence_ids,
                "numeric_facts": [
                    {"label": f"value_{index}", "value": float(number), "unit": None}
                    for index, number in enumerate(numbers, start=1)
                    if not isinstance(number, bool) and math.isfinite(float(number))
                ],
            })
        if not claims:
            missing.append("context-scoped Query evidence")
        summary = str(cards[0]["headline"]) if claims else "No context-scoped Query signal is available."
        actions = (["Review the cited Query evidence before ratification."] if claims else
                   ["Attach source-backed issuer evidence to this analysis context."])
    else:
        claims = []
        if sources:
            claims.append({
                "id": "source-register",
                "statement": f"Loaded {len(sources)} validated server source artifact"
                             f"{'s' if len(sources) != 1 else ''} for {context.name}.",
                "evidence_ids": [source.evidence_id for source in sources],
                "numeric_facts": [
                    fact for source in sources for fact in source.numeric_facts
                ][:100],
            })
        else:
            missing.append("validated server source artifact")
        summary = f"{context.name}: {kind.replace('-', ' ')}"
        actions = (["Review cited source artifacts before ratification."] if claims else
                   ["Attach a validated issuer, instrument, or domain artifact before ratification."])

    source_ids = sorted({eid for claim in claims for eid in claim["evidence_ids"]})
    payload = {
        "status": "ready" if claims and not missing else "partial",
        "summary": summary,
        "claims": claims,
        "recommended_actions": actions,
        "missing_dependencies": sorted(set(missing)),
        "source_ids": source_ids,
    }
    return payload, basis


def _encode_cursor(row: AnalysisInsight) -> str:
    raw = json.dumps({"generated_at": row.generated_at.isoformat(), "id": row.id}).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _decode_cursor(cursor: str) -> tuple[datetime, str]:
    try:
        raw = base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4))
        value = json.loads(raw)
        generated_at = datetime.fromisoformat(value["generated_at"])
        insight_id = str(value["id"])
        if not insight_id:
            raise ValueError
        return generated_at, insight_id
    except (
        binascii.Error,
        KeyError,
        TypeError,
        UnicodeDecodeError,
        ValueError,
    ) as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid insight cursor.") from exc


@router.get("/contexts/{context_id}/insights", response_model=InsightPage)
async def list_insights(
    context_id: str,
    surface: Optional[AnalysisSurfaceName] = Query(default=None),
    kind: Optional[str] = Query(default=None, min_length=1, max_length=64),
    cursor: Optional[str] = Query(default=None, max_length=500),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    _guard(caller, write=False)
    await _owned_context(db, context_id, caller.id)
    statement = select(AnalysisInsight).where(
        AnalysisInsight.context_id == context_id,
        AnalysisInsight.analyst_id == caller.id,
    )
    if surface:
        statement = statement.where(AnalysisInsight.surface == surface)
    if kind:
        statement = statement.where(AnalysisInsight.kind == kind)
    current_row = (await db.execute(
        statement.where(AnalysisInsight.status.in_(("ratified", "ready")))
        .order_by(AnalysisInsight.generated_at.desc(), AnalysisInsight.id.desc())
        .limit(1)
    )).scalar_one_or_none()
    if cursor:
        generated_at, insight_id = _decode_cursor(cursor)
        statement = statement.where(or_(
            AnalysisInsight.generated_at < generated_at,
            and_(AnalysisInsight.generated_at == generated_at, AnalysisInsight.id < insight_id),
        ))
    rows = (await db.execute(
        statement.order_by(AnalysisInsight.generated_at.desc(), AnalysisInsight.id.desc())
        .limit(limit + 1)
    )).scalars().all()
    page_rows = rows[:limit]
    return InsightPage(
        items=[_artifact(row) for row in page_rows],
        current=_artifact(current_row) if current_row is not None else None,
        next_cursor=_encode_cursor(page_rows[-1]) if len(rows) > limit and page_rows else None,
    )


async def _flush_new_insight(db: AsyncSession, row: AnalysisInsight) -> None:
    """Flush inside a savepoint so a unique collision does not poison the request."""
    async with db.begin_nested():
        db.add(row)
        await db.flush()


async def _prior_generation(
    db: AsyncSession,
    *,
    analyst_id: str,
    context_id: str,
    surface: str,
    kind: str,
    source_fingerprint: str,
) -> Optional[AnalysisInsight]:
    return (await db.execute(select(AnalysisInsight).where(
        AnalysisInsight.analyst_id == analyst_id,
        AnalysisInsight.context_id == context_id,
        AnalysisInsight.surface == surface,
        AnalysisInsight.kind == kind,
        AnalysisInsight.source_fingerprint == source_fingerprint,
    ).order_by(AnalysisInsight.version.desc()).limit(1))).scalar_one_or_none()


@router.post(
    "/contexts/{context_id}/insights",
    response_model=InsightArtifact,
    status_code=status.HTTP_201_CREATED,
)
async def create_insight(
    context_id: str,
    body: InsightCreate,
    response: Response,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    _guard(caller, write=True)
    context = await _owned_context(db, context_id, caller.id)
    _require_write(caller)
    await _validate_context_subjects(
        db,
        issuer_ids=context.issuer_ids or [],
        instrument_ids=context.instrument_ids or [],
        caller=caller,
    )
    refs = body.subject_refs or AnalysisArtifactRefs.model_validate(context.artifacts or {})
    await _validate_artifact_refs(db, refs, context_id=context_id, caller=caller)
    payload, basis = await _generation_payload(
        db, context, surface=body.surface, kind=body.kind, refs=refs
    )
    source_fingerprint = _fingerprint(basis)

    for _attempt in range(_GENERATION_RETRIES):
        prior = await _prior_generation(
            db,
            analyst_id=caller.id,
            context_id=context_id,
            surface=body.surface,
            kind=body.kind,
            source_fingerprint=source_fingerprint,
        )
        if prior is not None and not body.force:
            response.status_code = status.HTTP_200_OK
            return _artifact(prior)

        if body.force:
            latest_version = (await db.execute(select(func.max(AnalysisInsight.version)).where(
                AnalysisInsight.analyst_id == caller.id,
                AnalysisInsight.context_id == context_id,
                AnalysisInsight.surface == body.surface,
                AnalysisInsight.kind == body.kind,
                AnalysisInsight.source_fingerprint == source_fingerprint,
            ))).scalar_one_or_none()
            version = int(latest_version or 0) + 1
        else:
            version = 0

        now = datetime.now(timezone.utc)
        authority = AuthorityEnvelope(
            origin="deterministic",
            method=f"{body.surface}-insight-fallback",
            freshness="current" if payload["status"] == "ready" else "partial",
            as_of=now,
            source_ids=payload["source_ids"],
            confidence=1.0 if payload["status"] == "ready" else 0.0,
            approval_state="draft",
        )
        row = AnalysisInsight(
            analyst_id=caller.id,
            context_id=context_id,
            surface=body.surface,
            kind=body.kind,
            status=payload["status"],
            subject_refs=refs.model_dump(mode="json"),
            summary=payload["summary"],
            claims=payload["claims"],
            recommended_actions=payload["recommended_actions"],
            missing_dependencies=payload["missing_dependencies"],
            authority=authority.model_dump(mode="json"),
            source_fingerprint=source_fingerprint,
            version=version,
            model=None,
            generated_at=now,
        )
        try:
            await _flush_new_insight(db, row)
            return _artifact(row)
        except IntegrityError:
            if not body.force:
                winner = await _prior_generation(
                    db,
                    analyst_id=caller.id,
                    context_id=context_id,
                    surface=body.surface,
                    kind=body.kind,
                    source_fingerprint=source_fingerprint,
                )
                if winner is not None:
                    response.status_code = status.HTTP_200_OK
                    return _artifact(winner)

    raise HTTPException(
        status.HTTP_409_CONFLICT,
        "Insight generation conflicted with another request; retry.",
    )


@router.post("/insights/{insight_id}/ratify", response_model=InsightArtifact)
async def ratify_insight(
    insight_id: str,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    _guard(caller, write=True)
    row = await _owned_insight(db, insight_id, caller.id)
    _require_write(caller)
    if row.status == "ratified":
        return _artifact(row)
    if row.status != "ready":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only a ready insight can be ratified.")
    row.status = "ratified"
    row.ratified_at = datetime.now(timezone.utc)
    authority = dict(row.authority or {})
    authority["approval_state"] = "ratified"
    row.authority = authority
    await db.flush()
    return _artifact(row)


@router.post("/insights/{insight_id}/reject", response_model=InsightArtifact)
async def reject_insight(
    insight_id: str,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    _guard(caller, write=True)
    row = await _owned_insight(db, insight_id, caller.id)
    _require_write(caller)
    if row.status == "rejected":
        return _artifact(row)
    if row.status == "ratified":
        raise HTTPException(status.HTTP_409_CONFLICT, "A ratified insight cannot be rejected in place.")
    row.status = "rejected"
    row.rejected_at = datetime.now(timezone.utc)
    authority = dict(row.authority or {})
    authority["approval_state"] = "rejected"
    row.authority = authority
    await db.flush()
    return _artifact(row)
