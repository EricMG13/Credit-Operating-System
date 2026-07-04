"""Desk Brief — the proactive AI-research lane for the Query concept (Q1).

The analyst opens Query and is greeted by a set of cited, AI-written insight
cards generated from *what changed in the book* — no prompting required. This is
the "where is the AI-generated research" answer: an LLM writes desk-note prose,
but every card is grounded in a deterministic evidence pack and any card that
cites nothing real — or states a number not in its cited evidence — is DROPPED,
not shown.

Shape mirrors the overlay lane (engine/queryoverlay.py):

    deterministic evidence pack (bounded reads, stable ids)
      → one LLM call (no tools; pack wrapped as untrusted content)
      → closed-set validator (unknown ids / ungrounded numbers dropped)
      → persisted artifact (model + fingerprint + payload, cached)
      → rendered with AI-GENERATED marking on the client

Fault isolation: the endpoint always returns instantly (the persisted brief, or
deterministic highlights when there is no brief yet); regeneration is a
background single-flight task, and any failure leaves the previous brief served.
Keyless deploys never call the model — `available()` is False and the client
hides the panel. Spend is bounded to ≤1 call/24h/book: regeneration needs BOTH a
changed data fingerprint AND a >24h-old brief (or an explicit force), so a
run-burst day cannot multiply cost.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import (
    AsyncSessionLocal,
    Document,
    Issuer,
    MetricFact,
    QAFinding,
    QueryAcceptedLink,
    QueryInsight,
    Run,
)
from engine import llm_client, presets, querygraph
from engine.grounding import all_grounded
from engine.llm_safety import UNTRUSTED_RULE, loads_finite, wrap_untrusted

logger = logging.getLogger("caos")

_MAX_CARDS = 8
_FINDING_SAMPLE = 8
_SCAN_CAP = 2000  # bound every pack read (query-path P4 discipline, single process)
_STALE_AFTER = timedelta(hours=24)

# The KPIs whose run-over-run move is the core "what changed" signal, with the
# label + unit used to format a delta the model reads and may cite.
_DELTAS = {
    "net_leverage": ("leverage", "x"),
    "interest_coverage": ("coverage", "x"),
    "ebitda_margin": ("EBITDA margin", "%"),
}
_SEV_RANK = {"CRITICAL": 0, "MATERIAL": 1, "MINOR": 2}


def available() -> bool:
    """True when some provider key exists — mirrors queryoverlay.available()."""
    from config import get_settings

    s = get_settings()
    return bool(s.anthropic_api_key or s.openrouter_api_key or s.gemini_api_key)


def _client():
    import anthropic

    from config import get_settings

    s = get_settings()
    return anthropic.AsyncAnthropic(api_key=s.anthropic_api_key, timeout=s.caos_llm_timeout_s)


def _first_json(text: str) -> dict:
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        raise ValueError("model reply contained no JSON object")
    parsed = loads_finite(m.group(0))
    if not isinstance(parsed, dict):
        raise ValueError("model reply was not a JSON object")
    return parsed


def _text_of(resp) -> str:
    return next((b.text for b in resp.content if getattr(b, "type", "") == "text"), "")


# ── Evidence pack (deterministic reads, stable ids) ──────────────────────────

@dataclass
class PackEntry:
    """One grounded signal the model may cite. ``numbers`` is the closed set of
    figures a citing card is allowed to state; ``chunk_id`` (when set) resolves in
    the existing citation viewer, else the card deep-links ``walk``."""

    id: str
    kind: str  # delta | finding | coverage | docs
    label: str
    text: str
    numbers: List[float] = field(default_factory=list)
    issuer_id: Optional[str] = None
    walk: Optional[str] = None
    chunk_id: Optional[str] = None


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


async def _delta_entries(db: AsyncSession) -> List[PackEntry]:
    """Run-over-run KPI moves: latest vs prior complete-run headline value."""
    rows = (await db.execute(
        select(
            MetricFact.issuer_id, MetricFact.metric_key, MetricFact.value, MetricFact.unit,
            Run.created_at, Issuer.name, MetricFact.document_chunk_id,
        )
        .join(Run, Run.id == MetricFact.run_id)
        .join(Issuer, Issuer.id == MetricFact.issuer_id)
        .where(
            MetricFact.headline.is_(True),
            MetricFact.metric_key.in_(list(_DELTAS)),
            MetricFact.provenance == "run",
            Run.status == "complete",
        )
        .order_by(MetricFact.issuer_id, MetricFact.metric_key, Run.created_at.desc())
        .limit(_SCAN_CAP)
    )).all()

    # Group preserving the created_at-desc order; the first two rows of a group
    # are the latest and prior complete-run values.
    grouped: dict = {}
    for iid, key, value, unit, _created, name, chunk_id in rows:
        grouped.setdefault((iid, key), []).append((value, unit, name, chunk_id))

    entries: List[PackEntry] = []
    walk = "metric-trend" if await _walk_enabled(db, "metric-trend") else (
        "scatter" if await _walk_enabled(db, "scatter") else None)
    for (iid, key), vals in grouped.items():
        if len(vals) < 2:
            continue
        (latest, unit, name, chunk_id), (prior, *_rest) = vals[0], vals[1]
        delta = round(latest - prior, 1)
        if delta == 0:
            continue
        label_key, u = _DELTAS[key]
        sign = "+" if delta > 0 else "−"
        text = (f"{name}: {label_key} {prior:.1f}{u} → {latest:.1f}{u} "
                f"({sign}{abs(delta):.1f}{u} vs prior run)")
        entries.append(PackEntry(
            id=f"delta:{iid}:{key}", kind="delta", label=f"{name} {label_key}",
            text=text, numbers=[round(prior, 1), round(latest, 1), abs(delta)],
            issuer_id=iid, walk=walk, chunk_id=chunk_id,
        ))
    # Biggest absolute moves first — the signal a PM wants at open.
    entries.sort(key=lambda e: -abs(e.numbers[2]))
    return entries[:_SCAN_CAP]


async def _finding_entries(db: AsyncSession) -> List[PackEntry]:
    rows = (await db.execute(
        select(QAFinding, Issuer.name)
        .join(Run, Run.id == QAFinding.run_id)
        .join(Issuer, Issuer.id == Run.issuer_id)
        .where(Run.status == "complete")
        .order_by(Run.created_at.desc())
        .limit(_SCAN_CAP)
    )).all()
    ranked = sorted(rows, key=lambda r: _SEV_RANK.get((r[0].severity or "").upper(), 3))
    walk = "open-findings" if await _walk_enabled(db, "open-findings") else None
    out: List[PackEntry] = []
    for finding, name in ranked[:_FINDING_SAMPLE]:
        desc = (finding.description or "").strip().replace("\n", " ")[:160]
        out.append(PackEntry(
            id=f"f:{finding.id}", kind="finding",
            label=f"{name} · {finding.finding_id} ({finding.severity})",
            text=f"{name}: {finding.severity} QA finding {finding.finding_id} — {desc}",
            numbers=[], issuer_id=None, walk=walk, chunk_id=f"f:{finding.id}",
        ))
    return out


async def _context_entries(db: AsyncSession) -> List[PackEntry]:
    async def count(stmt) -> int:
        return int((await db.execute(stmt)).scalar() or 0)

    issuers = await count(select(func.count()).select_from(Issuer))
    complete = await count(
        select(func.count(func.distinct(Run.issuer_id))).where(Run.status == "complete"))
    docs = await count(select(func.count()).select_from(Document))
    crit = await count(select(func.count()).select_from(QAFinding).where(
        func.upper(QAFinding.severity) == "CRITICAL"))
    entries = [PackEntry(
        id="coverage", kind="coverage", label="Coverage",
        text=f"Coverage: {issuers} issuers, {complete} with a complete run, "
             f"{docs} source documents, {crit} critical QA findings open.",
        numbers=[issuers, complete, docs, crit], walk="coverage-completeness",
    )]
    recent = (await db.execute(
        select(Document.file_name).order_by(Document.uploaded_at.desc()).limit(3)
    )).scalars().all()
    if recent:
        names = ", ".join((n or "")[:60] for n in recent)
        entries.append(PackEntry(
            id="docs", kind="docs", label="Recent documents",
            text=f"Most recently ingested source documents: {names}.",
            numbers=[], walk=None,
        ))
    return entries


async def _walk_enabled(db: AsyncSession, cap_id: str) -> bool:
    caps = await querygraph.capabilities(db)
    for g in caps["groups"]:
        for c in g["capabilities"]:
            if c["id"] == cap_id:
                return bool(c["enabled"])
    return False


async def build_pack(db: AsyncSession) -> List[PackEntry]:
    """The deterministic evidence pack — every entry carries a stable id, the
    numbers a citing card may state, and a click-through (chunk or walk)."""
    deltas = await _delta_entries(db)
    findings = await _finding_entries(db)
    context = await _context_entries(db)
    return deltas + findings + context


async def fingerprint(db: AsyncSession) -> str:
    """Cheap hash over the book's shape. Unchanged book → identical fingerprint →
    no regeneration spend."""
    async def count(stmt) -> int:
        return int((await db.execute(stmt)).scalar() or 0)

    latest = (await db.execute(
        select(Run.id).where(Run.status == "complete").order_by(Run.created_at.desc()).limit(1)
    )).scalar()
    basis = {
        "issuers": await count(select(func.count()).select_from(Issuer)),
        "runs": await count(select(func.count()).select_from(Run).where(Run.status == "complete")),
        "docs": await count(select(func.count()).select_from(Document)),
        "findings": await count(select(func.count()).select_from(QAFinding)),
        "links": await count(select(func.count()).select_from(QueryAcceptedLink)),
        "latest": latest or "",
    }
    return hashlib.sha256(json.dumps(basis, sort_keys=True).encode()).hexdigest()


# ── Generation (LLM) + validator ─────────────────────────────────────────────

_SYSTEM = (
    "You are the Desk Brief lane on an institutional leveraged-finance credit "
    "platform. The PACK below is engine-derived signals from the coverage "
    f"database. {UNTRUSTED_RULE}\n\n"
    "Write 3 to 8 short insight cards a credit PM would want the moment they open "
    "the desk — what moved, what is flagged, where the book is concentrated. Each "
    "card is a terse headline (at most 12 words) plus a 1-2 sentence detail.\n\n"
    "HARD GROUNDING RULES (a card that breaks any of these is discarded):\n"
    "1. Every card MUST cite at least one PACK entry id in evidence_ids.\n"
    "2. NEVER state a figure that is not present in a cited entry. Prefer words to "
    "numbers; if unsure, omit the number. An ungrounded number discards the card.\n"
    "3. Do not invent issuers, moves, or findings not in the PACK.\n"
    "4. Optionally set walk to one id from WALKS to deep-link the relevant view.\n\n"
    "Be terse — a truncated reply is discarded. Reply with ONLY JSON:\n"
    '{"cards": [{"headline": "...", "detail": "...", '
    '"evidence_ids": ["..."], "walk": "<capability id or omit>"}]}'
)


def _validate(reply: dict, pack: List[PackEntry], enabled_walks: set) -> List[dict]:
    """The grounding gate: keep only cards that cite a real pack entry and whose
    every stated number is grounded in the cited entries. Ungrounded → dropped."""
    by_id = {e.id: e for e in pack}
    cards_in = reply.get("cards") if isinstance(reply, dict) else None
    if not isinstance(cards_in, list):
        return []
    out: List[dict] = []
    for i, card in enumerate(cards_in):
        if not isinstance(card, dict):
            continue
        headline = str(card.get("headline", "")).strip()[:160]
        detail = str(card.get("detail", "")).strip()[:400]
        if not headline:
            continue
        cited = [by_id[c] for c in (card.get("evidence_ids") or []) if c in by_id]
        if not cited:
            continue  # cites nothing real — dropped, never shown
        # Ground ONLY against each entry's curated `numbers` — the explicit closed
        # set of figures that entry authorizes. Deliberately NOT the entry's free
        # `text`: scanning that would let a card ground a financial claim off an
        # incidental numeral (a filename year, a finding id) that is not a figure.
        # delta/coverage carry their real numbers here; finding/docs carry [] and
        # are therefore word-only (a numeric claim citing only them fails closed).
        pool: list = []
        for e in cited:
            pool.extend(e.numbers)
        if not all_grounded(f"{headline} {detail}", pool):
            continue  # states a figure no cited entry supports — dropped
        walk = card.get("walk")
        if walk not in enabled_walks:
            walk = next((e.walk for e in cited if e.walk in enabled_walks), None)
        issuer_id = next((e.issuer_id for e in cited if e.issuer_id), None)
        out.append({
            "id": f"c{i}", "headline": headline, "detail": detail, "walk": walk,
            "issuer_id": issuer_id,
            "evidence": [{"id": e.id, "label": e.label, "chunk_id": e.chunk_id} for e in cited],
        })
        if len(out) >= _MAX_CARDS:
            break
    return out


def _deterministic_cards(pack: List[PackEntry]) -> List[dict]:
    """The always-honest fallback: highlight cards built straight from the pack, no
    LLM. Used when the model lane is absent or returned nothing groundable."""
    out: List[dict] = []
    for e in pack:
        if e.kind not in ("delta", "coverage"):
            continue
        out.append({
            "id": f"d{len(out)}", "headline": e.label, "detail": e.text,
            "walk": e.walk, "issuer_id": e.issuer_id,
            "evidence": [{"id": e.id, "label": e.label, "chunk_id": e.chunk_id}],
        })
        if len(out) >= 5:
            break
    return out


async def _generate(db: AsyncSession, pack: List[PackEntry]) -> tuple[List[dict], Optional[str], bool]:
    """Run the LLM over the pack and validate. Returns (cards, model, degraded).
    Any LLM/parse failure raises — the caller logs and keeps the prior brief."""
    caps = await querygraph.capabilities(db)
    flat = [c for g in caps["groups"] for c in g["capabilities"]]
    enabled_walks = {c["id"] for c in flat if c["enabled"]}
    walks_for_prompt = [{"id": c["id"], "label": c["label"]} for c in flat if c["enabled"]]

    slim = [{"id": e.id, "kind": e.kind, "text": e.text} for e in pack]
    system = (
        f"{_SYSTEM}\n\nWALKS:\n{json.dumps(walks_for_prompt, ensure_ascii=False)}"
    )
    resp = await llm_client.create(
        _client(),
        lane="query-insights",
        model=presets.model_for(presets.HEAVY),
        effort=presets.effort_for(presets.HEAVY),
        max_tokens=2000,
        system=system,
        messages=[{"role": "user", "content": f"PACK:\n{wrap_untrusted(json.dumps(slim, ensure_ascii=False))}"}],
    )
    reply = _first_json(_text_of(resp))
    cards = _validate(reply, pack, enabled_walks)
    if cards:
        model = str(getattr(resp, "model", None) or presets.model_for(presets.HEAVY))
        return cards, model, False
    # Model produced nothing groundable — degrade rather than show a blank panel.
    return _deterministic_cards(pack), None, True


async def _regenerate(db: AsyncSession, analyst_id: Optional[str]) -> dict:
    """Build → generate → validate → persist one brief. Returns its payload."""
    pack = await build_pack(db)
    fp = await fingerprint(db)
    model: Optional[str] = None
    if not pack:
        payload = {"cards": [], "degraded": True,
                   "generated_reason": "No coverage data yet.", "data_fingerprint": fp}
    else:
        cards, model, degraded = await _generate(db, pack)
        payload = {
            "cards": cards, "degraded": degraded, "data_fingerprint": fp,
            "generated_reason": ("Deterministic highlights — the model lane returned "
                                 "nothing groundable." if degraded else "AI desk brief."),
        }
    row = QueryInsight(data_fingerprint=fp, model=model, payload=payload, analyst_id=analyst_id)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _served(row, refreshing=False)


def _served(row: QueryInsight, refreshing: bool) -> dict:
    return {
        **row.payload,
        "model": row.model,
        "generated_at": row.generated_at.isoformat() if row.generated_at else None,
        "cached": True,
        "refreshing": refreshing,
        "available": available(),
    }


def _stale(row: QueryInsight) -> bool:
    gen = _aware(row.generated_at)
    if gen is None:
        return True
    return (datetime.now(timezone.utc) - gen) > _STALE_AFTER


# ── Single-flight background regeneration ────────────────────────────────────
# ponytail: a module-level flag is the single-flight lock — correct under the
# Phase-1 single-uvicorn-worker assumption (same as create-run's asyncio.Lock and
# the rate limiter). Phase-2 multi-worker needs a DB advisory lock; recorded, not
# built here.
_regen_inflight = False
_regen_tasks: set = set()


def _ensure_regen(analyst_id: Optional[str]) -> None:
    global _regen_inflight
    if _regen_inflight:
        return
    _regen_inflight = True  # set before await-free create_task → no interleave race

    async def _task() -> None:
        global _regen_inflight
        try:
            async with AsyncSessionLocal() as db:
                await _regenerate(db, analyst_id)
        except Exception as e:  # noqa: BLE001 — fault-isolated: keep the prior brief
            logger.warning("query-insights regeneration failed: %s", e)
        finally:
            _regen_inflight = False

    t = asyncio.create_task(_task())
    _regen_tasks.add(t)  # keep a ref so the loop can't GC the task mid-flight
    t.add_done_callback(_regen_tasks.discard)


async def insights(db: AsyncSession, *, force: bool = False, analyst_id: Optional[str] = None) -> dict:
    """The Desk Brief endpoint's core: return a brief instantly, regenerate in the
    background when warranted. Never blocks on the LLM; never fabricates."""
    fp = await fingerprint(db)
    row = (await db.execute(
        select(QueryInsight).order_by(QueryInsight.generated_at.desc()).limit(1)
    )).scalars().first()

    if row is not None and row.data_fingerprint == fp and not _stale(row) and not force:
        return _served(row, refreshing=False)

    # Regenerate only when the model lane exists AND (forced, or no brief, or the
    # book changed AND the brief is >24h old) — the both-conditions rule bounds
    # spend on a run-burst day (RT-2026-07-04-05).
    should_regen = available() and (
        force or row is None or (fp != row.data_fingerprint and _stale(row))
    )
    if should_regen:
        _ensure_regen(analyst_id)
        if row is not None:
            return _served(row, refreshing=True)
        # No brief yet: serve deterministic highlights now; the poll picks up the
        # AI brief when the background task lands.
        pack = await build_pack(db)
        return {
            "cards": _deterministic_cards(pack), "degraded": True,
            "generated_reason": "Building the AI desk brief…", "data_fingerprint": fp,
            "model": None, "generated_at": None, "cached": False,
            "refreshing": True, "available": True,
        }

    if row is not None:
        return _served(row, refreshing=False)

    # Keyless / no data: deterministic highlights (the client hides the panel when
    # the model lane is unavailable, so this is a safety net, not a normal path).
    pack = await build_pack(db)
    return {
        "cards": _deterministic_cards(pack), "degraded": True,
        "generated_reason": ("Model lane unavailable — deterministic highlights."
                             if not available() else "No coverage data yet."),
        "data_fingerprint": fp, "model": None, "generated_at": None,
        "cached": False, "refreshing": False, "available": available(),
    }
