"""Anomaly Detector — the deterministic third stage of the autonomous agent DAG.

Three pure detectors over the curated ``metric_facts`` store:

* ``_robust_z`` — MAD-based robust z (a NaN-safe, outlier-resistant standard-
  score). The shared scoring core the other two cross-sectional / time-series
  detectors build on.
* ``_ts_jump`` — a sudden latest-period move vs the stable history (robust z of
  the latest value against the prior periods' median + MAD).
* ``_peer_outlier`` — a cross-sectional extreme vs same-industry peers (fallback:
  the coverage universe when the sector is thin).
* ``_cusum_shift`` — a sustained step change in a metric series, via a baseline-
  anchored CUSUM with a change-point period.

``detect_anomalies(db, issuer_ids=None)`` is the integration entry point the
Sentinel's ``changed_issuers`` feeds: it reads each issuer's headline-KPI series
from the fact store, runs the detectors, and returns a severity-ranked list. A
gate-Blocked fact never feeds an anomaly (defense-in-depth behind the runner
write-skip). Scoped ``issuer_ids`` restricts which issuers are emitted (peer
context still draws on the full universe).

CLAUDE.md engine conventions: every value is gated through ``is_finite_number``
before any division; zero-MAD degrades to ``None`` rather than emitting ±inf; a
NaN smuggled past a plain isinstance check would poison the median/MAD and is
rejected. ``_ts_jump`` trusts its input series is finite (the upstream
``_series_by_issuer_metric`` read filters non-finite values).
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from statistics import median
from typing import Dict, List, Optional, Sequence, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import Issuer, MetricFact
from engine.metrics import CATALOG_BY_KEY
from engine.periods import is_finite_number

logger = logging.getLogger("caos.anomaly")

_KPI_KEYS = ("net_leverage", "interest_coverage", "ebitda_margin")
_SCAN_CAP = 2000
# Minimum series lengths — below these a detector degrades to None (no signal
# rather than a noisy false flag).
_MIN_SERIES_TS = 3
_MIN_SERIES_CUSUM = 4
_MIN_PEERS = 2
# Flag thresholds — robust-z magnitudes above which a detector emits.
_TS_JUMP_FLAG = 3.0
_PEER_OUTLIER_FLAG = 3.0


@dataclass
class Anomaly:
    """One detected anomaly. ``severity`` is on a comparable robust-z scale across
    kinds so ``detect_anomalies`` can rank ts-jump / peer-outlier / cusum-shift
    together. ``context`` carries kind-specific detail (peer_scope,
    change_point_period) the Reporter renders without re-querying."""

    kind: str  # ts-jump | peer-outlier | cusum-shift
    direction: str  # up | down
    severity: float
    issuer_id: str
    issuer_name: str
    metric: str
    chunk_id: Optional[str]
    context: Dict[str, object] = field(default_factory=dict)


# ── robust z (pure) ──────────────────────────────────────────────────────────

def _robust_z(value: float, peer_vals: Sequence[float]) -> Optional[Tuple[float, float]]:
    """MAD-based robust z → ``(median, z)`` or ``None``.

    Returns None when there are no peers, the value is non-finite, or the spread
    is degenerate (MAD = 0) with the value off-median — emitting ±inf would be
    worse than no signal. On-median with MAD = 0 returns ``(median, 0.0)``."""
    if not peer_vals or not is_finite_number(value):
        return None
    med = median(peer_vals)
    devs = [abs(v - med) for v in peer_vals]
    mad = median(devs)
    if mad <= 0:
        return (round(med, 2), 0.0) if value == med else None
    z = 0.6745 * (value - med) / mad
    return (round(med, 2), round(z, 1))


# ── ts-jump (pure) ───────────────────────────────────────────────────────────

def _ts_jump(series: Sequence[Tuple[str, float, Optional[str]]],
             metric: str, issuer_id: str, issuer_name: str) -> Optional[Anomaly]:
    """Flag a sudden latest-period move vs the stable history. ``series`` is
    ``[(period, value, chunk_id)]`` ordered chronologically; the last entry is
    the latest. < ``_MIN_SERIES_TS`` periods → None (no history to jump from)."""
    if len(series) < _MIN_SERIES_TS:
        return None
    *history, latest = series
    latest_period, latest_val, latest_chunk = latest
    if not is_finite_number(latest_val):
        return None
    hist_vals = [v for _p, v, _c in history if is_finite_number(v)]
    if len(hist_vals) < 2:
        return None
    res = _robust_z(latest_val, hist_vals)
    if res is None:
        return None
    _med, z = res
    if abs(z) < _TS_JUMP_FLAG:
        return None
    return Anomaly(
        kind="ts-jump", direction="up" if z > 0 else "down", severity=abs(z),
        issuer_id=issuer_id, issuer_name=issuer_name, metric=metric,
        chunk_id=latest_chunk,
        context={"latest_period": latest_period, "history_median": _med},
    )


# ── peer-outlier (pure) ──────────────────────────────────────────────────────

def _peer_outlier(headlines: Dict[str, Tuple[float, str, Optional[str]]],
                  issuer_id: str, issuer_name: str, metric: str) -> Optional[Anomaly]:
    """Flag a cross-sectional extreme vs same-industry peers (universe fallback
    when the sector has < ``_MIN_PEERS`` same-industry peers). ``headlines`` is
    ``{issuer_id: (value, industry, chunk_id)}``. Issuer absent → None."""
    own = headlines.get(issuer_id)
    if own is None:
        return None
    own_val, own_industry, own_chunk = own
    if not is_finite_number(own_val):
        return None
    same_industry = [(iid, v) for iid, (v, ind, _c) in headlines.items()
                     if iid != issuer_id and ind == own_industry and is_finite_number(v)]
    scope = "same-industry"
    peer_vals = [v for _iid, v in same_industry]
    if len(peer_vals) < _MIN_PEERS:
        # Sector too thin → fall back to the coverage universe.
        peer_vals = [v for iid, (v, _ind, _c) in headlines.items()
                     if iid != issuer_id and is_finite_number(v)]
        scope = "universe"
    res = _robust_z(own_val, peer_vals)
    if res is None:
        return None
    _med, z = res
    if abs(z) < _PEER_OUTLIER_FLAG:
        return None
    return Anomaly(
        kind="peer-outlier", direction="up" if z > 0 else "down", severity=abs(z),
        issuer_id=issuer_id, issuer_name=issuer_name, metric=metric,
        chunk_id=own_chunk,
        context={"peer_scope": scope, "peer_median": _med, "peer_count": len(peer_vals)},
    )


# ── cusum-shift (pure) ───────────────────────────────────────────────────────

def _cusum_shift(series: Sequence[Tuple[str, float, Optional[str]]],
                 metric: str, issuer_id: str, issuer_name: str) -> Optional[Anomaly]:
    """Flag a sustained step change via a baseline-anchored CUSUM. The baseline
    mean + sigma come from the first half of the series (the stable pre-shift
    period); a cumulative sum of deviations above a slack threshold triggers
    when the run is large enough. The change-point period is the index where the
    CUSUM began its run. < ``_MIN_SERIES_CUSUM`` periods → None."""
    n = len(series)
    if n < _MIN_SERIES_CUSUM:
        return None
    vals = [v for _p, v, _c in series if is_finite_number(v)]
    if len(vals) < _MIN_SERIES_CUSUM:
        return None
    baseline = vals[: max(2, n // 2)]
    mu = sum(baseline) / len(baseline)
    sigma = math.sqrt(sum((v - mu) ** 2 for v in baseline) / len(baseline))
    if sigma <= 0:
        sigma = 1e-6  # flat baseline — any real deviation is a shift
    k = 0.5 * sigma
    h = 4.0 * sigma

    pos = 0.0
    neg = 0.0
    pos_start = 0  # index where the current upward run began
    neg_start = 0
    flagged: Optional[Tuple[str, int, float, str]] = None  # (direction, cp_idx, severity, period)
    for i, (period, v, _c) in enumerate(series):
        if not is_finite_number(v):
            pos = neg = 0.0
            pos_start = neg_start = i + 1
            continue
        pos = max(0.0, pos + (v - mu) - k)
        neg = max(0.0, neg - (v - mu) - k)
        if pos == 0.0:
            pos_start = i + 1
        if neg == 0.0:
            neg_start = i + 1
        if pos > h and flagged is None:
            flagged = ("up", pos_start, pos / sigma, period)
        if neg > h and flagged is None:
            flagged = ("down", neg_start, neg / sigma, period)
    if flagged is None:
        return None
    direction, cp_idx, severity, cp_period = flagged
    cp_period = series[cp_idx][0] if 0 <= cp_idx < n else cp_period
    return Anomaly(
        kind="cusum-shift", direction=direction, severity=round(abs(severity), 1),
        issuer_id=issuer_id, issuer_name=issuer_name, metric=metric,
        chunk_id=series[-1][2],
        context={"change_point_period": cp_period, "baseline_mean": round(mu, 2)},
    )


# ── detect_anomalies (integration) ───────────────────────────────────────────

async def _series_by_issuer_metric(db: AsyncSession, issuer_ids: Optional[Sequence[str]]
                                   ) -> Dict[Tuple[str, str], List[Tuple[str, float, Optional[str]]]]:
    """{(issuer_id, metric_key): [(period, value, chunk_id)]} for run-derived,
    non-Blocked headline-KPI facts, chronological by period. The series feeds
    _ts_jump and _cusum_shift."""
    stmt = (
        select(MetricFact)
        .where(
            MetricFact.metric_key.in_(list(_KPI_KEYS)),
            MetricFact.provenance == "run",
            MetricFact.qa_status != "Blocked",
        )
        .order_by(MetricFact.issuer_id, MetricFact.metric_key, MetricFact.period)
        .limit(_SCAN_CAP)
    )
    if issuer_ids is not None:
        stmt = stmt.where(MetricFact.issuer_id.in_(list(issuer_ids)))
    rows = (await db.execute(stmt)).scalars().all()
    out: Dict[Tuple[str, str], List[Tuple[str, float, Optional[str]]]] = {}
    for f in rows:
        out.setdefault((f.issuer_id, f.metric_key), []).append(
            (f.period, f.value, f.document_chunk_id))
    return out


async def _headlines_by_metric(db: AsyncSession) -> Dict[str, Dict[str, Tuple[float, str, Optional[str]]]]:
    """{metric_key: {issuer_id: (latest headline value, industry, chunk_id)}} —
    the cross-section _peer_outlier reads. Drawn from the FULL universe (not
    scoped) so a scoped issuer's peer context still sees every peer."""
    stmt = (
        select(MetricFact, Issuer.industry)
        .join(Issuer, MetricFact.issuer_id == Issuer.id)
        .where(
            MetricFact.metric_key.in_(list(_KPI_KEYS)),
            MetricFact.headline.is_(True),
            MetricFact.provenance == "run",
            MetricFact.qa_status != "Blocked",
        )
        .order_by(MetricFact.issuer_id, MetricFact.metric_key, MetricFact.created_at.desc())
        .limit(_SCAN_CAP)
    )
    rows = (await db.execute(stmt)).all()
    out: Dict[str, Dict[str, Tuple[float, str, Optional[str]]]] = {k: {} for k in _KPI_KEYS}
    for fact, industry in rows:
        key = fact.metric_key
        if fact.issuer_id not in out[key]:  # latest-per-issuer (created_at desc)
            out[key][fact.issuer_id] = (fact.value, industry or "", fact.document_chunk_id)
    return out


async def detect_anomalies(db: AsyncSession,
                           issuer_ids: Optional[Sequence[str]] = None) -> List[Anomaly]:
    """The deterministic Anomaly Detector entry point.

    Reads each issuer's headline-KPI series + the cross-sectional headline set,
    runs the three detectors, and returns a severity-ranked (descending) list.
    Scoped ``issuer_ids`` restricts which issuers are EMITTED; peer context still
    draws on the full universe. Empty corpus / no signal → []. Blocked facts are
    excluded at the read so a Blocked run's series never feeds an anomaly."""
    # Issuer names for the Anomaly records.
    name_rows = (await db.execute(
        select(Issuer.id, Issuer.name).where(Issuer.id.in_(
            list(issuer_ids))) if issuer_ids is not None else select(Issuer.id, Issuer.name)
    )).all()
    names = {r[0]: r[1] for r in name_rows}

    series_map = await _series_by_issuer_metric(db, issuer_ids)
    headlines = await _headlines_by_metric(db)

    out: List[Anomaly] = []
    for (iid, metric), series in series_map.items():
        name = names.get(iid, iid)
        ts = _ts_jump(series, metric, iid, name)
        if ts is not None:
            out.append(ts)
        cusum = _cusum_shift(series, metric, iid, name)
        if cusum is not None:
            out.append(cusum)

    # peer-outlier: emit only for issuers in scope (peer context = full universe).
    scoped = set(issuer_ids) if issuer_ids is not None else set(names) | {iid for (iid, _m) in series_map}
    for metric in _KPI_KEYS:
        hmap = headlines.get(metric, {})
        for iid in scoped:
            name = names.get(iid, iid)
            po = _peer_outlier(hmap, iid, name, metric)
            if po is not None:
                out.append(po)

    out.sort(key=lambda a: a.severity, reverse=True)
    return out
