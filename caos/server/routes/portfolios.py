"""Portfolio management — managed CLO books built from uploaded holdings.

Create/list/read portfolios and (re)upload their holdings / constraints / mandate
files. Exposure + constraint compliance are COMPUTED on read from the stored
positions (engine/portfolio.py) — nothing derived is persisted, so the holdings
are always the single source of truth. Ingest also soft-links each position to a
registered issuer and refreshes that issuer's agency rating (shared with the
Phase-1 ratings collector).

Authorization — single-team model, by design (matches routes/runs.py). Every
authenticated analyst can read and write every portfolio; the handlers below take
``caller`` (rate-limiting, attribution via ``created_by``) but deliberately do
NOT filter by ``caller.id`` — a one-coverage-team fit, not an oversight. If the
trust model ever widens to multiple teams/tenants, per-caller authorization MUST
be added here (scope every ``portfolio_id`` lookup on ``created_by``). Until then
it is left unbuilt rather than guessed; the portfolios IDOR test in
test_portfolios.py pins the current cross-analyst behaviour so a change to it is
a conscious decision.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

import avscan
import ingest
import portfolio_ingest
import rate_limit
from database import (
    Issuer, Portfolio, PortfolioConstraint, PortfolioPosition, get_db,
)
from engine import portfolio as pf
from identity import CallerIdentity, get_identity

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
    total_nav: float
    total_par: float
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
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    rows = (await db.execute(select(Portfolio).order_by(Portfolio.name).limit(200))).scalars().all()
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
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    prt = await db.get(Portfolio, portfolio_id)
    if not prt:
        raise HTTPException(404, "Portfolio not found")
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


async def _persist_positions(db: AsyncSession, portfolio_id: str, positions: List[Dict[str, Any]]) -> int:
    """Replace a portfolio's positions; soft-link each to a registered issuer
    (figi→ticker→name) and refresh that issuer's agency rating from the row."""
    await db.execute(delete(PortfolioPosition).where(PortfolioPosition.portfolio_id == portfolio_id))
    issuers = (await db.execute(select(Issuer).limit(5000))).scalars().all()
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
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
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
                    created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc))
    db.add(prt)
    await db.flush()
    await _persist_positions(db, prt.id, positions)
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
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    _rate_guard(caller)
    prt = await db.get(Portfolio, portfolio_id)
    if not prt:
        raise HTTPException(404, "Portfolio not found")
    content = await _read_xlsx(holdings)
    positions = await asyncio.to_thread(portfolio_ingest.parse_holdings_xlsx, content)
    if not positions:
        raise HTTPException(422, "No CLO positions found in the holdings sheet.")
    await _persist_positions(db, portfolio_id, positions)
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
