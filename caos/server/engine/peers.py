"""CP-1C PeerBenchmark — where the issuer sits vs its peers.

Cross-sectional comparison of the issuer's headline credit metrics against peers
drawn from the ``metric_facts`` store: same-industry peers when there are at
least two, otherwise the full coverage universe (noted). For each metric it
reports the peer median, the issuer's percentile (respecting the metric's
polarity), and flags the metrics where the issuer is a bottom-quartile outlier —
emitting an informational CP-5 finding when so.

Deterministic, computed from the curated store + the issuer's own CP-1 values.
Bases can differ (EDGAR reported vs modeled adjusted) — flagged, like the NL query.
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import Issuer, MetricFact
from engine.gate import Finding
from engine.metrics import CATALOG_BY_KEY
from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload

# Headline metrics worth a peer read (those CP-1 / distress produce).
_BENCH = ("net_leverage", "interest_coverage", "ebitda_margin", "altman_z")
_WORST_QUARTILE = 25  # percentile at/below this = bottom-quartile outlier


def _year(period: str) -> int:
    nums = re.findall(r"\d{2,4}", period or "")
    return int(nums[-1]) if nums else -1


def _median(vals: List[float]) -> float:
    s = sorted(vals)
    n = len(s)
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2


def _percentile(iv: float, peer_vals: List[float], higher_is_better: bool) -> int:
    """% of peers the issuer is at least as good as, respecting the metric's
    polarity (for leverage, lower is better)."""
    better = (sum(1 for pv in peer_vals if iv >= pv) if higher_is_better
              else sum(1 for pv in peer_vals if iv <= pv))
    return round(100 * better / len(peer_vals))


def _own_values(cp1: ModulePayload) -> Dict[str, float]:
    nf = (cp1.runtime_output or {}).get("normalized_financials") or {}
    out: Dict[str, float] = {}
    for k, v in (("net_leverage", nf.get("net_leverage_adj_ltm")),
                 ("interest_coverage", nf.get("interest_coverage_ltm")),
                 ("altman_z", (cp1.runtime_output or {}).get("distress", {}).get("altman_z"))):
        if isinstance(v, (int, float)):
            out[k] = float(v)
    rev, eb = nf.get("revenue") or {}, nf.get("adj_ebitda") or {}
    common = [p for p in rev if p in eb and rev[p]]
    if common:
        p = max(common, key=_year)
        out["ebitda_margin"] = round(100 * eb[p] / rev[p], 1)
    return out


async def _peer_facts(
    session: AsyncSession, issuer: Issuer, keys: List[str], same_industry: bool
) -> Dict[str, List[Tuple[str, float]]]:
    """{metric_key: [(peer_issuer_id, value)]} for headline facts, latest-per-issuer
    (run over seed, then most recent), excluding the issuer itself."""
    stmt = (
        select(MetricFact, Issuer)
        .join(Issuer, MetricFact.issuer_id == Issuer.id)
        .where(MetricFact.headline.is_(True), MetricFact.metric_key.in_(keys),
               MetricFact.issuer_id != issuer.id)
    )
    if same_industry and issuer.industry:
        stmt = stmt.where(Issuer.industry == issuer.industry)
    rows = (await session.execute(stmt)).all()

    best: Dict[Tuple[str, str], MetricFact] = {}
    for fact, _iss in rows:
        key = (fact.issuer_id, fact.metric_key)
        cur = best.get(key)
        better = (cur is None
                  or (fact.provenance == "run" and cur.provenance != "run")
                  or (fact.provenance == cur.provenance and fact.created_at and cur.created_at
                      and fact.created_at > cur.created_at))
        if better:
            best[key] = fact
    out: Dict[str, List[Tuple[str, float]]] = {k: [] for k in keys}
    for (iid, mk), fact in best.items():
        out[mk].append((iid, fact.value))
    return out


async def synthesize_peer_benchmark(
    session: AsyncSession, issuer: Issuer, cp1: ModulePayload
) -> ModulePayload:
    own = _own_values(cp1)
    keys = [k for k in _BENCH if k in own]
    if not keys:
        return _insufficient("CP-1 produced no headline metrics to benchmark.")

    peers = await _peer_facts(session, issuer, keys, same_industry=True)
    scope = f"{issuer.industry} peers" if issuer.industry else "peers"
    distinct = {iid for vs in peers.values() for iid, _ in vs}
    if len(distinct) < 2:  # fall back to the whole book when the sector is thin
        peers = await _peer_facts(session, issuer, keys, same_industry=False)
        scope = "coverage universe (no same-sector peers in coverage)"
        distinct = {iid for vs in peers.values() for iid, _ in vs}
    if not distinct:
        return _insufficient("No peers with comparable metrics in coverage.")

    comparisons: List[dict] = []
    outliers: List[str] = []
    for mk in keys:
        peer_vals = [v for _iid, v in peers.get(mk, [])]
        if not peer_vals:
            continue
        md = CATALOG_BY_KEY[mk]
        iv = own[mk]
        percentile = _percentile(iv, peer_vals, md.higher_is_better)
        flag = percentile <= _WORST_QUARTILE
        comparisons.append({
            "metric": mk, "label": md.label, "unit": md.unit, "issuer_value": iv,
            "peer_median": round(_median(peer_vals), 2), "peer_count": len(peer_vals),
            "percentile": percentile, "higher_is_better": md.higher_is_better, "outlier": flag,
        })
        if flag:
            outliers.append(md.label)

    runtime = {
        "peer_scope": scope, "peer_count": len(distinct),
        "comparisons": comparisons, "outlier_metrics": outliers,
        "basis_note": "Leverage/EBITDA may mix reported (EDGAR) and adjusted bases across peers.",
    }
    confidence = "High" if len(distinct) >= 3 else "Medium"
    standing = (f"a bottom-quartile outlier on {', '.join(outliers)}" if outliers
                else "broadly in line with peers")
    return ModulePayload(
        module_id="CP-1C", module_name="PeerBenchmark", owned_object="peer_benchmark",
        runtime_output=runtime, confidence=confidence,
        downstream_consumers=["CP-2", "CP-3"],
        claims=[ClaimSpec(
            claim_id="C-PEER1",
            claim_text=(f"Against {scope} ({len(distinct)} peers), the issuer is {standing}."),
            evidence=[EvidenceSpec("E-PEER1", "upstream_artifact", "Calculated",
                                   "Cross-issuer metric store (CP-1 headline metrics vs peers)",
                                   "Medium")],
        )],
    )


def _insufficient(reason: str) -> ModulePayload:
    return ModulePayload(
        module_id="CP-1C", module_name="PeerBenchmark", owned_object="peer_benchmark",
        runtime_output={"comparisons": [], "note": reason},
        confidence="Insufficient Information", limitation_flags=[reason],
        downstream_consumers=["CP-2", "CP-3"],
    )


def peer_outlier_finding(cp1c: Optional[ModulePayload]) -> Optional[Finding]:
    """A MINOR (informational) finding when the issuer is a bottom-quartile peer
    outlier on one or more metrics."""
    if cp1c is None:
        return None
    outliers = (cp1c.runtime_output or {}).get("outlier_metrics") or []
    if not outliers:
        return None
    scope = (cp1c.runtime_output or {}).get("peer_scope", "peers")
    return Finding(
        finding_id="CP-1C-PEER", severity="MINOR", lane=2, module_id="CP-1C",
        affected_claim_id="C-PEER1",
        description=f"Bottom-quartile vs {scope} on: {', '.join(outliers)}. Weight the relative positioning.",
        required_remediation="Confirm peer set and whether the gap is structural or cyclical.",
    )
