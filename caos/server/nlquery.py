"""Natural-language cross-issuer query over the curated metric store.

A question becomes a **constrained QuerySpec** (the model fills a closed schema —
it never authors SQL) which is validated against the metric dictionary and turned
into a parameterized query over ``metric_facts``. Two translators behind one
interface, mirroring the demo-mode pattern elsewhere ([llm.py], synth.py):

  - ``_demo_translate`` — a deterministic keyword mapper used when no model key
    is configured, so the feature is fully demoable offline. Handles the canonical
    example ("…margins most exposed to higher inflation in energy prices").
  - ``_llm_translate`` — Claude fills the QuerySpec, grounded in the catalog.

``execute`` ranks issuers on the chosen metric (honoring its polarity), attaching
each value's citation, QA status, and provenance (run-derived vs seeded).
"""

from __future__ import annotations

import json
import logging
import re
from typing import Dict, List, Literal, Optional, Tuple, Union

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from database import Issuer, MetricFact
from engine.metrics import CATALOG_BY_KEY, MetricDef, catalog_dicts
from retrieval import retrieve_corpus

logger = logging.getLogger("caos.nlquery")

_FILTER_FIELDS = {"industry", "country"}
_FILTER_OPS = {"=", ">", ">=", "<", "<=", "ilike"}
_MAX_LIMIT = 50


class Filter(BaseModel):
    field: str           # an issuer field (industry|country) or a catalog metric key
    op: str
    value: object


class QuerySpec(BaseModel):
    metrics: List[str] = Field(default_factory=list)  # catalog keys to display
    rank_by: str                                      # catalog key to rank on
    direction: str = "desc"                           # asc | desc
    filters: List[Filter] = Field(default_factory=list)
    limit: int = 10
    interpretation: str = ""
    # Optional qualitative driver to corroborate the ranking with per-issuer
    # document excerpts (hybrid mode), e.g. "energy prices" for a margin-exposure
    # question. None → pure structured ranking.
    evidence: Optional[str] = None


class IssuerFilter(BaseModel):
    field: str  # industry | country
    value: object


class SemanticSpec(BaseModel):
    """A qualitative question routed to evidence retrieval rather than a metric."""

    search: str
    issuer_filter: Optional[IssuerFilter] = None
    limit: int = 8
    interpretation: str = ""


class QueryError(ValueError):
    """Raised when a question cannot be mapped to a valid, in-vocabulary spec."""


def validate_spec(spec: QuerySpec) -> QuerySpec:
    """Clamp/validate a spec against the catalog. Rejects out-of-vocabulary keys
    so a hallucinated metric is surfaced as a clarification, never executed."""
    if spec.rank_by not in CATALOG_BY_KEY:
        raise QueryError(f"unknown metric to rank by: {spec.rank_by!r}")
    metrics = [m for m in spec.metrics if m in CATALOG_BY_KEY]
    if spec.rank_by not in metrics:
        metrics = [spec.rank_by, *metrics]
    for f in spec.filters:
        if f.field not in _FILTER_FIELDS and f.field not in CATALOG_BY_KEY:
            raise QueryError(f"unknown filter field: {f.field!r}")
        if f.op not in _FILTER_OPS:
            raise QueryError(f"unsupported filter op: {f.op!r}")
    spec.metrics = metrics
    spec.direction = "asc" if str(spec.direction).lower() == "asc" else "desc"
    spec.limit = max(1, min(_MAX_LIMIT, int(spec.limit or 10)))
    return spec


def validate_semantic(spec: SemanticSpec) -> SemanticSpec:
    """Clamp a semantic spec; drop an out-of-vocabulary issuer filter field."""
    if not (spec.search or "").strip():
        raise QueryError("empty search")
    if spec.issuer_filter and spec.issuer_filter.field not in _FILTER_FIELDS:
        spec.issuer_filter = None
    spec.limit = max(1, min(_MAX_LIMIT, int(spec.limit or 8)))
    return spec


# ── Demo (offline) translator ────────────────────────────────────────────────
# Ordered so a driver/exposure word wins over a generic "margin" mention, e.g.
# "margins most exposed to energy prices" ranks by energy exposure, shows margin.
_KEYWORD_METRIC = [
    (("energy", "fuel", "power", "commodit"), "energy_cost_pct"),
    (("leverage", "levered", "indebted"), "net_leverage"),
    (("coverage", "interest cover"), "interest_coverage"),
    (("fcf", "cash flow", "conversion", "cash generat"), "fcf_conversion"),
    (("gross margin",), "gross_margin"),
    (("revenue", "sales", "size", "largest", "biggest"), "revenue"),
    (("margin", "profitab", "ebitda"), "ebitda_margin"),
]
_DESC_WORDS = ("most", "highest", "largest", "biggest", "greatest", "exposed", "worst", "weakest", "top")
_ASC_WORDS = ("least", "lowest", "smallest", "safest", "strongest", "best", "lowest")
# Cues that a structured question also names a qualitative driver worth
# corroborating with document evidence (→ hybrid).
_EVIDENCE_CUES = ("exposed", "exposure", "inflation", "sensitive", "driven", "pressure",
                  "risk", "vulnerable", "affected", "impact")


def _demo_translate(question: str) -> QuerySpec:
    q = question.lower()
    rank_by = next((key for words, key in _KEYWORD_METRIC if any(w in q for w in words)), "net_leverage")
    if any(w in q for w in _ASC_WORDS) and not any(w in q for w in ("most", "highest", "exposed")):
        direction = "asc"
    else:
        direction = "desc"
    metrics = list(dict.fromkeys([rank_by, "ebitda_margin", "net_leverage"]))
    label = CATALOG_BY_KEY[rank_by].label
    extreme = "highest" if direction == "desc" else "lowest"
    shown = ", ".join(CATALOG_BY_KEY[m].label for m in metrics)
    # Hybrid: a ranking question that cites a qualitative driver gets the question
    # itself as the evidence query (BM25 surfaces the relevant chunk per issuer).
    evidence = question.strip() if any(w in q for w in _EVIDENCE_CUES) else None
    interp = f"Rank issuers by {label} ({extreme} first); showing {shown}."
    if evidence:
        interp += " Corroborated with supporting evidence from each issuer's documents."
    return QuerySpec(metrics=metrics, rank_by=rank_by, direction=direction,
                     limit=10, interpretation=interp, evidence=evidence)


# Words that signal a *qualitative* question about document content (→ semantic),
# even when a metric word is also present.
_QUAL_WORDS = (
    "flag", "mention", "discuss", "disclos", "filing", "document", "risk factor",
    "what do", "say", "commentary", "narrative", "describe", "talk about", "note",
)


def _demo_semantic(question: str) -> SemanticSpec:
    return SemanticSpec(
        search=question.strip(),
        limit=8,
        interpretation=f'Search issuer documents for "{question.strip()}"; issuers ranked by best evidence match.',
    )


def _demo_plan(question: str) -> Tuple[str, Union[QuerySpec, SemanticSpec]]:
    """Route a question structured (metric ranking) vs semantic (document evidence).

    A question that asks about document content (flag/mention/filings/…) — or that
    names no metric at all — goes semantic; otherwise it ranks a metric.
    """
    q = question.lower()
    has_metric = any(any(w in q for w in words) for words, _ in _KEYWORD_METRIC)
    if any(w in q for w in _QUAL_WORDS) or not has_metric:
        return "semantic", validate_semantic(_demo_semantic(question))
    return "structured", validate_spec(_demo_translate(question))


# ── LLM translator ───────────────────────────────────────────────────────────
_SYSTEM = (
    "You translate a credit analyst's natural-language question into a JSON "
    "QuerySpec that ranks issuers by a metric. Choose metric keys ONLY from this "
    "catalog (use the exact `key`):\n{catalog}\n\n"
    "Return ONLY a JSON object: {{\"metrics\":[keys to display], \"rank_by\": key, "
    "\"direction\": \"asc\"|\"desc\", \"filters\":[{{\"field\":\"industry\"|\"country\"|metric_key,"
    "\"op\":\"=|>|>=|<|<=|ilike\",\"value\":...}}], \"limit\": int, "
    "\"interpretation\": one terse sentence restating what you ranked}}. "
    "Pick direction by the metric's meaning: 'most exposed/highest/weakest' on a "
    "higher-is-worse metric ranks descending. If the question names a driver "
    "(e.g. energy prices), rank by that driver metric and also display the "
    "affected metric. Never invent keys."
)


async def _llm_translate(question: str) -> QuerySpec:
    import anthropic

    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    catalog = "\n".join(
        f"- {m['key']}: {m['label']} ({m['unit']}, "
        f"{'higher=better' if m['higher_is_better'] else 'higher=worse'}) — {m['description']}"
        for m in catalog_dicts()
    )
    resp = await client.messages.create(
        model=settings.anthropic_model,
        max_tokens=600,
        system=_SYSTEM.format(catalog=catalog),
        messages=[{"role": "user", "content": question}],
    )
    text = next((b.text for b in resp.content if b.type == "text"), "")
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise QueryError("model returned no JSON spec")
    return QuerySpec(**json.loads(match.group(0)))


async def translate(question: str) -> QuerySpec:
    settings = get_settings()
    if settings.anthropic_api_key:
        try:
            return validate_spec(await _llm_translate(question))
        except QueryError:
            raise
        except Exception as e:  # network/parse → fall back to the deterministic mapper
            logger.warning("LLM translate failed, using demo mapper: %s", e)
    return validate_spec(_demo_translate(question))


# ── Planner: route structured (metric ranking) vs semantic (document evidence) ──
_PLAN_SYSTEM = (
    "You route a credit analyst's question to one of two engines and return ONLY a "
    "JSON object.\n"
    "If it ranks issuers by a quantitative metric, return STRUCTURED; choose metric "
    "keys ONLY from this catalog (exact `key`):\n{catalog}\n"
    'STRUCTURED: {{"mode":"structured","metrics":[keys],"rank_by":key,"direction":'
    '"asc"|"desc","filters":[{{"field":"industry"|"country"|metric_key,"op":'
    '"=|>|>=|<|<=|ilike","value":...}}],"limit":int,"evidence":"<qualitative driver '
    'to corroborate with document excerpts, e.g. energy prices; else null>",'
    '"interpretation":"..."}}.\n'
    "If it asks what issuers' DOCUMENTS say (mention/flag/discuss/risk factors/"
    "qualitative exposure), return SEMANTIC to search source text.\n"
    'SEMANTIC: {{"mode":"semantic","search":"key terms","issuer_filter":'
    '{{"field":"industry"|"country","value":...}}|null,"limit":int,"interpretation":"..."}}.\n'
    "Direction by meaning (most exposed/weakest on a higher-is-worse metric → desc). "
    "Never invent metric keys."
)


async def _llm_plan(question: str) -> Tuple[str, Union[QuerySpec, SemanticSpec]]:
    import anthropic

    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    catalog = "\n".join(
        f"- {m['key']}: {m['label']} ({m['unit']}, "
        f"{'higher=better' if m['higher_is_better'] else 'higher=worse'}) — {m['description']}"
        for m in catalog_dicts()
    )
    resp = await client.messages.create(
        model=settings.anthropic_model,
        max_tokens=600,
        system=_PLAN_SYSTEM.format(catalog=catalog),
        messages=[{"role": "user", "content": question}],
    )
    text = next((b.text for b in resp.content if b.type == "text"), "")
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise QueryError("model returned no JSON spec")
    data = json.loads(match.group(0))
    mode = data.pop("mode", "structured")
    if mode == "semantic":
        return "semantic", SemanticSpec(**data)
    return "structured", QuerySpec(**data)


async def plan(question: str) -> Tuple[str, Union[QuerySpec, SemanticSpec]]:
    """Classify and translate a question. Returns (mode, validated spec)."""
    settings = get_settings()
    if settings.anthropic_api_key:
        try:
            mode, spec = await _llm_plan(question)
            if mode == "semantic":
                return "semantic", validate_semantic(spec)  # type: ignore[arg-type]
            return "structured", validate_spec(spec)  # type: ignore[arg-type]
        except QueryError:
            raise
        except Exception as e:  # network/parse → deterministic router
            logger.warning("LLM plan failed, using demo router: %s", e)
    return _demo_plan(question)


# ── Execution ────────────────────────────────────────────────────────────────
def _passes(value: Optional[float], op: str, target) -> bool:
    if value is None:
        return False
    try:
        t = float(target)
    except (TypeError, ValueError):
        return True
    return {"=": value == t, ">": value > t, ">=": value >= t,
            "<": value < t, "<=": value <= t}.get(op, True)


async def execute(session: AsyncSession, spec: QuerySpec) -> dict:
    """Run a validated spec over headline metric_facts; return ranked, cited rows."""
    needed = list(dict.fromkeys([spec.rank_by, *spec.metrics]))
    issuer_filters = [f for f in spec.filters if f.field in _FILTER_FIELDS]
    metric_filters = [f for f in spec.filters if f.field in CATALOG_BY_KEY]

    stmt = (
        select(MetricFact, Issuer)
        .join(Issuer, MetricFact.issuer_id == Issuer.id)
        .where(MetricFact.headline.is_(True), MetricFact.metric_key.in_(needed))
    )
    for f in issuer_filters:
        col = getattr(Issuer, f.field)
        stmt = stmt.where(col.ilike(f"%{f.value}%") if f.op == "ilike" else col == f.value)

    rows = (await session.execute(stmt)).all()

    # Pivot per issuer; per (issuer, metric) keep the best fact: run-derived over
    # seed, then most recent. Several runs of one issuer collapse to the latest.
    by_issuer: Dict[str, dict] = {}
    for fact, issuer in rows:
        entry = by_issuer.setdefault(issuer.id, {"issuer": issuer, "metrics": {}})
        prev = entry["metrics"].get(fact.metric_key)
        better = (
            prev is None
            or (fact.provenance == "run" and prev.provenance != "run")
            or (fact.provenance == prev.provenance and fact.created_at and prev.created_at
                and fact.created_at > prev.created_at)
        )
        if better:
            entry["metrics"][fact.metric_key] = fact

    md: MetricDef = CATALOG_BY_KEY[spec.rank_by]
    results = []
    for entry in by_issuer.values():
        facts = entry["metrics"]
        ranked = facts.get(spec.rank_by)
        if ranked is None:
            continue  # can't rank an issuer with no value for the ranked metric
        if not all(_passes(facts[f.field].value if f.field in facts else None, f.op, f.value)
                   for f in metric_filters):
            continue
        issuer = entry["issuer"]
        results.append({
            "issuer": {"id": issuer.id, "name": issuer.name, "ticker": issuer.ticker,
                       "industry": issuer.industry, "country": issuer.country},
            "rank_value": ranked.value,
            "metrics": {
                key: {
                    "value": f.value, "unit": f.unit, "provenance": f.provenance,
                    "qa_status": f.qa_status, "period": f.period,
                    "citation": ({"claim_id": f.source_claim_id,
                                  "evidence_id": f.source_evidence_id,
                                  "chunk_id": f.document_chunk_id}
                                 if (f.source_evidence_id or f.document_chunk_id) else None),
                }
                for key, f in facts.items() if key in spec.metrics
            },
        })

    results.sort(key=lambda r: r["rank_value"], reverse=(spec.direction == "desc"))
    results = results[: spec.limit]

    # Hybrid: corroborate each ranked issuer with the top supporting excerpt from
    # its own documents, retrieved against the qualitative driver. Reuses the
    # cross-issuer retriever scoped to one issuer.
    hybrid = bool(spec.evidence)
    if hybrid:
        for row in results:
            ev_hits = await retrieve_corpus(
                session, spec.evidence, k=1, issuer_ids=[row["issuer"]["id"]]
            )
            row["evidence"] = (
                {"chunk_id": ev_hits[0].chunk_id, "doc": ev_hits[0].doc,
                 "text": _snippet(ev_hits[0].text)}
                if ev_hits else None
            )

    columns = [
        {"key": m, "label": CATALOG_BY_KEY[m].label, "unit": CATALOG_BY_KEY[m].unit,
         "higher_is_better": CATALOG_BY_KEY[m].higher_is_better}
        for m in spec.metrics
    ]
    caveats = []
    provs = {r["metrics"].get(spec.rank_by, {}).get("provenance") for r in results}
    provs.discard(None)
    if provs == {"seed"}:
        caveats.append(f"{md.label} is illustrative seed data (no sourced value yet).")
    elif "seed" in provs:
        caveats.append(f"{md.label} is derived from filings for some issuers, illustrative seed for others.")
    elif provs == {"derived"}:
        caveats.append(f"{md.label} is derived from each issuer's filings (cited).")
    if any(m["value"] is None for r in results for m in r["metrics"].values()):
        caveats.append("Some issuers are missing values for a displayed metric.")
    if hybrid:
        caveats.append("Supporting excerpts are the top document match per issuer (BM25) — corroborating, not the basis for the ranking.")

    return {
        "mode": "hybrid" if hybrid else "structured",
        "interpretation": spec.interpretation,
        "spec": spec.model_dump(),
        "rank_by": spec.rank_by,
        "columns": columns,
        "rows": results,
        "caveats": caveats,
    }


def _snippet(text: str, n: int = 320) -> str:
    t = " ".join((text or "").split())
    return t if len(t) <= n else t[:n].rsplit(" ", 1)[0] + "…"


async def execute_semantic(session: AsyncSession, spec: SemanticSpec) -> dict:
    """Cross-issuer evidence retrieval: rank issuers by their best document match,
    returning cited excerpts. The qualitative counterpart to ``execute``."""
    issuer_ids = None
    if spec.issuer_filter:
        col = getattr(Issuer, spec.issuer_filter.field)
        ids = (await session.execute(
            select(Issuer.id).where(col.ilike(f"%{spec.issuer_filter.value}%"))
        )).scalars().all()
        issuer_ids = list(ids) or ["__none__"]  # a filter matching nothing → no rows

    hits = await retrieve_corpus(session, spec.search, k=12, issuer_ids=issuer_ids)

    groups: Dict[str, dict] = {}
    for h in hits:
        g = groups.setdefault(h.issuer_id, {"score": 0.0, "excerpts": []})
        g["score"] = max(g["score"], h.score)
        if len(g["excerpts"]) < 2:
            g["excerpts"].append({"chunk_id": h.chunk_id, "doc": h.doc, "text": _snippet(h.text)})

    issuers: Dict[str, Issuer] = {}
    if groups:
        for iss in (await session.execute(
            select(Issuer).where(Issuer.id.in_(list(groups)))
        )).scalars().all():
            issuers[iss.id] = iss

    rows = []
    for iid, g in groups.items():
        iss = issuers.get(iid)
        if iss is None:
            continue
        rows.append({
            "issuer": {"id": iss.id, "name": iss.name, "ticker": iss.ticker,
                       "industry": iss.industry, "country": iss.country},
            "score": round(g["score"], 3),
            "excerpts": g["excerpts"],
        })
    rows.sort(key=lambda r: r["score"], reverse=True)
    rows = rows[: spec.limit]

    caveats = ["Ranked by document-text match (BM25) — qualitative relevance, not a quantitative score."]
    if not rows:
        caveats = ["No issuer documents matched — try different terms."]

    return {
        "mode": "semantic",
        "interpretation": spec.interpretation,
        "rank_by": None,
        "rows": rows,
        "caveats": caveats,
    }
