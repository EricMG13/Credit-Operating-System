"""The Query concept's graph engine — traverses the run-derived store as edges.

Where the NL query ([nlquery.py]) *flattens* the store and ranks a column, Query
*walks* it: every capability picks an edge type already materialized in the data
(provenance chains, the module DAG, issuer↔issuer peer links, sector clusters)
and returns a positioned node-link graph the frontend renders directly.

Five builders cover the whole capability surface via params:

  - ``_peers``         — issuer↔issuer similarity over the metric store (CP-1C math,
                         computed live so it works on seed data before any run).
  - ``_contagion``     — the *energy* shock overlay: issuers linked to the energy
                         driver via ``energy_cost_pct`` + BM25 corpus overlap.
  - ``_shared_theme``  — a generic risk-theme overlay: issuers whose filings/memos
                         co-mention an analyst-supplied ``theme`` (BM25 corpus only,
                         no fact anchor — so any theme works, not just energy).
  - ``_concentration`` — clustered views (sector/country, provenance split, scatter,
                         percentile, coverage, committee/gate rollups).
  - ``_provenance``    — layered DAGs over one run's modules → claims → evidence →
                         chunks, plus the QA/debate/diff variants.

``availability`` reads the DB once and decides which capabilities are runnable now,
so the rail greys a query exactly when its edge can't be walked from what's stored
(no run → no provenance; one run → no diff; no CP-4C run → no covenant register).

Positions are normalized 0..1 (computed here, not in the client) so the renderer
stays a dumb projector. Pure helpers (``_rank_peers``, ``_norm``, layout) are
DB-free and covered by the ``__main__`` self-check.
"""

from __future__ import annotations

import logging
from statistics import median
from typing import Dict, List, Optional, Sequence, Tuple

from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from engine.periods import is_finite_number

from database import (
    Claim,
    Document,
    DocumentChunk,
    EvidenceItem,
    Issuer,
    MetricFact,
    ModuleOutput,
    PortfolioPosition,
    QAFinding,
    Run,
)
from engine.metrics import CATALOG_BY_KEY, DERIVED_PROVENANCE, better_fact
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
        _cap("rating-distribution", "Rating distribution", "concentration", {"by": "rating"}, "rated"),
        _cap("portfolio-exposure", "Portfolio exposure", "concentration", {"by": "portfolio"}, "portfolio"),
        _cap("contagion", "Contagion query", "contagion", {"theme": "energy"}, "facts"),
        _cap("sponsor-graph", "Sponsor / counterparty graph", "provenance", {"focus": "sponsor"}, "sponsor_names"),
        _cap("covenant-register", "Covenant register", "concentration", {"by": "covenant"}, "covenant"),
    ]},
    {"id": "metric", "label": "Metric x time", "icon": "timeline", "caps": [
        _cap("distribution", "Distribution / percentile", "concentration", {"by": "percentile"}, "facts"),
        _cap("scatter", "Cross-issuer scatter", "concentration", {"by": "scatter"}, "facts"),
        _cap("metric-trend", "Metric trend", "concentration", {"by": "trend"}, "periods2"),
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
    {"id": "wiki", "label": "Wiki & Memos", "icon": "file-text", "caps": [
        _cap("wiki-links", "Wiki structure & classification", "concentration", {"by": "wiki"}, "docs"),
        _cap("analyst-memos", "Analyst links / memos", "provenance", {"focus": "memos"}, "issuers"),
    ]},
]

CAP_BY_ID: Dict[str, dict] = {c["id"]: c for g in GROUPS for c in g["caps"]}

# Why a capability is greyed — keyed by its `requires` availability flag.
_REASONS: Dict[str, str] = {
    "facts": "no metric facts ingested",
    "issuers": "no issuers in coverage",
    "docs": "no source documents ingested",
    "runs": "needs a completed run",
    "periods2": "needs ≥2 reporting periods",
    "findings": "no QA findings yet",
    "debate": "no IC debate run yet",
    "sponsor_names": "no sponsor-owned issuers in coverage",
    "covenant": "no covenant analysis yet",
    "rated": "no agency ratings on file",
    "portfolio": "no portfolio holdings ingested",
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
    # Analyst-entered PE sponsor (Issuer.sponsor, mig 0018) — the sponsor/counterparty
    # graph draws issuer↔sponsor edges off it, so it's runnable the moment one issuer
    # is tagged (no CP-2D name extraction needed).
    sponsors = await count(select(func.count()).select_from(Issuer).where(
        Issuer.sponsor.isnot(None), Issuer.sponsor != ""))
    # Any persisted CP-4C covenant analysis → the cross-issuer register is walkable.
    covenant = await count(select(func.count()).select_from(ModuleOutput).where(
        ModuleOutput.module_id == "CP-4C"))
    # ≥1 issuer carrying an agency rating (collected from ingested holdings/market
    # sheets, ratings.py) → the rating-distribution walk is runnable, no run needed.
    rated = await count(select(func.count()).select_from(Issuer).where(or_(
        Issuer.rating_moody.isnot(None), Issuer.rating_sp.isnot(None),
        Issuer.rating_fitch.isnot(None))))
    # ≥1 ingested CLO position → the portfolio-exposure walk is runnable.
    portfolio = await count(select(func.count()).select_from(PortfolioPosition))

    # ≥2 distinct periods for some (issuer, metric): the trend axis.
    # HAVING…LIMIT 1 existence check — don't materialize every group to test any().
    periods2 = (await session.execute(
        select(MetricFact.issuer_id)
        .group_by(MetricFact.issuer_id, MetricFact.metric_key)
        .having(func.count(func.distinct(MetricFact.period)) >= 2)
        .limit(1)
    )).first() is not None

    return {
        "facts": facts > 0,
        "issuers": issuers > 0,
        "docs": chunks > 0,
        "runs": runs > 0,
        "periods2": periods2,
        "findings": findings > 0,
        "debate": debate > 0,
        "sponsor_names": sponsors > 0,
        "covenant": covenant > 0,
        "rated": rated > 0,
        "portfolio": portfolio > 0,
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

    from config import get_settings
    from urllib.parse import quote
    from pathlib import Path
    settings = get_settings()
    v_name = settings.vault_name or (Path(settings.vault_export_dir).name if settings.vault_export_dir else "")
    if v_name:
        if kind in ("issuer", "center") and not nid.startswith(("cs:", "grp:", "lane:", "prov:")):
            n["obsidian_url"] = f"obsidian://open?vault={quote(v_name)}&file=Issuers%2F{quote(label)}"
        elif "run_spoke_title" in extra:
            sp_title = extra["run_spoke_title"]
            if kind == "module":
                n["obsidian_url"] = f"obsidian://open?vault={quote(v_name)}&file=Runs%2F{quote(sp_title)}%23{quote(n['label'])}"
            else:
                n["obsidian_url"] = f"obsidian://open?vault={quote(v_name)}&file=Runs%2F{quote(sp_title)}"
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
    """True if ``fact`` should replace ``prev`` for one (issuer, metric). Delegates
    to the canonical comparator in engine.metrics (shared with nlquery, peers,
    sponsors, and the issuer profile; pinned by test_fact_collapse.py)."""
    return better_fact(prev, fact)


async def _profile_values(session: AsyncSession, keys: Sequence[str]) -> Dict[str, dict]:
    """{issuer_id: {"issuer": Issuer, "m": {key: value}}} over headline facts — one winning
    fact per (issuer, metric) via a bounded SQL window (mirrors _best_fact: run/fixture tier,
    newest created_at, deterministic id tiebreak), so the read stays issuers×metrics rather
    than O(run history)."""
    tier = case((MetricFact.provenance.in_(DERIVED_PROVENANCE), 1), else_=0)
    win = select(
        MetricFact.id.label("fid"),
        func.row_number().over(
            partition_by=(MetricFact.issuer_id, MetricFact.metric_key),
            order_by=(tier.desc(), MetricFact.created_at.desc().nullslast(), MetricFact.id.desc()),
        ).label("rn"),
    ).where(
        MetricFact.headline.is_(True), MetricFact.metric_key.in_(list(keys)),
        # Fabricated demo-fixture rows (the ATLF fixture persisted for a NON-demo
        # issuer on a keyless run) must never render as an issuer's profile in
        # the Query graph — for a fresh issuer they are the ONLY facts, so the
        # tier ordering alone can't keep them out (audit 2026-07-10 FE-13 server
        # side; mirrors peers._peer_facts).
        MetricFact.provenance != "demo_fixture",
    ).subquery()
    rows = (await session.execute(
        select(MetricFact, Issuer)
        .join(Issuer, MetricFact.issuer_id == Issuer.id)
        .where(MetricFact.id.in_(select(win.c.fid).where(win.c.rn == 1)))
    )).all()
    out: Dict[str, dict] = {}
    for fact, iss in rows:
        out.setdefault(iss.id, {"issuer": iss, "m": {}})["m"][fact.metric_key] = fact.value
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

    # is_finite_number, not is-None: the store is write-gated finite, but this
    # consumer feeds median()/round()/a divide — a smuggled NaN would 500 every
    # /graph contagion request for all analysts (BE5-3 defense-in-depth).
    present = [v for _i, v, _h in rows if is_finite_number(v)]
    thresh = max(15.0, median(present)) if present else 15.0
    driver = "driver"
    nodes = [_node(driver, "Energy input cost ↑", "driver", 0.5, 0.12)]
    edges: List[dict] = []
    exposed = [(iss, v) for iss, v, h in rows if is_finite_number(v) and (v >= thresh or h)]
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


# ── Builder: shared theme (generic corpus co-mention overlay) ────────────────
async def _shared_theme(session: AsyncSession, theme: Optional[str], cap: dict) -> dict:
    """Issuers whose filings/memos co-mention an analyst-supplied ``theme``.

    Unlike ``_contagion`` (anchored on the ``energy_cost_pct`` fact + threshold),
    this overlay is anchored purely on BM25 corpus overlap, so *any* risk theme
    works — 'tariff exposure', 'refinancing wall', 'FX translation' — not just
    energy. Members are the distinct issuers with a corpus hit; the rest of the
    documented universe sits below as dim, un-linked context so the synthesis
    denominator reflects coverage, not just the matched set."""
    theme = (theme or "").strip()
    if not theme:
        return _empty(cap, "Shared-theme overlay",
                      "Supply a risk theme to overlay (e.g. 'tariff exposure', 'refinancing wall').")

    hits = await retrieve_corpus(session, theme, k=24)
    member_ids: List[str] = []
    seen = set()
    for h in hits:  # distinct issuers, best-BM25 order preserved
        if h.issuer_id not in seen:
            seen.add(h.issuer_id)
            member_ids.append(h.issuer_id)
    member_ids = member_ids[:12]  # keep the canvas legible
    if not member_ids:
        return _empty(cap, "Shared-theme overlay",
                      f"No issuer in the corpus co-mentions “{_clip(theme, 60)}”.")

    # Documented universe = issuers with any source doc (only they *can* co-mention).
    # ponytail: dim "others" unbounded; fine for the Phase-1 loans universe (dozens).
    # Cap + "+N more" summary node if the documented set ever reaches the hundreds.
    doc_ids = set((await session.execute(select(Document.issuer_id).distinct())).scalars())
    all_ids = list(dict.fromkeys(member_ids + [i for i in doc_ids if i not in seen]))
    issuers = {i.id: i for i in (await session.execute(
        select(Issuer).where(Issuer.id.in_(all_ids)))).scalars()}
    member_ids = [i for i in member_ids if i in issuers]
    other_ids = [i for i in doc_ids if i not in seen and i in issuers]

    driver = "theme"
    nodes = [_node(driver, _clip(theme, 40), "driver", 0.5, 0.12)]
    edges: List[dict] = []
    for iid, (x, y) in zip(member_ids, _spread(len(member_ids), y=0.45, x0=0.16, x1=0.84)):
        iss = issuers[iid]
        nodes.append(_node(iid, iss.name, "issuer", x, y, group=iss.industry,
                           exposed=True, sub="corpus co-mention"))
        edges.append(_edge(driver, iid, kind="driver"))
    for iid, (x, y) in zip(other_ids, _spread(len(other_ids), y=0.85, x0=0.16, x1=0.84)):
        nodes.append(_node(iid, issuers[iid].name, "issuer", x, y, dim=True, sub="no co-mention"))

    denom = len(member_ids) + len(other_ids)
    meta = [f"{len(member_ids)} of {denom} documented issuers co-mention the theme",
            f"theme: “{_clip(theme, 60)}”"]
    cav = ["Membership = BM25 corpus co-mention of the theme terms across filings / "
           "analyst memos — a shared-language overlay, not a modeled correlation."]
    return _result(cap, f"Shared theme — {_clip(theme, 40)}", nodes, edges, meta, cav)


def _spread(n: int, y: float, x0: float = 0.1, x1: float = 0.9) -> List[Tuple[float, float]]:
    if n <= 0:
        return []
    if n == 1:
        return [((x0 + x1) / 2, y)]
    step = (x1 - x0) / (n - 1)
    return [(x0 + i * step, y) for i in range(n)]


# ── Builder: concentration (clustered / scatter / rollup views) ──────────────
async def _concentration(session: AsyncSession, by: str, issuer_id: Optional[str], cap: dict) -> dict:  # noqa: C901  # pre-existing multi-view builder; split per-view when reworked
    if by in ("industry", "country"):
        return await _cluster_by_field(session, by, cap)
    if by == "rating":
        return await _rating_distribution(session, cap)
    if by == "portfolio":
        return await _portfolio_exposure(session, cap)
    if by == "wiki":
        return await _cluster_by_wiki(session, cap)
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
    if by == "covenant":
        return await _covenant_register(session, cap)
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
    covered |= set((await session.execute(select(Run.issuer_id).distinct())).scalars())
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
    # Only claim a single "largest" cluster when there is a strict maximum. On a
    # tie (e.g. four one-name sectors all at 25%) naming one "largest" is a false
    # superlative — mirror the client synthesis line and report the tie honestly.
    top_len = len(ordered[0][1])
    top_pct = round(100 * top_len / total)
    n_top = sum(1 for _, m in ordered if len(m) == top_len)
    if n_top == len(ordered):
        conc = f"evenly split — {top_pct}% each"
    elif n_top == 1:
        conc = f"{ordered[0][0]} = {top_pct}% (largest)"
    else:
        conc = f"{n_top} groups tied at {top_pct}%"
    meta = [f"{total} analyzed issuers", f"{len(ordered)} {field} groups", conc]
    cav = [f"Covered issuers only (≥1 fact or run). Grouped by {field}; >30% flags concentration."]
    return _result(cap, f"Concentration by {field}", nodes, edges, meta, cav)


async def _rating_distribution(session: AsyncSession, cap: dict) -> dict:
    """Cross-issuer rating distribution — issuers bucketed by agency rating
    (Moody's-preferred), mirroring the CP-6A exposure report's rating table.
    Ratings are collected off ingested holdings/market sheets (ratings.py), so
    this lights up the moment one rated sheet is uploaded — no run required. Emits
    the same sector-cluster / member-edge shape as _cluster_by_field so the client
    concentration synthesis reads it unchanged."""
    from ratings import rating_bucket, rating_index  # local: ratings.py has no engine deps

    issuers = (await session.execute(
        select(Issuer).where(or_(
            Issuer.rating_moody.isnot(None), Issuer.rating_sp.isnot(None),
            Issuer.rating_fitch.isnot(None))).limit(2000)
    )).scalars().all()
    if not issuers:
        return _empty(cap, "Rating distribution", "No agency ratings on file yet.")
    # Fixed senior→junior order so the register reads like a rating table.
    order = ["IG", "BB", "B", "CCC", "Unrated"]
    groups: Dict[str, List[Issuer]] = {}
    for iss in issuers:
        b = rating_bucket(rating_index(iss.rating_moody, iss.rating_sp, iss.rating_fitch))
        groups.setdefault(b, []).append(iss)
    ordered = [(b, groups[b]) for b in order if b in groups]
    centers = _grid_centers(len(ordered))
    nodes: List[dict] = []
    edges: List[dict] = []
    total = len(issuers)
    for (name, members), (cx, cy) in zip(ordered, centers):
        gid = f"grp:{name}"
        pct = round(100 * len(members) / total)
        nodes.append(_node(gid, f"{name} · {len(members)}", "sector", cx, cy,
                           group=name, sub=f"{pct}% of rated book",
                           flag=(name == "CCC") or None))
        for iss, (mx, my) in zip(members, _member_grid(cx, cy, len(members))):
            nodes.append(_node(iss.id, iss.name, "issuer", mx, my, group=name,
                               sub=iss.rating_moody or iss.rating_sp or iss.rating_fitch,
                               compact=True))
            edges.append(_edge(gid, iss.id, kind="member"))
    ccc = len(groups.get("CCC", []))
    meta = [f"{total} rated issuers", f"{len(ordered)} rating buckets",
            f"{ccc} in CCC/below" if ccc else "none in CCC/below"]
    cav = ["Bucketed by best available agency rating (Moody's-preferred); collected "
           "from ingested holdings/market sheets."]
    return _result(cap, "Rating distribution", nodes, edges, meta, cav)


async def _portfolio_exposure(session: AsyncSession, cap: dict) -> dict:
    """The CLO's sector concentration, computed from ingested holdings
    (engine/portfolio.py). Sector clusters (kind 'sector') with their obligors as
    members — the same shape as _cluster_by_field, so the client concentration
    synthesis reads it unchanged. >10% sectors flag (the typical single-sector cap)."""
    from engine.portfolio import compute_exposure

    rows = (await session.execute(select(PortfolioPosition).limit(5000))).scalars().all()
    if not rows:
        return _empty(cap, "Portfolio exposure", "No portfolio holdings ingested yet.")
    positions = [{"borrower_name": r.borrower_name, "issuer_id": r.issuer_id, "sector": r.sector,
                  "ranking": r.ranking, "rating_moody": r.rating_moody, "rating_sp": r.rating_sp,
                  "par_usd": r.par_usd, "price": r.price} for r in rows]
    ex = compute_exposure(positions)
    sectors = ex["sectors"][:20]  # top 20 by MV
    # obligor names per sector (distinct), for member dots under each cluster.
    per_sector: Dict[str, List[str]] = {}
    for r in rows:
        s = str(r.sector or "Unclassified")
        name = (r.borrower_name or "—")
        bucket = per_sector.setdefault(s, [])
        if name not in bucket:
            bucket.append(name)

    centers = _grid_centers(len(sectors))
    nodes: List[dict] = []
    edges: List[dict] = []
    for sec, (cx, cy) in zip(sectors, centers):
        name = sec["sector"]
        pct = sec["pct_nav"]
        gid = f"grp:{name}"
        nodes.append(_node(gid, f"{name} · {pct}%", "sector", cx, cy, group=name,
                           sub=f"{sec['n_obligors']} obligors", flag=(pct is not None and pct > 10) or None))
        members = per_sector.get(name, [])[:24]
        for oname, (mx, my) in zip(members, _member_grid(cx, cy, len(members))):
            oid = f"pos:{name}:{oname}"
            nodes.append(_node(oid, oname, "issuer", mx, my, group=name, compact=True))
            edges.append(_edge(gid, oid, kind="member"))
    top = sectors[0]
    meta = [f"${ex['total_nav']:,.0f} NAV · {ex['n_positions']} positions · {ex['n_obligors']} obligors",
            f"{len(sectors)} sectors shown",
            f"top: {top['sector']} {top['pct_nav']}%"]
    cav = ["Computed from ingested CLO holdings (%NAV by sector); >10% flags a single-sector-cap breach."]
    return _result(cap, "Portfolio exposure", nodes, edges, meta, cav)


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
                           group=iss.industry,
                           sub=f"net leverage {x:.1f}x · interest coverage {y:.1f}x"))
    # Axis names carry the metric range for immediate scale; the machine-readable
    # xdomain/ydomain lines let the scatter place real-value ticks (they don't
    # match the "x = "/"y = " axis-name filter, so they never render as labels).
    meta = [f"x = net leverage ({xlo:.1f}x → {xhi:.1f}x)",
            f"y = interest coverage ({ylo:.1f}x → {yhi:.1f}x)",
            f"{len(pts)} issuers",
            f"xdomain={xlo:.2f}|{xhi:.2f}", f"ydomain={ylo:.2f}|{yhi:.2f}"]
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
    # Same cross-issuer basis mix as peers/scatter — carry the same disclosure.
    return _result(cap, f"{tgt.name} percentile rank", nodes, edges, meta,
                   [_BASIS_CAVEAT, "p≤25 = bottom-quartile outlier."])


async def _trend(session: AsyncSession, cap: dict) -> dict:
    from engine.periods import sort_key
    # One winning fact per (issuer, metric, period) via a bounded window (mirrors the
    # collapse: run/fixture tier, newest created_at, id tiebreak) so re-runs of the same
    # period collapse deterministically and the read is issuers×metrics×periods, not ×runs.
    # No headline filter — a trend needs the prior (non-headline) periods too.
    tier = case((MetricFact.provenance.in_(DERIVED_PROVENANCE), 1), else_=0)
    win = select(
        MetricFact.id.label("fid"),
        func.row_number().over(
            partition_by=(MetricFact.issuer_id, MetricFact.metric_key, MetricFact.period),
            order_by=(tier.desc(), MetricFact.created_at.desc().nullslast(), MetricFact.id.desc()),
        ).label("rn"),
    ).where(
        MetricFact.metric_key.in_(("revenue", "adj_ebitda", "net_leverage")),
        # Same fabricated-fact exclusion as _profile_values (FE-13 server side).
        MetricFact.provenance != "demo_fixture",
    ).subquery()
    rows = (await session.execute(
        select(MetricFact, Issuer).join(Issuer, MetricFact.issuer_id == Issuer.id)
        .where(MetricFact.id.in_(select(win.c.fid).where(win.c.rn == 1)))
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
    # distinct (issuer, module): the by_issuer set-fold below dedups anyway, so push
    # DISTINCT to the DB — bounds the scan to issuers×modules, not O(runs×modules).
    rows = (await session.execute(
        select(Run.issuer_id, ModuleOutput.module_id)
        .join(ModuleOutput, ModuleOutput.run_id == Run.id)
        .distinct()
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
    # Distinct (committee_status, issuer): the board shows an issuer once per state it
    # has a run in — not once per run, which piled duplicate-id nodes on repeat issuers
    # and scanned the whole (append-only) Run history. DB DISTINCT bounds this to
    # states×issuers and fixes the duplicate-node id collision.
    rows = (await session.execute(
        select(Run.committee_status, Issuer.id, Issuer.name)
        .join(Issuer, Run.issuer_id == Issuer.id)
        .distinct()
    )).all()
    if not rows:
        return _empty(cap, "Committee-readiness", "No runs yet.")
    groups: Dict[str, List[Tuple[str, str]]] = {}
    for status, iid, name in rows:
        groups.setdefault(status or "Draft Only", []).append((iid, name))
    ordered = sorted(groups.items(), key=lambda kv: len(kv[1]), reverse=True)
    centers = _grid_centers(len(ordered))
    nodes, edges = [], []
    for (status, members), (cx, cy) in zip(ordered, centers):
        gid = f"cs:{status}"
        nodes.append(_node(gid, f"{status} · {len(members)}", "sector", cx, cy, group=status))
        for (iid, name), (mx, my) in zip(members, _member_grid(cx, cy, len(members))):
            nodes.append(_node(f"{gid}:{iid}", name, "issuer", mx, my, compact=True))
            edges.append(_edge(gid, f"{gid}:{iid}", kind="member"))
    meta = [f"{sum(len(m) for _s, m in ordered)} issuer-states", f"{len(ordered)} committee states"]
    return _result(cap, "Committee-readiness board", nodes, edges, meta, [])


_GATE_NODE_CAP = 300  # rollup graph, not a ledger — render the most-severe/newest slice


async def _gate_lane(session: AsyncSession, cap: dict) -> dict:
    total = int((await session.execute(select(func.count()).select_from(QAFinding))).scalar() or 0)
    if total == 0:
        return _empty(cap, "Gate-lane rollup", "No QA findings yet.")
    crit = int((await session.execute(
        select(func.count()).select_from(QAFinding).where(QAFinding.severity == "CRITICAL")
    )).scalar() or 0)
    # QAFinding grows O(modules×runs); a rollup past a few hundred nodes is both an
    # unreadable canvas and a huge payload. Render the most-severe, newest slice so a
    # cap never hides a CRITICAL behind newer MINORs; the full totals stay in meta.
    sev_rank = case(
        (QAFinding.severity == "CRITICAL", 0),
        (QAFinding.severity == "MATERIAL", 1),
        (QAFinding.severity == "MINOR", 2),
        else_=3,
    )
    rows = (await session.execute(
        select(QAFinding).order_by(sev_rank, QAFinding.id.desc()).limit(_GATE_NODE_CAP)
    )).scalars().all()
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
    shown = f" ({len(rows)} shown)" if len(rows) < total else ""
    meta = [f"{total} findings{shown}", f"{len(ordered)} CP-5 lanes", f"{crit} CRITICAL"]
    return _result(cap, "Gate findings by lane", nodes, edges, meta, [])


# ── Builder: cross-issuer registers (sponsor field, covenant CP-4C output) ───
async def _sponsor_graph(session: AsyncSession, cap: dict) -> dict:
    """Sponsor / counterparty graph over the analyst-entered ``Issuer.sponsor``
    field (mig 0018): each sponsor is a hub, the issuers it owns hang off it, so
    shared-sponsor concentration and a sponsor's track record read off one view.
    Only sponsor-owned names appear (NULL/blank sponsor = not sponsor-owned); a hub
    with >2 names flags a concentration edge. No ownership feed, so this is exactly
    as good as the analyst's tagging — stated in the caveat."""
    issuers = (await session.execute(
        select(Issuer).where(Issuer.sponsor.isnot(None), Issuer.sponsor != "")
    )).scalars().all()
    if not issuers:
        return _empty(cap, "Sponsor graph", "No sponsor-owned issuers in coverage.")
    groups: Dict[str, List[Issuer]] = {}
    for iss in issuers:
        groups.setdefault((iss.sponsor or "").strip(), []).append(iss)
    ordered = sorted(groups.items(), key=lambda kv: len(kv[1]), reverse=True)
    centers = _grid_centers(len(ordered))
    nodes: List[dict] = []
    edges: List[dict] = []
    for (sponsor, members), (cx, cy) in zip(ordered, centers):
        gid = f"sp:{sponsor}"
        nodes.append(_node(gid, f"{sponsor} · {len(members)}", "sector", cx, cy,
                           group=sponsor, sub="sponsor", flag=len(members) > 2 or None))
        for iss, (mx, my) in zip(members, _member_grid(cx, cy, len(members))):
            nodes.append(_node(iss.id, iss.name, "issuer", mx, my, group=sponsor, compact=True))
            edges.append(_edge(gid, iss.id, kind="member"))
    multi = sum(1 for _s, m in ordered if len(m) > 1)
    meta = [f"{len(issuers)} sponsor-owned issuers", f"{len(ordered)} sponsors",
            f"{multi} sponsor(s) with >1 name"]
    cav = ["Analyst-entered sponsor field (no ownership feed); >2 names flags concentration."]
    return _result(cap, "Sponsor / counterparty graph", nodes, edges, meta, cav)


# Latest-CP-4C-per-issuer read; bound the (append-only) module_output history scan.
_COVENANT_SCAN_CAP = 2000


async def _covenant_register(session: AsyncSession, cap: dict) -> dict:
    """Covenant register over the latest CP-4C output per issuer: clusters names by
    structure (maintenance leverage covenant vs cov-lite) and annotates each
    maintenance name with its threshold and turns of headroom, flagging thin
    cushions. Cov-lite is the leveraged-loan norm, not itself a flag — the risk
    signal is a maintenance name running thin headroom. Extraction-based, so the
    caveat states the basis."""
    rows = (await session.execute(
        select(ModuleOutput, Issuer.id, Issuer.name)
        .join(Run, Run.id == ModuleOutput.run_id)
        .join(Issuer, Issuer.id == Run.issuer_id)
        .where(ModuleOutput.module_id == "CP-4C")
        .order_by(ModuleOutput.created_at.desc())
        .limit(_COVENANT_SCAN_CAP)
    )).all()
    if not rows:
        return _empty(cap, "Covenant register", "No covenant analysis yet.")
    # Rows are newest-first → first sighting of an issuer is its latest CP-4C.
    latest: Dict[str, Tuple[ModuleOutput, str]] = {}
    for mo, iid, name in rows:
        latest.setdefault(iid, (mo, name))

    maint: List[Tuple] = []
    covlite: List[Tuple] = []
    thin = 0
    for iid, (mo, name) in latest.items():
        out = mo.runtime_output or {}
        lev_cov = out.get("leverage_covenant_x")
        cur = out.get("current_net_leverage")
        # Guard both CP-1-derived figures before subtracting: a NaN/inf leverage
        # would poison the headroom read and slip a false flag past `< 1.0`.
        if is_finite_number(lev_cov):
            head = round(lev_cov - cur, 2) if is_finite_number(cur) else None
            is_thin = head is not None and head < 1.0
            thin += 1 if is_thin else 0
            maint.append((iid, name, lev_cov, out.get("covenant_basis"), head, is_thin))
        else:
            covlite.append((iid, name))

    clusters: List[Tuple[str, List[Tuple]]] = []
    if maint:
        clusters.append(("Maintenance covenant", maint))
    if covlite:
        clusters.append(("Cov-lite", covlite))
    centers = _grid_centers(len(clusters))
    nodes: List[dict] = []
    edges: List[dict] = []
    for (label, members), (cx, cy) in zip(clusters, centers):
        gid = f"cov:{label}"
        nodes.append(_node(gid, f"{label} · {len(members)}", "sector", cx, cy, group=label))
        for member, (mx, my) in zip(members, _member_grid(cx, cy, len(members))):
            iid, name = member[0], member[1]
            if label == "Maintenance covenant":
                _iid, _name, lev_cov, basis, head, is_thin = member
                sub = f"{lev_cov:g}x cov" + (f" · {head:g}x headroom" if head is not None else "")
                nodes.append(_node(iid, name, "issuer", mx, my, group=label, compact=True,
                                   sub=sub, basis=basis, flag=is_thin or None,
                                   title=f"{name}: {lev_cov:g}x maintenance covenant"
                                         + (f", {head:g}x headroom" if head is not None else "")))
            else:
                nodes.append(_node(iid, name, "issuer", mx, my, group=label, compact=True,
                                   sub="cov-lite"))
            edges.append(_edge(gid, iid, kind="member"))
    meta = [f"{len(latest)} covenant-analyzed issuers",
            f"{len(maint)} maintenance · {len(covlite)} cov-lite",
            f"{thin} thin headroom (<1.0x)"]
    cav = ["Latest CP-4C per issuer; extraction-based (keyword scan of governing docs). "
           "Cov-lite is the loan-market norm — the flag is thin maintenance headroom."]
    return _result(cap, "Covenant register", nodes, edges, meta, cav)


# ── Builder: provenance (layered DAGs over a run) ────────────────────────────
async def _latest_run(session: AsyncSession, issuer_id: Optional[str],
                      prefer_claims: bool = False) -> Optional[Run]:
    """The most recent run that produced module outputs. When ``prefer_claims`` is
    set (trace / lineage / orphan), prefer one whose CP-1 actually carries claims —
    so the source-chain isn't empty just because the newest run had a thin CP-1.

    EXISTS subqueries, not a per-run COUNT loop: the old fallback scan issued up
    to 200 (400 with prefer_claims) sequential round trips per graph build when
    leading runs were thin. This is 1-2 queries regardless of history."""
    has_outputs = select(ModuleOutput.id).where(ModuleOutput.run_id == Run.id).exists()
    base = select(Run).where(has_outputs).order_by(Run.created_at.desc())
    if issuer_id:
        base = base.where(Run.issuer_id == issuer_id)
    if prefer_claims:
        cp1_has_claims = (
            select(Claim.id)
            .join(ModuleOutput, ModuleOutput.id == Claim.module_output_id)
            .where(ModuleOutput.run_id == Run.id, ModuleOutput.module_id == "CP-1")
            .exists()
        )
        preferred = (await session.execute(base.where(cp1_has_claims).limit(1))).scalars().first()
        if preferred is not None:
            return preferred
    return (await session.execute(base.limit(1))).scalars().first()


async def _modules(session: AsyncSession, run_id: str) -> List[ModuleOutput]:
    return list((await session.execute(
        select(ModuleOutput).where(ModuleOutput.run_id == run_id).order_by(ModuleOutput.created_at)
    )).scalars().all())


async def _provenance(session: AsyncSession, focus: str, issuer_id: Optional[str], cap: dict) -> dict:
    if focus == "sponsor":
        return await _sponsor_graph(session, cap)
    if focus == "memos":
        return await _analyst_memos(session, issuer_id, cap)
    run = await _latest_run(session, issuer_id, prefer_claims=focus in ("trace", "lineage", "orphan"))
    if run is None:
        return _empty(cap, "Provenance", "No completed run to traverse.")
    issuer = await session.get(Issuer, run.issuer_id)
    name = issuer.name if issuer else run.issuer_id
    mods = await _modules(session, run.id)

    from vault_export import spoke_title
    sp_title = spoke_title(name, {"id": run.id, "as_of_date": run.as_of_date})

    if focus in ("trace", "impact"):
        return await _dag(session, run, name, mods, focus, cap, sp_title)
    if focus in ("lineage", "orphan"):
        return await _claim_audit(session, run, name, mods, focus, cap, sp_title)
    if focus == "findings":
        return await _findings(session, run, name, cap, sp_title)
    if focus in ("debate", "tension"):
        return await _debate(name, mods, focus, cap, sp_title)
    return _empty(cap, "Provenance", f"unknown focus {focus!r}")


async def _dag(session: AsyncSession, run: Run, name: str, mods: List[ModuleOutput],  # noqa: C901
               focus: str, cap: dict, sp_title: str) -> dict:
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
                               confidence=m.confidence, run_spoke_title=sp_title))
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
        await _attach_source_chain(session, cp1.id, nodes, edges, sp_title)
    meta = [f"run: {name}", f"{len(present)} modules", f"{len(edges)} edges",
            "trace = dependencies" if focus == "trace" else "impact = downstream consumers"]
    title = f"{name} — conclusion lineage" if focus == "trace" else f"{name} — impact analysis"
    return _result(cap, title, nodes, edges, meta,
                   ["Every module→module edge is a stored dependency in the route plan."])


async def _attach_source_chain(session: AsyncSession, module_output_id: str,
                               nodes: List[dict], edges: List[dict], sp_title: str) -> None:
    claims = list((await session.execute(
        select(Claim).where(Claim.module_output_id == module_output_id).limit(2)
    )).scalars().all())
    yslot = 0.2
    for c in claims:
        cid = f"c:{c.id}"
        nodes.append(_node(cid, c.claim_id, "claim", 0.06, yslot, sub=_clip(c.claim_text), run_spoke_title=sp_title))
        edges.append(_edge(cid, "CP-1", kind="cite"))
        evs = list((await session.execute(
            select(EvidenceItem).where(EvidenceItem.claim_pk == c.id).limit(2)
        )).scalars().all())
        for k, e in enumerate(evs):
            eid = f"e:{e.id}"
            nodes.append(_node(eid, e.evidence_id, "evidence", 0.02, yslot + 0.08 + 0.05 * k,
                               sub=e.lineage_class, run_spoke_title=sp_title))
            edges.append(_edge(eid, cid, kind="cite"))
            if e.document_chunk_id:
                nodes.append(_node(f"ch:{e.document_chunk_id}", "source chunk", "chunk",
                                   0.0, yslot + 0.14 + 0.05 * k, chunk_id=e.document_chunk_id))
                edges.append(_edge(f"ch:{e.document_chunk_id}", eid, kind="cite"))
        yslot += 0.34


async def _claim_audit(session: AsyncSession, run: Run, name: str, mods: List[ModuleOutput],
                       focus: str, cap: dict, sp_title: str) -> dict:
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
                           sub=tag, title=_clip(c.claim_text), run_spoke_title=sp_title))
    meta = [f"run: {name}", f"{len(hits)} flagged claims", f"focus: {focus}"]
    cav = ["Weak = Untraced / Conflicting / Assumption-Based / Weak Lineage."
           if focus == "lineage" else "Ungrounded = no evidence resolves to an ingested chunk."]
    return _result(cap, title, nodes, edges, meta, cav)


async def _findings(session: AsyncSession, run: Run, name: str, cap: dict, sp_title: str) -> dict:
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
        nodes.append(_node(f"m:{mid}", mid, "module", x, y, run_spoke_title=sp_title))
        mod_xy[mid] = f"m:{mid}"
    fpos = _spread(len(rows), y=0.75, x0=0.12, x1=0.88)
    for f, (x, y) in zip(rows, fpos):
        fid = f"f:{f.id}"
        nodes.append(_node(fid, f.finding_id, sev_kind.get(f.severity, "finding-min"), x, y,
                           sub=f.severity, title=_clip(f.description), run_spoke_title=sp_title))
        if f.module_id and f.module_id in mod_xy:
            edges.append(_edge(mod_xy[f.module_id], fid, kind="finding"))
    crit = sum(1 for f in rows if f.severity == "CRITICAL")
    meta = [f"run: {name}", f"{len(rows)} findings", f"{crit} CRITICAL"]
    return _result(cap, f"{name} — open findings", nodes, edges, meta, [])


async def _debate(name: str, mods: List[ModuleOutput], focus: str, cap: dict, sp_title: str) -> dict:
    cp6 = next((m for m in mods if m.module_id == "CP-6A"), None)
    if cp6 is None:
        return _empty(cap, "Debate", "No IC debate (CP-6A) on this run.")
    rt = cp6.runtime_output or {}
    verdict = rt.get("verdict") or {}
    headline = verdict.get("lean") or verdict.get("sizing_posture") or "verdict"
    bull = (rt.get("bull_case") or {}).get("points") or []
    bear = (rt.get("bear_case") or {}).get("points") or []
    nodes = [_node("verdict", f"IC verdict: {headline}", "center", 0.5, 0.5, center=True,
                   sub=f"net score {verdict.get('net_score', '?')}", run_spoke_title=sp_title)]
    edges = []
    bpos = _spread(len(bull), y=0.16, x0=0.12, x1=0.88)
    for i, (p, (x, y)) in enumerate(zip(bull, bpos)):
        nid = f"bull:{i}"
        nodes.append(_node(nid, p.get("source", "bull"), "point-bull", x, y,
                           sub=_clip(p.get("point", "")), weight=p.get("weight"), run_spoke_title=sp_title))
        edges.append(_edge(nid, "verdict", kind="bull"))
    epos = _spread(len(bear), y=0.84, x0=0.12, x1=0.88)
    for i, (p, (x, y)) in enumerate(zip(bear, epos)):
        nid = f"bear:{i}"
        nodes.append(_node(nid, p.get("source", "bear"), "point-bear", x, y,
                           sub=_clip(p.get("point", "")), weight=p.get("weight"), run_spoke_title=sp_title))
        edges.append(_edge(nid, "verdict", kind="bear"))
    gu = verdict.get("greatest_uncertainty")
    meta = [f"run: {name}", f"{len(bull)} bull / {len(bear)} bear",
            f"greatest uncertainty: {_clip(gu, 60)}" if gu else "weighted by the IC chair"]
    title = f"{name} — bull vs bear" if focus == "tension" else f"{name} — debate digest"
    return _result(cap, title, nodes, edges, meta,
                   ["The chair verdict is a reproducible function of point weights, not a judgement."])


# Wiki graph bounds: the vault mirrors every run as a note, but the GRAPH is a
# structural overview, not a ledger — render the newest few spokes per issuer.
_WIKI_RUNS_PER_ISSUER = 2
_WIKI_RUN_CAP = 300  # same posture as _GATE_NODE_CAP


async def _cluster_by_wiki(session: AsyncSession, cap: dict) -> dict:
    covered = set((await session.execute(
        select(MetricFact.issuer_id).where(MetricFact.headline.is_(True))
    )).scalars())
    covered |= set((await session.execute(select(Run.issuer_id).distinct())).scalars())
    if not covered:
        return _empty(cap, "Wiki Graph", "No analyzed issuers to display in the wiki.")

    issuers = (await session.execute(
        select(Issuer).where(Issuer.id.in_(covered))
    )).scalars().all()

    # Run is append-only (never pruned), so an uncapped select here grows without
    # bound and every node lands in the overlay LLM prompt (BE5-1). Newest runs
    # per issuer via the same SQL window the fact reads use (rn ≤ per-issuer cap),
    # then a severity-neutral total cap; true totals stay in meta.
    win = select(
        Run.id.label("rid"),
        func.row_number().over(
            partition_by=Run.issuer_id,
            order_by=(Run.created_at.desc().nullslast(), Run.id.desc()),
        ).label("rn"),
    ).where(Run.issuer_id.in_(covered)).subquery()
    total_runs = int((await session.execute(
        select(func.count()).select_from(Run).where(Run.issuer_id.in_(covered))
    )).scalar() or 0)
    runs = (await session.execute(
        select(Run, Issuer).join(Issuer, Run.issuer_id == Issuer.id)
        .where(Run.id.in_(select(win.c.rid).where(win.c.rn <= _WIKI_RUNS_PER_ISSUER)))
        .order_by(Run.created_at.desc().nullslast(), Run.id.desc())
        .limit(_WIKI_RUN_CAP)
    )).all()

    nodes = []
    edges = []

    center_id = "wiki:center"
    nodes.append(_node(center_id, "Wiki Databank", "center", 0.5, 0.5))

    industries = sorted({iss.industry for iss in issuers if iss.industry})

    ind_pos = _radial_positions(len(industries), r=0.18)
    for ind, (x, y) in zip(industries, ind_pos):
        nid = f"ind:{ind}"
        nodes.append(_node(nid, ind, "sector", x, y, group=ind))
        edges.append(_edge(center_id, nid, kind="member"))

    iss_pos = _radial_positions(len(issuers), r=0.36)
    for i, (iss, (x, y)) in enumerate(zip(issuers, iss_pos)):
        nodes.append(_node(iss.id, iss.name, "issuer", x, y, group=iss.industry, sub=iss.industry))
        if iss.industry:
            edges.append(_edge(f"ind:{iss.industry}", iss.id, kind="member"))
        else:
            edges.append(_edge(center_id, iss.id, kind="member"))

    from vault_export import spoke_title
    # Anchor each run spoke just outside its issuer's ring position (was a fixed
    # (0.5, 0.5) — every run node stacked on the canvas centre); siblings step
    # further out so an issuer's newest-2 spokes never overlap.
    issuer_xy = {iss.id: xy for iss, xy in zip(issuers, iss_pos)}
    seen_per_issuer: Dict[str, int] = {}
    for run, issuer in runs:
        sp_title = spoke_title(issuer.name, {"id": run.id, "as_of_date": run.as_of_date})
        nid = f"run:{run.id}"
        label = f"Run {run.as_of_date or run.id[:8]}"
        j = seen_per_issuer.get(issuer.id, 0)
        seen_per_issuer[issuer.id] = j + 1
        ix, iy = issuer_xy.get(issuer.id, (0.5, 0.5))
        dx, dy = ix - 0.5, iy - 0.5
        norm = (dx * dx + dy * dy) ** 0.5 or 1.0
        reach = 0.52 + 0.07 * j
        rx = min(0.96, max(0.04, 0.5 + dx / norm * reach))
        ry = min(0.96, max(0.04, 0.5 + dy / norm * reach))
        nodes.append(_node(nid, label, "module", rx, ry, run_spoke_title=sp_title, sub=run.committee_status))
        edges.append(_edge(issuer.id, nid, kind="dep"))

    shown = f"{total_runs} runs" if total_runs == len(runs) else f"{total_runs} runs · showing newest {len(runs)}"
    meta = [f"{len(issuers)} issuers", shown, f"{len(industries)} sectors"]
    return _result(cap, "Wiki Knowledge Graph", nodes, edges, meta,
                   ["Traverses the derived wiki note structure. Issuers link to sectors, runs link to issuers."])


async def _analyst_memos(session: AsyncSession, issuer_id: Optional[str], cap: dict) -> dict:
    from database import AnalystLink, Issuer
    from pathlib import Path
    from urllib.parse import quote
    from config import get_settings

    if issuer_id:
        issuer = await session.get(Issuer, issuer_id)
    else:
        covered = set((await session.execute(
            select(MetricFact.issuer_id).where(MetricFact.headline.is_(True))
        )).scalars())
        if not covered:
            return _empty(cap, "Analyst memos", "No covered issuers.")
        issuer_id = sorted(covered)[0]
        issuer = await session.get(Issuer, issuer_id)

    if issuer is None:
        return _empty(cap, "Analyst memos", "Focus issuer not found.")

    links = (await session.execute(
        select(AnalystLink).where(AnalystLink.target_issuer_id == issuer.id)
    )).scalars().all()

    nodes = []
    edges = []

    nodes.append(_node(issuer.id, issuer.name, "center", 0.5, 0.5, group=issuer.industry, sub=issuer.industry))

    if not links:
        meta = [f"focus: {issuer.name}", "0 custom analyst memos"]
        return _result(cap, f"Analyst memos for {issuer.name}", nodes, edges, meta,
                       ["No analyst memos parsed for this issuer yet. Add Markdown links in the vault to link them."])

    pos = _radial_positions(len(links), r=0.28)
    settings = get_settings()
    v_name = settings.vault_name or (Path(settings.vault_export_dir).name if settings.vault_export_dir else "")

    for link, (x, y) in zip(links, pos):
        nid = f"memo:{link.id}"
        extra = {}
        if v_name:
            extra["obsidian_url"] = f"obsidian://open?vault={quote(v_name)}&file=Analyst-Memos%2F{quote(link.source_note)}"
        nodes.append(_node(nid, link.source_note, "claim", x, y, sub=_clip(link.excerpt, 60), **extra))
        edges.append(_edge(nid, issuer.id, kind="cite", label="mentions"))

    meta = [f"focus: {issuer.name}", f"{len(links)} custom memos"]
    return _result(cap, f"Analyst memos for {issuer.name}", nodes, edges, meta,
                   ["Drawn from analyst-written Markdown memos referencing this issuer in the vault."])


def _clip(text: Optional[str], n: int = 90) -> str:
    t = " ".join((text or "").split())
    return t if len(t) <= n else t[: n - 1].rstrip() + "…"


# ── Analyst-ratified links (Query phase 3) ───────────────────────────────────
async def _append_accepted_links(session: AsyncSession, graph: dict) -> dict:
    """Draw analyst-accepted issuer links on any graph carrying both endpoints.

    Accepted links are stored data (model-proposed, analyst-ratified — see
    ``QueryAcceptedLink``), so they belong in the deterministic payload: solid
    edge kind ``accepted``, present in table/CSV/print. A caveat line keeps the
    provenance honest on the exhibit itself."""
    from database import QueryAcceptedLink

    node_ids = {n["id"] for n in graph.get("nodes", [])}
    if len(node_ids) < 2:
        return graph
    rows = (await session.execute(select(QueryAcceptedLink))).scalars().all()
    existing = {frozenset((e["source"], e["target"])) for e in graph.get("edges", [])}
    drawn = 0
    for r in rows:
        pair = frozenset((r.issuer_a, r.issuer_b))
        if r.issuer_a not in node_ids or r.issuer_b not in node_ids or pair in existing:
            continue
        graph["edges"].append({
            "source": r.issuer_a, "target": r.issuer_b, "kind": "accepted",
            "label": "accepted",
        })
        existing.add(pair)
        drawn += 1
    if drawn:
        graph["caveats"] = list(graph.get("caveats", [])) + [
            f"{drawn} analyst-accepted link{'s' if drawn != 1 else ''} drawn — "
            "model-proposed, analyst-ratified (see Query overlay)."
        ]
    return graph


# ── Dispatch ─────────────────────────────────────────────────────────────────
async def build_graph(session: AsyncSession, capability_id: str,
                      issuer_id: Optional[str] = None,
                      theme: Optional[str] = None) -> dict:
    cap = CAP_BY_ID.get(capability_id)
    if cap is None:
        raise KeyError(capability_id)
    mode = cap["mode"]
    if mode == "peers":
        graph = await _peers(session, issuer_id, cap)
    elif mode == "contagion":
        # Two overlays share the render mode but not the anchor: shared-theme is
        # a generic corpus co-mention driven by the analyst's ``theme``; contagion
        # stays the energy-fact overlay and ignores any supplied theme.
        if capability_id == "shared-theme":
            graph = await _shared_theme(session, theme or cap["params"].get("theme"), cap)
        else:
            graph = await _contagion(session, cap["params"].get("theme"), cap)
    elif mode == "concentration":
        graph = await _concentration(session, cap["params"].get("by", "industry"), issuer_id, cap)
    elif mode == "provenance":
        graph = await _provenance(session, cap["params"].get("focus", "trace"), issuer_id, cap)
    else:
        raise ValueError(f"unknown mode {mode!r}")
    return await _append_accepted_links(session, graph)


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
          len({c['mode'] for c in CAP_BY_ID.values()}), "render modes")
