"""Loan Compare — cross-issuer documentation comparison.

Pivots the `deal_terms` store into the side-by-side grid: deals as columns (one
pinned as Benchmark), terms as rows grouped by the engine/terms_catalog sections.
This is a pure read over what extraction (CP-4D) or the demo seed populated — no
analysis happens here. The vs-Benchmark delta and the "looser/tighter" direction
come straight off the catalog so the frontend can tint the loophole heat. Every
populated cell carries its lineage + confidence + the chunk it was drawn from, so
the value stays one click from the agreement language (CP-5B). See
docs/COMPARE_SCHEMA.md.
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import Deal, DealTerm, Issuer, get_db
from engine.terms_catalog import SECTIONS, BY_KEY, terms_in_section
from identity import CallerIdentity, get_identity

router = APIRouter()

_MIN_DEALS, _MAX_DEALS = 2, 6


# ─── Response models ─────────────────────────────────────────────────────────
class DealSummary(BaseModel):
    id: str
    label: str
    issuer_id: str
    issuer_name: Optional[str] = None
    industry: Optional[str] = None
    transaction_phase: Optional[str] = None
    launch_date: Optional[str] = None
    provenance: str


class CompareCell(BaseModel):
    deal_id: str
    present: bool                       # False = not extracted for this deal
    value_num: Optional[float] = None
    value_text: Optional[str] = None
    display: str                        # best-effort string; frontend may reformat by vtype
    delta: Optional[float] = None       # numeric value − benchmark value (numeric terms only)
    lineage_class: str
    confidence: str
    document_chunk_id: Optional[str] = None
    has_quote: bool = False


class CompareRow(BaseModel):
    term_key: str
    label: str
    vtype: str
    looser: str                         # "higher"|"lower"|"yes"|"none" — direction that is more borrower-favorable
    cells: List[CompareCell]


class CompareSection(BaseModel):
    key: str
    label: str
    rows: List[CompareRow]


class CompareGrid(BaseModel):
    deals: List[DealSummary]            # in requested column order
    benchmark_deal_id: Optional[str]
    sections: List[CompareSection]


# ─── Helpers ─────────────────────────────────────────────────────────────────
def _fmt_num(v: float) -> str:
    if float(v).is_integer():
        return str(int(v))
    return f"{v:.6f}".rstrip("0").rstrip(".")


def _cell(deal_id: str, term, dt: Optional[DealTerm], bench_num: Optional[float]) -> CompareCell:
    if dt is None:
        return CompareCell(
            deal_id=deal_id, present=False, display="",
            lineage_class="Insufficient Information", confidence="Insufficient Information",
        )
    if dt.value_num is not None:
        display, num = _fmt_num(dt.value_num), dt.value_num
    elif dt.value_text is not None:
        display, num = dt.value_text, None
    else:
        display, num = "", None
    delta = None
    if term.is_numeric and num is not None and bench_num is not None:
        delta = round(num - bench_num, 6)
    return CompareCell(
        deal_id=deal_id, present=True, value_num=dt.value_num, value_text=dt.value_text,
        display=display, delta=delta, lineage_class=dt.lineage_class, confidence=dt.confidence,
        document_chunk_id=dt.document_chunk_id, has_quote=bool(dt.quote),
    )


# ─── Endpoints ───────────────────────────────────────────────────────────────
@router.get("/deals", response_model=List[DealSummary])
async def list_deals(
    q: Optional[str] = Query(default=None, max_length=255,
                             description="Case-insensitive substring match on deal label or issuer name."),
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    """The deals available to compare, each joined to its issuer for the picker."""
    rows = (await db.execute(
        select(Deal, Issuer).join(Issuer, Deal.issuer_id == Issuer.id).order_by(Deal.label)
    )).all()
    out: List[DealSummary] = []
    needle = q.strip().lower() if q and q.strip() else None
    for deal, issuer in rows:
        if needle and needle not in deal.label.lower() and needle not in (issuer.name or "").lower():
            continue
        out.append(DealSummary(
            id=deal.id, label=deal.label, issuer_id=deal.issuer_id, issuer_name=issuer.name,
            industry=issuer.industry, transaction_phase=deal.transaction_phase,
            launch_date=deal.launch_date, provenance=deal.provenance,
        ))
    return out


@router.get("", response_model=CompareGrid)
async def compare(
    deals: str = Query(description=f"{_MIN_DEALS}–{_MAX_DEALS} deal ids, comma-separated."),
    benchmark: Optional[str] = Query(default=None, description="Deal id to pin as Benchmark (defaults to the first)."),
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    """Pivot the selected deals' terms into the comparison grid. Rows with no data
    for any selected deal are omitted; empty sections drop out."""
    ids = [d for d in (s.strip() for s in deals.split(",")) if d]
    # De-dup preserving order.
    seen: set[str] = set()
    ids = [d for d in ids if not (d in seen or seen.add(d))]
    if not (_MIN_DEALS <= len(ids) <= _MAX_DEALS):
        raise HTTPException(422, f"Select between {_MIN_DEALS} and {_MAX_DEALS} deals to compare.")

    deal_rows = (await db.execute(select(Deal).where(Deal.id.in_(ids)))).scalars().all()
    by_id = {d.id: d for d in deal_rows}
    missing = [d for d in ids if d not in by_id]
    if missing:
        raise HTTPException(404, f"Unknown deal id(s): {', '.join(missing)}")

    bench_id = benchmark if benchmark in by_id else ids[0]

    issuers = {
        i.id: i for i in (await db.execute(
            select(Issuer).where(Issuer.id.in_([d.issuer_id for d in deal_rows]))
        )).scalars().all()
    }
    terms = (await db.execute(select(DealTerm).where(DealTerm.deal_id.in_(ids)))).scalars().all()
    by_cell = {(t.deal_id, t.term_key): t for t in terms}

    summaries = [
        DealSummary(
            id=d.id, label=d.label, issuer_id=d.issuer_id,
            issuer_name=(issuers.get(d.issuer_id).name if issuers.get(d.issuer_id) else None),
            industry=(issuers.get(d.issuer_id).industry if issuers.get(d.issuer_id) else None),
            transaction_phase=d.transaction_phase, launch_date=d.launch_date, provenance=d.provenance,
        )
        for d in (by_id[i] for i in ids)
    ]

    sections: List[CompareSection] = []
    for section_key, section_label in SECTIONS:
        rows: List[CompareRow] = []
        for term in terms_in_section(section_key):
            cells_dt = {i: by_cell.get((i, term.key)) for i in ids}
            if not any(cells_dt.values()):
                continue  # no deal has this term — omit the row
            bench_dt = cells_dt.get(bench_id)
            bench_num = bench_dt.value_num if (bench_dt and term.is_numeric) else None
            rows.append(CompareRow(
                term_key=term.key, label=term.label, vtype=term.vtype, looser=term.looser,
                cells=[_cell(i, term, cells_dt[i], bench_num) for i in ids],
            ))
        if rows:
            sections.append(CompareSection(key=section_key, label=section_label, rows=rows))

    return CompareGrid(deals=summaries, benchmark_deal_id=bench_id, sections=sections)
