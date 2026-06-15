"""CP-4D DealTermsExtractor — the structured covenant/term set behind Loan Compare.

Reads the issuer's governing documents (credit agreement / indenture, vaulted via
the EDGAR lane or uploaded) and extracts the engine/terms_catalog fields as a
source-traced term set. Where CP-4C answers "how much room before something
breaks?" (capacity/headroom), CP-4D answers "what do the terms *say*?" across the
~115 catalog fields, so deals can be compared side-by-side on /compare.

Deterministic-first (regex over retrieved chunks for the high-signal numerics and
the cov-lite read), with a section-batched LLM seam for the long tail — mirroring
[covenants.py]/[adjusted.py]. Every extracted term carries lineage · confidence ·
the chunk it was drawn from (CP-5B), so each comparison cell stays one click from
the agreement language. Pure (no DB): the runner projects the payload's terms into
deals/deal_terms, the way metrics.extract_facts feeds metric_facts.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import asdict, dataclass
from typing import Dict, List, Optional, Sequence, Tuple

from config import get_settings
from engine import budget
from engine.llm_safety import UNTRUSTED_RULE, safe_chunk_id, wrap_untrusted
from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload
from engine.terms_catalog import BY_KEY, terms_in_section

logger = logging.getLogger("caos.engine")

MAX_CLAIMS = 40  # cap CP-5B claim rows per run; all terms still project to deal_terms

# A broad sweep for the deterministic baseline + LLM grounding.
_BROAD_QUERY = (
    "applicable margin spread SOFR floor term loan facility incremental MFN free and clear "
    "leverage covenant maintenance cov-lite restricted payments ratio basket shall not exceed"
)

# Sections worth an LLM extraction pass, in priority order (highest analytical
# value first, so a tight budget still covers the terms that matter most).
_LLM_SECTION_ORDER = [
    "transaction_fundamentals", "financial_covenant", "incremental",
    "ebitda_adjustments", "sweeps", "debt_covenant", "liens_covenant",
    "rp_covenant", "builder_basket", "general_basket_growers",
    "carveouts", "documentation_scores",
]

# ── Deterministic patterns ───────────────────────────────────────────────────
_SPREAD_BPS = re.compile(r"S(?:OFR|ONIA)?\s*\+\s*(\d{2,4})\b", re.IGNORECASE)
_MARGIN_PCT = re.compile(r"applicable margin[^.]{0,60}?(\d(?:\.\d+)?)\s*%", re.IGNORECASE)
_FLOOR = re.compile(r"floor[^.]{0,40}?(\d(?:\.\d+)?)\s*%", re.IGNORECASE)
_TL_SIZE = re.compile(r"term loan[^.]{0,80}?\$?\s*([\d,]+(?:\.\d+)?)\s*million", re.IGNORECASE)
_TURNS = re.compile(r"(\d+(?:\.\d+)?)\s*(?:x|times)\b", re.IGNORECASE)
_MILLION = re.compile(r"\$?\s*([\d,]+(?:\.\d+)?)\s*million", re.IGNORECASE)
_MAINT_CUE = ("financial covenant", "maintenance covenant", "shall not exceed", "shall not permit")


@dataclass
class ExtractedTerm:
    """One extracted catalog value plus its provenance. Projected 1:1 to a DealTerm."""

    term_key: str
    value_num: Optional[float] = None
    value_text: Optional[str] = None
    quote: Optional[str] = None
    chunk_id: Optional[str] = None
    extraction_type: str = "documentary_fact"
    lineage_class: str = "Directly Sourced"
    confidence: str = "High"


def _f(v: str) -> float:
    return float(v.replace(",", ""))


def derive_deal_terms(chunks: Sequence[Tuple[str, str]]) -> List[ExtractedTerm]:
    """Deterministic baseline: the high-signal numerics + the cov-lite read, from
    ``(chunk_id, text)`` pairs. Conservative — emits a term only on a confident
    match, so the LLM pass (or a human) fills the rest. First match wins."""
    out: Dict[str, ExtractedTerm] = {}

    def add(t: ExtractedTerm) -> None:
        out.setdefault(t.term_key, t)

    def scan(pattern: re.Pattern, *, require: Tuple[str, ...] = ()) -> Optional[Tuple[re.Match, str]]:
        for cid, text in chunks:
            if require and not any(k in text.lower() for k in require):
                continue
            m = pattern.search(text)
            if m:
                return m, cid
        return None

    # Spread — "S + 275" wins; else an applicable-margin percent → bps.
    hit = scan(_SPREAD_BPS)
    if hit:
        m, cid = hit
        add(ExtractedTerm("spread_bps", value_num=float(m.group(1)), quote=m.group(0), chunk_id=cid, extraction_type="table_value"))
    else:
        hit = scan(_MARGIN_PCT)
        if hit:
            m, cid = hit
            add(ExtractedTerm("spread_bps", value_num=round(float(m.group(1)) * 100), quote=m.group(0),
                              chunk_id=cid, extraction_type="calculated_metric", confidence="Medium"))

    hit = scan(_FLOOR, require=("floor",))
    if hit:
        m, cid = hit
        add(ExtractedTerm("floor", value_num=round(float(m.group(1)) / 100, 5), quote=m.group(0), chunk_id=cid, extraction_type="table_value"))

    hit = scan(_TL_SIZE, require=("term loan",))
    if hit:
        m, cid = hit
        add(ExtractedTerm("term_loan_size_musd", value_num=_f(m.group(1)), quote=m.group(0), chunk_id=cid, extraction_type="table_value"))

    # Maintenance leverage covenant ↔ cov-lite. Presence of a leverage maximum →
    # the level + cov_lite No; absence across the corpus → cov_lite Yes (inferred).
    lev = scan(_TURNS, require=("leverage",) )
    maint = any(any(c in text.lower() for c in _MAINT_CUE) and "leverage" in text.lower() for _, text in chunks)
    if lev and maint:
        m, cid = lev
        add(ExtractedTerm("net_first_lien_leverage_ratio", value_num=float(m.group(1)), quote=m.group(0), chunk_id=cid, extraction_type="table_value"))
        add(ExtractedTerm("cov_lite", value_text="No", chunk_id=cid, extraction_type="documentary_fact"))
    elif chunks:
        add(ExtractedTerm("cov_lite", value_text="Yes", extraction_type="analyst_inference",
                          lineage_class="Analyst Inference", confidence="Medium"))

    # Incurrence ratio carveout (turns near "ratio" + "indebtedness"/"debt").
    hit = scan(_TURNS, require=("ratio",))
    if hit:
        m, cid = hit
        add(ExtractedTerm("ratio_debt_carveout", value_num=float(m.group(1)), quote=m.group(0), chunk_id=cid, extraction_type="table_value", confidence="Medium"))

    return list(out.values())


# ── LLM section pass (the long tail) ─────────────────────────────────────────
def _section_prompt(section_key: str) -> Tuple[str, str]:
    """(retrieval query, system prompt) for one catalog section's terms."""
    terms = terms_in_section(section_key)
    spec = "; ".join(f"{t.key} ({t.vtype}): {t.label}" for t in terms)
    query = section_key.replace("_", " ") + " covenant basket ratio cap " + " ".join(t.label for t in terms[:6])
    system = (
        "You read leveraged-finance credit agreements / indentures. From the SOURCE "
        "CHUNKS, extract the following terms. Return ONLY a JSON object mapping term_key "
        "to {\"value\": <number|string|null>, \"chunk_id\": <id|null>, \"quote\": <short "
        "verbatim span|null>}. Use a number for numeric vtypes (musd/bps/pct/turns/months/"
        "price/score_1_5), a string for enum/bool/text/quote/date, and null when a term is "
        "not present. Never invent a figure or a chunk_id.\n\nTERMS: " + spec + "\n\n" + UNTRUSTED_RULE
    )
    return query, system


async def _llm_section_terms(retrieve, section_key: str) -> List[ExtractedTerm]:
    """Claude extracts one section's terms from its retrieved chunks. Any failure
    raises to the caller, which logs and moves on (defensive per-section)."""
    import anthropic

    settings = get_settings()
    query, system = _section_prompt(section_key)
    hits = await retrieve(query, 6)
    if not hits:
        return []
    grounding = "\n\n".join(f"[chunk {h.chunk_id}]\n{h.text}" for h in hits)
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    resp = await client.messages.create(
        model=settings.anthropic_model, max_tokens=1200, system=system,
        messages=[{"role": "user", "content": f"SOURCE CHUNKS:\n{wrap_untrusted(grounding)}"}],
    )
    budget.record_usage(resp)
    text = next((b.text for b in resp.content if b.type == "text"), "")
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return []
    data = json.loads(match.group(0))
    out: List[ExtractedTerm] = []
    for key, payload in data.items():
        term = BY_KEY.get(key)
        if term is None or not isinstance(payload, dict):
            continue
        value = payload.get("value")
        if value is None:
            continue
        cid = safe_chunk_id(payload.get("chunk_id"), hits)
        quote = payload.get("quote") if isinstance(payload.get("quote"), str) else None
        et = ExtractedTerm(term_key=key, chunk_id=cid, quote=quote, confidence="High")
        if term.is_numeric and isinstance(value, (int, float)):
            et.value_num = float(value)
            et.extraction_type = "table_value"
        else:
            et.value_text = str(value)
            et.extraction_type = "quote" if term.vtype == "quote" else "documentary_fact"
            if term.vtype == "quote" and quote is None:
                et.quote = str(value)
        out.append(et)
    return out


async def extract_deal_terms(retrieve) -> List[ExtractedTerm]:
    """Deterministic baseline, then LLM section passes (budget-gated) that override
    it where the model finds a confident value."""
    terms: Dict[str, ExtractedTerm] = {}
    hits = await retrieve(_BROAD_QUERY, 12)
    for t in derive_deal_terms([(h.chunk_id, h.text) for h in hits]):
        terms[t.term_key] = t

    if get_settings().anthropic_api_key and budget.llm_allowed():
        for section_key in _LLM_SECTION_ORDER:
            if not budget.llm_allowed():
                break
            try:
                for t in await _llm_section_terms(retrieve, section_key):
                    terms[t.term_key] = t
            except Exception as e:  # noqa: BLE001
                logger.warning("CP-4D LLM section %s failed: %s", section_key, e)
    return list(terms.values())


async def synthesize_deal_terms(cp1: ModulePayload, retrieve) -> ModulePayload:
    """Build the CP-4D payload: the extracted term set (for projection into
    deal_terms) plus CP-5B claims/evidence for the quantified / quoted terms.
    ``cp1`` anchors the run to an issuer; ``retrieve`` is the runner's BM25."""
    extracted = await extract_deal_terms(retrieve)

    if not extracted:
        reason = "No covenant/term disclosures extracted from ingested sources."
        return ModulePayload(
            module_id="CP-4D", module_name="DealTermsExtractor",
            owned_object="deal_term_set",
            runtime_output={"terms": [], "coverage": {"extracted": 0, "catalog": len(BY_KEY)}},
            confidence="Insufficient Information", limitation_flags=[reason],
            downstream_consumers=["CP-RENDER", "CP-COMPARE"],
        )

    covlite = next((t for t in extracted if t.term_key == "cov_lite"), None)
    structure = "cov-lite" if (covlite and covlite.value_text == "Yes") else ("maintenance" if covlite else "unknown")

    claims: List[ClaimSpec] = []
    # Claim only the terms with a real source span, highest-confidence first.
    claimable = [t for t in extracted if t.chunk_id and (t.value_num is not None or t.value_text)]
    for i, t in enumerate(claimable[:MAX_CLAIMS]):
        label = BY_KEY[t.term_key].label
        shown = t.value_text if t.value_text is not None else t.value_num
        claims.append(ClaimSpec(
            claim_id=f"C-DT{i:02d}",
            claim_text=f"{label}: {shown}",
            evidence=[EvidenceSpec(
                f"E-DT{i:02d}", t.extraction_type, t.lineage_class,
                f"{label} (governing document)", t.confidence, resolved_chunk_id=t.chunk_id,
            )],
        ))

    sourced = sum(1 for t in extracted if t.chunk_id)
    return ModulePayload(
        module_id="CP-4D", module_name="DealTermsExtractor",
        owned_object="deal_term_set",
        runtime_output={
            "terms": [asdict(t) for t in extracted],
            "covenant_structure": structure,
            "coverage": {"extracted": len(extracted), "sourced": sourced, "catalog": len(BY_KEY)},
        },
        confidence="High" if sourced else "Medium",
        limitation_flags=([] if sourced else ["No term resolved to a source chunk; values are inferred."]),
        downstream_consumers=["CP-RENDER", "CP-COMPARE", "CP-6E"],
        claims=claims,
    )
