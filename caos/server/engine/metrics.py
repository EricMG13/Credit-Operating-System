"""The metric dictionary (the queryable catalog) and run-output extraction.

``METRIC_CATALOG`` is the closed vocabulary the NL→query translator and the UI
both draw from — defining it *is* the "dictionary" cross-issuer query ranges
over. ``extract_facts`` projects a completed run's CP-1 normalized_financials
into structured, cited metric facts (the run-derived half of ``metric_facts``)
— including a computed fcf_conversion when CP-1 carries an FCF series — and
``extract_cost_facts`` projects CP-2's evidence-grounded energy_cost_pct.
gross_margin remains seed-only illustrative (populated by seed_metrics, never
faked from a run).
"""

from __future__ import annotations

import math
import re
from dataclasses import asdict, dataclass
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

from sqlalchemy import ColumnElement

from database import MetricFact
from engine.gate import Finding
from engine.periods import is_finite_number, latest, latest_annual, safe_div, sort_key
from engine.schemas import ModulePayload


def _as_dict(x: object) -> dict:
    """Interior containers of live runtime_output are unvalidated below the top
    level, and ``or {}`` keeps a truthy non-dict (a list-of-objects revenue, a
    narrative string) whose ``.keys()/.items()/.get()`` would raise inside the
    fatal projection phase and abort + roll back the whole run (BE3-3). The
    container-level twin of the leaf-level ``is_finite_number`` gate in add()."""
    return x if isinstance(x, dict) else {}


@dataclass(frozen=True)
class MetricDef:
    key: str
    label: str
    unit: str            # "x" | "%" | "$M"
    category: str        # profitability | leverage | scale | cash | cost exposure
    higher_is_better: bool
    description: str


METRIC_CATALOG: List[MetricDef] = [
    MetricDef("revenue", "Revenue", "$M", "scale", True,
              "LTM total revenue."),
    MetricDef("adj_ebitda", "Adj. EBITDA", "$M", "scale", True,
              "LTM adjusted EBITDA."),
    MetricDef("ebitda_margin", "EBITDA margin", "%", "profitability", True,
              "Adjusted EBITDA as a percent of revenue."),
    MetricDef("gross_margin", "Gross margin", "%", "profitability", True,
              "Gross profit as a percent of revenue."),
    MetricDef("net_leverage", "Net leverage", "x", "leverage", False,
              "Net debt / adjusted EBITDA (lower is stronger credit)."),
    MetricDef("interest_coverage", "Interest coverage", "x", "leverage", True,
              "Adjusted EBITDA / interest."),
    # Key kept for payload stability; display renamed — the computation (below)
    # is FCF / revenue (an FCF margin), NOT the desk's FCF/EBITDA "conversion".
    MetricDef("fcf_conversion", "FCF margin", "%", "cash", True,
              "Free cash flow as a percent of revenue."),
    MetricDef("energy_cost_pct", "Energy cost exposure", "%", "cost exposure", False,
              "Energy as a percent of the cost base — a proxy for how exposed "
              "margins are to energy-price inflation (higher = more exposed)."),
    MetricDef("altman_z", "Altman Z''", "", "distress", True,
              "Altman Z''-Score from the XBRL balance sheet (private-firm variant): "
              "below 1.1 distress, 1.1-2.6 grey, above 2.6 safe (higher is safer)."),
]

CATALOG_BY_KEY: Dict[str, MetricDef] = {m.key: m for m in METRIC_CATALOG}


def headline_fact_predicates(keys: Iterable[str]) -> List[ColumnElement[bool]]:
    """The three predicates that define "a valid, non-Blocked headline fact" in the
    ``MetricFact`` store: headline, in the requested ``keys`` set, and not QA-Blocked.
    ``keys`` need only be iterable — callers pass tuples, lists, or (as in
    ``queryinsights._delta_entries``) a dict keyed by metric key.

    The store's structurally-different readers (``peers._peer_facts``,
    ``metricengine._headline_facts_by_issuer``, ``metricfactlane._raw_facts``,
    ``queryinsights._delta_entries``) each spread ``*headline_fact_predicates(keys)``
    into their own ``select(...).where(...)`` and keep every other predicate (columns,
    joins, provenance policy, complete-run join, cap, order) their own — so this guard
    has one tested home instead of four restatements. It is defense-in-depth behind the
    runner's Blocked-CP-1 write-skip: a QA-Blocked or wrong-key figure can never enter a
    peer median or a cross-issuer answer."""
    return [MetricFact.headline.is_(True), MetricFact.metric_key.in_(list(keys)),
            MetricFact.qa_status != "Blocked"]


# ── Provenance precedence (the ONE ranking every read-side collapse uses) ────
# Minted values: run (QA-gated engine), fixture (genuine ATLF demo),
# demo_fixture (fabricated — flagged, never authoritative), derived
# (chunk-extracted), seed (illustrative). Read-side rule, pinned by
# test_fact_collapse.py: run/fixture tier beats everything else, then newest
# created_at within a tier. Five sites used to re-implement this with
# divergent vocabularies (nlquery vs querygraph vs peers vs sponsors vs the
# issuer profile), so the same issuer showed different numbers per surface.
DERIVED_PROVENANCE = ("run", "fixture")


def provenance_tier(provenance: Optional[str]) -> int:
    """Collapse tier: a real run OR the demo fixture outranks seed (#04)."""
    return 1 if provenance in DERIVED_PROVENANCE else 0


def better_fact(prev, fact) -> bool:
    """True if ``fact`` should replace ``prev`` for one (issuer, metric):
    run/fixture tier beats seed, then newest created_at within a tier; null
    created_at keeps prev. The reference comparator for every fact collapse."""
    if prev is None:
        return True
    pt, ft = provenance_tier(prev.provenance), provenance_tier(fact.provenance)
    if ft != pt:
        return ft > pt
    return bool(fact.created_at and prev.created_at and fact.created_at > prev.created_at)


def catalog_dicts() -> List[dict]:
    """The catalog as plain dicts (for the API and the LLM system prompt)."""
    return [asdict(m) for m in METRIC_CATALOG]


# metric_key -> keywords used to find the CP-1 claim that supports it, so each
# run-derived fact can cite the claim/evidence/chunk behind it.
_CITE_KEYWORDS: Dict[str, List[str]] = {
    "net_leverage": ["leverage"],
    "interest_coverage": ["coverage", "interest"],
    "adj_ebitda": ["ebitda", "add-back"],
    "revenue": ["revenue"],
    "altman_z": ["altman"],
}


def _citation(payload: ModulePayload, metric_key: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """(claim_id, evidence_id, chunk_id) for the metric, or (None, None, None)."""
    for c in payload.claims:
        text = c.claim_text.lower()
        if any(k in text for k in _CITE_KEYWORDS.get(metric_key, [])):
            ev = c.evidence[0] if c.evidence else None
            return c.claim_id, (ev.evidence_id if ev else None), (ev.resolved_chunk_id if ev else None)
    return None, None, None


def _is_ltm(period: str) -> bool:
    return period.upper().startswith("LTM")


def _headline_period(periods: Sequence[str]) -> Optional[str]:
    """The period whose value is the cross-issuer headline: an explicit LTM /
    trailing period if one exists (the fixture/LLM case), else the most recent
    fiscal year (the EDGAR annual-filer case, where the latest 10-K *is* the
    headline). Keeps headline selection correct for both provenances."""
    periods = list(periods)
    if not periods:
        return None
    # Prefer an explicit LTM/trailing period as the headline; among ties pick the
    # MOST RECENT (total order), not whichever happened to come first.
    ltm = [p for p in periods if _is_ltm(p)]
    return max(ltm or periods, key=sort_key)


def extract_facts(  # noqa: C901
    run_id: str, payload: ModulePayload, qa_status: str, *, is_reference_issuer: bool = True
) -> List[dict]:
    """Project CP-1 normalized_financials into MetricFact kwarg dicts (run-derived).

    Emits revenue / adj_ebitda per period, a computed ebitda_margin, and the LTM
    net_leverage / interest_coverage. Each metric is cited back to the CP-1 claim
    that asserts it where one matches. LTM periods are the headline values used
    for cross-issuer ranking.

    ``is_reference_issuer`` distinguishes the genuine Atlas Forge demo issuer (for
    which the fixture *is* the intended demo content) from any other issuer the
    keyless fixture path served the same demo numbers to. A fixture payload for a
    NON-reference issuer is tagged ``demo_fixture`` provenance — clearly non-
    authoritative — rather than the plain ``fixture`` provenance the genuine demo
    keeps, so a UI/peer read never mistakes fabricated demo figures for a real run.
    """
    ro = payload.runtime_output or {}
    fin = _as_dict(ro.get("normalized_financials"))
    rev = _as_dict(fin.get("revenue"))
    eb = _as_dict(fin.get("adj_ebitda"))
    # EDGAR = reported GAAP; issuer-disclosed = reported_disclosure (distinct from
    # fully-modeled/fixture); fixture/LLM carry covenant-adjusted figures. (#27)
    raw_basis = ro.get("basis")
    basis = {"reported_gaap_xbrl": "reported", "reported_disclosure": "reported_disclosure"}.get(
        raw_basis if isinstance(raw_basis, str) else "", "adjusted")
    # A fixture-sourced CP-1 (ATLF demo numbers) must not enter the cross-issuer store
    # as a real run (#04). The genuine demo issuer keeps "fixture"; the same fixture
    # served for ANOTHER issuer is "demo_fixture" — fabricated, flagged as such. (#10)
    if getattr(payload, "is_fixture", False):
        provenance = "fixture" if is_reference_issuer else "demo_fixture"
    else:
        provenance = "run"
    # Money unit honours the payload's disclosed currency: a reported-disclosure
    # CP-1 for a GBP/EUR filer (reported_cp1.py stores runtime_output["currency"])
    # must not project £/€ magnitudes into the shared cross-issuer store labeled
    # "$M" — a silent unit mismatch in every cross-issuer ranking. (#AA4)
    cur = ro.get("currency")
    money_unit = f"{cur}M" if isinstance(cur, str) and cur and cur != "$" else "$M"
    facts: List[dict] = []

    def add(metric_key: str, period: str, value, unit: str, headline: bool) -> None:
        # is_finite_number (not just `value is None`): a live LLM CP-1 can emit a NaN/
        # ±inf figure, which would otherwise land as a NaN MetricFact in the SHARED
        # cross-issuer store and contaminate peer medians for *other* issuers. Drop
        # any non-finite value at the projection boundary. (bool is accepted as int.)
        if not is_finite_number(value):
            return
        cid, eid, chunk = _citation(payload, metric_key)
        facts.append(dict(
            run_id=run_id, module_id=payload.module_id, metric_key=metric_key,
            period=period, value=float(value), unit=unit, headline=headline,
            qa_status=qa_status, source_claim_id=cid, source_evidence_id=eid,
            document_chunk_id=chunk, provenance=provenance, basis=basis,
        ))

    rev_headline = _headline_period(list(rev.keys()))
    eb_headline = _headline_period(list(eb.keys()))
    for period, v in rev.items():
        add("revenue", period, v, money_unit, period == rev_headline)
    for period, v in eb.items():
        add("adj_ebitda", period, v, money_unit, period == eb_headline)
        rv = rev.get(period)
        # Both operands must be finite before the divide: a NaN rv is truthy, so a
        # bare `isinstance(rv,..) and rv` would let NaN through and poison the margin
        # (add() would then drop it, but compute it cleanly here regardless). safe_div
        # concentrates that guard; scale the numerator so arithmetic order is unchanged.
        # v needs its own guard BEFORE the scaling: the live CP-1 schema permits null
        # leaves ("set undisclosed metrics to null"), and 100 * None raises TypeError
        # before safe_div ever sees it — killing the whole run at projection.
        m = safe_div(100 * v, rv) if is_finite_number(v) else None
        if m is not None:
            add("ebitda_margin", period, round(m, 1), "%", period == eb_headline)

    # Free cash flow + cash conversion (FCF / revenue), per period. Conversion is
    # derived here from the FCF and revenue series, not trusted as an input.
    fcf = _as_dict(fin.get("free_cash_flow"))
    fcf_headline = _headline_period(list(fcf.keys()))
    for period, v in fcf.items():
        add("fcf", period, v, money_unit, period == fcf_headline)
        rv = rev.get(period)
        # same null-leaf guard as ebitda_margin above: 100 * None raises
        m = safe_div(100 * v, rv) if is_finite_number(v) else None
        if m is not None:
            add("fcf_conversion", period, round(m, 1), "%", period == fcf_headline)

    # Net leverage: a per-period series (drives the leverage trend) when CP-1
    # provides one; else the single LTM scalar. Interest coverage stays LTM.
    lev = _as_dict(fin.get("net_leverage"))
    if lev:
        lev_headline = _headline_period(list(lev.keys()))
        for period, v in lev.items():
            add("net_leverage", period, v, "x", period == lev_headline)
    else:
        add("net_leverage", "LTM", fin.get("net_leverage_adj_ltm"), "x", True)
    add("interest_coverage", "LTM", fin.get("interest_coverage_ltm"), "x", True)
    # Altman Z'' distress score (EDGAR-derived; lives outside normalized_financials).
    dz = _as_dict((payload.runtime_output or {}).get("distress"))
    add("altman_z", "LTM", dz.get("altman_z"), "", True)
    return facts


def extract_cost_facts(run_id: str, payload: ModulePayload, qa_status: str) -> List[dict]:
    """Project CP-2 CostStructure into a MetricFact kwarg dict (run-derived).

    Lands energy_cost_pct as a run-provenance, headline fact cited to the CP-2
    claim/evidence/chunk that asserts it. Empty if the module derived no value.
    """
    val = (payload.runtime_output or {}).get("energy_cost_pct")
    # is_finite_number (not a bare `is None`): CP-2's runtime_output is LLM-authored
    # and energy_cost_pct is NOT pinned in the CP-2 tool schema (synth pins only the
    # 9 dimensions + credit_implication), so a live/replayed payload can carry a NaN
    # float or a non-numeric string. float(val) on a NaN would land a non-finite value
    # in the SHARED cross-issuer store (poisoning peer ranking + 500-ing the /query
    # response), and a string would raise inside the runner's fact-projection block —
    # which sits OUTSIDE per-module isolation, so it fails the whole run (BE5-3). Drop
    # any non-finite value at the projection boundary, exactly like extract_facts.add().
    if not is_finite_number(val):
        return []
    claim_id = evidence_id = chunk = None
    for c in payload.claims:
        if c.evidence:
            claim_id, ev = c.claim_id, c.evidence[0]
            evidence_id, chunk = ev.evidence_id, ev.resolved_chunk_id
            break
    return [dict(
        run_id=run_id, module_id=payload.module_id, metric_key="energy_cost_pct",
        period="LTM", value=float(val), unit="%", headline=True, qa_status=qa_status,
        source_claim_id=claim_id, source_evidence_id=evidence_id,
        document_chunk_id=chunk, provenance="run", basis=None,  # energy is basis-agnostic
    )]


def leverage_plausibility_finding(cp1: Optional[ModulePayload]) -> Optional[Finding]:
    """MATERIAL CP-5B finding when CP-1's asserted net leverage disagrees with
    net_debt / latest adj-EBITDA beyond a rounding band — a deterministic
    cross-check that catches a live LLM emitting an internally-inconsistent
    leverage (the open runtime_output schema, #21). Skipped when any input is
    absent (e.g. a reported-disclosure CP-1 that carries leverage but no net debt);
    the deterministic EDGAR/fixture paths compute leverage consistently, so they
    never trip it."""
    if cp1 is None:
        return None
    # _as_dict: a truthy non-dict normalized_financials (live-LLM narrative
    # string) must degrade to "inputs absent", not AttributeError in the QA
    # phase where a raise aborts the whole run (BE3-2). latest() tolerates a
    # malformed adj_ebitda series itself.
    nf = _as_dict((cp1.runtime_output or {}).get("normalized_financials"))
    lev, nd = nf.get("net_leverage_adj_ltm"), nf.get("net_debt_ltm")
    eb = latest_annual(nf.get("adj_ebitda") or {})
    if not (is_finite_number(lev) and lev and is_finite_number(nd) and nd
            and is_finite_number(eb) and eb):
        return None
    recomputed = safe_div(nd, eb)
    if recomputed is None:
        # The guard above proved nd, eb finite and non-zero, so None here means
        # |nd / eb| overflowed float range — maximally inconsistent with any finite
        # asserted leverage. Fall through with inf so the MATERIAL finding FIRES
        # (the pre-safe_div behavior) instead of silently suppressing the check
        # exactly when the CP-1 figures are most absurd.
        recomputed = math.inf
    # Relative deviation against abs(lev): a net-cash issuer has NEGATIVE net
    # leverage, and dividing by the signed lev would make the ratio negative —
    # always <= 0.05 — so EVERY negative asserted leverage (and any sign-flip
    # vs the recomputed value) would silently escape this MATERIAL cross-check.
    # A None deviation means the numerator overflowed (recomputed is inf or the
    # spread exceeds float range) — that is maximal deviation, so fall through
    # and fire rather than treating None as "within band".
    deviation = safe_div(abs(recomputed - lev), abs(lev))
    if deviation is not None and deviation <= 0.05:
        return None
    return Finding(
        finding_id="CP-1-LEV-PLAUS", severity="MATERIAL", lane=6, module_id="CP-1",
        description=(
            f"Asserted net leverage {lev:g}x disagrees with net debt / LTM adjusted EBITDA "
            f"({nd:g} / {eb:g} = {recomputed:.2f}x) — the CP-1 figures are internally inconsistent."
        ),
        required_remediation="Reconcile the asserted leverage against net debt and adjusted EBITDA.",
    )


# The headline metrics a CP-1 must carry at least one of to be a real credit
# foundation. `revenue`/`adj_ebitda` are period series (checked via latest());
# leverage/coverage are LTM scalars.
_CP1_HEADLINE_SERIES = ("revenue", "adj_ebitda", "free_cash_flow")
_CP1_HEADLINE_SCALARS = ("net_leverage_adj_ltm", "interest_coverage_ltm", "net_debt_ltm")



def cp1_completeness_finding(cp1: Optional[ModulePayload]) -> Optional[Finding]:
    """MATERIAL finding when a CP-1 asserts real confidence yet carries NO finite
    headline metric — the numeric-completeness lane the CP-5 gate otherwise lacks.

    The deterministic gate (gate.py) only maps finding severity; nothing checks that
    CP-1 actually produced numbers, so a live-LLM CP-1 that passes schema validation
    but leaves every metric null (or NaN-degraded-to-absent) rolls up Passed ->
    Committee Ready and becomes exportable. Every legitimate producer (EDGAR emits at
    least revenue; reported-disclosure emits net leverage; the fixture is full) carries
    at least one finite headline metric, so this only fires on a genuinely empty-but-
    confident CP-1 — never on a net-cash issuer (which still has revenue/EBITDA) or a
    CP-1 that honestly reports ``Insufficient Information``.
    """
    if cp1 is None:
        return None
    # An honestly-insufficient CP-1 is already surfaced (confidence -> committee
    # status "Insufficient Information"); don't double-flag it.
    if cp1.confidence == "Insufficient Information":
        return None
    nf = (cp1.runtime_output or {}).get("normalized_financials") or {}
    has_series = any(is_finite_number(latest(nf.get(k) or {})) for k in _CP1_HEADLINE_SERIES)
    has_scalar = any(is_finite_number(nf.get(k)) for k in _CP1_HEADLINE_SCALARS)
    if has_series or has_scalar:
        return None
    return Finding(
        finding_id="CP-1-INCOMPLETE", severity="MATERIAL", lane=6, module_id="CP-1",
        description=(
            f"CP-1 reports {cp1.confidence} confidence but its normalized_financials carry no "
            "finite headline metric (revenue, adjusted EBITDA, net leverage, or coverage) — the "
            "canonical foundation is empty, so downstream leverage/recovery/covenant reads have "
            "no numbers to stand on and the run must not ship as committee-ready."
        ),
        required_remediation="Re-run CP-1 against usable source financials, or mark it Insufficient Information.",
    )


# ponytail: a flat absolute ceiling, not a peer-band — CP-1C peer infra isn't
# reachable from this call site (peer_outlier_finding runs off a different
# module). Swap for a peer-band once that's wired here. 8.0x is beyond where a
# broadly-syndicated leveraged loan is underwritten at close; real distressed
# names can still exceed it, which is exactly why this stays MINOR/advisory.
_LEVERAGE_SANITY_CEILING = 8.0


def leverage_magnitude_finding(cp1: Optional[ModulePayload]) -> Optional[Finding]:
    """MINOR (advisory, non-gating) CP-5B finding when CP-1's asserted net
    leverage falls outside a plausible sanity band, regardless of whether it is
    internally self-consistent with net debt / adjusted EBITDA.

    leverage_plausibility_finding only catches an asserted leverage that
    disagrees with net_debt_ltm / adj_ebitda; it is silent when a fabrication
    keeps those two internally consistent (e.g. true leverage 3.0x fabricated to
    10.0x by also fabricating net_debt_ltm so 2500/250 recomputes to exactly
    10.0x — adversarially confirmed 2026-07-11, see
    test_cp1_grounding.py::test_net_debt_leverage_fabrication_now_caught_by_leverage_magnitude_finding).
    This is a magnitude-only, defense-in-depth backstop: it does not care
    whether the figures agree with each other, only whether the asserted number
    itself is plausible for a leveraged-loan issuer.

    DELIBERATELY MINOR, NOT MATERIAL: an absolute ceiling has a real
    false-positive population — genuinely distressed issuers legitimately run
    leverage past any fixed band — so this stays advisory (visible, queryable)
    rather than gating, same tradeoff as cp1_grounding_finding's FX
    false-positive. Checks ``abs(lev)`` so an implausible net-CASH position
    (a large negative leverage) is caught symmetrically."""
    if cp1 is None:
        return None
    nf = _as_dict((cp1.runtime_output or {}).get("normalized_financials"))
    lev = nf.get("net_leverage_adj_ltm")
    if not is_finite_number(lev) or abs(lev) <= _LEVERAGE_SANITY_CEILING:
        return None
    return Finding(
        finding_id="CP-1-LEV-MAGNITUDE", severity="MINOR", lane=6, module_id="CP-1",
        description=(
            f"Asserted net leverage {lev:g}x falls outside the "
            f"±{_LEVERAGE_SANITY_CEILING:g}x plausibility band for a leveraged-loan "
            "issuer. Internally consistent with net debt / adjusted EBITDA, but the "
            "magnitude itself warrants verification against the source documents."
        ),
        required_remediation="Verify the asserted net leverage magnitude against the issuer's actual filings/documents.",
    )


def cp1_grounding_finding(cp1: Optional[ModulePayload]) -> Optional[Finding]:
    """MINOR (advisory, non-gating) CP-5B finding when CP-1's headline revenue AND
    adjusted EBITDA both have no basis in the retrieved source documents — the
    complementary check to leverage_plausibility_finding, which only catches an
    internally INCONSISTENT figure. A live model can hallucinate (or an injected
    filing can steer) a self-consistent but fabricated income statement that
    passes that check untouched; this surfaces it by requiring the underlying
    figures to round-match something the model actually retrieved. Fires only
    when BOTH figures are ungrounded — a single miss is tolerated (a legitimate
    currency/period-convention mismatch on one figure alone should not restrict
    the module).

    DELIBERATELY MINOR, NOT MATERIAL, for v1 (adversarially reviewed
    2026-07-11): a non-USD issuer's FX-converted figures legitimately fail to
    round-match native-currency source text — a real, population-level false-
    positive with no currency signal in the schema yet to suppress it — so this
    finding is surfaced in the evidence trail (visible, queryable) without
    forcing "Restricted" on a genuinely correct run. Promote to MATERIAL once a
    currency/basis signal exists to skip non-USD issuers. Does not, alone, close
    a fabrication that keeps revenue/EBITDA correct while inventing net_debt/
    leverage — that passes both this and leverage_plausibility_finding untouched;
    see leverage_magnitude_finding, the magnitude-only backstop that catches it.

    Set by engine.synth._ground_cp1_headline_figures at synthesis time; empty
    (never fires) for the deterministic EDGAR/reported/fixture paths and for any
    live run where no documents were retrieved."""
    if cp1 is None or len(cp1.ungrounded_headline_figures) < 2:
        return None
    fields = ", ".join(cp1.ungrounded_headline_figures)
    return Finding(
        finding_id="CP-1-UNGROUNDED", severity="MINOR", lane=6, module_id="CP-1",
        description=(
            f"CP-1 headline figures ({fields}) do not round-match any retrieved "
            "source chunk — the income statement has no apparent basis in the "
            "ingested documents. (Advisory: not gating in v1 — see function "
            "docstring for the FX false-positive limitation.)"
        ),
        required_remediation="Verify the normalized financials against the issuer's actual filings/documents.",
    )


# Energy cost exposure stated as a percent of the cost base, alongside an
# energy keyword — the specific "N percent of cost of goods sold" pattern avoids
# grabbing unrelated percentages (e.g. a gross-margin figure in the same chunk).
_ENERGY_CHECK = re.compile(r"energy|power|natural\s+gas|electricity|fuel", re.IGNORECASE)
_COST_PCT_RE = re.compile(
    r"(\d+(?:\.\d+)?)\s*(?:percent|%)\s+of\s+(?:the\s+)?(?:cost of goods sold|cogs|cost base)",
    re.IGNORECASE,
)


def derive_energy_cost_pct(
    chunks: Sequence[Tuple[str, str, str]]
) -> Optional[Tuple[float, str, str]]:
    """Extract energy-as-%-of-cost-base from an issuer's document chunks.

    ``chunks`` is ``(chunk_id, doc, text)``. Returns ``(value, chunk_id, doc)`` for
    the first chunk that both mentions energy and states a cost-base percentage,
    else None. Deterministic and offline — the evidence-grounded counterpart to a
    hardcoded seed value for energy_cost_pct.
    """
    for chunk_id, doc, text in chunks:
        if not _ENERGY_CHECK.search(text):
            continue
        m = _COST_PCT_RE.search(text)
        if m:
            v = float(m.group(1))
            # Domain clamp (0, 100]: a matched percentage outside it is a mis-read
            # ("0 percent of cost base" / a stray figure), not a cost share — its
            # sibling extractors all range-guard, this one published a headline
            # MetricFact unclamped (audit 2026-07-10 S1). Degrade, never guess.
            if 0 < v <= 100:
                return v, chunk_id, doc
    return None
