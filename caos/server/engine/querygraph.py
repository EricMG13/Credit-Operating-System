"""The Query concept's graph engine — traverses the run-derived store as edges.

Where the NL query ([nlquery.py]) *flattens* the store and ranks a column, Query
*walks* it: every capability picks an edge type already materialized in the data
(provenance chains, the module DAG, issuer↔issuer peer links, sector clusters)
and returns a positioned node-link graph the frontend renders directly.

Four builders cover the whole capability surface via params:

  - ``_peers``         — issuer↔issuer similarity over the metric store (CP-1C math,
                         computed live so it works on seed data before any run).
  - ``_contagion``     — a shared-driver overlay: issuers linked to one risk driver
                         via ``energy_cost_pct`` + BM25 corpus overlap.
  - ``_concentration`` — clustered views (sector/country, provenance split, scatter,
                         percentile, coverage, committee/gate rollups).
  - ``_provenance``    — layered DAGs over one run's modules → claims → evidence →
                         chunks, plus the QA/debate/diff variants.

``availability`` reads the DB once and decides which capabilities are runnable now,
so the rail greys a query exactly when its edge can't be walked from what's stored
(no run → no provenance; one run → no diff; CP-2D stores no sponsor names → ever).

Positions are normalized 0..1 (computed here, not in the client) so the renderer
stays a dumb projector. Pure helpers (``_rank_peers``, ``_norm``, layout) are
DB-free and covered by the ``__main__`` self-check.
"""

from __future__ import annotations

import logging
from statistics import median
from typing import Dict, List, Optional, Sequence, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import (
    Claim,
    DocumentChunk,
    EvidenceItem,
    Issuer,
    MetricFact,
    ModuleOutput,
    QAFinding,
    Run,
)
from engine.metrics import CATALOG_BY_KEY
from engine.registry import REGISTRY, all_specs
from retrieval import retrieve_corpus

logger = logging.getLogger("caos.querygraph")

# Metrics the peer/scatter/percentile views compare on (those CP-1 / CP-1C use).
_PROFILE_KEYS = ("net_leverage", "interest_coverage", "ebitda_margin")
_WEAK_LINEAGE = {"Weak Lineage", "Untraced", "Conflicting", "Assumption-Based"}
_BASIS_CAVEAT = (
    "Leverage / EBITDA may mix reported-GAAP (EDGAR) and modeled-adjusted bases "
    "across issuers — not directly comparable."
)


# ── Capability registry — the rail, and the dispatch table ───────────────────
def _cap(cid: str, label: str, mode: str, params: dict, requires: str) -> dict:
    return {"id": cid, "label": label, "mode": mode, "params": params, "requires": requires}


GROUPS: List[dict] = [
    {"id": "provenance", "label": "Provenance", "icon": "arrow-guide", "caps": [
        _cap("trace-source", "Trace number to source", "provenance", {"focus": "trace"}, "runs"),
        _cap("lineage-audit", "Lineage audit", "provenance", {"focus": "lineage"}, "runs"),
        _cap("provenance-split", "Provenance split", "concentration", {"by": "provenance"}, "facts"),
        _cap("orphan-claims", "Orphan-claim finder", "provenance", {"focus": "orphan"}, "runs"),
    ]},
    {"id": "dag", "label": "Reasoning DAG", "icon": "binary-tree", "caps": [
        _cap("conclusion-lineage", "Conclusion lineage", "provenance", {"focus": "trace"}, "runs"),
        _cap("impact-analysis", "Impact analysis", "provenance", {"focus": "impact"}, "runs"),
        _cap("coverage-completeness", "Coverage completeness", "concentration", {"by": "coverage"}, "runs"),
    ]},
    {"id": "issuer", "label": "Issuer links", "icon": "affiliate", "caps": [
        _cap("peer-set", "Peer set", "peers", {}, "facts"),
        _cap("peer-profile", "Peer-by-profile", "peers", {}, "facts"),
        _cap("shared-theme", "Shared-theme links", "contagion", {"theme": "energy input-cost pressure"}, "docs"),
        _cap("concentration-map", "Concentration map", "concentration", {"by": "industry"}, "issuers"),
        _cap("contagion", "Contagion query", "contagion", {"theme": "energy"}, "facts"),
        _cap("sponsor-graph", "Sponsor / counterparty graph", "provenance", {"focus": "sponsor"}, "sponsor_names"),
    ]},
    {"id": "metric", "label": "Metric x time", "icon": "timeline", "caps": [
        _cap("distribution", "Distribution / percentile", "concentration", {"by": "percentile"}, "facts"),
        _cap("scatter", "Cross-issuer scatter", "concentration", {"by": "scatter"}, "facts"),
        _cap("metric-trend", "Metric trend", "concentration", {"by": "trend"}, "periods2"),
    ]},
    {"id": "versions", "label": "Run versions", "icon": "versions", "caps": [
        _cap("run-diff", "Run diff (what changed)", "provenance", {"focus": "diff"}, "runs2"),
        _cap("coverage-changed", "Coverage what-changed", "provenance", {"focus": "diff"}, "runs2"),
    ]},
    {"id": "qa", "label": "QA / governance", "icon": "shield-check", "caps": [
        _cap("open-findings", "Open findings", "provenance", {"focus": "findings"}, "findings"),
        _cap("gate-lane", "Gate-lane rollup", "concentration", {"by": "gate_lane"}, "findings"),
        _cap("committee-board", "Committee-readiness board", "concentration", {"by": "committee"}, "runs"),
    ]},
    {"id": "contradiction", "label": "Contradiction", "icon": "arrows-cross", "caps": [
        _cap("tension", "Tension finder", "provenance", {"focus": "tension"}, "debate"),
        _cap("debate-digest", "Debate digest", "provenance", {"focus": "debate"}, "debate"),
    ]},
]

CAP_BY_ID: Dict[str, dict] = {c["id"]: c for g in GROUPS for c in g["caps"]}

# Why a capability is greyed — keyed by its `requires` availability flag.
_REASONS: Dict[str, str] = {
    "facts": "no metric facts ingested",
    "issuers": "no issuers in coverage",
    "docs": "no source documents ingested",
    "runs": "needs a completed run",
    "runs2": "needs ≥2 runs of one issuer",
    "periods2": "needs ≥2 reporting periods",
    "findings": "no QA findings yet",
    "debate": "no IC debate run yet",
    "sponsor_names": "CP-2D stores no sponsor names",
}


# ── Availability — one DB pass deciding what's runnable now ───────────────────
async def availability(session: AsyncSession) -> Dict[str, bool]:
    """Compute the per-flag availability the rail greys on. One pass; cheap counts."""
    async def count(stmt) -> int:
        return int((await session.execute(stmt)).scalar() or 0)

    facts = await count(select(func.count()).select_from(MetricFact).where(MetricFact.headline.is_(True)))
    issuers = await count(select(func.count()).select_from(Issuer))
    chunks = await count(select(func.count()).select_from(DocumentChunk))
    runs = await count(select(func.count(func.distinct(ModuleOutput.run_id))))
    findings = await count(select(func.count()).select_from(QAFinding))
    debate = await count(select(func.count()).select_from(ModuleOutput).where(ModuleOutput.module_id == "CP-6A"))

    # ≥2 *fact-bearing* runs for some issuer — the real precondition for a diff.
    # Counting bare Run rows over-reports: a run that never persisted headline facts
    # can't be compared, so the rail would greenlight a diff with nothing to diff.
    fact_runs = (await session.execute(
        select(Run.issuer_id, MetricFact.run_id)
        .join(MetricFact, MetricFact.run_id == Run.id)
        .where(MetricFact.headline.is_(True))
        .group_by(Run.issuer_id, MetricFact.run_id)
    )).all()
    per_issuer: Dict[str, int] = {}
    for iid, _rid in fact_runs:
        per_issuer[iid] = per_issuer.get(iid, 0) + 1
    runs2 = any(c >= 2 for c in per_issuer.values())

    # ≥2 distinct periods for some (issuer, metric): the trend axis.
    periods = (await session.execute(
        select(MetricFact.issuer_id, MetricFact.metric_key, func.count(func.distinct(MetricFact.period)))
        .group_by(MetricFact.issuer_id, MetricFact.metric_key)
    )).all()
    periods2 = any(c >= 2 for _i, _k, c in periods)

    return {
        "facts": facts > 0,
        "issuers": issuers > 0,
        "docs": chunks > 0,
        "runs": runs > 0,
        "runs2": runs2,
        "periods2": periods2,
        "findings": findings > 0,
        "debate": debate > 0,
        # CP-2D persists a governance score, never a sponsor *name* — the edge has
        # no endpoints to draw, so this stays off until that extraction exists.
        "sponsor_names": False,
    }


async def capabilities(session: AsyncSession) -> dict:
    """The rail payload: groups with each capability's enabled state + grey reason."""
    avail = await availability(session)
    groups = []
    for g in GROUPS:
        caps = []
        for c in g["caps"]:
            on = avail.get(c["requires"], False)
            caps.append({
                "id": c["id"], "label": c["label"], "mode": c["mode"],
                "enabled": on, "reason": None if on else _REASONS.get(c["requires"], "unavailable"),
            })
        groups.append({"id": g["id"], "label": g["label"], "icon": g["icon"],
                       "ready": sum(1 for c in caps if c["enabled"]), "total": len(caps),
                       "capabilities": caps})
    return {"groups": groups, "availability": avail}


# ── Graph payload helpers ────────────────────────────────────────────────────
def _node(nid: str, label: str, kind: str, x: float, y: float, **extra) -> dict:
    n = {"id": nid, "label": label, "kind": kind, "x": round(x, 3), "y": round(y, 3)}
    n.update({k: v for k, v in extra.items() if v is not None})
    return n


def _edge(src: str, dst: str, **extra) -> dict:
    e = {"source": src, "target": dst}
    e.update({k: v for k, v in extra.items() if v is not None})
    return e


def _result(cap: dict, title: str, nodes: List[dict], edges: List[dict],
            meta: List[str], caveats: List[str]) -> dict:
    return {"capability_id": cap["id"], "mode": cap["mode"], "title": title,
            "nodes": nodes, "edges": edges, "meta": meta, "caveats": caveats}


def _norm(v: float, lo: float, hi: float) -> float:
    return 0.5 if hi <= lo else max(0.0, min(1.0, (v - lo) / (hi - lo)))


def _empty(cap: dict, title: str, why: str) -> dict:
    return _result(cap, title, [], [], [why], [why])


# ── Latest-per (issuer, metric) fact selection (run > seed, then most recent) ─
def _best_fact(prev: Optional[MetricFact], fact: MetricFact) -> bool:
    return (prev is None
            or (fact.provenance == "run" and prev.provenance != "run")
            or (fact.provenance == prev.provenance and fact.created_at and prev.created_at
                and fact.created_at > prev.created_at))


async def _profile_values(session: AsyncSession, keys: Sequence[str]) -> Dict[str, dict]:
    """{issuer_id: {"issuer": Issuer, "m": {key: value}}} over headline facts."""
    rows = (await session.execute(
        select(MetricFact, Issuer)
        .join(Issuer, MetricFact.issuer_id == Issuer.id)
        .where(MetricFact.headline.is_(True), MetricFact.metric_key.in_(list(keys)))
    )).all()
    best: Dict[Tuple[str, str], MetricFact] = {}
    issuers: Dict[str, Issuer] = {}
    for fact, iss in rows:
        issuers[iss.id] = iss
        k = (iss.id, fact.metric_key)
        if _best_fact(best.get(k), fact):
            best[k] = fact
    out: Dict[str, dict] = {}
    for (iid, mk), fact in best.items():
        out.setdefault(iid, {"issuer": issuers[iid], "m": {}})["m"][mk] = fact.value
    return out


# ── Pure peer ranking (DB-free; self-checked) ────────────────────────────────
def _rank_peers(
    vals: Dict[str, Dict[str, float]], keys: Sequence[str], target: str, limit: int = 6
) -> List[Tuple[str, float]]:
    """Rank issuers by normalized-Euclidean closeness to ``target`` over shared
    metric keys. Returns [(issuer_id, similarity 0..1)], closest first. Each key is
    min-max normalized across the cohort so units don't dominate the distance."""
    if target not in vals:
        return []
    ranges = {}
    for k in keys:
        present = [v[k] for v in vals.values() if k in v]
        if present:
            ranges[k] = (min(present), max(present))
    tv = vals[target]
    scored: List[Tuple[str, float]] = []
    for iid, mv in vals.items():
        if iid == target:
            continue
        shared = [k for k in keys if k in mv and k in tv and k in ranges]
        if not shared:
            continue
        dist = (sum((_norm(mv[k], *ranges[k]) - _norm(tv[k], *ranges[k])) ** 2 for k in shared)
                / len(shared)) ** 0.5
        scored.append((iid, 1.0 / (1.0 + dist)))
    scored.sort(key=lambda t: t[1], reverse=True)
    return scored[:limit]


def _radial_positions(n: int, r: float = 0.36) -> List[Tuple[float, float]]:
    """n points on a circle around (0.5, 0.5), starting at the top, clockwise."""
    import math
    if n <= 0:
        return []
    return [(0.5 + r * math.sin(2 * math.pi * i / n),
             0.5 - r * math.cos(2 * math.pi * i / n)) for i in range(n)]


# ── Builder: peers (issuer↔issuer) ───────────────────────────────────────────
async def _peers(session: AsyncSession, issuer_id: Optional[str], cap: dict) -> dict:
    data = await _profile_values(session, _PROFILE_KEYS)
    if not data:
        return _empty(cap, "Peer graph", "No headline metrics in coverage to compare.")
    vals = {iid: d["m"] for iid, d in data.items()}
    target = issuer_id if issuer_id in vals else _default_focus(data, vals)
    ranked = _rank_peers(vals, _PROFILE_KEYS, target)
    if not ranked:
        return _empty(cap, "Peer graph", "No comparable peers for the focus issuer.")

    tgt = data[target]["issuer"]
    nodes = [_node(target, tgt.name, "center", 0.5, 0.5, group=tgt.industry, center=True,
                   sub=tgt.industry or tgt.country)]
    edges: List[dict] = []
    pos = _radial_positions(len(ranked))
    # Ordinal nearest-rank on the edge (#1 = closest) — honest about ordering without
    # implying a calibrated 0–100 score; line weight still tracks similarity.
    for rank, ((iid, sim), (x, y)) in enumerate(zip(ranked, pos), start=1):
        iss = data[iid]["issuer"]
        nodes.append(_node(iid, iss.name, "issuer", x, y, group=iss.industry,
                           sub=iss.industry or iss.country))
        edges.append(_edge(target, iid, weight=round(sim, 3), label=f"#{rank}"))
    meta = [f"focus: {tgt.name}", f"{len(ranked)} peers", "ranked by profile distance (#1 = nearest)"]
    return _result(cap, f"Peers of {tgt.name}", nodes, edges, meta,
                   [_BASIS_CAVEAT, "Closeness is ordinal within this cohort, not an absolute score."])


def _default_focus(data: Dict[str, dict], vals: Dict[str, Dict[str, float]]) -> str:
    """Deterministic focus issuer: richest profile, ties broken alphabetically by
    name (stable across runs — no arbitrary codepoint tiebreaker)."""
    return min(vals, key=lambda i: (-len(vals[i]), data[i]["issuer"].name or i))


# ── Builder: contagion (shared-driver overlay) ───────────────────────────────
async def _contagion(session: AsyncSession, theme: Optional[str], cap: dict) -> dict:
    energy = await _profile_values(session, ("energy_cost_pct",))
    bm_terms = theme or "energy input cost inflation fuel power"
    hits = await retrieve_corpus(session, bm_terms, k=24)
    hit_issuers = {h.issuer_id for h in hits}

    rows: List[Tuple[Issuer, Optional[float], bool]] = []
    for iid, d in energy.items():
        rows.append((d["issuer"], d["m"].get("energy_cost_pct"), iid in hit_issuers))
    # Issuers with a corpus hit but no energy fact still belong on the canvas (dim).
    seen = {d["issuer"].id for d in energy.values()}
    extra_ids = [i for i in hit_issuers if i not in seen]
    if extra_ids:
        for iss in (await session.execute(select(Issuer).where(Issuer.id.in_(extra_ids)))).scalars():
            rows.append((iss, None, True))
    if not rows:
        return _empty(cap, "Contagion overlay", "No issuers expose this driver in the store.")

    present = [v for _i, v, _h in rows if v is not None]
    thresh = max(15.0, median(present)) if present else 15.0
    driver = "driver"
    nodes = [_node(driver, "Energy input cost ↑", "driver", 0.5, 0.12)]
    edges: List[dict] = []
    exposed = [(iss, v) for iss, v, h in rows if (v is not None and v >= thresh) or h and v is not None]
    others = [iss for iss, v, h in rows if (iss, v) not in exposed]

    ex_pos = _spread(len(exposed), y=0.45, x0=0.16, x1=0.84)
    for (iss, v), (x, y) in zip(exposed, ex_pos):
        nodes.append(_node(iss.id, iss.name, "issuer", x, y, group=iss.industry,
                           exposed=True, sub=f"{round(v)}% of cost base"))
        edges.append(_edge(driver, iss.id, weight=round(v / 100, 3), kind="driver"))
    ot_pos = _spread(len(others), y=0.85, x0=0.16, x1=0.84)
    for iss, (x, y) in zip(others, ot_pos):
        nodes.append(_node(iss.id, iss.name, "issuer", x, y, dim=True, sub="not exposed"))
    meta = [f"{len(exposed)} of {len(rows)} share the driver",
            f"threshold ≥{round(thresh)}% energy / cost base"]
    cav = ["Shared-driver links corroborate (energy_cost_pct + BM25 corpus overlap) — "
           "not a modeled correlation."]
    return _result(cap, "Energy-shock contagion", nodes, edges, meta, cav)


def _spread(n: int, y: float, x0: float = 0.1, x1: float = 0.9) -> List[Tuple[float, float]]:
    if n <= 0:
        return []
    if n == 1:
        return [((x0 + x1) / 2, y)]
    step = (x1 - x0) / (n - 1)
    return [(x0 + i * step, y) for i in range(n)]


# ── Builder: concentration (clustered / scatter / rollup views) ──────────────
async def _concentration(session: AsyncSession, by: str, issuer_id: Optional[str], cap: dict) -> dict:
    if by in ("industry", "country"):
        return await _cluster_by_field(session, by, cap)
    if by == "provenance":
        return await _provenance_split(session, cap)
    if by == "scatter":
        return await _scatter(session, cap)
    if by == "percentile":
        return await _percentile(session, issuer_id, cap)
    if by == "trend":
        return await _trend(session, cap)
    if by == "coverage":
        return await _coverage(session, cap)
    if by == "committee":
        return await _committee(session, cap)
    if by == "gate_lane":
        return await _gate_lane(session, cap)
    return _empty(cap, "Concentration", f"unknown view {by!r}")


async def _cluster_by_field(session: AsyncSession, field: str, cap: dict) -> dict:
    # Concentration is a *coverage* view — only issuers we've actually analyzed
    # (≥1 headline fact or ≥1 run) belong on it. Empty registry rows (e.g. E2E test
    # fixtures with no facts) carry no analytical signal and would skew the %s, so
    # they're excluded; this also bounds the working set instead of scanning the
    # whole issuer table.
    covered = set((await session.execute(
        select(MetricFact.issuer_id).where(MetricFact.headline.is_(True))
    )).scalars())
    covered |= set((await session.execute(select(Run.issuer_id))).scalars())
    if not covered:
        return _empty(cap, "Concentration", "No analyzed issuers yet.")
    issuers = (await session.execute(select(Issuer).where(Issuer.id.in_(covered)))).scalars().all()
    if not issuers:
        return _empty(cap, "Concentration", "No analyzed issuers yet.")
    groups: Dict[str, List[Issuer]] = {}
    for iss in issuers:
        groups.setdefault(getattr(iss, field) or "Unclassified", []).append(iss)
    ordered = sorted(groups.items(), key=lambda kv: len(kv[1]), reverse=True)
    centers = _grid_centers(len(ordered))
    nodes: List[dict] = []
    edges: List[dict] = []
    total = len(issuers)
    for (name, members), (cx, cy) in zip(ordered, centers):
        gid = f"grp:{name}"
        pct = round(100 * len(members) / total)
        nodes.append(_node(gid, f"{name} · {len(members)}", "sector", cx, cy,
                           group=name, sub=f"{pct}% of book", flag=pct > 30 or None))
        for iss, (mx, my) in zip(members, _member_grid(cx, cy, len(members))):
            nodes.append(_node(iss.id, iss.name, "issuer", mx, my, group=name, compact=True))
            edges.append(_edge(gid, iss.id, kind="member"))
    top = ordered[0]
    meta = [f"{total} analyzed issuers", f"{len(ordered)} {field} groups",
            f"{top[0]} = {round(100 * len(top[1]) / total)}% (largest)"]
    cav = [f"Covered issuers only (≥1 fact or run). Grouped by {field}; >30% flags concentration."]
    return _result(cap, f"Concentration by {field}", nodes, edges, meta, cav)


def _grid_centers(n: int) -> List[Tuple[float, float]]:
    import math
    if n <= 0:
        return []
    cols = math.ceil(math.sqrt(n))
    rows = math.ceil(n / cols)
    out = []
    for i in range(n):
        r, c = divmod(i, cols)
        out.append(((c + 0.5) / cols, (r + 0.5) / rows))
    return out


def _member_grid(cx: float, cy: float, n: int, sp: float = 0.032) -> List[Tuple[float, float]]:
    """A tidy dot-grid of ``n`` members under a cluster pill — replaces the radial
    ring that piled labels on top of each other once a cluster held more than a
    couple of issuers. Members render as compact dots (names on hover), so a 12-
    issuer sector reads as an orderly block, not a smear."""
    import math
    if n <= 0:
        return []
    cols = max(1, math.ceil(math.sqrt(n)))
    out = []
    # Stack rows *downward* from a fixed clearance below the pill, so the top row
    # always clears the pill (the old centered grid pushed tall blocks up into it).
    clearance = 0.055
    for i in range(n):
        r, c = divmod(i, cols)
        x = cx + (c - (cols - 1) / 2) * sp
        y = cy + clearance + r * sp
        out.append((min(0.97, max(0.03, x)), min(0.96, max(0.04, y))))
    return out


async def _provenance_split(session: AsyncSession, cap: dict) -> dict:
    rows = (await session.execute(
        select(MetricFact.provenance, MetricFact.basis, func.count())
        .where(MetricFact.headline.is_(True))
        .group_by(MetricFact.provenance, MetricFact.basis)
    )).all()
    if not rows:
        return _empty(cap, "Provenance split", "No headline facts to classify.")
    buckets: Dict[str, int] = {}
    for prov, basis, c in rows:
        key = prov + (f" / {basis}" if basis else "")
        buckets[key] = buckets.get(key, 0) + int(c)
    ordered = sorted(buckets.items(), key=lambda kv: kv[1], reverse=True)
    pos = _spread(len(ordered), y=0.5, x0=0.18, x1=0.82)
    nodes = []
    total = sum(buckets.values())
    for (label, c), (x, y) in zip(ordered, pos):
        kind = "evidence" if label.startswith("run") or label.startswith("derived") else "chunk"
        nodes.append(_node(f"prov:{label}", f"{label} · {c}", kind, x, y,
                           sub=f"{round(100 * c / total)}% of facts"))
    meta = [f"{total} headline facts", f"{len(ordered)} provenance/basis classes"]
    cav = ["run = QA-gated engine; derived = extracted from a cited chunk; seed = illustrative."]
    return _result(cap, "Provenance split", nodes, [], meta, cav)


async def _scatter(session: AsyncSession, cap: dict) -> dict:
    data = await _profile_values(session, ("net_leverage", "interest_coverage"))
    pts = [(d["issuer"], d["m"].get("net_leverage"), d["m"].get("interest_coverage"))
           for d in data.values()]
    pts = [(i, x, y) for i, x, y in pts if x is not None and y is not None]
    if len(pts) < 2:
        return _empty(cap, "Cross-issuer scatter", "Need ≥2 issuers with both metrics.")
    xs = [x for _i, x, _y in pts]
    ys = [y for _i, _x, y in pts]
    xlo, xhi, ylo, yhi = min(xs), max(xs), min(ys), max(ys)
    nodes = []
    for iss, x, y in pts:
        nodes.append(_node(iss.id, iss.name, "issuer",
                           0.1 + 0.8 * _norm(x, xlo, xhi), 0.9 - 0.8 * _norm(y, ylo, yhi),
                           group=iss.industry, sub=f"{x:.1f}x / {y:.1f}x"))
    meta = ["x = net leverage →", "y = interest coverage ↑", f"{len(pts)} issuers"]
    return _result(cap, "Leverage × coverage", nodes, [], meta, [_BASIS_CAVEAT])


async def _percentile(session: AsyncSession, issuer_id: Optional[str], cap: dict) -> dict:
    data = await _profile_values(session, _PROFILE_KEYS)
    if not data:
        return _empty(cap, "Percentile", "No headline metrics in coverage.")
    vals = {iid: d["m"] for iid, d in data.items()}
    target = issuer_id if issuer_id in vals else _default_focus(data, vals)
    tgt = data[target]["issuer"]
    nodes = [_node(target, tgt.name, "center", 0.08, 0.5, center=True, sub=tgt.industry)]
    edges = []
    keys = [k for k in _PROFILE_KEYS if k in vals[target]]
    for idx, k in enumerate(keys):
        md = CATALOG_BY_KEY[k]
        peer_vals = [vals[i][k] for i in vals if k in vals[i] and i != target]
        iv = vals[target][k]
        better = (sum(1 for pv in peer_vals if iv >= pv) if md.higher_is_better
                  else sum(1 for pv in peer_vals if iv <= pv))
        pct = round(100 * better / len(peer_vals)) if peer_vals else 50
        y = 0.2 + (0.6 * idx / max(1, len(keys) - 1)) if len(keys) > 1 else 0.5
        nid = f"pct:{k}"
        nodes.append(_node(nid, f"{md.label} · p{pct}", "metric", 0.25 + 0.6 * pct / 100, y,
                           sub=f"{iv:g}{md.unit}", flag=pct <= 25 or None))
        edges.append(_edge(target, nid, kind="member"))
    meta = [f"focus: {tgt.name}", f"{len(keys)} metrics vs {len(vals) - 1} peers",
            "x = percentile rank (polarity-adjusted)"]
    return _result(cap, f"{tgt.name} percentile rank", nodes, edges, meta,
                   ["p≤25 = bottom-quartile outlier."])


async def _trend(session: AsyncSession, cap: dict) -> dict:
    from engine.periods import sort_key
    rows = (await session.execute(
        select(MetricFact, Issuer).join(Issuer, MetricFact.issuer_id == Issuer.id)
        .where(MetricFact.metric_key.in_(("revenue", "adj_ebitda", "net_leverage")))
    )).all()
    series: Dict[Tuple[str, str], List[Tuple[str, float]]] = {}
    issuers: Dict[str, Issuer] = {}
    for f, iss in rows:
        issuers[iss.id] = iss
        series.setdefault((iss.id, f.metric_key), []).append((f.period, f.value))
    pick = max(series.items(), key=lambda kv: len({p for p, _ in kv[1]}), default=None)
    if pick is None or len({p for p, _ in pick[1]}) < 2:
        return _empty(cap, "Metric trend", "No metric has ≥2 periods yet.")
    (iid, mk), pairs = pick
    pairs = sorted({p: v for p, v in pairs}.items(), key=lambda pv: sort_key(pv[0]))
    vs = [v for _p, v in pairs]
    lo, hi = min(vs), max(vs)
    md = CATALOG_BY_KEY.get(mk)
    nodes, edges = [], []
    pos = _spread(len(pairs), y=0.5, x0=0.12, x1=0.88)
    prev = None
    for (period, v), (x, _y) in zip(pairs, pos):
        nid = f"pt:{period}"
        nodes.append(_node(nid, period, "metric", x, 0.85 - 0.6 * _norm(v, lo, hi),
                           sub=f"{v:g}{md.unit if md else ''}"))
        if prev:
            edges.append(_edge(prev, nid, kind="seq"))
        prev = nid
    label = (md.label if md else mk)
    meta = [f"{issuers[iid].name}", label, f"{len(pairs)} periods"]
    return _result(cap, f"{issuers[iid].name} — {label} trend", nodes, edges, meta, [])


async def _coverage(session: AsyncSession, cap: dict) -> dict:
    designed = [s for s in all_specs() if s.implemented]
    total = len(designed)
    rows = (await session.execute(
        select(Run.issuer_id, ModuleOutput.module_id)
        .join(ModuleOutput, ModuleOutput.run_id == Run.id)
    )).all()
    if not rows:
        return _empty(cap, "Coverage completeness", "No completed runs yet.")
    by_issuer: Dict[str, set] = {}
    for iid, mid in rows:
        by_issuer.setdefault(iid, set()).add(mid)
    names = dict((await session.execute(
        select(Issuer.id, Issuer.name).where(Issuer.id.in_(list(by_issuer)))
    )).all())
    designed_ids = {s.module_id for s in designed}
    counts = {iid: len(ran & designed_ids) for iid, ran in by_issuer.items()}
    # Flag *relative* to the best-covered run, not an absolute %: a run legitimately
    # skips modules it has no inputs for, so "fewer than the best peer achieved" is a
    # truer under-coverage signal than a fixed <60% cutoff.
    best = max(counts.values()) if counts else 0
    nodes = []
    pos = _spread(len(by_issuer), y=0.5, x0=0.12, x1=0.88)
    for (iid, n), (x, _y) in zip(counts.items(), pos):
        ratio = n / total if total else 0
        nodes.append(_node(iid, names.get(iid, iid), "issuer", x, 0.9 - 0.7 * ratio,
                           sub=f"{n}/{total} modules", flag=(n < best) or None))
    meta = [f"{len(by_issuer)} issuers run", f"best-covered = {best}/{total}",
            "y = completeness; flagged = below the best-covered run"]
    return _result(cap, "Coverage completeness", nodes, [], meta,
                   ["Relative under-coverage vs the best run — a thin run may legitimately skip input-gated modules."])


async def _committee(session: AsyncSession, cap: dict) -> dict:
    rows = (await session.execute(
        select(Run, Issuer).join(Issuer, Run.issuer_id == Issuer.id)
    )).all()
    if not rows:
        return _empty(cap, "Committee-readiness", "No runs yet.")
    groups: Dict[str, List[Issuer]] = {}
    for run, iss in rows:
        groups.setdefault(run.committee_status or "Draft Only", []).append(iss)
    ordered = sorted(groups.items(), key=lambda kv: len(kv[1]), reverse=True)
    centers = _grid_centers(len(ordered))
    nodes, edges = [], []
    for (status, members), (cx, cy) in zip(ordered, centers):
        gid = f"cs:{status}"
        nodes.append(_node(gid, f"{status} · {len(members)}", "sector", cx, cy, group=status))
        for iss, (mx, my) in zip(members, _member_grid(cx, cy, len(members))):
            nodes.append(_node(f"{gid}:{iss.id}", iss.name, "issuer", mx, my, compact=True))
            edges.append(_edge(gid, f"{gid}:{iss.id}", kind="member"))
    meta = [f"{len(rows)} runs", f"{len(ordered)} committee states"]
    return _result(cap, "Committee-readiness board", nodes, edges, meta, [])


async def _gate_lane(session: AsyncSession, cap: dict) -> dict:
    rows = (await session.execute(select(QAFinding))).scalars().all()
    if not rows:
        return _empty(cap, "Gate-lane rollup", "No QA findings yet.")
    groups: Dict[str, List[QAFinding]] = {}
    for f in rows:
        groups.setdefault(f"Lane {f.lane}" if f.lane is not None else "Unscoped", []).append(f)
    ordered = sorted(groups.items(), key=lambda kv: len(kv[1]), reverse=True)
    centers = _grid_centers(len(ordered))
    nodes, edges = [], []
    sev_kind = {"CRITICAL": "finding-crit", "MATERIAL": "finding-mat", "MINOR": "finding-min"}
    for (lane, members), (cx, cy) in zip(ordered, centers):
        gid = f"lane:{lane}"
        nodes.append(_node(gid, f"{lane} · {len(members)}", "sector", cx, cy, group=lane))
        for f, (mx, my) in zip(members, _member_grid(cx, cy, len(members))):
            nodes.append(_node(f"f:{f.id}", f.finding_id, sev_kind.get(f.severity, "finding-min"),
                               mx, my, sub=f.severity, module=f.module_id, compact=True,
                               title=f"{f.finding_id} · {f.severity}: {_clip(f.description, 80)}"))
            edges.append(_edge(gid, f"f:{f.id}", kind="member"))
    crit = sum(1 for f in rows if f.severity == "CRITICAL")
    meta = [f"{len(rows)} findings", f"{len(ordered)} CP-5 lanes", f"{crit} CRITICAL"]
    return _result(cap, "Gate findings by lane", nodes, edges, meta, [])


# ── Builder: provenance (layered DAGs over a run) ────────────────────────────
async def _latest_run(session: AsyncSession, issuer_id: Optional[str],
                      prefer_claims: bool = False) -> Optional[Run]:
    """The most recent run that produced module outputs. When ``prefer_claims`` is
    set (trace / lineage / orphan), prefer one whose CP-1 actually carries claims —
    so the source-chain isn't empty just because the newest run had a thin CP-1."""
    stmt = select(Run).order_by(Run.created_at.desc())
    if issuer_id:
        stmt = stmt.where(Run.issuer_id == issuer_id)
    fallback: Optional[Run] = None
    for run in (await session.execute(stmt)).scalars():
        has = (await session.execute(
            select(func.count()).select_from(ModuleOutput).where(ModuleOutput.run_id == run.id)
        )).scalar()
        if not has:
            continue
        if fallback is None:
            fallback = run
        if not prefer_claims:
            return run
        claims = (await session.execute(
            select(func.count()).select_from(Claim)
            .join(ModuleOutput, ModuleOutput.id == Claim.module_output_id)
            .where(ModuleOutput.run_id == run.id, ModuleOutput.module_id == "CP-1")
        )).scalar()
        if claims:
            return run
    return fallback


async def _modules(session: AsyncSession, run_id: str) -> List[ModuleOutput]:
    return list((await session.execute(
        select(ModuleOutput).where(ModuleOutput.run_id == run_id).order_by(ModuleOutput.created_at)
    )).scalars().all())


async def _provenance(session: AsyncSession, focus: str, issuer_id: Optional[str], cap: dict) -> dict:
    if focus == "sponsor":  # never enabled, but guard the dispatch
        return _empty(cap, "Sponsor graph", "CP-2D persists no sponsor names to link.")
    run = await _latest_run(session, issuer_id, prefer_claims=focus in ("trace", "lineage", "orphan"))
    if run is None:
        return _empty(cap, "Provenance", "No completed run to traverse.")
    issuer = await session.get(Issuer, run.issuer_id)
    name = issuer.name if issuer else run.issuer_id
    mods = await _modules(session, run.id)
    if focus in ("trace", "impact"):
        return await _dag(session, run, name, mods, focus, cap)
    if focus in ("lineage", "orphan"):
        return await _claim_audit(session, run, name, mods, focus, cap)
    if focus == "findings":
        return await _findings(session, run, name, cap)
    if focus in ("debate", "tension"):
        return await _debate(name, mods, focus, cap)
    if focus == "diff":
        return await _diff(session, run, name, cap)
    return _empty(cap, "Provenance", f"unknown focus {focus!r}")


async def _dag(session: AsyncSession, run: Run, name: str, mods: List[ModuleOutput],
               focus: str, cap: dict) -> dict:
    present = {m.module_id: m for m in mods}
    # Layer x by registry layer_rank; spread y within a layer.
    layers: Dict[int, List[str]] = {}
    for mid in present:
        spec = REGISTRY.get(mid)
        layers.setdefault(spec.layer_rank if spec else 5, []).append(mid)
    ranks = sorted(layers)
    nodes, edges = [], []
    xfor = {rk: (0.1 + 0.8 * i / max(1, len(ranks) - 1)) if len(ranks) > 1 else 0.5
            for i, rk in enumerate(ranks)}
    for rk in ranks:
        col = layers[rk]
        # Stagger alternate columns so the dense L1/L2 layers don't line their
        # nodes (and edges) up into an unreadable lattice.
        off = 0.04 if (ranks.index(rk) % 2) else 0.0
        for j, mid in enumerate(col):
            m = present[mid]
            y = (0.08 + off + (0.84 * j / max(1, len(col) - 1))) if len(col) > 1 else 0.5
            nodes.append(_node(mid, mid, "module", xfor[rk], min(0.94, y), sub=m.module_name,
                               confidence=m.confidence))
    # Module→module edges (the reasoning DAG) from the registry, both ends present.
    for mid, m in present.items():
        spec = REGISTRY.get(mid)
        deps = (spec.depends_on if spec else ()) if focus == "trace" else ()
        for d in deps:
            if d in present:
                edges.append(_edge(d, mid, kind="dep"))
        if focus == "impact":
            for c in (m.downstream_consumers or []):
                if c in present:
                    edges.append(_edge(mid, c, kind="dep"))
    # Attach the CP-1 source chain (claim → evidence → chunk) on the far left.
    cp1 = present.get("CP-1")
    if cp1 is not None and focus == "trace":
        await _attach_source_chain(session, cp1.id, nodes, edges)
    meta = [f"run: {name}", f"{len(present)} modules", f"{len(edges)} edges",
            "trace = dependencies" if focus == "trace" else "impact = downstream consumers"]
    title = f"{name} — conclusion lineage" if focus == "trace" else f"{name} — impact analysis"
    return _result(cap, title, nodes, edges, meta,
                   ["Every module→module edge is a stored dependency in the route plan."])


async def _attach_source_chain(session: AsyncSession, module_output_id: str,
                               nodes: List[dict], edges: List[dict]) -> None:
    claims = list((await session.execute(
        select(Claim).where(Claim.module_output_id == module_output_id).limit(2)
    )).scalars().all())
    yslot = 0.2
    for c in claims:
        cid = f"c:{c.id}"
        nodes.append(_node(cid, c.claim_id, "claim", 0.06, yslot, sub=_clip(c.claim_text)))
        edges.append(_edge(cid, "CP-1", kind="cite"))
        evs = list((await session.execute(
            select(EvidenceItem).where(EvidenceItem.claim_pk == c.id).limit(2)
        )).scalars().all())
        for k, e in enumerate(evs):
            eid = f"e:{e.id}"
            nodes.append(_node(eid, e.evidence_id, "evidence", 0.02, yslot + 0.08 + 0.05 * k,
                               sub=e.lineage_class))
            edges.append(_edge(eid, cid, kind="cite"))
            if e.document_chunk_id:
                nodes.append(_node(f"ch:{e.document_chunk_id}", "source chunk", "chunk",
                                   0.0, yslot + 0.14 + 0.05 * k, chunk_id=e.document_chunk_id))
                edges.append(_edge(f"ch:{e.document_chunk_id}", eid, kind="cite"))
        yslot += 0.34


async def _claim_audit(session: AsyncSession, run: Run, name: str, mods: List[ModuleOutput],
                       focus: str, cap: dict) -> dict:
    mod_ids = [m.id for m in mods]
    claims = list((await session.execute(
        select(Claim).where(Claim.module_output_id.in_(mod_ids))
    )).scalars().all()) if mod_ids else []
    ev_by_claim: Dict[str, List[EvidenceItem]] = {c.id: [] for c in claims}
    if claims:
        for e in (await session.execute(
            select(EvidenceItem).where(EvidenceItem.claim_pk.in_(list(ev_by_claim)))
        )).scalars().all():
            ev_by_claim[e.claim_pk].append(e)
    mod_of = {m.id: m.module_id for m in mods}
    hits: List[Tuple[Claim, str]] = []
    for c in claims:
        evs = ev_by_claim[c.id]
        if focus == "lineage" and any(e.lineage_class in _WEAK_LINEAGE for e in evs):
            tag = next(e.lineage_class for e in evs if e.lineage_class in _WEAK_LINEAGE)
            hits.append((c, tag))
        elif focus == "orphan" and (not evs or all(not e.document_chunk_id for e in evs)):
            hits.append((c, "no resolved chunk"))
    title = f"{name} — weak-lineage claims" if focus == "lineage" else f"{name} — ungrounded claims"
    if not hits:
        clean = ("No weak-lineage claims — all evidence is sourced or calculated."
                 if focus == "lineage" else "No ungrounded claims — every claim resolves to a chunk.")
        return _result(cap, title, [], [], [clean], [clean])
    nodes, edges = [], []
    pos = _spread(len(hits), y=0.5, x0=0.16, x1=0.84)
    kind = "finding-mat" if focus == "lineage" else "finding-crit"
    for (c, tag), (x, _y) in zip(hits[:12], pos):
        cid = f"c:{c.id}"
        nodes.append(_node(cid, f"{mod_of.get(c.module_output_id, '?')} {c.claim_id}", kind, x, 0.5,
                           sub=tag, title=_clip(c.claim_text)))
    meta = [f"run: {name}", f"{len(hits)} flagged claims", f"focus: {focus}"]
    cav = ["Weak = Untraced / Conflicting / Assumption-Based / Weak Lineage."
           if focus == "lineage" else "Ungrounded = no evidence resolves to an ingested chunk."]
    return _result(cap, title, nodes, edges, meta, cav)


async def _findings(session: AsyncSession, run: Run, name: str, cap: dict) -> dict:
    rows = list((await session.execute(
        select(QAFinding).where(QAFinding.run_id == run.id)
    )).scalars().all())
    if not rows:
        return _result(cap, f"{name} — open findings", [], [], ["No open findings on this run."],
                       ["No open findings on this run."])
    nodes, edges = [], []
    sev_kind = {"CRITICAL": "finding-crit", "MATERIAL": "finding-mat", "MINOR": "finding-min"}
    mods = {f.module_id for f in rows if f.module_id}
    mpos = _spread(len(mods), y=0.25, x0=0.18, x1=0.82)
    mod_xy = {}
    for mid, (x, y) in zip(sorted(mods), mpos):
        nodes.append(_node(f"m:{mid}", mid, "module", x, y))
        mod_xy[mid] = f"m:{mid}"
    fpos = _spread(len(rows), y=0.75, x0=0.12, x1=0.88)
    for f, (x, y) in zip(rows, fpos):
        fid = f"f:{f.id}"
        nodes.append(_node(fid, f.finding_id, sev_kind.get(f.severity, "finding-min"), x, y,
                           sub=f.severity, title=_clip(f.description)))
        if f.module_id and f.module_id in mod_xy:
            edges.append(_edge(mod_xy[f.module_id], fid, kind="finding"))
    crit = sum(1 for f in rows if f.severity == "CRITICAL")
    meta = [f"run: {name}", f"{len(rows)} findings", f"{crit} CRITICAL"]
    return _result(cap, f"{name} — open findings", nodes, edges, meta, [])


async def _debate(name: str, mods: List[ModuleOutput], focus: str, cap: dict) -> dict:
    cp6 = next((m for m in mods if m.module_id == "CP-6A"), None)
    if cp6 is None:
        return _empty(cap, "Debate", "No IC debate (CP-6A) on this run.")
    rt = cp6.runtime_output or {}
    verdict = rt.get("verdict") or {}
    headline = verdict.get("lean") or verdict.get("sizing_posture") or "verdict"
    bull = (rt.get("bull_case") or {}).get("points") or []
    bear = (rt.get("bear_case") or {}).get("points") or []
    nodes = [_node("verdict", f"IC verdict: {headline}", "center", 0.5, 0.5, center=True,
                   sub=f"net score {verdict.get('net_score', '?')}")]
    edges = []
    bpos = _spread(len(bull), y=0.16, x0=0.12, x1=0.88)
    for i, (p, (x, y)) in enumerate(zip(bull, bpos)):
        nid = f"bull:{i}"
        nodes.append(_node(nid, p.get("source", "bull"), "point-bull", x, y,
                           sub=_clip(p.get("point", "")), weight=p.get("weight")))
        edges.append(_edge(nid, "verdict", kind="bull"))
    epos = _spread(len(bear), y=0.84, x0=0.12, x1=0.88)
    for i, (p, (x, y)) in enumerate(zip(bear, epos)):
        nid = f"bear:{i}"
        nodes.append(_node(nid, p.get("source", "bear"), "point-bear", x, y,
                           sub=_clip(p.get("point", "")), weight=p.get("weight")))
        edges.append(_edge(nid, "verdict", kind="bear"))
    gu = verdict.get("greatest_uncertainty")
    meta = [f"run: {name}", f"{len(bull)} bull / {len(bear)} bear",
            f"greatest uncertainty: {_clip(gu, 60)}" if gu else "weighted by the IC chair"]
    title = f"{name} — bull vs bear" if focus == "tension" else f"{name} — debate digest"
    return _result(cap, title, nodes, edges, meta,
                   ["The chair verdict is a reproducible function of point weights, not a judgement."])


async def _diff(session: AsyncSession, run: Run, name: str, cap: dict) -> dict:
    # A diff needs two runs that BOTH persisted headline facts. Bare Run rows
    # over-report — many runs never extracted facts — so select fact-bearing runs,
    # newest first, for an issuer that has at least two (preferring the run in hand).
    rows = (await session.execute(
        select(MetricFact.run_id, Run.issuer_id, Run.created_at, Run.as_of_date)
        .join(Run, Run.id == MetricFact.run_id)
        .where(MetricFact.headline.is_(True))
        .group_by(MetricFact.run_id, Run.issuer_id, Run.created_at, Run.as_of_date)
    )).all()
    by_issuer: Dict[str, List[Tuple]] = {}
    for rid, iid, created, asof in rows:
        by_issuer.setdefault(iid, []).append((created, rid, asof))
    eligible = {iid: sorted(v, reverse=True) for iid, v in by_issuer.items() if len(v) >= 2}
    if not eligible:
        return _empty(cap, "Run diff", "No issuer has two runs with comparable headline facts yet.")
    iid = run.issuer_id if run.issuer_id in eligible else max(eligible, key=lambda i: eligible[i][0][0])
    issuer = await session.get(Issuer, iid)
    iname = issuer.name if issuer else name
    (_c1, cur_id, cur_asof), (_c2, prev_id, prev_asof) = eligible[iid][0], eligible[iid][1]

    async def facts(rid: str) -> Dict[str, float]:
        rs = (await session.execute(
            select(MetricFact.metric_key, MetricFact.value)
            .where(MetricFact.run_id == rid, MetricFact.headline.is_(True))
        )).all()
        return {k: v for k, v in rs}

    a, b = await facts(cur_id), await facts(prev_id)
    keys = sorted(set(a) | set(b))
    nodes, edges = [], []
    pos = _spread(len(keys), y=0.5, x0=0.12, x1=0.88)
    moved = 0
    for k, (x, _y) in zip(keys, pos):
        md = CATALOG_BY_KEY.get(k)
        av, bv = a.get(k), b.get(k)
        if av is None:
            kind, sub = "metric", "dropped"
        elif bv is None:
            kind, sub = "metric", "new"
        else:
            delta = round(av - bv, 2)
            # Adverse = the metric moved in its *bad* direction (polarity-aware).
            worse = bool(md) and ((delta > 0 and not md.higher_is_better) or (delta < 0 and md.higher_is_better))
            kind = "metric" if delta == 0 else ("finding-mat" if worse else "point-bull")
            sub = f"{bv:g} → {av:g}" + (f" ({'+' if delta >= 0 else ''}{delta})" if delta else " (flat)")
            moved += 1 if delta else 0
        nodes.append(_node(f"d:{k}", md.label if md else k, kind, x, 0.5, sub=sub))
    meta = [iname, f"{cur_asof or 'current'} vs {prev_asof or 'prior'}",
            f"{len(keys)} metrics · {moved} moved"]
    return _result(cap, f"{iname} — what changed", nodes, edges, meta,
                   ["Current vs prior fact-bearing run. Amber = adverse move, green = improvement (polarity-aware)."])


def _clip(text: Optional[str], n: int = 90) -> str:
    t = " ".join((text or "").split())
    return t if len(t) <= n else t[: n - 1].rstrip() + "…"


# ── Dispatch ─────────────────────────────────────────────────────────────────
async def build_graph(session: AsyncSession, capability_id: str,
                      issuer_id: Optional[str] = None) -> dict:
    cap = CAP_BY_ID.get(capability_id)
    if cap is None:
        raise KeyError(capability_id)
    mode = cap["mode"]
    if mode == "peers":
        return await _peers(session, issuer_id, cap)
    if mode == "contagion":
        return await _contagion(session, cap["params"].get("theme"), cap)
    if mode == "concentration":
        return await _concentration(session, cap["params"].get("by", "industry"), issuer_id, cap)
    if mode == "provenance":
        return await _provenance(session, cap["params"].get("focus", "trace"), issuer_id, cap)
    raise ValueError(f"unknown mode {mode!r}")


if __name__ == "__main__":  # ponytail: DB-free self-check over the pure logic
    # registry integrity
    ids = [c["id"] for g in GROUPS for c in g["caps"]]
    assert len(ids) == len(set(ids)), "duplicate capability id"
    assert all(c["requires"] in _REASONS for g in GROUPS for c in g["caps"]), "unknown requires flag"
    assert all(c["mode"] in {"peers", "contagion", "concentration", "provenance"}
               for c in CAP_BY_ID.values()), "unknown builder mode"

    # peer ranking: closest profile wins, similarity in (0,1], self excluded
    vals = {
        "A": {"net_leverage": 4.0, "interest_coverage": 3.0, "ebitda_margin": 20.0},
        "B": {"net_leverage": 4.1, "interest_coverage": 3.1, "ebitda_margin": 21.0},  # near A
        "C": {"net_leverage": 8.0, "interest_coverage": 1.2, "ebitda_margin": 9.0},   # far
        "D": {"net_leverage": 6.0, "interest_coverage": 2.0, "ebitda_margin": 14.0},
    }
    ranked = _rank_peers(vals, _PROFILE_KEYS, "A")
    assert ranked[0][0] == "B", f"nearest peer should be B, got {ranked}"
    assert ranked[-1][0] == "C", "farthest peer should be C"
    assert all(0 < s <= 1 for _i, s in ranked), "similarity out of (0,1]"
    assert "A" not in dict(ranked), "target excluded from its own peers"
    assert _rank_peers(vals, _PROFILE_KEYS, "missing") == [], "unknown target → no peers"

    # default focus: richest profile, ties broken alphabetically (deterministic)
    fdata = {i: {"issuer": type("I", (), {"name": n})} for i, n in
             (("x", "Zeta"), ("y", "Acme"), ("z", "Beta"))}
    fvals = {"x": {"net_leverage": 4.0}, "y": {"net_leverage": 4.0, "interest_coverage": 3.0},
             "z": {"net_leverage": 4.0, "interest_coverage": 3.0}}
    assert _default_focus(fdata, fvals) == "y", "richest profile, then alphabetical → Acme"

    # normalization + layout stay in [0,1]
    assert _norm(5, 0, 10) == 0.5 and _norm(5, 5, 5) == 0.5
    assert all(0 <= x <= 1 and 0 <= y <= 1 for x, y in _radial_positions(7))
    assert all(0 <= x <= 1 and 0 <= y <= 1 for x, y in _grid_centers(5))
    assert len(_spread(1, 0.5)) == 1 and _spread(0, 0.5) == []

    # member grid stacks downward and clears the pill (every row below the centroid)
    mg = _member_grid(0.5, 0.5, 26)
    assert all(my > 0.5 for _mx, my in mg), "members must sit below the pill centroid"
    assert all(0.03 <= mx <= 0.97 for mx, _my in mg), "member x in-bounds"

    # clip
    assert _clip("a b  c") == "a b c"
    assert _clip("x" * 200).endswith("…") and len(_clip("x" * 200)) <= 90

    print("querygraph self-check OK —", len(ids), "capabilities,",
          len({c['mode'] for c in CAP_BY_ID.values()}), "builders")
