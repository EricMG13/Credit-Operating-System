"""Portfolio management — managed CLO books built from uploaded holdings.

Create/list/read portfolios and (re)upload their holdings / constraints / mandate
files. Exposure + constraint compliance are COMPUTED on read from the stored
positions (engine/portfolio.py) — nothing derived is persisted, so the holdings
are always the single source of truth. Ingest also soft-links each position to a
registered issuer and refreshes that issuer's agency rating (shared with the
Phase-1 ratings collector).

Authorization is config-gated. The default shared-desk deployment preserves
cross-analyst reads and writes. When CAOS_TENANCY_ENABLED is active, every direct
and indirect portfolio lookup is scoped to the caller's exact team; creator
attribution is not an authorization boundary.
"""

from __future__ import annotations

import asyncio
import base64
import binascii
import hashlib
import hmac
import json
import logging
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

import avscan
import ingest
import portfolio_ingest
import rate_limit
from config import get_settings
from database import (
    Issuer, Portfolio, PortfolioConstraint, PortfolioPosition, PortfolioStressRun, get_db,
)
from engine import portfolio as pf
from identity import CallerIdentity, get_identity, require_write_role
from tenancy import (
    new_portfolio_team,
    require_portfolio_access,
    scope_issuers,
    scope_portfolios,
)

logger = logging.getLogger("caos.portfolios")
router = APIRouter()

_UPLOAD_MAX_PER_MINUTE = 20


def _rate_guard(caller: CallerIdentity) -> None:
    if not rate_limit.hit(f"portfolio:{caller.id}", max_attempts=_UPLOAD_MAX_PER_MINUTE, window_seconds=60):
        raise HTTPException(429, "Portfolio upload rate limit reached — try again in a minute.")


class PortfolioSummary(BaseModel):
    id: str
    name: str
    kind: str
    as_of_date: Optional[str] = None
    n_positions: int
    total_nav: Optional[float]
    total_par: Optional[float]
    breaches: int          # hard+soft constraint breaches (computed)
    watches: int
    created_at: Optional[datetime] = None


class PortfolioDetail(BaseModel):
    id: str
    name: str
    kind: str
    as_of_date: Optional[str] = None
    mandate: Dict[str, Any] = {}
    exposure: Dict[str, Any] = {}
    compliance: List[Dict[str, Any]] = []


# ── Reads ────────────────────────────────────────────────────────────────────
async def _positions(db: AsyncSession, portfolio_id: str) -> List[Dict[str, Any]]:
    rows = (await db.execute(
        select(PortfolioPosition).where(PortfolioPosition.portfolio_id == portfolio_id)
    )).scalars().all()
    return [{
        "issuer_id": p.issuer_id, "borrower_name": p.borrower_name, "ticker": p.ticker,
        "figi": p.figi, "sector": p.sector, "sub_sector": p.sub_sector, "ranking": p.ranking,
        "rating_moody": p.rating_moody, "rating_sp": p.rating_sp, "par_usd": p.par_usd,
        "price": p.price, "margin_bps": p.margin_bps,
    } for p in rows]


async def _constraints(db: AsyncSession, portfolio_id: str) -> List[Dict[str, Any]]:
    rows = (await db.execute(
        select(PortfolioConstraint).where(PortfolioConstraint.portfolio_id == portfolio_id)
    )).scalars().all()
    return [{
        "code": c.code, "category": c.category, "parameter": c.parameter,
        "limit_text": c.limit_text, "limit_value": c.limit_value, "limit_unit": c.limit_unit,
        "limit_op": c.limit_op, "breach_type": c.breach_type, "source_document": c.source_document,
    } for c in rows]


@router.get("", response_model=List[PortfolioSummary], include_in_schema=False)
@router.get("/", response_model=List[PortfolioSummary])
async def list_portfolios(
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    stmt = scope_portfolios(select(Portfolio), caller)
    rows = (await db.execute(stmt.order_by(Portfolio.name).limit(200))).scalars().all()
    if not rows:
        return []

    pids = [prt.id for prt in rows]

    pos_rows = (await db.execute(
        select(
            PortfolioPosition.portfolio_id, PortfolioPosition.issuer_id, PortfolioPosition.borrower_name,
            PortfolioPosition.ticker, PortfolioPosition.figi, PortfolioPosition.sector, PortfolioPosition.sub_sector,
            PortfolioPosition.ranking, PortfolioPosition.rating_moody, PortfolioPosition.rating_sp,
            PortfolioPosition.par_usd, PortfolioPosition.price, PortfolioPosition.margin_bps
        ).where(PortfolioPosition.portfolio_id.in_(pids))
    )).all()

    con_rows = (await db.execute(
        select(
            PortfolioConstraint.portfolio_id, PortfolioConstraint.code, PortfolioConstraint.category,
            PortfolioConstraint.parameter, PortfolioConstraint.limit_text, PortfolioConstraint.limit_value,
            PortfolioConstraint.limit_unit, PortfolioConstraint.limit_op, PortfolioConstraint.breach_type,
            PortfolioConstraint.source_document
        ).where(PortfolioConstraint.portfolio_id.in_(pids))
    )).all()

    from collections import defaultdict
    pos_by_pid = defaultdict(list)
    for p in pos_rows:
        pos_by_pid[p.portfolio_id].append({
            "issuer_id": p.issuer_id, "borrower_name": p.borrower_name, "ticker": p.ticker,
            "figi": p.figi, "sector": p.sector, "sub_sector": p.sub_sector, "ranking": p.ranking,
            "rating_moody": p.rating_moody, "rating_sp": p.rating_sp, "par_usd": p.par_usd,
            "price": p.price, "margin_bps": p.margin_bps,
        })

    con_by_pid = defaultdict(list)
    for c in con_rows:
        con_by_pid[c.portfolio_id].append({
            "code": c.code, "category": c.category, "parameter": c.parameter,
            "limit_text": c.limit_text, "limit_value": c.limit_value, "limit_unit": c.limit_unit,
            "limit_op": c.limit_op, "breach_type": c.breach_type, "source_document": c.source_document,
        })

    out: List[PortfolioSummary] = []
    for prt in rows:
        pos = pos_by_pid[prt.id]
        ex = pf.compute_exposure(pos)
        comp = pf.check_constraints(con_by_pid[prt.id], ex)
        
        breaches = 0
        watches = 0
        for c in comp:
            status = c["status"]
            if status == "Breach":
                breaches += 1
            elif status == "Watch":
                watches += 1

        out.append(PortfolioSummary(
            id=prt.id, name=prt.name, kind=prt.kind, as_of_date=prt.as_of_date,
            n_positions=ex["n_positions"], total_nav=ex["total_nav"], total_par=ex["total_par"],
            breaches=breaches, watches=watches, created_at=prt.created_at,
        ))
    return out


@router.get("/{portfolio_id}", response_model=PortfolioDetail)
async def get_portfolio(
    portfolio_id: str,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    prt = require_portfolio_access(caller, await db.get(Portfolio, portfolio_id))
    ex = pf.compute_exposure(await _positions(db, portfolio_id))
    comp = pf.check_constraints(await _constraints(db, portfolio_id), ex)
    return PortfolioDetail(
        id=prt.id, name=prt.name, kind=prt.kind, as_of_date=prt.as_of_date,
        mandate=prt.mandate or {}, exposure=ex, compliance=comp,
    )


# ── Writes ───────────────────────────────────────────────────────────────────
async def _read_xlsx(file: UploadFile) -> bytes:
    content = await ingest.read_capped(file)
    await avscan.scan(content)          # scan before parse (no-op unless CLAMAV set)
    ingest.sniff_xlsx(content)
    return content


async def _persist_positions(
    db: AsyncSession,
    portfolio_id: str,
    positions: List[Dict[str, Any]],
    caller: CallerIdentity,
) -> int:
    """Replace a portfolio's positions; soft-link each to a registered issuer
    (figi→ticker→name) and refresh that issuer's agency rating from the row."""
    await db.execute(delete(PortfolioPosition).where(PortfolioPosition.portfolio_id == portfolio_id))
    issuers = (
        await db.execute(scope_issuers(select(Issuer), caller).limit(5000))
    ).scalars().all()
    by_figi = {i.figi.strip().lower(): i for i in issuers if i.figi}
    by_ticker = {i.ticker.strip().lower(): i for i in issuers if i.ticker}
    by_name = {i.name.strip().lower(): i for i in issuers if i.name}

    def match(rec) -> Optional[Issuer]:
        for k in ("figi", "ticker", "borrower_name"):
            val = rec.get(k)
            if val:
                val_clean = val.strip().lower()
                table = by_figi if k == "figi" else by_ticker if k == "ticker" else by_name
                if val_clean in table:
                    return table[val_clean]
        return None

    for rec in positions:
        iss = match(rec)
        if iss is not None:  # refresh the linked issuer's rating (shares the #1 collector's intent)
            if rec.get("rating_moody"):
                iss.rating_moody = rec["rating_moody"]
            if rec.get("rating_sp"):
                iss.rating_sp = rec["rating_sp"]
        db.add(PortfolioPosition(
            portfolio_id=portfolio_id, issuer_id=iss.id if iss else None,
            borrower_name=rec["borrower_name"], ticker=rec.get("ticker"), figi=rec.get("figi"),
            loan_name=rec.get("loan_name"), sector=rec.get("sector"), sub_sector=rec.get("sub_sector"),
            ranking=rec.get("ranking"), rating_moody=rec.get("rating_moody"), rating_sp=rec.get("rating_sp"),
            par_usd=rec["par_usd"], facility_musd=rec.get("facility_musd"), margin_bps=rec.get("margin_bps"),
            maturity=rec.get("maturity"), price=rec.get("price"), ytm=rec.get("ytm"), dm=rec.get("dm"),
        ))
    return len(positions)


async def _persist_constraints(db: AsyncSession, portfolio_id: str, constraints: List[Dict[str, Any]]) -> int:
    await db.execute(delete(PortfolioConstraint).where(PortfolioConstraint.portfolio_id == portfolio_id))
    for c in constraints:
        db.add(PortfolioConstraint(portfolio_id=portfolio_id, **{
            k: c.get(k) for k in ("code", "category", "parameter", "limit_text", "limit_value",
                                  "limit_unit", "limit_op", "breach_type", "source_document")}))
    return len(constraints)


@router.post("", response_model=PortfolioSummary, status_code=201, include_in_schema=False)
@router.post("/", response_model=PortfolioSummary, status_code=201)
async def create_portfolio(
    name: str = Form(...),
    kind: str = Form("CLO"),
    as_of_date: Optional[str] = Form(None),
    holdings: UploadFile = File(...),
    constraints: Optional[UploadFile] = File(None),
    mandate: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    require_write_role(caller)
    _rate_guard(caller)
    if not name.strip():
        raise HTTPException(400, "Portfolio name is required.")
    content = await _read_xlsx(holdings)
    positions = await asyncio.to_thread(portfolio_ingest.parse_holdings_xlsx, content)
    if not positions:
        raise HTTPException(422, "No CLO positions found — the holdings sheet needs a 'Holdings' par column with values.")

    mandate_data: Dict[str, Any] = {}
    if mandate is not None:
        mc = await ingest.read_capped(mandate)
        await avscan.scan(mc)
        mandate_data = portfolio_ingest.parse_mandate_csv(mc)

    prt = Portfolio(name=name.strip(), kind=(kind or "CLO").strip(), as_of_date=as_of_date,
                    mandate=mandate_data, created_by=caller.id,
                    team_id=new_portfolio_team(caller),
                    created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc))
    db.add(prt)
    await db.flush()
    await _persist_positions(db, prt.id, positions, caller)
    if constraints is not None:
        cc = await ingest.read_capped(constraints)
        await avscan.scan(cc)
        await _persist_constraints(db, prt.id, portfolio_ingest.parse_constraints_csv(cc))
    await db.flush()

    ex = pf.compute_exposure(positions)
    comp = pf.check_constraints(await _constraints(db, prt.id), ex)
    return PortfolioSummary(
        id=prt.id, name=prt.name, kind=prt.kind, as_of_date=prt.as_of_date,
        n_positions=ex["n_positions"], total_nav=ex["total_nav"], total_par=ex["total_par"],
        breaches=sum(1 for c in comp if c["status"] == "Breach"),
        watches=sum(1 for c in comp if c["status"] == "Watch"), created_at=prt.created_at,
    )


@router.post("/{portfolio_id}/holdings", response_model=PortfolioSummary)
async def update_holdings(
    portfolio_id: str,
    holdings: UploadFile = File(...),
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    _rate_guard(caller)
    prt = require_portfolio_access(caller, await db.get(Portfolio, portfolio_id))
    require_write_role(caller)
    content = await _read_xlsx(holdings)
    positions = await asyncio.to_thread(portfolio_ingest.parse_holdings_xlsx, content)
    if not positions:
        raise HTTPException(422, "No CLO positions found in the holdings sheet.")
    await _persist_positions(db, portfolio_id, positions, caller)
    prt.updated_at = datetime.now(timezone.utc)
    await db.flush()
    ex = pf.compute_exposure(positions)
    comp = pf.check_constraints(await _constraints(db, portfolio_id), ex)
    return PortfolioSummary(
        id=prt.id, name=prt.name, kind=prt.kind, as_of_date=prt.as_of_date,
        n_positions=ex["n_positions"], total_nav=ex["total_nav"], total_par=ex["total_par"],
        breaches=sum(1 for c in comp if c["status"] == "Breach"),
        watches=sum(1 for c in comp if c["status"] == "Watch"), created_at=prt.created_at,
    )


# ── Portfolio Lab: positions / deterministic analytics / immutable stress ───
_POSITION_SORTS = {
    "borrower_name": PortfolioPosition.borrower_name,
    "ticker": PortfolioPosition.ticker,
    "sector": PortfolioPosition.sector,
    "sub_sector": PortfolioPosition.sub_sector,
    "ranking": PortfolioPosition.ranking,
    "rating_moody": PortfolioPosition.rating_moody,
    "rating_sp": PortfolioPosition.rating_sp,
    "par_usd": PortfolioPosition.par_usd,
    "price": PortfolioPosition.price,
    "margin_bps": PortfolioPosition.margin_bps,
    "maturity": PortfolioPosition.maturity,
    "created_at": PortfolioPosition.created_at,
}


_CURSOR_VERSION = 1
# Cursor payloads include a schema-bounded sort value (up to 255 characters).
# Keep the request guard aligned with the largest cursor this route can issue.
_CURSOR_MAX_LENGTH = 4096


def _revision(portfolio: Portfolio) -> str:
    value = portfolio.updated_at
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def _filter_fingerprint(
    *,
    text: Optional[str],
    sector: Optional[str],
    rating: Optional[str],
    ranking: Optional[str],
) -> str:
    canonical = json.dumps(
        {
            "text": (text or "").strip(),
            "sector": (sector or "").strip(),
            "rating": (rating or "").strip(),
            "ranking": (ranking or "").strip(),
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _encode_cursor(payload: Dict[str, Any]) -> str:
    raw = json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
        ensure_ascii=False,
    ).encode("utf-8")
    encoded = base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
    signature = hmac.new(
        get_settings().session_secret.encode("utf-8"),
        encoded.encode("ascii"),
        hashlib.sha256,
    ).hexdigest()
    return f"{encoded}.{signature}"


def _decode_cursor(
    cursor: str,
    *,
    portfolio: Portfolio,
    sort: str,
    direction: str,
    filter_fingerprint: str,
) -> Dict[str, Any]:
    try:
        encoded, signature = cursor.rsplit(".", 1)
        expected = hmac.new(
            get_settings().session_secret.encode("utf-8"),
            encoded.encode("ascii"),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError
        raw = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
        payload = json.loads(raw)
        if (
            payload.get("v") != _CURSOR_VERSION
            or payload.get("portfolio_id") != portfolio.id
            or payload.get("sort") != sort
            or payload.get("direction") != direction
            or payload.get("filters") != filter_fingerprint
            or not isinstance(payload.get("last_id"), str)
            or not payload["last_id"]
            or not isinstance(payload.get("last_is_null"), bool)
        ):
            raise ValueError
        if payload.get("revision") != _revision(portfolio):
            raise HTTPException(409, "Positions cursor is stale; refresh holdings.")
        return payload
    except HTTPException:
        raise
    except (binascii.Error, KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(422, "Invalid or mismatched positions cursor.") from exc


def _position_payload(row: PortfolioPosition) -> Dict[str, Any]:
    from engine.periods import is_finite_number

    def finite(value: Any) -> Any:
        return value if value is None or is_finite_number(value) else None

    return {
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
        "market_value": pf.position_market_value({
            "par_usd": row.par_usd,
            "price": row.price,
        }),
    }


async def _position_rows(
    db: AsyncSession, portfolio_id: str
) -> List[PortfolioPosition]:
    return list((await db.execute(
        select(PortfolioPosition)
        .where(PortfolioPosition.portfolio_id == portfolio_id)
        .order_by(PortfolioPosition.id)
    )).scalars().all())


def _authority(portfolio: Portfolio, *, method: str) -> Dict[str, Any]:
    return pf.portfolio_authority(
        method=method,
        as_of=portfolio.as_of_date,
        portfolio_id=portfolio.id,
    )


def _cursor_value(row: PortfolioPosition, sort: str) -> Any:
    value = getattr(row, sort)
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat()
    return value


def _cursor_query_value(sort: str, value: Any) -> Any:
    if value is None:
        return None
    if sort == "created_at":
        try:
            parsed = datetime.fromisoformat(str(value))
        except ValueError as exc:
            raise HTTPException(422, "Invalid positions cursor sort value.") from exc
        return parsed
    if sort in {"par_usd", "price", "margin_bps"}:
        from engine.periods import is_finite_number

        if not is_finite_number(value):
            raise HTTPException(422, "Invalid positions cursor sort value.")
        return float(value)
    if not isinstance(value, str):
        raise HTTPException(422, "Invalid positions cursor sort value.")
    return value


@router.get("/{portfolio_id}/positions")
async def get_positions(
    portfolio_id: str,
    limit: int = Query(50, ge=1, le=200),
    cursor: Optional[str] = Query(None, max_length=_CURSOR_MAX_LENGTH),
    sort: str = Query("borrower_name", max_length=32),
    direction: str = Query("asc", max_length=4),
    text: Optional[str] = Query(None, max_length=160),
    sector: Optional[str] = Query(None, max_length=128),
    rating: Optional[str] = Query(None, max_length=16),
    ranking: Optional[str] = Query(None, max_length=64),
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    portfolio = require_portfolio_access(caller, await db.get(Portfolio, portfolio_id))
    if sort not in _POSITION_SORTS:
        raise HTTPException(422, "Unsupported positions sort field.")
    if direction not in {"asc", "desc"}:
        raise HTTPException(422, "Direction must be asc or desc.")
    text = text.strip() if text and text.strip() else None
    sector = sector.strip() if sector and sector.strip() else None
    rating = rating.strip() if rating and rating.strip() else None
    ranking = ranking.strip() if ranking and ranking.strip() else None
    filters_hash = _filter_fingerprint(
        text=text, sector=sector, rating=rating, ranking=ranking
    )

    stmt = select(PortfolioPosition).where(
        PortfolioPosition.portfolio_id == portfolio.id
    )
    if text:
        pattern = f"%{text}%"
        stmt = stmt.where(or_(
            PortfolioPosition.borrower_name.ilike(pattern),
            PortfolioPosition.ticker.ilike(pattern),
            PortfolioPosition.figi.ilike(pattern),
            PortfolioPosition.loan_name.ilike(pattern),
        ))
    if sector:
        stmt = stmt.where(PortfolioPosition.sector == sector)
    if rating:
        pattern = f"%{rating}%"
        stmt = stmt.where(or_(
            PortfolioPosition.rating_moody.ilike(pattern),
            PortfolioPosition.rating_sp.ilike(pattern),
        ))
    if ranking:
        stmt = stmt.where(PortfolioPosition.ranking.ilike(f"%{ranking}%"))

    total = (await db.execute(
        select(func.count()).select_from(stmt.order_by(None).subquery())
    )).scalar_one()
    column = _POSITION_SORTS[sort]
    if cursor:
        cursor_payload = _decode_cursor(
            cursor,
            portfolio=portfolio,
            sort=sort,
            direction=direction,
            filter_fingerprint=filters_hash,
        )
        last_id = cursor_payload["last_id"]
        if cursor_payload["last_is_null"]:
            stmt = stmt.where(
                and_(column.is_(None), PortfolioPosition.id > last_id)
            )
        else:
            last_value = _cursor_query_value(sort, cursor_payload.get("last"))
            comparison = (
                column > last_value if direction == "asc" else column < last_value
            )
            stmt = stmt.where(or_(
                comparison,
                and_(column == last_value, PortfolioPosition.id > last_id),
                column.is_(None),
            ))
    ordered = (
        stmt.order_by(
            column.asc().nulls_last() if direction == "asc" else column.desc().nulls_last(),
            PortfolioPosition.id.asc(),
        )
        .limit(limit + 1)
    )
    fetched = list((await db.execute(ordered)).scalars().all())
    has_more = len(fetched) > limit
    rows = fetched[:limit]
    next_cursor = None
    if has_more and rows:
        last = rows[-1]
        last_value = _cursor_value(last, sort)
        next_cursor = _encode_cursor({
            "v": _CURSOR_VERSION,
            "portfolio_id": portfolio.id,
            "sort": sort,
            "direction": direction,
            "filters": filters_hash,
            "revision": _revision(portfolio),
            "last": last_value,
            "last_is_null": last_value is None,
            "last_id": last.id,
        })
    normalized_as_of = pf.normalize_portfolio_as_of(portfolio.as_of_date)
    return {
        "items": [_position_payload(row) for row in rows],
        "total": total,
        "next_cursor": next_cursor,
        "as_of": (
            normalized_as_of.date().isoformat()
            if normalized_as_of is not None
            else None
        ),
        "authority": _authority(portfolio, method="reported-holdings-v1"),
    }


@router.get("/{portfolio_id}/analytics")
async def get_analytics(
    portfolio_id: str,
    as_of: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    portfolio = require_portfolio_access(caller, await db.get(Portfolio, portfolio_id))
    rows = await _position_rows(db, portfolio.id)
    constraints = await _constraints(db, portfolio.id)
    stored_as_of = pf.normalize_portfolio_as_of(portfolio.as_of_date)
    requested_as_of = pf.normalize_portfolio_as_of(as_of)
    requested_supported = (
        as_of is None
        or (
            stored_as_of is not None
            and requested_as_of is not None
            and stored_as_of.date() == requested_as_of.date()
        )
    )
    effective_as_of = stored_as_of if requested_supported else None
    analytics = pf.compute_portfolio_analytics(
        [_position_payload(row) for row in rows],
        constraints,
        as_of=effective_as_of,
        portfolio_id=portfolio.id,
    )
    if as_of is not None and not requested_supported:
        analytics["missing_dependencies"] = pf.bound_missing_dependencies(
            analytics["missing_dependencies"]
            + ["historical portfolio holdings for requested as_of"]
        )
    elif stored_as_of is None:
        analytics["missing_dependencies"] = pf.bound_missing_dependencies(
            analytics["missing_dependencies"] + ["valid portfolio as_of snapshot"]
        )
    latest = list((await db.execute(
        select(PortfolioStressRun)
        .where(PortfolioStressRun.portfolio_id == portfolio.id)
        .order_by(PortfolioStressRun.created_at.desc())
        .limit(5)
    )).scalars().all())
    analytics["latest_stress_runs"] = [
        {
            "id": row.id,
            "label": row.label,
            "status": row.status,
            "source_fingerprint": row.source_fingerprint,
            "base_nav": (row.output or {}).get("base_nav"),
            "stressed_nav": (row.output or {}).get("stressed_nav"),
            "loss_amount": (row.output or {}).get("loss_amount"),
            "loss_percent": (row.output or {}).get("loss_percent"),
            "created_at": row.created_at,
        }
        for row in latest
    ]
    return analytics


class StressRunCreate(BaseModel):
    label: str = Field(min_length=1, max_length=160)
    book_price_shock_pct: float = Field(ge=-100, le=100)
    sector_shock_pcts: Dict[str, float] = Field(default_factory=dict)

    @field_validator("book_price_shock_pct")
    @classmethod
    def finite_book_shock(cls, value: float) -> float:
        from engine.periods import is_finite_number

        if not is_finite_number(value):
            raise ValueError("book price shock must be finite")
        return value

    @field_validator("sector_shock_pcts")
    @classmethod
    def finite_sector_shocks(cls, value: Dict[str, float]) -> Dict[str, float]:
        from engine.periods import is_finite_number

        if len(value) > 100:
            raise ValueError("at most 100 sector shocks are allowed")
        for sector_name, shock in value.items():
            if (
                not sector_name.strip()
                or len(sector_name) > 128
                or not is_finite_number(shock)
                or shock < -100
                or shock > 100
            ):
                raise ValueError("sector shocks must be named, finite, and between -100 and 100")
        return value


def _stress_payload(row: PortfolioStressRun) -> Dict[str, Any]:
    return {
        "id": row.id,
        "portfolio_id": row.portfolio_id,
        "created_by": row.created_by,
        "label": row.label,
        "input": row.inputs,
        "output": row.output,
        "source_fingerprint": row.source_fingerprint,
        "authority": row.authority,
        "status": row.status,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


@router.post("/{portfolio_id}/stress-runs", status_code=201)
async def create_stress_run(
    portfolio_id: str,
    body: StressRunCreate,
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    portfolio = require_portfolio_access(caller, await db.get(Portfolio, portfolio_id))
    require_write_role(caller)
    rows = await _position_rows(db, portfolio.id)
    positions = [_position_payload(row) for row in rows]
    inputs = body.model_dump()
    output = pf.compute_stress_snapshot(
        positions,
        inputs,
        as_of=portfolio.as_of_date,
        portfolio_id=portfolio.id,
    )
    authority = output["authority"]
    now = datetime.now(timezone.utc)
    row = PortfolioStressRun(
        portfolio_id=portfolio.id,
        created_by=caller.id,
        label=body.label.strip(),
        inputs=inputs,
        output=output,
        source_fingerprint=pf.stress_source_fingerprint(
            positions,
            inputs,
            as_of=portfolio.as_of_date,
            portfolio_id=portfolio.id,
        ),
        authority=authority,
        status="complete",
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    await db.flush()
    return _stress_payload(row)


@router.get("/{portfolio_id}/stress-runs")
async def list_stress_runs(
    portfolio_id: str,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db, scope="function"),
    caller: CallerIdentity = Depends(get_identity),
):
    portfolio = require_portfolio_access(caller, await db.get(Portfolio, portfolio_id))
    rows = list((await db.execute(
        select(PortfolioStressRun)
        .where(PortfolioStressRun.portfolio_id == portfolio.id)
        .order_by(PortfolioStressRun.created_at.desc(), PortfolioStressRun.id.desc())
        .limit(limit)
    )).scalars().all())
    total = (await db.execute(
        select(func.count(PortfolioStressRun.id))
        .where(PortfolioStressRun.portfolio_id == portfolio.id)
    )).scalar_one()
    return {
        "items": [_stress_payload(row) for row in rows],
        "total": total,
        "authority": _authority(portfolio, method="persisted-deterministic-stress-v1"),
    }
