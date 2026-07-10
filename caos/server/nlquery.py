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
from typing import Dict, List, Optional, Tuple, Union

from pydantic import BaseModel, Field
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from engine import llm_client, presets
from database import Issuer, MetricFact
from engine.metrics import CATALOG_BY_KEY, MetricDef, catalog_dicts
from retrieval import retrieve_corpus, retrieve_corpus_by_issuer

logger = logging.getLogger("caos.nlquery")

_FILTER_FIELDS = {"industry", "country"}
_FILTER_OPS = {"=", ">", ">=", "<", "<=", "ilike"}
_NUMERIC_OPS = {"=", ">", ">=", "<", "<="}  # ilike is text-only (issuer fields)
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


class SynthesisSpec(BaseModel):
    """A qualitative question routed to agent outputs, claims, and QA findings in the wiki structure."""

    search: str
    issuer_filter: Optional[IssuerFilter] = None
    module_filter: Optional[str] = None
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
        # A metric filter is numeric: reject the text-only `ilike` and a non-numeric
        # value HERE, rather than silently passing every row in _passes (#4).
        if f.field in CATALOG_BY_KEY:
            if f.op not in _NUMERIC_OPS:
                raise QueryError(f"metric filter {f.field!r} needs a numeric op, not {f.op!r}")
            try:
                float(f.value)  # type: ignore[arg-type]
            except (TypeError, ValueError):
                raise QueryError(f"metric filter {f.field!r} needs a numeric value, not {f.value!r}")
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


def validate_synthesis(spec: SynthesisSpec) -> SynthesisSpec:
    """Clamp a synthesis spec; drop an out-of-vocabulary issuer filter field."""
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

_SYNTHESIS_WORDS = (
    "finding", "remediation", "failed", "qa", "consensus", "debrief", "module", "opinion",
    "conclusion", "verdict", "wiki", "synthesis", "claim",
)


def _demo_semantic(question: str) -> SemanticSpec:
    return SemanticSpec(
        search=question.strip(),
        limit=8,
        interpretation=f'Search issuer documents for "{question.strip()}"; issuers ranked by best evidence match.',
    )


def _demo_synthesis(question: str) -> SynthesisSpec:
    return SynthesisSpec(
        search=question.strip(),
        limit=8,
        interpretation=f'Search agent outputs and QA findings for "{question.strip()}"; matches ranked by best score.',
    )


def _demo_plan(question: str) -> Tuple[str, Union[QuerySpec, SemanticSpec, SynthesisSpec]]:
    """Route a question structured (metric ranking) vs semantic (document evidence) vs synthesis (agent wiki)."""
    q = question.lower()
    if any(w in q for w in _SYNTHESIS_WORDS):
        return "synthesis", validate_synthesis(_demo_synthesis(question))
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

    settings = get_settings()
    # Shared cached client (llm_client.anthropic_client): per-call construction
    # re-paid TLS setup on every request and leaked unclosed httpx transports.
    client = llm_client.anthropic_client(settings)
    catalog = "\n".join(
        f"- {m['key']}: {m['label']} ({m['unit']}, "
        f"{'higher=better' if m['higher_is_better'] else 'higher=worse'}) — {m['description']}"
        for m in catalog_dicts()
    )
    resp = await llm_client.create(
        client,
        lane="nlquery:translate",
        model=presets.resolved_query_model(),
        effort=presets.effort_for(presets.LIGHT),
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
    "You route a credit analyst's question to one of three engines and return ONLY a "
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
    "If it asks about consensus, agent outputs, claims, quality findings, or QA findings "
    "(remediation, failed, debate, status), return SYNTHESIS.\n"
    'SYNTHESIS: {{"mode":"synthesis","search":"key terms","issuer_filter":'
    '{{"field":"industry"|"country","value":...}}|null,"module_filter":string|null,'
    '"limit":int,"interpretation":"..."}}.\n'
    "Direction by meaning (most exposed/weakest on a higher-is-worse metric → desc). "
    "Never invent metric keys."
)


async def _llm_plan(question: str) -> Tuple[str, Union[QuerySpec, SemanticSpec, SynthesisSpec]]:

    settings = get_settings()
    # Shared cached client (llm_client.anthropic_client): per-call construction
    # re-paid TLS setup on every request and leaked unclosed httpx transports.
    client = llm_client.anthropic_client(settings)
    catalog = "\n".join(
        f"- {m['key']}: {m['label']} ({m['unit']}, "
        f"{'higher=better' if m['higher_is_better'] else 'higher=worse'}) — {m['description']}"
        for m in catalog_dicts()
    )
    resp = await llm_client.create(
        client,
        lane="nlquery:plan",
        model=presets.resolved_query_model(),
        effort=presets.effort_for(presets.LIGHT),
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
    if mode == "synthesis":
        return "synthesis", SynthesisSpec(**data)
    return "structured", QuerySpec(**data)


async def plan(question: str) -> Tuple[str, Union[QuerySpec, SemanticSpec, SynthesisSpec]]:
    """Classify and translate a question. Returns (mode, validated spec)."""
    settings = get_settings()
    if settings.anthropic_api_key:
        try:
            mode, spec = await _llm_plan(question)
            if mode == "semantic":
                return "semantic", validate_semantic(spec)  # type: ignore[arg-type]
            if mode == "synthesis":
                return "synthesis", validate_synthesis(spec)  # type: ignore[arg-type]
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
        return False  # fail closed: an unparseable filter excludes, never admits all (#4)
    if op == "=":
        return value == t
    if op == ">":
        return value > t
    if op == ">=":
        return value >= t
    if op == "<":
        return value < t
    if op == "<=":
        return value <= t
    return False


# ── Latest-per (issuer, metric) collapse ─────────────────────────────────────
_DERIVED_PROVENANCE = ("run", "fixture")  # run/fixture outrank seed in the collapse tier


def _derived(provenance: str) -> int:
    """Collapse tier: a real run OR the demo fixture outranks seed (#04)."""
    return 1 if provenance in _DERIVED_PROVENANCE else 0


def _better_fact(prev: Optional[MetricFact], fact: MetricFact) -> bool:
    """True if ``fact`` should replace ``prev`` as the kept value for one
    (issuer, metric): run/fixture-derived beats seed, then most-recent created_at
    within the same tier. Several runs of one issuer collapse to the latest.

    NB two sharp edges any SQL-window reimplementation must reproduce exactly:
    (1) when either created_at is null the tie stays with ``prev`` (first seen) — an
        iteration-order dependence a window ORDER BY must pin with a deterministic id
        tiebreak, and whose NULLS position differs SQLite(dev)↔Postgres(prod);
    (2) this tiers run==fixture, and engine.querygraph._best_fact was unified onto the
        same rule — the two collapses are pinned identical by test_fact_collapse.py's
        test_both_collapses_agree_after_unification.
    """
    if prev is None:
        return True
    pt, ft = _derived(prev.provenance), _derived(fact.provenance)
    if ft != pt:
        return ft > pt
    return bool(fact.created_at and prev.created_at and fact.created_at > prev.created_at)


def _provenance_caveats(label: str, provs: set) -> List[str]:
    """Result-level honesty sentences for the ranked metric's provenance mix.

    The seed/derived chain keeps the pre-existing wording. demo_fixture is
    checked INDEPENDENTLY of that chain: fabricated figures (the ATLF fixture
    persisted for a non-demo issuer on a keyless run, #10) must be called out
    even when mixed with sourced values — the row-level badges alone read as
    benign seed (SEAM2-1)."""
    out: List[str] = []
    if provs == {"seed"}:
        out.append(f"{label} is illustrative seed data (no sourced value yet).")
    elif "seed" in provs:
        out.append(f"{label} is derived from filings for some issuers, illustrative seed for others.")
    elif provs == {"derived"}:
        out.append(f"{label} is derived from each issuer's filings (cited).")
    if "demo_fixture" in provs:
        out.append(
            f"{label} for one or more issuers is fabricated Atlas Forge demo-fixture data "
            "(served because no model key is configured) — NOT sourced from those issuers' "
            "filings; treat as illustrative only."
        )
    return out


async def execute(session: AsyncSession, spec: QuerySpec) -> dict:  # noqa: C901
    """Run a validated spec over headline metric_facts; return ranked, cited rows."""
    needed = list(dict.fromkeys([spec.rank_by, *spec.metrics]))
    issuer_filters = [f for f in spec.filters if f.field in _FILTER_FIELDS]
    metric_filters = [f for f in spec.filters if f.field in CATALOG_BY_KEY]

    # Bound the scan: pick one winning fact per (issuer, metric) in SQL via a window
    # ordered to mirror _better_fact — run/fixture tier, then newest created_at, then a
    # deterministic id tiebreak (which also pins the null-created_at case the Python fold
    # left to iteration order). Keeps the read at issuers×metrics, not O(run history).
    # _better_fact stays the pinned reference this ORDER BY must match (test_fact_collapse).
    tier = case((MetricFact.provenance.in_(_DERIVED_PROVENANCE), 1), else_=0)
    win = (
        select(
            MetricFact.id.label("fid"),
            func.row_number().over(
                partition_by=(MetricFact.issuer_id, MetricFact.metric_key),
                order_by=(tier.desc(), MetricFact.created_at.desc().nullslast(),
                          MetricFact.id.desc()),
            ).label("rn"),
        )
        .join(Issuer, MetricFact.issuer_id == Issuer.id)
        .where(MetricFact.headline.is_(True), MetricFact.metric_key.in_(needed))
    )
    for f in issuer_filters:
        col = getattr(Issuer, f.field)
        win = win.where(col.ilike(f"%{f.value}%") if f.op == "ilike" else col == f.value)
    win = win.subquery()

    stmt = (
        select(MetricFact, Issuer)
        .join(Issuer, MetricFact.issuer_id == Issuer.id)
        .where(MetricFact.id.in_(select(win.c.fid).where(win.c.rn == 1)))
    )
    rows = (await session.execute(stmt)).all()

    # The window already collapsed to one fact per (issuer, metric) — just pivot.
    by_issuer: Dict[str, dict] = {}
    for fact, issuer in rows:
        by_issuer.setdefault(issuer.id, {"issuer": issuer, "metrics": {}})["metrics"][fact.metric_key] = fact

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
                    "qa_status": f.qa_status, "period": f.period, "basis": f.basis,
                    "citation": ({"claim_id": f.source_claim_id,
                                  "evidence_id": f.source_evidence_id,
                                  "chunk_id": f.document_chunk_id}
                                 if (f.source_evidence_id or f.document_chunk_id) else None),
                }
                for key, f in facts.items() if key in spec.metrics
            },
        })

    results.sort(key=lambda r: r["rank_value"], reverse=(spec.direction == "desc"))
    # Universe of issuers that could be ranked (had a value for rank_by and passed
    # the filters) BEFORE the top-N display cap — so the UI can say "top N of M"
    # instead of implying the returned cohort is the whole population.
    total_ranked = len(results)
    results = results[: spec.limit]

    # Hybrid: corroborate each ranked issuer with the top supporting excerpt from
    # its own documents, retrieved against the qualitative driver. Reuses the
    # cross-issuer retriever scoped to one issuer.
    hybrid = bool(spec.evidence)
    if hybrid:
        # One query for the best supporting excerpt per ranked issuer (PERF-1).
        best = await retrieve_corpus_by_issuer(
            session, spec.evidence, [row["issuer"]["id"] for row in results]
        )
        for row in results:
            h = best.get(row["issuer"]["id"])
            row["evidence"] = (
                {"chunk_id": h.chunk_id, "doc": h.doc, "text": _snippet(h.text)}
                if h else None
            )

    columns = [
        {"key": m, "label": CATALOG_BY_KEY[m].label, "unit": CATALOG_BY_KEY[m].unit,
         "higher_is_better": CATALOG_BY_KEY[m].higher_is_better}
        for m in spec.metrics
    ]
    provs = {r["metrics"].get(spec.rank_by, {}).get("provenance") for r in results}
    provs.discard(None)
    caveats = _provenance_caveats(md.label, provs)
    # Reported (EDGAR GAAP) vs adjusted (covenant/modeled) EBITDA are not directly
    # comparable; warn when a leverage/EBITDA ranking mixes them across issuers.
    if spec.rank_by in {"net_leverage", "adj_ebitda"}:
        bases = {r["metrics"].get(spec.rank_by, {}).get("basis") for r in results}
        bases.discard(None)
        if "reported" in bases and "adjusted" in bases:
            caveats.append(
                f"{md.label} mixes reported-GAAP (EDGAR filers) and covenant-adjusted "
                "(modeled) bases across issuers — not directly comparable.")
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
        "total_ranked": total_ranked,
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


async def execute_synthesis(session: AsyncSession, spec: SynthesisSpec) -> dict:  # noqa: C901
    """Search agent outputs, claims, and QA findings; return ranked matches."""
    from database import ModuleOutput, Claim, QAFinding, Run, Issuer
    from retrieval import bm25_rank
    import json

    # ponytail: cap each scan so the in-request BM25 corpus can't grow unbounded
    # with run history when no issuer/module filter is given. Newest-first, so the
    # cap keeps the most recent runs. Raise, or push scoring into Postgres, if the
    # platform accumulates enough runs that the tail matters.
    _SYNTH_SCAN_CAP = 2000

    issuer_ids = None
    if spec.issuer_filter:
        col = getattr(Issuer, spec.issuer_filter.field)
        ids = (await session.execute(
            select(Issuer.id).where(col.ilike(f"%{spec.issuer_filter.value}%"))
        )).scalars().all()
        issuer_ids = list(ids) or ["__none__"]

    stmt_m = (
        select(ModuleOutput, Run, Issuer)
        .join(Run, ModuleOutput.run_id == Run.id)
        .join(Issuer, Run.issuer_id == Issuer.id)
    )
    if issuer_ids:
        stmt_m = stmt_m.where(Issuer.id.in_(issuer_ids))
    if spec.module_filter:
        stmt_m = stmt_m.where(ModuleOutput.module_id == spec.module_filter)

    stmt_m = stmt_m.order_by(Run.created_at.desc()).limit(_SYNTH_SCAN_CAP)
    modules = (await session.execute(stmt_m)).all()

    stmt_c = (
        select(Claim, ModuleOutput, Run, Issuer)
        .join(ModuleOutput, Claim.module_output_id == ModuleOutput.id)
        .join(Run, ModuleOutput.run_id == Run.id)
        .join(Issuer, Run.issuer_id == Issuer.id)
    )
    if issuer_ids:
        stmt_c = stmt_c.where(Issuer.id.in_(issuer_ids))
    if spec.module_filter:
        stmt_c = stmt_c.where(ModuleOutput.module_id == spec.module_filter)

    stmt_c = stmt_c.order_by(Run.created_at.desc()).limit(_SYNTH_SCAN_CAP)
    claims = (await session.execute(stmt_c)).all()

    stmt_f = (
        select(QAFinding, Run, Issuer)
        .join(Run, QAFinding.run_id == Run.id)
        .join(Issuer, Run.issuer_id == Issuer.id)
    )
    if issuer_ids:
        stmt_f = stmt_f.where(Issuer.id.in_(issuer_ids))
    if spec.module_filter:
        stmt_f = stmt_f.where(QAFinding.module_id == spec.module_filter)

    stmt_f = stmt_f.order_by(Run.created_at.desc()).limit(_SYNTH_SCAN_CAP)
    findings = (await session.execute(stmt_f)).all()

    corpus = []
    meta = {}

    for m_out, run, issuer in modules:
        key = f"m:{m_out.id}"
        # Row count is capped (_SYNTH_SCAN_CAP) but a runtime_output can be tens
        # of KB (CP-1 FactPack) — serialize a bounded slice so the on-loop
        # tokenize/rank stays O(cap × 2KB), not O(cap × payload) (BE5-4). BM25
        # ranks on term overlap; a 2KB head is plenty of signal for retrieval.
        payload = json.dumps(m_out.runtime_output, ensure_ascii=False)[:2000]
        text = (
            f"Module: {m_out.module_name} ({m_out.module_id}). "
            f"Confidence: {m_out.confidence}. QA Status: {m_out.qa_status}. "
            f"Output payload: {payload}"
        )
        corpus.append((key, text))
        meta[key] = {
            "issuer": {"id": issuer.id, "name": issuer.name, "ticker": issuer.ticker, "industry": issuer.industry, "country": issuer.country},
            "kind": "module",
            "title": f"{m_out.module_name} ({m_out.module_id})",
            "sub": f"Confidence: {m_out.confidence} · QA: {m_out.qa_status}",
            "text": text,
        }

    for claim, m_out, run, issuer in claims:
        key = f"c:{claim.id}"
        text = f"Claim {claim.claim_id} from {m_out.module_name}: {claim.claim_text}"
        corpus.append((key, text))
        meta[key] = {
            "issuer": {"id": issuer.id, "name": issuer.name, "ticker": issuer.ticker, "industry": issuer.industry, "country": issuer.country},
            "kind": "claim",
            "title": f"Claim {claim.claim_id} ({m_out.module_id})",
            "sub": m_out.module_name,
            "text": claim.claim_text,
        }

    for finding, run, issuer in findings:
        key = f"f:{finding.id}"
        text = (
            f"QA Finding {finding.finding_id} ({finding.severity}) "
            f"on module {finding.module_id or 'run'}. Lane {finding.lane}. "
            f"Description: {finding.description}. "
            f"Required remediation: {finding.required_remediation or 'none'}."
        )
        corpus.append((key, text))
        meta[key] = {
            "issuer": {"id": issuer.id, "name": issuer.name, "ticker": issuer.ticker, "industry": issuer.industry, "country": issuer.country},
            "kind": f"finding-{finding.severity.lower()[:3]}",
            "title": f"QA Finding {finding.finding_id} ({finding.severity})",
            "sub": f"Lane {finding.lane} · Module: {finding.module_id or 'Run'}",
            "text": f"{finding.description}" + (f" (Remediation: {finding.required_remediation})" if finding.required_remediation else ""),
        }

    hits = bm25_rank(spec.search, corpus, k=spec.limit)

    groups = {}
    for h in hits:
        info = meta[h.chunk_id]
        iid = info["issuer"]["id"]
        g = groups.setdefault(iid, {"score": 0.0, "excerpts": []})
        g["score"] = max(g["score"], h.score)
        if len(g["excerpts"]) < 2:
            g["excerpts"].append({
                "chunk_id": h.chunk_id,
                "doc": info["title"],
                "doc_type": info["kind"],
                "text": f"{info['sub']}: {info['text']}" if info['sub'] else info['text']
            })

    issuers = {}
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

    caveats = ["Ranked by wiki and agent-synthesis match (BM25) — qualitative relevance, not a quantitative score."]
    if not rows:
        caveats = ["No matching agent outputs, claims, or QA findings found — try different terms."]

    return {
        "mode": "synthesis",
        "interpretation": spec.interpretation,
        "rank_by": None,
        "rows": rows,
        "caveats": caveats,
    }

