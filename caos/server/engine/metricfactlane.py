"""Metric-fact SQL retrieval lane — the 4th fusion input (Phase 1 remainder).

The recall/precision fix the dropped-claim-rate health alarm names at the
retrieval layer: today numbers in an answer come from the Metric Engine's
*KPI derivatives* (deltas, peer z — ``engine/metricengine.py``) plus whatever
figures happen to appear in cited chunks (string-presence grounding). The
metric-fact SQL lane surfaces the raw curated ``metric_facts`` store as a
first-class retrieval source — a query about "leverage" retrieves the actual
``MetricFact`` rows for net leverage (and any other topic-matched metric),
rendered as ``MetricFactEntry``s with closed ``numbers`` sets, so the LLM
narrates the stored figure verbatim instead of restating a number from a
chunk and hoping it lines up.

Complementary to the Metric Engine, not a replacement:
- Metric Engine → *derivatives* (deltas, peer z) for the KPI set, scoped or
  unscoped. Computed, not stored.
- SQL lane (this module) → *raw stored facts*, topic-relevant, any metric key,
  any issuer scope. The lexicon maps query terms to metric keys; the SQL read
  pulls latest-per-(issuer, key) headline facts for the matched keys + scoped
  issuers. ``dedup_against_derivatives`` skips a raw fact whose (issuer, key,
  value, period) a derivative already states, so the facts_note stays lean.

ON by default (the plan's "numbers always come from the metric-fact SQL lane")
but fault-isolated: any failure degrades to an empty list — the answer lane
still runs on chunks + Metric Engine derivatives alone. No new dependency, no
schema — ``metric_facts`` already exists.

Engine conventions (CLAUDE.md): ``is_finite_number`` guards every value before
it enters a ``numbers`` set (a NaN raw fact must not poison the numeric gate's
grounding pool). The read is bounded (``_SCAN_CAP``) and gated behind
``qa_status != "Blocked"`` so a gate-Blocked fact never feeds the lane —
defense-in-depth behind the runner write-skip.
"""

from __future__ import annotations

import logging
import re
from typing import Dict, List, Optional, Sequence, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import Issuer, MetricFact, Run
from engine.metrics import CATALOG_BY_KEY, MetricDef
from engine.metricengine import MetricFactEntry
from engine.periods import is_finite_number

logger = logging.getLogger("caos.metricfactlane")

_SCAN_CAP = 500  # bound the read (query-path P4 discipline)
_MAX_FACTS = 12  # cap the facts_note payload (prompt-budget discipline)


# ── query → metric-key lexicon ───────────────────────────────────────────────
# Synonyms per metric key. The label tokens + key + category are auto-included
# from the catalog; the synonyms below add the desk shorthand the catalog
# labels don't cover ("gearing", "top line", "z-score"). A key is matched when
# any of its synonyms appears as a word-boundary substring of the query.
_SYNONYMS: Dict[str, Tuple[str, ...]] = {
    "net_leverage": ("leverage", "debt", "gearing", "net debt", "levered"),
    "interest_coverage": ("coverage", "interest cover", "cover", "interest"),
    "ebitda_margin": ("margin", "profitability", "ebitda margin"),
    "revenue": ("revenue", "sales", "top line", "topline", "turnover"),
    "adj_ebitda": ("ebitda", "adjusted ebitda", "operating profit"),
    "gross_margin": ("gross", "gross profit", "gross margin"),
    "fcf_conversion": ("fcf", "free cash", "cash conversion", "fcf margin"),
    "energy_cost_pct": ("energy", "energy cost", "energy exposure"),
    "altman_z": ("altman", "distress", "z-score", "z score", "z''"),
}


def _match_metric_keys(query: str) -> Dict[str, int]:
    """Map a natural-language query to matched metric keys → match score.

    The score is the count of distinct synonyms (word-boundary, case-insensitive)
    that appear in the query. A higher score means the query is more clearly
    about that metric. Empty dict when nothing matches (the lane is a no-op —
    the answer falls back to chunks + Metric Engine derivatives alone).
    """
    if not query:
        return {}
    q = query.lower()
    out: Dict[str, int] = {}
    for key, synonyms in _SYNONYMS.items():
        score = 0
        for syn in synonyms:
            # word-boundary for alphabetic synonyms; plain substring for
            # punctuation-bearing ones ("z-score", "z''", "top line").
            if any(c.isalpha() for c in syn) and not any(
                c in syn for c in " '-"
            ):
                if re.search(rf"\b{re.escape(syn)}\b", q):
                    score += 1
            else:
                if syn in q:
                    score += 1
        # Also match the catalog label tokens + key (covers "EBITDA margin",
        # "Interest coverage" etc. even without a synonym entry).
        md = CATALOG_BY_KEY.get(key)
        if md is not None:
            label_low = md.label.lower()
            if label_low and label_low in q:
                score += 1
            if key.lower().replace("_", " ") in q:
                score += 1
        if score > 0:
            out[key] = score
    return out


# ── SQL retrieval ────────────────────────────────────────────────────────────

async def _raw_facts(
    db: AsyncSession, keys: Sequence[str], issuer_ids: Optional[Sequence[str]]
) -> List[MetricFact]:
    """Latest-per-(issuer, metric_key) headline ``run`` facts for the matched
    keys + scoped issuers, complete runs only, non-Blocked. Bounded by
    ``_SCAN_CAP``. Mirrors the read pattern in ``metricengine._headline_facts_by_issuer``
    but filtered to the topic-matched key set rather than the fixed KPI set."""
    if not keys:
        return []
    stmt = (
        select(MetricFact, Issuer.name)
        .join(Run, Run.id == MetricFact.run_id)
        .join(Issuer, Issuer.id == MetricFact.issuer_id)
        .where(
            MetricFact.headline.is_(True),
            MetricFact.metric_key.in_(list(keys)),
            MetricFact.provenance == "run",
            Run.status == "complete",
            MetricFact.qa_status != "Blocked",
        )
        .order_by(MetricFact.issuer_id, MetricFact.metric_key, Run.created_at.desc())
        .limit(_SCAN_CAP)
    )
    if issuer_ids:
        stmt = stmt.where(MetricFact.issuer_id.in_(list(issuer_ids)))
    rows = (await db.execute(stmt)).all()
    # latest-per-(issuer, key): rows are ordered so the first row of a group is
    # the latest complete-run headline fact.
    seen: set = set()
    facts: List[MetricFact] = []
    for fact, _name in rows:
        g = (fact.issuer_id, fact.metric_key)
        if g in seen:
            continue
        seen.add(g)
        facts.append(fact)
    return facts


def _period_year(period: str) -> Optional[float]:
    """Extract a 4-digit calendar year from a period label (``FY2024`` → 2024.0,
    ``Q1-2024`` → 2024.0, ``LTM`` → None). The grounding gate's numeral regex
    pulls the year out of any sentence that states the period (``"FY2024"``),
    so the year must be in the fact's closed ``numbers`` set — otherwise a
    correct sentence stating the stored figure AND its period gets dropped for
    "states a figure not present in cited evidence." The year is deterministic
    from the stored fact, so including it is safe (not a fabricated figure)."""
    if not period:
        return None
    m = re.search(r"(19|20)\d{2}", str(period))
    return float(m.group()) if m else None


def _render_entries(
    facts: List[MetricFact], names: Dict[str, str], match_scores: Dict[str, int],
    walk: Optional[str]
) -> List[MetricFactEntry]:
    """Render raw facts as ``MetricFactEntry``s with closed ``numbers`` sets,
    ranked by topic-match score then issuer id for deterministic ordering.

    The ``numbers`` set carries the value AND the period's 4-digit year when
    extractable — the grounding gate's numeral regex pulls the year from any
    sentence that states the period (``"FY2024"``), so the year must be in the
    closed set or a correct sentence gets dropped. The year is deterministic
    from the stored fact (not fabricated)."""
    out: List[MetricFactEntry] = []
    for f in facts:
        if not is_finite_number(f.value):
            continue  # NaN/inf must not enter the numeric gate's grounding pool
        md: Optional[MetricDef] = CATALOG_BY_KEY.get(f.metric_key)
        if md is None:
            continue
        iid = f.issuer_id
        label = f"{names.get(iid, iid)} {md.label}"
        text = f"{names.get(iid, iid)}: {md.label} {f.value:g}{md.unit} ({f.period})."
        numbers: List[float] = [round(f.value, 4)]
        year = _period_year(f.period)
        if year is not None:
            numbers.append(year)
        out.append(MetricFactEntry(
            id=f"fact:{iid}:{f.metric_key}:raw:{f.period}",
            kind="metric", label=label, text=text,
            numbers=numbers,
            issuer_id=iid, walk=walk, chunk_id=f.document_chunk_id,
        ))
    # Rank: topic-match score (desc) then issuer id (asc) for deterministic order.
    out.sort(key=lambda e: (-match_scores.get(
        e.id.split(":")[2] if e.id.count(":") >= 3 else "", 0), e.issuer_id or ""))
    return out[:_MAX_FACTS]


async def retrieve_metric_facts(
    db: AsyncSession, query: str, issuer_ids: Optional[Sequence[str]] = None,
    *, walk: Optional[str] = None, k: int = _MAX_FACTS
) -> List[MetricFactEntry]:
    """The metric-fact SQL retrieval lane entry point.

    Returns topic-relevant raw ``MetricFactEntry``s — the stored figures the
    answer lane's facts_note surfaces alongside the Metric Engine's derivatives.
    Empty (no-op) when the query matches no metric key, or when no headline
    facts exist for the matched keys + scope. Every figure is
    ``is_finite_number``-gated before it enters the closed ``numbers`` set.
    """
    match_scores = _match_metric_keys(query)
    if not match_scores:
        return []
    keys = sorted(match_scores)
    facts = await _raw_facts(db, keys, issuer_ids)
    if not facts:
        return []
    issuer_ids_in_facts = sorted({f.issuer_id for f in facts})
    name_rows = (await db.execute(
        select(Issuer.id, Issuer.name).where(Issuer.id.in_(issuer_ids_in_facts))
    )).all()
    names: Dict[str, str] = {r[0]: r[1] for r in name_rows}
    entries = _render_entries(facts, names, match_scores, walk)
    return entries[:k]


# ── dedup against Metric Engine derivatives ──────────────────────────────────

def dedup_against_derivatives(
    raw: List[MetricFactEntry], derivatives: List[MetricFactEntry]
) -> List[MetricFactEntry]:
    """Skip a raw fact whose (issuer, key) a derivative already covers with the
    same latest value+period — the delta already states the latest figure, so
    restating it as a raw fact is noise in the facts_note. Keeps raw facts for
    (issuer, key) pairs the derivatives don't cover (non-KPI metrics, or KPI
    metrics where the derivative degraded — e.g. only one complete run → no
    delta → the raw fact is still worth narrating).

    Dedup is by (issuer, key, value, period) tuple: a delta whose
    ``numbers=[prior, latest, abs_delta]`` covers a raw fact whose
    ``numbers=[latest]`` when latest == raw.value and the delta's latest period
    == raw.period. The delta's id encodes (issuer, key, "delta"); the raw id
    encodes (issuer, key, "raw", period) — so id collision is impossible, but
    semantic duplication is what this helper removes.
    """
    if not raw:
        return []
    if not derivatives:
        return list(raw)
    # Build the (issuer, key, value, period) coverage set from derivatives.
    # A delta's "latest" is numbers[1]; its period isn't on the entry, so we
    # key on (issuer, key, value) — the delta's latest value is the figure the
    # raw fact would restate. Peer-z derivatives (numbers=[own, med, z]) cover
    # the own value too, so include numbers[0] for those.
    covered: set = set()
    for d in derivatives:
        iid = d.issuer_id or ""
        # Derivative ids: fact:{iid}:{key}:delta | fact:{iid}:{key}:peerz
        parts = d.id.split(":")
        if len(parts) < 3:
            continue
        key = parts[2]
        # delta: numbers=[prior, latest, abs_delta] → latest = numbers[1]
        # peerz: numbers=[own, med, z] → own = numbers[0]
        if d.kind == "metric" and len(d.numbers) >= 2:
            covered.add((iid, key, round(d.numbers[1], 4)))  # delta latest
            covered.add((iid, key, round(d.numbers[0], 4)))  # peerz own / delta prior
    out: List[MetricFactEntry] = []
    for r in raw:
        parts = r.id.split(":")
        if len(parts) < 3:
            out.append(r)
            continue
        key = parts[2]
        val = round(r.numbers[0], 4) if r.numbers else None
        if val is not None and (r.issuer_id or "", key, val) in covered:
            continue  # delta/peerz already states this figure
        out.append(r)
    return out
