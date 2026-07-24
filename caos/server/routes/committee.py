"""IC Book committee preparation and atomic decision finalization."""

from __future__ import annotations

import hashlib
import hmac
import json
from dataclasses import replace
from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

import rate_limit
import signed_tokens
from config import get_settings
from database import (
    AnalysisContextRecord,
    AnalystOpinionVersion,
    Claim,
    CommitteeAgendaItem,
    CommitteeEvidenceException,
    Decision,
    Document,
    DocumentChunk,
    EvidenceItem,
    Issuer,
    ModuleOutput,
    Portfolio,
    PortfolioConstraint,
    PortfolioPosition,
    PortfolioStressRun,
    QAFinding,
    ReportVersion,
    Run,
    get_db,
)
from engine import portfolio as portfolio_engine
from engine.periods import is_finite_number
from engine.report import assemble_report, committee_export_allowed
from identity import CallerIdentity, get_identity, require_write_role
from routes.thesis import ThesisVersionIn, create_thesis_version
from tenancy import (
    require_issuer,
    require_portfolio_access,
    require_run_access,
    scope_issuers,
)

router = APIRouter()

AgendaStatus = Literal["draft", "ready", "decided", "cancelled"]
Recommendation = Literal["approve", "decline", "revisit"]
_SORTS = {
    "scheduled_for": CommitteeAgendaItem.scheduled_for,
    "updated_at": CommitteeAgendaItem.updated_at,
    "created_at": CommitteeAgendaItem.created_at,
    "status": CommitteeAgendaItem.status,
    "owner": CommitteeAgendaItem.owner_id,
    "expiry": CommitteeAgendaItem.expiry,
}
_MAX_CURSOR = 2048
_EXCEPTION_MAX_DAYS = 30
_COMMITTEE_WRITE_MAX_PER_MINUTE = 60
_COMMITTEE_NOTE = Annotated[str, Field(max_length=2_000)]


class AgendaCreate(BaseModel):
    issuer_id: str = Field(min_length=1, max_length=36)
    portfolio_id: Optional[str] = Field(default=None, max_length=36)
    owner_id: Optional[str] = Field(default=None, max_length=255)
    scheduled_for: datetime
    recommendation: Recommendation
    conviction: Optional[float] = Field(default=None, ge=0, le=100)
    thesis: str = Field(min_length=1, max_length=50_000)
    conditions: list[_COMMITTEE_NOTE] = Field(default_factory=list, max_length=50)
    expiry: Optional[date] = None
    run_id: Optional[str] = Field(default=None, max_length=36)
    report_version_id: Optional[str] = Field(default=None, max_length=36)
    context_id: Optional[str] = Field(default=None, max_length=36)
    analyst_opinion_version_id: Optional[str] = Field(default=None, max_length=36)
    status: Literal["draft", "ready"] = "draft"


class AgendaPatch(BaseModel):
    expected_revision: int = Field(ge=1)
    portfolio_id: Optional[str] = Field(default=None, max_length=36)
    owner_id: Optional[str] = Field(default=None, max_length=255)
    scheduled_for: Optional[datetime] = None
    recommendation: Optional[Recommendation] = None
    conviction: Optional[float] = Field(default=None, ge=0, le=100)
    thesis: Optional[str] = Field(default=None, min_length=1, max_length=50_000)
    conditions: Optional[list[_COMMITTEE_NOTE]] = Field(default=None, max_length=50)
    expiry: Optional[date] = None
    run_id: Optional[str] = Field(default=None, max_length=36)
    report_version_id: Optional[str] = Field(default=None, max_length=36)
    context_id: Optional[str] = Field(default=None, max_length=36)
    analyst_opinion_version_id: Optional[str] = Field(default=None, max_length=36)
    status: Optional[Literal["draft", "ready", "cancelled"]] = None


class ExceptionRequestIn(BaseModel):
    expected_revision: int = Field(ge=1)
    rationale: str = Field(min_length=1, max_length=20_000)
    mitigants: list[_COMMITTEE_NOTE] = Field(default_factory=list, max_length=50)
    expires_at: date


class ExceptionReviewIn(BaseModel):
    expected_revision: int = Field(ge=1)
    decision: Literal["approve", "reject"]
    review_note: str = Field(min_length=1, max_length=20_000)


class ExceptionRevokeIn(BaseModel):
    expected_revision: int = Field(ge=1)
    review_note: str = Field(min_length=1, max_length=20_000)


class EvidenceExceptionOut(BaseModel):
    id: str
    agenda_item_id: str
    run_id: str
    basis_sha256: str
    failure_codes: list[str]
    finding_ids: list[str]
    rationale: str
    mitigants: list[str]
    expires_at: date
    status: Literal["pending", "approved", "rejected", "revoked", "expired"]
    requested_by: str
    requested_at: datetime
    reviewed_by: Optional[str]
    reviewed_at: Optional[datetime]
    review_note: Optional[str]
    revoked_by: Optional[str]
    revoked_at: Optional[datetime]
    revision: int


class AgendaOut(BaseModel):
    id: str
    issuer_id: str
    portfolio_id: Optional[str]
    owner_id: str
    scheduled_for: datetime
    recommendation: str
    conviction: Optional[float]
    thesis: str
    conditions: list[str]
    expiry: Optional[date]
    run_id: Optional[str]
    report_version_id: Optional[str]
    context_id: Optional[str]
    analyst_opinion_version_id: Optional[str]
    status: str
    revision: int
    readiness_failures: list[str]
    readiness_state: Literal["blocked", "ready", "ready_under_exception"]
    evidence_exception: Optional[EvidenceExceptionOut] = None
    finalized_decision_id: Optional[str]
    snapshot_sha256: Optional[str]
    frozen_authority: dict
    created_at: datetime
    updated_at: datetime
    finalized_at: Optional[datetime]


class AgendaPage(BaseModel):
    items: list[AgendaOut]
    next_cursor: Optional[str]
    total: int


class FinalizedDecisionOut(BaseModel):
    id: str
    issuer_id: str
    portfolio_id: Optional[str]
    agenda_item_id: Optional[str]
    report_version_id: Optional[str]
    run_id: str
    action: str
    status: str
    snapshot_sha256: str
    created_at: datetime


class AgendaFinalizeOut(BaseModel):
    agenda: AgendaOut
    decision: FinalizedDecisionOut


class AgendaFinalizeIn(BaseModel):
    expected_revision: int = Field(ge=1)


def _is_admin(caller: CallerIdentity) -> bool:
    return caller.role.strip().lower() == "admin"


def _require_committee_write(caller: CallerIdentity) -> None:
    require_write_role(caller)
    if caller.role.strip().lower() not in {"analyst", "admin"}:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Caller cannot mutate committee records.")


def _committee_write_guard(caller: CallerIdentity) -> None:
    _require_committee_write(caller)
    if not rate_limit.hit(
        f"committee-write:{caller.id}",
        max_attempts=_COMMITTEE_WRITE_MAX_PER_MINUTE,
        window_seconds=60,
    ):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Committee write rate limit reached — try again in a minute.",
        )


def _require_exception_reviewer(caller: CallerIdentity) -> None:
    """Use server identity only; Settings' QA view is presentation preference."""
    require_write_role(caller)
    if caller.role.strip().lower() not in {"qa", "admin"}:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only QA or an admin can review evidence exceptions.")


def _require_item_mutation(caller: CallerIdentity, row: CommitteeAgendaItem) -> None:
    if row.owner_id != caller.id and not _is_admin(caller):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Only the agenda owner or an admin can mutate this item.",
        )


def _clean_conditions(values: list[str]) -> list[str]:
    return [value.strip() for value in values if value.strip()]


def _exception_out(row: CommitteeEvidenceException) -> EvidenceExceptionOut:
    status_value = row.status
    if status_value == "approved" and row.expires_at < datetime.now(timezone.utc).date():
        status_value = "expired"
    return EvidenceExceptionOut(
        id=row.id,
        agenda_item_id=row.agenda_item_id,
        run_id=row.run_id,
        basis_sha256=row.basis_sha256,
        failure_codes=row.failure_codes or [],
        finding_ids=row.finding_ids or [],
        rationale=row.rationale,
        mitigants=row.mitigants or [],
        expires_at=row.expires_at,
        status=status_value,  # type: ignore[arg-type]
        requested_by=row.requested_by,
        requested_at=row.requested_at,
        reviewed_by=row.reviewed_by,
        reviewed_at=row.reviewed_at,
        review_note=row.review_note,
        revoked_by=row.revoked_by,
        revoked_at=row.revoked_at,
        revision=row.revision,
    )


def _exception_basis(
    item: CommitteeAgendaItem,
    run: Run,
    failures: list[str],
    findings: list[QAFinding],
) -> tuple[str, list[str]]:
    finding_ids = sorted(str(finding.id) for finding in findings)
    basis = {
        "agenda_item_id": item.id,
        "run_id": run.id,
        "qa_status": run.qa_status,
        "committee_status": run.committee_status,
        "failures": sorted(failures),
        "finding_ids": finding_ids,
    }
    raw = json.dumps(basis, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode()).hexdigest(), finding_ids


def _exception_is_eligible(
    failures: list[str],
    run: Optional[Run],
    findings: list[QAFinding],
) -> bool:
    """Only a reviewed non-critical information gap is waivable.

    Referential failures and no-QA states stay hard blocks; a Committee Ready run
    does not need an exception, and a Blocked run is never eligible.
    """
    if run is None or failures != ["run_not_committee_ready"]:
        return False
    if run.committee_status not in {"Restricted", "Insufficient Information"}:
        return False
    return not any(finding.severity == "CRITICAL" for finding in findings)


def _approved_exception_is_current(
    exception: Optional[CommitteeEvidenceException],
    item: CommitteeAgendaItem,
    run: Optional[Run],
    failures: list[str],
    findings: list[QAFinding],
) -> bool:
    if exception is None or exception.status != "approved" or exception.expires_at < datetime.now(timezone.utc).date():
        return False
    if run is None or exception.run_id != run.id or not _exception_is_eligible(failures, run, findings):
        return False
    basis_sha, finding_ids = _exception_basis(item, run, failures, findings)
    return exception.basis_sha256 == basis_sha and sorted(exception.finding_ids or []) == finding_ids


def _cursor_fingerprint(filters: dict[str, Any], sort: str, direction: str) -> str:
    raw = json.dumps(
        {"filters": filters, "sort": sort, "direction": direction},
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _encode_cursor(offset: int, fingerprint: str) -> str:
    return signed_tokens.sign_json(
        {"v": 1, "offset": offset, "fingerprint": fingerprint},
        secret=get_settings().session_secret,
    )


def _decode_cursor(cursor: str, fingerprint: str) -> int:
    try:
        payload = signed_tokens.verify_json(cursor, secret=get_settings().session_secret)
        offset = payload["offset"]
        if payload.get("v") != 1 or payload.get("fingerprint") != fingerprint:
            raise ValueError
        if not isinstance(offset, int) or offset < 0 or offset > 1_000_000:
            raise ValueError
        return offset
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or stale agenda cursor.") from None


async def _validate_refs(
    db: AsyncSession,
    caller: CallerIdentity,
    *,
    issuer_id: str,
    owner_id: str,
    run_id: Optional[str],
    portfolio_id: Optional[str],
    report_version_id: Optional[str],
    context_id: Optional[str],
    lock: bool = False,
) -> tuple[Optional[Run], Optional[Portfolio], Optional[ReportVersion], Optional[AnalysisContextRecord]]:
    require_issuer(caller, await db.get(Issuer, issuer_id))
    run = None
    if run_id:
        run_stmt = select(Run).where(Run.id == run_id)
        run = (await db.execute(run_stmt.with_for_update() if lock else run_stmt)).scalar_one_or_none()
        run = await require_run_access(caller, run, db)
    if run is not None and run.issuer_id != issuer_id:
        raise HTTPException(status.HTTP_409_CONFLICT, "Run and agenda describe different issuers.")

    portfolio = None
    if portfolio_id:
        portfolio_stmt = select(Portfolio).where(Portfolio.id == portfolio_id)
        portfolio = require_portfolio_access(
            caller,
            (await db.execute(
                portfolio_stmt.with_for_update() if lock else portfolio_stmt
            )).scalar_one_or_none(),
        )
        if run is not None and run.portfolio_id != portfolio.id:
            raise HTTPException(status.HTTP_409_CONFLICT, "Run is not linked to the selected portfolio.")

    report = None
    if report_version_id:
        report_stmt = select(ReportVersion).where(ReportVersion.id == report_version_id)
        report = (await db.execute(
            report_stmt.with_for_update() if lock else report_stmt
        )).scalar_one_or_none()
    if report_version_id and report is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report version not found.")
    if report is not None:
        if report.analyst_id != owner_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Report version not found.")
        if run is None or report.run_id != run.id:
            raise HTTPException(status.HTTP_409_CONFLICT, "Report version is not linked to the selected run.")

    context = None
    if context_id:
        context_stmt = select(AnalysisContextRecord).where(AnalysisContextRecord.id == context_id)
        context = (await db.execute(
            context_stmt.with_for_update() if lock else context_stmt
        )).scalar_one_or_none()
    if context_id and (context is None or context.analyst_id != owner_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Analysis context not found.")
    if context is not None:
        if context.issuer_ids and issuer_id not in context.issuer_ids:
            raise HTTPException(status.HTTP_409_CONFLICT, "Analysis context does not include the agenda issuer.")
        if report is not None and report.context_id != context.id:
            raise HTTPException(status.HTTP_409_CONFLICT, "Report version is not linked to the selected context.")
        if portfolio_id and context.portfolio_scope and context.portfolio_scope != portfolio_id:
            raise HTTPException(status.HTTP_409_CONFLICT, "Analysis context is linked to a different portfolio.")
    return run, portfolio, report, context


async def _validate_analyst_opinion(
    db: AsyncSession,
    *,
    opinion_id: Optional[str],
    issuer_id: str,
    owner_id: str,
) -> Optional[AnalystOpinionVersion]:
    if not opinion_id:
        return None
    opinion = await db.get(AnalystOpinionVersion, opinion_id)
    if opinion is None or opinion.issuer_id != issuer_id or opinion.analyst_id != owner_id:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Analyst opinion must belong to the agenda owner and issuer.",
        )
    return opinion


def _report_readiness_failures(
    item: CommitteeAgendaItem,
    run: Run,
    report: Optional[ReportVersion],
) -> list[str]:
    if report is None:
        return ["missing_report_version"]
    failures: list[str] = []
    if report.analyst_id != item.owner_id:
        failures.append("report_owner_mismatch")
    if report.run_id != run.id:
        failures.append("report_run_mismatch")
    if report.status != "published":
        failures.append("report_not_published")
    if (report.authority or {}).get("origin") != "live":
        failures.append("report_not_live")
    return failures


def _context_readiness_failures(
    item: CommitteeAgendaItem,
    report: Optional[ReportVersion],
    context: Optional[AnalysisContextRecord],
) -> list[str]:
    if context is None:
        return ["missing_context"]
    failures: list[str] = []
    if context.analyst_id != item.owner_id:
        failures.append("context_owner_mismatch")
    if context.issuer_ids and item.issuer_id not in context.issuer_ids:
        failures.append("context_issuer_mismatch")
    if report is not None and report.context_id != context.id:
        failures.append("context_report_mismatch")
    if item.portfolio_id and context.portfolio_scope and context.portfolio_scope != item.portfolio_id:
        failures.append("context_portfolio_mismatch")
    if (context.artifacts or {}).get("report_version_id") not in {None, item.report_version_id}:
        failures.append("context_report_selection_mismatch")
    return failures


def _readiness_from_refs(
    item: CommitteeAgendaItem,
    run: Optional[Run],
    portfolio: Optional[Portfolio],
    report: Optional[ReportVersion],
    context: Optional[AnalysisContextRecord],
) -> list[str]:
    failures: list[str] = []
    if not item.thesis.strip():
        failures.append("missing_thesis")
    if item.recommendation not in {"approve", "decline", "revisit"}:
        failures.append("invalid_recommendation")
    if not item.analyst_opinion_version_id:
        failures.append("missing_analyst_opinion")
    if not item.run_id:
        failures.append("missing_run")
        return failures
    if run is None:
        failures.append("missing_run")
        return failures
    if run.issuer_id != item.issuer_id:
        failures.append("run_issuer_mismatch")
    if not committee_export_allowed(run.committee_status):
        failures.append("run_not_committee_ready")
    if item.portfolio_id:
        if portfolio is None:
            failures.append("missing_portfolio")
        if run.portfolio_id != item.portfolio_id:
            failures.append("run_portfolio_mismatch")
    if item.report_version_id:
        failures.extend(_report_readiness_failures(item, run, report))
    if item.context_id:
        failures.extend(_context_readiness_failures(item, report, context))
    return failures


async def _readiness_failures(db: AsyncSession, caller: CallerIdentity, item: CommitteeAgendaItem) -> list[str]:
    if not item.run_id:
        return _readiness_from_refs(item, None, None, None, None)
    # QA/admin may independently evaluate readiness for an agenda item they are
    # already authorized to see. Reuse the owner's run identity only for the
    # ownership check inside _validate_refs; issuer/team visibility stays that
    # of the reviewing caller, so this cannot become a run-discovery bypass.
    readiness_caller = caller
    if caller.id != item.owner_id and caller.role.strip().lower() in {"qa", "admin"}:
        readiness_caller = replace(caller, id=item.owner_id)
    try:
        run, portfolio, report, context = await _validate_refs(
            db,
            readiness_caller,
            issuer_id=item.issuer_id,
            owner_id=item.owner_id,
            run_id=item.run_id,
            portfolio_id=item.portfolio_id,
            report_version_id=item.report_version_id,
            context_id=item.context_id,
        )
    except HTTPException as exc:
        return [f"invalid_linkage:{exc.detail}"]
    return _readiness_from_refs(item, run, portfolio, report, context)


async def _latest_exception(
    db: AsyncSession,
    agenda_item_id: str,
) -> Optional[CommitteeEvidenceException]:
    return (await db.execute(
        select(CommitteeEvidenceException)
        .where(CommitteeEvidenceException.agenda_item_id == agenda_item_id)
        .order_by(CommitteeEvidenceException.requested_at.desc(), CommitteeEvidenceException.id.desc())
        .limit(1)
    )).scalar_one_or_none()


async def _effective_readiness(
    db: AsyncSession,
    caller: CallerIdentity,
    item: CommitteeAgendaItem,
    *,
    base_failures: Optional[list[str]] = None,
    run: Optional[Run] = None,
    findings: Optional[list[QAFinding]] = None,
    exception: Optional[CommitteeEvidenceException] = None,
) -> tuple[list[str], Optional[CommitteeEvidenceException], bool]:
    """Return hard failures, most recent exception, and whether it currently waives readiness."""
    failures = base_failures if base_failures is not None else await _readiness_failures(db, caller, item)
    current_run = run
    if current_run is None and item.run_id:
        current_run = await db.get(Run, item.run_id)
    current_findings = findings
    if current_findings is None and current_run is not None:
        current_findings = list((await db.execute(
            select(QAFinding).where(QAFinding.run_id == current_run.id)
        )).scalars().all())
    current_exception = exception if exception is not None else await _latest_exception(db, item.id)
    if _approved_exception_is_current(
        current_exception,
        item,
        current_run,
        failures,
        current_findings or [],
    ):
        return [failure for failure in failures if failure != "run_not_committee_ready"], current_exception, True
    return failures, current_exception, False


async def _agenda_out(
    db: AsyncSession,
    caller: CallerIdentity,
    row: CommitteeAgendaItem,
    *,
    readiness_failures: Optional[list[str]] = None,
    evidence_exception: Optional[CommitteeEvidenceException] = None,
    readiness_under_exception: bool = False,
) -> AgendaOut:
    if row.status == "decided":
        failures: list[str] = []
        current_exception = evidence_exception
        under_exception = bool((row.snapshot or {}).get("evidence_exception"))
    elif readiness_failures is None:
        failures, current_exception, under_exception = await _effective_readiness(db, caller, row)
    else:
        failures = readiness_failures
        current_exception = evidence_exception
        under_exception = readiness_under_exception
    authority = (row.snapshot or {}).get("authority", {}) if row.snapshot else {}
    return AgendaOut(
        id=row.id,
        issuer_id=row.issuer_id,
        portfolio_id=row.portfolio_id,
        owner_id=row.owner_id,
        scheduled_for=row.scheduled_for,
        recommendation=row.recommendation,
        conviction=row.conviction,
        thesis=row.thesis,
        conditions=row.conditions or [],
        expiry=row.expiry,
        run_id=row.run_id,
        report_version_id=row.report_version_id,
        context_id=row.context_id,
        analyst_opinion_version_id=row.analyst_opinion_version_id,
        status=row.status,
        revision=row.revision,
        readiness_failures=failures,
        readiness_state=("blocked" if failures else "ready_under_exception" if under_exception else "ready"),
        evidence_exception=_exception_out(current_exception) if current_exception is not None else None,
        finalized_decision_id=row.finalized_decision_id,
        snapshot_sha256=row.snapshot_sha256,
        frozen_authority=authority,
        created_at=row.created_at,
        updated_at=row.updated_at,
        finalized_at=row.finalized_at,
    )


async def _agenda_page_items(
    db: AsyncSession,
    caller: CallerIdentity,
    rows: list[CommitteeAgendaItem],
) -> list[AgendaOut]:
    """Resolve readiness for a page with bounded batch queries, never per row."""
    run_ids = {row.run_id for row in rows if row.run_id}
    portfolio_ids = {row.portfolio_id for row in rows if row.portfolio_id}
    report_ids = {row.report_version_id for row in rows if row.report_version_id}
    context_ids = {row.context_id for row in rows if row.context_id}
    runs = list((await db.execute(select(Run).where(Run.id.in_(run_ids)))).scalars().all()) if run_ids else []
    portfolios = list((await db.execute(
        select(Portfolio).where(Portfolio.id.in_(portfolio_ids))
    )).scalars().all()) if portfolio_ids else []
    reports = list((await db.execute(
        select(ReportVersion).where(ReportVersion.id.in_(report_ids))
    )).scalars().all()) if report_ids else []
    contexts = list((await db.execute(
        select(AnalysisContextRecord).where(AnalysisContextRecord.id.in_(context_ids))
    )).scalars().all()) if context_ids else []
    exceptions = list((await db.execute(
        select(CommitteeEvidenceException)
        .where(CommitteeEvidenceException.agenda_item_id.in_({row.id for row in rows}))
        .order_by(CommitteeEvidenceException.requested_at.desc(), CommitteeEvidenceException.id.desc())
    )).scalars().all()) if rows else []
    findings = list((await db.execute(
        select(QAFinding).where(QAFinding.run_id.in_(run_ids))
    )).scalars().all()) if run_ids else []
    run_by_id = {row.id: row for row in runs}
    portfolio_by_id = {row.id: row for row in portfolios}
    report_by_id = {row.id: row for row in reports}
    context_by_id = {row.id: row for row in contexts}
    exception_by_agenda: dict[str, CommitteeEvidenceException] = {}
    for exception_row in exceptions:
        exception_by_agenda.setdefault(exception_row.agenda_item_id, exception_row)
    findings_by_run: dict[str, list[QAFinding]] = {}
    for finding in findings:
        findings_by_run.setdefault(finding.run_id, []).append(finding)
    out: list[AgendaOut] = []
    for row in rows:
        run = run_by_id.get(row.run_id or "")
        base_failures = _readiness_from_refs(
            row,
            run,
            portfolio_by_id.get(row.portfolio_id or ""),
            report_by_id.get(row.report_version_id or ""),
            context_by_id.get(row.context_id or ""),
        )
        current_exception = exception_by_agenda.get(row.id)
        under_exception = _approved_exception_is_current(
            current_exception,
            row,
            run,
            base_failures,
            findings_by_run.get(run.id, []) if run else [],
        )
        effective_failures = (
            [failure for failure in base_failures if failure != "run_not_committee_ready"]
            if under_exception else base_failures
        )
        out.append(await _agenda_out(
            db,
            caller,
            row,
            readiness_failures=effective_failures,
            evidence_exception=current_exception,
            readiness_under_exception=under_exception,
        ))
    return out


async def _accessible_item(
    db: AsyncSession, caller: CallerIdentity, item_id: str, *, lock: bool = False
) -> CommitteeAgendaItem:
    stmt = select(CommitteeAgendaItem).where(CommitteeAgendaItem.id == item_id)
    if lock:
        stmt = stmt.with_for_update()
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Agenda item not found.")
    require_issuer(caller, await db.get(Issuer, row.issuer_id))
    return row


@router.post("/agenda", response_model=AgendaOut, status_code=status.HTTP_201_CREATED)
async def create_agenda_item(
    body: AgendaCreate,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    _committee_write_guard(caller)
    owner_id = body.owner_id if _is_admin(caller) and body.owner_id else caller.id
    # The form normally submits the selected version explicitly. This fallback
    # keeps older clients from silently producing an un-linkable agenda item:
    # if the owner already has a current issuer view, freeze that reference at
    # creation. It never fabricates an analyst view.
    opinion_id = body.analyst_opinion_version_id
    if not opinion_id:
        opinion_id = (await db.execute(
            select(AnalystOpinionVersion.id)
            .where(
                AnalystOpinionVersion.issuer_id == body.issuer_id,
                AnalystOpinionVersion.analyst_id == owner_id,
            )
            .order_by(AnalystOpinionVersion.version.desc())
            .limit(1)
        )).scalar_one_or_none()
    await _validate_refs(
        db,
        caller,
        issuer_id=body.issuer_id,
        owner_id=owner_id,
        run_id=body.run_id,
        portfolio_id=body.portfolio_id,
        report_version_id=body.report_version_id,
        context_id=body.context_id,
    )
    await _validate_analyst_opinion(
        db,
        opinion_id=opinion_id,
        issuer_id=body.issuer_id,
        owner_id=owner_id,
    )
    now = datetime.now(timezone.utc)
    row = CommitteeAgendaItem(
        issuer_id=body.issuer_id,
        portfolio_id=body.portfolio_id,
        owner_id=owner_id,
        scheduled_for=body.scheduled_for,
        recommendation=body.recommendation,
        conviction=body.conviction,
        thesis=body.thesis.strip(),
        conditions=_clean_conditions(body.conditions),
        expiry=body.expiry,
        run_id=body.run_id,
        report_version_id=body.report_version_id,
        context_id=body.context_id,
        analyst_opinion_version_id=opinion_id,
        status=body.status,
        revision=1,
        snapshot={},
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    await db.flush()
    if row.status == "ready":
        failures, _, _ = await _effective_readiness(db, caller, row)
        if failures:
            raise HTTPException(status.HTTP_409_CONFLICT, {"message": "Agenda item is not ready.", "failures": failures})
    return await _agenda_out(db, caller, row)


@router.get("/agenda", response_model=AgendaPage)
async def list_agenda(
    issuer_id: Optional[str] = Query(default=None, max_length=36),
    portfolio_id: Optional[str] = Query(default=None, max_length=36),
    owner_id: Optional[str] = Query(default=None, max_length=255),
    agenda_status: Optional[AgendaStatus] = Query(default=None, alias="status"),
    scheduled_from: Optional[datetime] = None,
    scheduled_to: Optional[datetime] = None,
    expiry_from: Optional[date] = None,
    expiry_to: Optional[date] = None,
    sort: str = Query("scheduled_for", pattern="^(scheduled_for|updated_at|created_at|status|owner|expiry)$"),
    direction: Literal["asc", "desc"] = "asc",
    cursor: Optional[str] = Query(default=None, max_length=_MAX_CURSOR),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    filters = {
        "issuer_id": issuer_id,
        "portfolio_id": portfolio_id,
        "owner_id": owner_id,
        "status": agenda_status,
        "scheduled_from": scheduled_from,
        "scheduled_to": scheduled_to,
        "expiry_from": expiry_from,
        "expiry_to": expiry_to,
    }
    fingerprint = _cursor_fingerprint(filters, sort, direction)
    offset = _decode_cursor(cursor, fingerprint) if cursor else 0
    stmt = scope_issuers(
        select(CommitteeAgendaItem).join(Issuer, Issuer.id == CommitteeAgendaItem.issuer_id), caller
    )
    if issuer_id:
        stmt = stmt.where(CommitteeAgendaItem.issuer_id == issuer_id)
    if portfolio_id:
        stmt = stmt.where(CommitteeAgendaItem.portfolio_id == portfolio_id)
    if owner_id:
        stmt = stmt.where(CommitteeAgendaItem.owner_id == owner_id)
    if agenda_status:
        stmt = stmt.where(CommitteeAgendaItem.status == agenda_status)
    if scheduled_from:
        stmt = stmt.where(CommitteeAgendaItem.scheduled_for >= scheduled_from)
    if scheduled_to:
        stmt = stmt.where(CommitteeAgendaItem.scheduled_for <= scheduled_to)
    if expiry_from:
        stmt = stmt.where(CommitteeAgendaItem.expiry >= expiry_from)
    if expiry_to:
        stmt = stmt.where(CommitteeAgendaItem.expiry <= expiry_to)
    sort_col = _SORTS[sort]
    order = sort_col.desc() if direction == "desc" else sort_col.asc()
    rows = (await db.execute(stmt.order_by(order, CommitteeAgendaItem.id).offset(offset).limit(limit + 1))).scalars().all()
    has_more = len(rows) > limit
    rows = rows[:limit]
    total = (await db.execute(
        select(func.count()).select_from(stmt.order_by(None).subquery())
    )).scalar_one()
    return AgendaPage(
        items=await _agenda_page_items(db, caller, list(rows)),
        next_cursor=_encode_cursor(offset + limit, fingerprint) if has_more else None,
        total=total,
    )


@router.get("/agenda/{item_id}", response_model=AgendaOut)
async def get_agenda_item(
    item_id: str,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    return await _agenda_out(db, caller, await _accessible_item(db, caller, item_id))


@router.patch("/agenda/{item_id}", response_model=AgendaOut)
async def patch_agenda_item(
    item_id: str,
    body: AgendaPatch,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    _committee_write_guard(caller)
    row = await _accessible_item(db, caller, item_id, lock=True)
    _require_item_mutation(caller, row)
    if row.status in {"decided", "cancelled"}:
        raise HTTPException(status.HTTP_409_CONFLICT, "Finalized or cancelled agenda items are immutable.")
    if row.revision != body.expected_revision:
        raise HTTPException(status.HTTP_409_CONFLICT, {"message": "Agenda item changed elsewhere.", "current_revision": row.revision})
    if "owner_id" in body.model_fields_set and body.owner_id != row.owner_id:
        if not _is_admin(caller) or not body.owner_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only an admin can reassign an agenda item.")

    values = body.model_dump(exclude={"expected_revision"}, exclude_unset=True)
    if "conditions" in values and values["conditions"] is not None:
        values["conditions"] = _clean_conditions(values["conditions"])
    if "thesis" in values and values["thesis"] is not None:
        values["thesis"] = values["thesis"].strip()
    candidate_owner = values.get("owner_id") or row.owner_id
    await _validate_refs(
        db,
        caller,
        issuer_id=row.issuer_id,
        owner_id=candidate_owner,
        run_id=values.get("run_id", row.run_id),
        portfolio_id=values.get("portfolio_id", row.portfolio_id),
        report_version_id=values.get("report_version_id", row.report_version_id),
        context_id=values.get("context_id", row.context_id),
    )
    await _validate_analyst_opinion(
        db,
        opinion_id=values.get("analyst_opinion_version_id", row.analyst_opinion_version_id),
        issuer_id=row.issuer_id,
        owner_id=candidate_owner,
    )
    for key, value in values.items():
        setattr(row, key, value)
    row.revision += 1
    row.updated_at = datetime.now(timezone.utc)
    await db.flush()
    if row.status == "ready":
        failures, _, _ = await _effective_readiness(db, caller, row)
        if failures:
            raise HTTPException(status.HTTP_409_CONFLICT, {"message": "Agenda item is not ready.", "failures": failures})
    return await _agenda_out(db, caller, row)


@router.post("/agenda/{item_id}/exceptions", response_model=AgendaOut, status_code=status.HTTP_201_CREATED)
async def request_evidence_exception(
    item_id: str,
    body: ExceptionRequestIn,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    _committee_write_guard(caller)
    item = await _accessible_item(db, caller, item_id, lock=True)
    _require_item_mutation(caller, item)
    if item.status in {"decided", "cancelled"}:
        raise HTTPException(status.HTTP_409_CONFLICT, "Finalized or cancelled agenda items cannot request an exception.")
    if item.revision != body.expected_revision:
        raise HTTPException(status.HTTP_409_CONFLICT, {"message": "Agenda item changed elsewhere.", "current_revision": item.revision})
    today = datetime.now(timezone.utc).date()
    if body.expires_at < today or body.expires_at > today + timedelta(days=_EXCEPTION_MAX_DAYS):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Exception expiry must be within the next 30 days.")
    failures = await _readiness_failures(db, caller, item)
    run = await db.get(Run, item.run_id) if item.run_id else None
    findings = list((await db.execute(
        select(QAFinding).where(QAFinding.run_id == run.id)
    )).scalars().all()) if run else []
    if not _exception_is_eligible(failures, run, findings):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {"message": "Only a non-critical readiness gap may be requested as an exception.", "failures": failures},
        )
    latest = await _latest_exception(db, item.id)
    if latest is not None and latest.status == "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, "An evidence exception is already awaiting review.")
    assert run is not None
    basis_sha256, finding_ids = _exception_basis(item, run, failures, findings)
    exception = CommitteeEvidenceException(
        agenda_item_id=item.id,
        run_id=run.id,
        basis_sha256=basis_sha256,
        failure_codes=failures,
        finding_ids=finding_ids,
        rationale=body.rationale.strip(),
        mitigants=_clean_conditions(body.mitigants),
        expires_at=body.expires_at,
        status="pending",
        requested_by=caller.id,
        requested_at=datetime.now(timezone.utc),
        revision=1,
    )
    db.add(exception)
    item.revision += 1
    item.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return await _agenda_out(db, caller, item, evidence_exception=exception)


@router.post("/exceptions/{exception_id}/review", response_model=AgendaOut)
async def review_evidence_exception(
    exception_id: str,
    body: ExceptionReviewIn,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    _require_exception_reviewer(caller)
    exception = (await db.execute(
        select(CommitteeEvidenceException).where(CommitteeEvidenceException.id == exception_id).with_for_update()
    )).scalar_one_or_none()
    if exception is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Evidence exception not found.")
    item = await _accessible_item(db, caller, exception.agenda_item_id, lock=True)
    if exception.status != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only a pending exception can be reviewed.")
    if exception.revision != body.expected_revision:
        raise HTTPException(status.HTTP_409_CONFLICT, {"message": "Exception changed elsewhere.", "current_revision": exception.revision})
    if caller.id in {exception.requested_by, item.owner_id}:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "An exception cannot be reviewed by its requester or agenda owner.")
    failures = await _readiness_failures(db, caller, item)
    run = await db.get(Run, item.run_id) if item.run_id else None
    findings = list((await db.execute(
        select(QAFinding).where(QAFinding.run_id == run.id)
    )).scalars().all()) if run else []
    if body.decision == "approve":
        if not _exception_is_eligible(failures, run, findings):
            raise HTTPException(status.HTTP_409_CONFLICT, {"message": "Exception basis is no longer eligible.", "failures": failures})
        assert run is not None
        basis_sha256, finding_ids = _exception_basis(item, run, failures, findings)
        if exception.run_id != run.id or exception.basis_sha256 != basis_sha256 or sorted(exception.finding_ids or []) != finding_ids:
            raise HTTPException(status.HTTP_409_CONFLICT, "Evidence changed since the exception request; submit a new request.")
        exception.status = "approved"
    else:
        exception.status = "rejected"
    exception.reviewed_by = caller.id
    exception.reviewed_at = datetime.now(timezone.utc)
    exception.review_note = body.review_note.strip()
    exception.revision += 1
    item.revision += 1
    item.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return await _agenda_out(db, caller, item, evidence_exception=exception)


@router.post("/exceptions/{exception_id}/revoke", response_model=AgendaOut)
async def revoke_evidence_exception(
    exception_id: str,
    body: ExceptionRevokeIn,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    _require_exception_reviewer(caller)
    exception = (await db.execute(
        select(CommitteeEvidenceException).where(CommitteeEvidenceException.id == exception_id).with_for_update()
    )).scalar_one_or_none()
    if exception is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Evidence exception not found.")
    item = await _accessible_item(db, caller, exception.agenda_item_id, lock=True)
    if exception.status != "approved":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only an approved exception can be revoked.")
    if exception.revision != body.expected_revision:
        raise HTTPException(status.HTTP_409_CONFLICT, {"message": "Exception changed elsewhere.", "current_revision": exception.revision})
    exception.status = "revoked"
    exception.revoked_by = caller.id
    exception.revoked_at = datetime.now(timezone.utc)
    exception.review_note = body.review_note.strip()
    exception.revision += 1
    item.revision += 1
    item.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return await _agenda_out(db, caller, item, evidence_exception=exception)


def _canonical_json(value: Any) -> tuple[Any, str]:
    canonical = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)
    return json.loads(canonical), hashlib.sha256(canonical.encode()).hexdigest()


async def _freeze_evidence_manifest(
    db: AsyncSession,
    modules: list[ModuleOutput],
) -> tuple[dict[str, Any], list[str]]:
    module_ids = [module.id for module in modules]
    claims = list((await db.execute(
        select(Claim).where(Claim.module_output_id.in_(module_ids)).order_by(Claim.id).with_for_update()
    )).scalars().all()) if module_ids else []
    claim_ids = [claim.id for claim in claims]
    evidence = list((await db.execute(
        select(EvidenceItem).where(EvidenceItem.claim_pk.in_(claim_ids)).order_by(EvidenceItem.id).with_for_update()
    )).scalars().all()) if claim_ids else []
    chunk_ids = {item.document_chunk_id for item in evidence if item.document_chunk_id}
    chunks = list((await db.execute(
        select(DocumentChunk).where(DocumentChunk.id.in_(chunk_ids)).order_by(DocumentChunk.id).with_for_update()
    )).scalars().all()) if chunk_ids else []
    document_ids = {chunk.document_id for chunk in chunks}
    documents = list((await db.execute(
        select(Document).where(Document.id.in_(document_ids)).order_by(Document.id).with_for_update()
    )).scalars().all()) if document_ids else []
    chunk_by_id = {chunk.id: chunk for chunk in chunks}
    manifest = {
        "modules": [{
            "id": module.id,
            "module_id": module.module_id,
            "module_name": module.module_name,
            "runtime_output": module.runtime_output or {},
            "confidence": module.confidence,
            "qa_status": module.qa_status,
            "committee_status": module.committee_status,
            "validation_status": module.validation_status,
            "limitation_flags": module.limitation_flags or [],
        } for module in modules],
        "claims": [{
            "id": claim.id,
            "module_output_id": claim.module_output_id,
            "claim_id": claim.claim_id,
            "claim_text": claim.claim_text,
        } for claim in claims],
        "evidence": [{
            "id": item.id,
            "claim_pk": item.claim_pk,
            "evidence_id": item.evidence_id,
            "extraction_type": item.extraction_type,
            "lineage_class": item.lineage_class,
            "source_locator": item.source_locator,
            "document_chunk_id": item.document_chunk_id,
            "confidence": item.confidence,
            "chunk": ({
                "id": chunk_by_id[item.document_chunk_id].id,
                "document_id": chunk_by_id[item.document_chunk_id].document_id,
                "seq": chunk_by_id[item.document_chunk_id].seq,
                "text": chunk_by_id[item.document_chunk_id].text,
                "chunk_hash": chunk_by_id[item.document_chunk_id].chunk_hash,
                "prov": chunk_by_id[item.document_chunk_id].prov,
            } if item.document_chunk_id in chunk_by_id else None),
        } for item in evidence],
        "documents": [{
            "id": document.id,
            "issuer_id": document.issuer_id,
            "doc_type": document.doc_type,
            "file_name": document.file_name,
            "storage_key": document.storage_key,
            "fiscal_period": document.fiscal_period,
            "uploaded_at": document.uploaded_at,
        } for document in documents],
    }
    frozen, manifest_hash = _canonical_json(manifest)
    source_ids = module_ids + claim_ids + [item.id for item in evidence]
    source_ids += [chunk.id for chunk in chunks] + [document.id for document in documents]
    return {"records": frozen, "sha256": manifest_hash}, source_ids


async def _freeze_portfolio_snapshot(
    db: AsyncSession,
    portfolio: Optional[Portfolio],
) -> tuple[Optional[dict[str, Any]], list[str]]:
    if portfolio is None:
        return None, []
    positions = list((await db.execute(
        select(PortfolioPosition).where(PortfolioPosition.portfolio_id == portfolio.id)
        .order_by(PortfolioPosition.id).with_for_update()
    )).scalars().all())
    constraints = list((await db.execute(
        select(PortfolioConstraint).where(PortfolioConstraint.portfolio_id == portfolio.id)
        .order_by(PortfolioConstraint.id).with_for_update()
    )).scalars().all())
    stress = (await db.execute(
        select(PortfolioStressRun).where(PortfolioStressRun.portfolio_id == portfolio.id)
        .order_by(PortfolioStressRun.created_at.desc(), PortfolioStressRun.id.desc()).limit(1)
        .with_for_update()
    )).scalar_one_or_none()
    def finite(value: Any) -> Any:
        return value if value is None or is_finite_number(value) else None

    position_rows = [{
        "id": row.id,
        "portfolio_id": row.portfolio_id,
        "issuer_id": row.issuer_id,
        "borrower_name": row.borrower_name,
        "ticker": row.ticker,
        "figi": row.figi,
        "loan_name": row.loan_name,
        "sector": row.sector,
        "sub_sector": row.sub_sector,
        "ranking": row.ranking,
        "rating_moody": row.rating_moody,
        "rating_sp": row.rating_sp,
        "par_usd": finite(row.par_usd),
        "facility_musd": finite(row.facility_musd),
        "margin_bps": finite(row.margin_bps),
        "maturity": row.maturity,
        "price": finite(row.price),
        "ytm": finite(row.ytm),
        "dm": finite(row.dm),
        "created_at": row.created_at,
        "market_value": portfolio_engine.position_market_value({
            "par_usd": row.par_usd,
            "price": row.price,
        }),
    } for row in positions]
    constraint_rows = [{
        "id": row.id,
        "code": row.code,
        "category": row.category,
        "parameter": row.parameter,
        "limit_text": row.limit_text,
        "limit_value": row.limit_value,
        "limit_unit": row.limit_unit,
        "limit_op": row.limit_op,
        "breach_type": row.breach_type,
        "source_document": row.source_document,
    } for row in constraints]
    analytics = portfolio_engine.compute_portfolio_analytics(
        position_rows,
        constraint_rows,
        as_of=portfolio.as_of_date,
        portfolio_id=portfolio.id,
    )
    holdings_frozen, holdings_hash = _canonical_json(position_rows)
    constraints_frozen, constraints_hash = _canonical_json(constraint_rows)
    stress_snapshot = None
    stress_source_ids: list[str] = []
    if stress:
        expected_stress_fingerprint = portfolio_engine.stress_source_fingerprint(
            position_rows,
            stress.inputs or {},
            as_of=portfolio.as_of_date,
            portfolio_id=portfolio.id,
        )
        if hmac.compare_digest(stress.source_fingerprint, expected_stress_fingerprint):
            stress_snapshot = {
                "status": "current",
                "id": stress.id,
                "label": stress.label,
                "inputs": stress.inputs,
                "output": stress.output,
                "source_fingerprint": stress.source_fingerprint,
                "authority": stress.authority,
                "created_at": stress.created_at,
            }
            stress_source_ids.append(stress.id)
        else:
            # Do not attach stale outputs to current holdings. Preserve only the
            # mismatch diagnostic so the committee record is explicit.
            stress_snapshot = {
                "status": "stale",
                "id": stress.id,
                "stored_source_fingerprint": stress.source_fingerprint,
                "expected_source_fingerprint": expected_stress_fingerprint,
                "reason": "stress source does not match frozen holdings and as-of",
            }
    snapshot = {
        "id": portfolio.id,
        "name": portfolio.name,
        "as_of_date": portfolio.as_of_date,
        "updated_at": portfolio.updated_at,
        "holdings": holdings_frozen,
        "holdings_sha256": holdings_hash,
        "constraints": constraints_frozen,
        "constraints_sha256": constraints_hash,
        "analytics": analytics,
        "stress": stress_snapshot,
    }
    frozen, snapshot_hash = _canonical_json(snapshot)
    source_ids = [portfolio.id] + [row.id for row in positions] + [row.id for row in constraints]
    source_ids.extend(stress_source_ids)
    return {"records": frozen, "sha256": snapshot_hash}, source_ids


def _decision_summary(row: Decision) -> FinalizedDecisionOut:
    return FinalizedDecisionOut(
        id=row.id,
        issuer_id=row.issuer_id,
        portfolio_id=row.portfolio_id,
        agenda_item_id=row.agenda_item_id,
        report_version_id=row.report_version_id,
        run_id=row.run_id,
        action=row.action,
        status=row.status,
        snapshot_sha256=row.snapshot_sha256,
        created_at=row.created_at,
    )


async def _existing_finalization_out(
    db: AsyncSession,
    caller: CallerIdentity,
    row: CommitteeAgendaItem,
    expected_revision: int,
) -> Optional[AgendaFinalizeOut]:
    if not row.finalized_decision_id:
        return None
    # The successful finalize advances the agenda revision once. Accepting that
    # exact transition revision makes a lost-response retry idempotent without
    # allowing an arbitrarily stale request to retrieve the finalized record.
    if expected_revision not in {row.revision, row.revision - 1}:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {
                "message": "Agenda item changed since review.",
                "current_revision": row.revision,
            },
        )
    decision = await db.get(Decision, row.finalized_decision_id)
    if decision is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Agenda finalization link is inconsistent.")
    return AgendaFinalizeOut(
        agenda=await _agenda_out(db, caller, row), decision=_decision_summary(decision)
    )


@router.post("/agenda/{item_id}/finalize", response_model=AgendaFinalizeOut)
async def finalize_agenda_item(
    item_id: str,
    body: AgendaFinalizeIn,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    _committee_write_guard(caller)
    row = await _accessible_item(db, caller, item_id, lock=True)
    _require_item_mutation(caller, row)
    existing = await _existing_finalization_out(db, caller, row, body.expected_revision)
    if existing is not None:
        return existing
    if row.revision != body.expected_revision:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {"message": "Agenda item changed since review.", "current_revision": row.revision},
        )
    if row.status != "ready":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only a ready agenda item can be finalized.")
    failures, evidence_exception, under_exception = await _effective_readiness(db, caller, row)
    if failures:
        raise HTTPException(status.HTTP_409_CONFLICT, {"message": "Agenda item is not ready.", "failures": failures})
    run, portfolio, report, context = await _validate_refs(
        db,
        caller,
        issuer_id=row.issuer_id,
        owner_id=row.owner_id,
        run_id=row.run_id,
        portfolio_id=row.portfolio_id,
        report_version_id=row.report_version_id,
        context_id=row.context_id,
        lock=True,
    )
    assert run is not None  # readiness guarantees a persisted run
    opinion = await _validate_analyst_opinion(
        db,
        opinion_id=row.analyst_opinion_version_id,
        issuer_id=row.issuer_id,
        owner_id=row.owner_id,
    )
    if opinion is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "A linked analyst opinion is required before finalization.")
    modules = (await db.execute(
        select(ModuleOutput).where(ModuleOutput.run_id == run.id)
        .order_by(ModuleOutput.module_id).with_for_update()
    )).scalars().all()
    evidence_manifest, evidence_source_ids = await _freeze_evidence_manifest(db, list(modules))
    portfolio_snapshot, portfolio_source_ids = await _freeze_portfolio_snapshot(db, portfolio)
    document = assemble_report(run, modules)
    now = datetime.now(timezone.utc)
    source_ids = [run.id, opinion.id] + evidence_source_ids + portfolio_source_ids
    source_ids.append(f"evidence-manifest:{evidence_manifest['sha256']}")
    if portfolio_snapshot:
        source_ids.extend([
            f"portfolio-snapshot:{portfolio_snapshot['sha256']}",
            f"holdings:{portfolio_snapshot['records']['holdings_sha256']}",
            f"constraints:{portfolio_snapshot['records']['constraints_sha256']}",
        ])
    if report:
        source_ids.append(report.id)
        source_ids.extend(str(value) for value in (report.authority or {}).get("source_ids", []) if value)
    if context:
        source_ids.append(context.id)
    if evidence_exception is not None and under_exception:
        source_ids.extend([evidence_exception.id, f"exception-basis:{evidence_exception.basis_sha256}"])
    snapshot = {
        "agenda": {
            "id": row.id,
            "issuer_id": row.issuer_id,
            "portfolio_id": row.portfolio_id,
            "owner_id": row.owner_id,
            "finalized_by": caller.id,
            "scheduled_for": row.scheduled_for,
            "recommendation": row.recommendation,
            "conviction": row.conviction,
            "thesis": row.thesis,
            "conditions": row.conditions or [],
            "expiry": row.expiry,
            "revision": row.revision,
        },
        "analyst_view": {
            "id": opinion.id,
            "version": opinion.version,
            "analyst_id": opinion.analyst_id,
            "stance": opinion.stance,
            "conviction": opinion.conviction,
            "rationale_md": opinion.rationale_md,
            "evidence_state": opinion.evidence_state,
            "unresolved_items": opinion.unresolved_items or [],
            "thesis_version_id": opinion.thesis_version_id,
            "source_run_id": opinion.source_run_id,
            "context_id": opinion.context_id,
            "analyst_link_ids": opinion.analyst_link_ids or [],
            "created_at": opinion.created_at,
        },
        "run": {
            "id": run.id,
            "issuer_id": run.issuer_id,
            "portfolio_id": run.portfolio_id,
            "qa_status": run.qa_status,
            "committee_status": run.committee_status,
            "as_of_date": run.as_of_date,
            "model_id": run.model_id,
            "prompt_version": run.prompt_version,
            "completed_at": run.completed_at,
        },
        "document": document,
        "document_sha256": hashlib.sha256(
            json.dumps(document, sort_keys=True, separators=(",", ":"), default=str).encode()
        ).hexdigest(),
        "evidence_manifest": evidence_manifest,
        "report_version": ({
            "id": report.id,
            "context_id": report.context_id,
            "document_sha256": report.document_sha256,
            "payload": report.payload or {},
            "authority": report.authority or {},
        } if report else None),
        "context": ({"id": context.id, "artifacts": context.artifacts or {}} if context else None),
        "portfolio": portfolio_snapshot,
        "evidence_exception": ({
            "id": evidence_exception.id,
            "run_id": evidence_exception.run_id,
            "basis_sha256": evidence_exception.basis_sha256,
            "failure_codes": evidence_exception.failure_codes or [],
            "finding_ids": evidence_exception.finding_ids or [],
            "rationale": evidence_exception.rationale,
            "mitigants": evidence_exception.mitigants or [],
            "expires_at": evidence_exception.expires_at,
            "requested_by": evidence_exception.requested_by,
            "requested_at": evidence_exception.requested_at,
            "reviewed_by": evidence_exception.reviewed_by,
            "reviewed_at": evidence_exception.reviewed_at,
            "review_note": evidence_exception.review_note,
        } if evidence_exception is not None and under_exception else None),
        "authority": {
            "origin": "live",
            "method": "derived-with-approved-exception" if under_exception else "derived",
            "freshness": "current",
            "as_of": now.isoformat(),
            "source_ids": sorted(set(source_ids)),
            "run_id": run.id,
            "version_id": report.id if report else None,
            "confidence": None,
            "approval_state": "ratified",
            "analyst_override": (
                f"Finalized under approved evidence exception; analyst view {opinion.stance}."
                if under_exception else None
            ),
        },
    }
    # Persist the same JSON-safe representation that is hashed. SQLAlchemy's
    # JSON serializer does not apply ``default=str`` to nested datetimes.
    canonical = json.dumps(snapshot, sort_keys=True, separators=(",", ":"), default=str)
    snapshot = json.loads(canonical)
    snapshot_sha256 = hashlib.sha256(canonical.encode()).hexdigest()
    decision = Decision(
        issuer_id=row.issuer_id,
        run_id=run.id,
        report_id=row.report_version_id,
        report_version_id=row.report_version_id,
        portfolio_id=row.portfolio_id,
        agenda_item_id=row.id,
        action=row.recommendation,
        conditions=row.conditions or [],
        expiry=row.expiry,
        snapshot=snapshot,
        snapshot_sha256=snapshot_sha256,
        status="active",
        created_by=row.owner_id,
        created_at=now,
    )
    db.add(decision)
    await db.flush()
    thesis_version = await create_thesis_version(
        db,
        ThesisVersionIn(
            issuer_id=row.issuer_id,
            thesis_md=row.thesis,
            trigger="decision",
            linked_decision_id=decision.id,
        ),
        caller,
    )
    thesis_version.created_by = row.owner_id
    row.status = "decided"
    row.finalized_decision_id = decision.id
    row.snapshot = snapshot
    row.snapshot_sha256 = snapshot_sha256
    row.revision += 1
    row.updated_at = now
    row.finalized_at = now
    await db.flush()
    return AgendaFinalizeOut(
        agenda=await _agenda_out(db, caller, row), decision=_decision_summary(decision)
    )
