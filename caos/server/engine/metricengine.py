"""Metric Engine — deterministic query-time metric derivatives for the Query
answer lane (Phase 2 foundation of the Intelligent Data Vault).

The inversion the Query concept needs: figures an AI answer states come from a
*deterministic* computation over the curated ``metric_facts`` store, not from
chunk string-presence. The LLM narrates computed figures; it does not originate
them. This module computes those figures before any LLM call and exposes them as
trusted evidence entries with stable ids, a closed ``numbers`` set (the only
figures a citing claim may state), and a click-through back to the source chunk.

Two views today (both pure-SQL + math, no LLM):

1. **Headline deltas** — latest vs prior complete-run headline value per KPI for
   an issuer (or the book's biggest movers when unscoped). Mirrors
   ``queryinsights._delta_entries`` but generalized into a shared lane so the
   answer lane and the future Analyst agent reuse one source of truth.
2. **Peer robust z-scores** — for a scoped issuer, where each KPI sits relative
   to same-industry peers (fallback: the coverage universe), using a MAD-based
   robust z so a single outlier peer cannot distort the read.

Each entry carries ``kind="metric"`` and an id in the ``fact:`` namespace, so the
answer lane's citation gate and numeric gate treat it exactly like a pack entry:
a sentence citing a fact id must ground every numeral against that fact's closed
``numbers`` set. The ``chunk_id`` is the supporting fact's ``document_chunk_id``
so click-through resolves through the existing chunk viewer.

Covenant headroom (the third Metric Engine output in the plan) is deferred to v2:
it needs a join against the persisted CP-4C payload and pairs better with the
Phase-1 graph-expansion retrieval lane. Noted here so the deferral is explicit.

Engine conventions (CLAUDE.md): every CP-1-derived value is gated through
``engine.periods.is_finite_number`` before any division/multiplication, and
denominators that can reach 0 (peer count, MAD) degrade to a skip rather than
divide. A NaN slipping past a plain ``isinstance(x, (int, float))`` check would
poison the robust z or the delta — ``is_finite_number`` rejects NaN/±inf while
accepting ``bool``/``0``.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from statistics import median
from typing import List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import Issuer, MetricFact, Run
from engine.metrics import CATALOG_BY_KEY, headline_fact_predicates
from engine.periods import is_finite_number, safe_div

logger = logging.getLogger("caos.metricengine")

# The KPI set the Metric Engine derives over. Kept identical to the Desk Brief's
# `_DELTAS` so the two lanes narrate the same figures; extend here to widen both.
_KPI_KEYS: Tuple[str, ...] = ("net_leverage", "interest_coverage", "ebitda_margin")

_SCAN_CAP = 2000  # bound every read (query-path P4 discipline, single process)
_TOP_MOVERS = 8   # unscoped: biggest absolute moves first, like the Desk Brief
_MIN_PEERS = 2    # below this, a peer read is not worth narrating


@dataclass
class MetricFactEntry:
    """One deterministic, citation-backed metric fact the answer lane may cite.

    ``numbers`` is the closed set of figures a citing claim is allowed to state —
    the numeric gate checks every numeral in the claim against this set. ``text``
    states those same figures so a human reader (and the gate) sees what was
    computed. ``chunk_id`` is the supporting fact's ``document_chunk_id`` so the
    existing chunk viewer resolves the click-through; ``walk`` deep-links the
    relevant capability when the entry is rendered as a card.
    """

    id: str
    kind: str  # always "metric" — kept for shape parity with PackEntry
    label: str
    text: str
    numbers: List[float] = field(default_factory=list)
    issuer_id: Optional[str] = None
    walk: Optional[str] = None
    chunk_id: Optional[str] = None


def _sign(delta: float) -> str:
    return "+" if delta > 0 else "−"


def _fmt(value: float, unit: str) -> str:
    return f"{value:g}{unit}"


async def _headline_facts_by_issuer(
    db: AsyncSession, issuer_id: Optional[str]
) -> List[MetricFact]:
    """Latest-per-(issuer, metric_key) headline ``run`` facts, complete runs only.

    Mirrors the read pattern in ``queryinsights._delta_entries`` and
    ``peers._peer_facts``: headline=True, provenance=run, complete runs, KPI keys.
    When ``issuer_id`` is None, reads across the book (unscoped deltas path).
    """
    stmt = (
        select(MetricFact, Issuer.name, Run.created_at)
        .join(Run, Run.id == MetricFact.run_id)
        .join(Issuer, Issuer.id == MetricFact.issuer_id)
        .where(
            *headline_fact_predicates(_KPI_KEYS),
            MetricFact.provenance == "run",
            Run.status == "complete",
        )
        .order_by(MetricFact.issuer_id, MetricFact.metric_key, Run.created_at.desc())
        .limit(_SCAN_CAP)
    )
    if issuer_id is not None:
        stmt = stmt.where(MetricFact.issuer_id == issuer_id)
    return [row[0] for row in (await db.execute(stmt)).all()]


def _delta_entries(
    facts: List[MetricFact], names: dict, walk: Optional[str]
) -> List[MetricFactEntry]:
    """Build delta entries from latest-vs-prior headline facts, biggest move first.

    ``facts`` is already ordered (issuer, metric_key, created_at desc) so the first
    two rows of a group are the latest and prior complete-run values. A group with
    <2 rows (only one complete run) yields no delta — there is no prior to move
    from, and narrating a single point as a "delta" would mislead.
    """
    grouped: dict = {}
    for f in facts:
        grouped.setdefault((f.issuer_id, f.metric_key), []).append(f)

    out: List[MetricFactEntry] = []
    for (iid, key), vals in grouped.items():
        if len(vals) < 2:
            continue
        latest, prior = vals[0], vals[1]
        if not (is_finite_number(latest.value) and is_finite_number(prior.value)):
            continue  # NaN/inf must not poison the delta (CLAUDE.md engine conv.)
        delta = round(latest.value - prior.value, 1)
        if delta == 0:
            continue  # no move → nothing to narrate
        md = CATALOG_BY_KEY.get(key)
        if md is None:
            continue
        label = f"{names.get(iid, iid)} {md.label}"
        text = (f"{names.get(iid, iid)}: {md.label} "
                f"{_fmt(prior.value, md.unit)} → {_fmt(latest.value, md.unit)} "
                f"({_sign(delta)}{abs(delta):.1f}{md.unit} vs prior run)")
        out.append(MetricFactEntry(
            id=f"fact:{iid}:{key}:delta", kind="metric", label=label, text=text,
            numbers=[round(prior.value, 1), round(latest.value, 1), abs(delta)],
            issuer_id=iid, walk=walk, chunk_id=latest.document_chunk_id,
        ))
    out.sort(key=lambda e: -abs(e.numbers[2]))
    return out


async def _peer_values(
    db: AsyncSession, issuer_id: str, key: str
) -> Tuple[List[float], Optional[MetricFact]]:
    """(peer headline values, the issuer's own latest headline fact) for one KPI.

    Same-industry peers when the issuer has an industry and ≥2 peers exist,
    otherwise the coverage universe — same fallback policy as
    ``peers.synthesize_peer_benchmark``. Excludes the issuer itself, demo_fixture
    rows, and Blocked facts.
    """
    issuer = (await db.execute(select(Issuer).where(Issuer.id == issuer_id))
              ).scalars().first()
    if issuer is None:
        return [], None

    async def read(same_industry: bool) -> List[Tuple[str, float]]:
        stmt = (
            select(MetricFact, Issuer)
            .join(Issuer, MetricFact.issuer_id == Issuer.id)
            .where(
                *headline_fact_predicates([key]),
                MetricFact.issuer_id != issuer_id,
                MetricFact.provenance != "demo_fixture",
            )
        )
        if same_industry and issuer.industry:
            stmt = stmt.where(Issuer.industry == issuer.industry)
        rows = (await db.execute(stmt)).all()
        # latest-per-issuer (run over seed, then most recent) — mirrors peers._peer_facts
        best: dict = {}
        for fact, _iss in rows:
            cur = best.get(fact.issuer_id)
            better = (cur is None
                      or (fact.provenance == "run" and cur.provenance != "run")
                      or (fact.provenance == cur.provenance and fact.created_at
                          and cur.created_at and fact.created_at > cur.created_at))
            if better:
                best[fact.issuer_id] = fact
        return [(iid, f.value) for iid, f in best.items()]

    peers = await read(same_industry=True)
    if len(peers) < _MIN_PEERS and issuer.industry:
        peers = await read(same_industry=False)
    peer_vals = [v for _iid, v in peers if is_finite_number(v)]

    # The issuer's own latest headline fact for this key (cited back via chunk_id).
    own = (await db.execute(
        select(MetricFact)
        .where(
            MetricFact.issuer_id == issuer_id,
            *headline_fact_predicates([key]),
        )
        .order_by(MetricFact.created_at.desc())
        .limit(1)
    )).scalars().first()
    return peer_vals, own


def _robust_z(iv: float, peer_vals: List[float]) -> Optional[Tuple[float, float, float]]:
    """MAD-based robust z (median, MAD, z) for ``iv`` against ``peer_vals``.

    Returns None when the read is not worth narrating: empty peers, a non-finite
    issuer value, or a zero MAD with the issuer off-median (a degenerate spread
    where a z would be infinite — degrade rather than emit ±inf). The 0.6745
    constant is the standard normal-consistency factor for MAD.
    """
    if not peer_vals or not is_finite_number(iv):
        return None
    med = median(peer_vals)
    devs = [abs(v - med) for v in peer_vals]
    mad = median(devs)
    if mad <= 0:
        return None if iv != med else (round(med, 2), 0.0, 0.0)
    z = safe_div(0.6745 * (iv - med), mad)
    if z is None:  # unreachable: mad > 0 (checked above) and iv, med finite
        return None
    return round(med, 2), round(mad, 2), round(z, 1)


def _peerz_entries(
    db_results: dict, walk: Optional[str]
) -> List[MetricFactEntry]:
    """Build peer z-score entries from ``_peer_values`` results keyed by metric."""
    out: List[MetricFactEntry] = []
    for key, (peer_vals, own, issuer_name) in db_results.items():
        if own is None or not is_finite_number(own.value):
            continue
        md = CATALOG_BY_KEY.get(key)
        if md is None:
            continue
        res = _robust_z(own.value, peer_vals)
        if res is None:
            continue
        med, _mad, z = res
        label = f"{issuer_name} {md.label} vs peers"
        direction = "above" if z > 0 else "below" if z < 0 else "in line with"
        text = (f"{issuer_name}: {md.label} {own.value:g}{md.unit} vs peer "
                f"median {med:g}{md.unit} (robust z {z:+.1f}, {direction} peers).")
        out.append(MetricFactEntry(
            id=f"fact:{own.issuer_id}:{key}:peerz", kind="metric", label=label,
            text=text,
            numbers=[round(own.value, 1), med, z],
            issuer_id=own.issuer_id, walk=walk, chunk_id=own.document_chunk_id,
        ))
    return out


async def build_metric_facts(
    db: AsyncSession, issuer_id: Optional[str] = None, *, walk: Optional[str] = None
) -> List[MetricFactEntry]:
    """The deterministic Metric Engine entry point.

    Returns trusted, citation-backed metric fact entries the answer lane injects
    alongside retrieved chunks. Scoped (``issuer_id`` set): deltas for that issuer
    plus peer z-scores against the universe. Unscoped: the book's biggest movers
    (deltas only — peer z is per-issuer by definition).

    Every figure is gated through ``is_finite_number`` before arithmetic;
    denominators (peer count, MAD) degrade to a skip rather than divide. The
    closed ``numbers`` set on each entry is the only set of figures a citing AI
    claim may state, enforced downstream by ``grounding.all_grounded``.
    """
    facts = await _headline_facts_by_issuer(db, issuer_id)
    if not facts:
        return []
    # Issuer-name lookup for the scoped path; for the unscoped path the join in
    # _headline_facts_by_issuer already carried names but we discarded them —
    # re-read cheaply here (bounded by the KPI set).
    issuer_ids = sorted({f.issuer_id for f in facts})
    name_rows = (await db.execute(
        select(Issuer.id, Issuer.name).where(Issuer.id.in_(issuer_ids))
    )).all()
    names: dict[str, str] = {r[0]: r[1] for r in name_rows}

    if issuer_id is not None:
        deltas = _delta_entries(facts, names, walk)[:len(_KPI_KEYS)]
        peer_results: dict = {}
        issuer_name = names.get(issuer_id, issuer_id)
        for key in _KPI_KEYS:
            peer_vals, own = await _peer_values(db, issuer_id, key)
            peer_results[key] = (peer_vals, own, issuer_name)
        peerz = _peerz_entries(peer_results, walk)
        return deltas + peerz

    # Unscoped: the book's biggest movers. The Desk Brief already narrates this
    # set; exposing it here lets an unscoped answer cite the same figures.
    return _delta_entries(facts, names, walk)[:_TOP_MOVERS]
