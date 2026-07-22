"""Tests for engine/metricfactlane.py — the metric-fact SQL retrieval lane
(Phase 1 remainder).

The 4th fusion input: surfaces the raw curated ``metric_facts`` store as
first-class ``MetricFactEntry``s so the LLM narrates stored figures verbatim
instead of restating numbers from chunks. These tests pin: the query→metric-key
lexicon (synonym + label + key matching, word-boundary, case-insensitivity,
empty-on-no-match), the SQL retrieval (topic-filtered, scoped, latest-per-
(issuer,key), Blocked-excluded, empty-corpus degradation), the is_finite_number
guard, ranking by topic-match score, and the dedup-against-derivatives helper
that keeps the facts_note lean.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest

from database import (
    AsyncSessionLocal,
    Document,
    DocumentChunk,
    Issuer,
    MetricFact,
    Run,
)
from engine.metricfactlane import (
    _match_metric_keys,
    dedup_against_derivatives,
    retrieve_metric_facts,
)
from engine.metricengine import MetricFactEntry


# ── _match_metric_keys (pure) ────────────────────────────────────────────────

def test_match_leverage_synonyms():
    keys = _match_metric_keys("What is Acme's leverage ratio?")
    assert "net_leverage" in keys
    assert keys["net_leverage"] >= 1


def test_match_debt_synonym_maps_to_net_leverage():
    keys = _match_metric_keys("How much debt does Acme carry?")
    assert "net_leverage" in keys  # "debt" synonym


def test_match_coverage_and_interest():
    keys = _match_metric_keys("Can Acme cover its interest payments?")
    assert "interest_coverage" in keys  # "cover" + "interest" synonyms


def test_match_margin_maps_to_ebitda_margin():
    keys = _match_metric_keys("Tell me about Acme's margin trend")
    assert "ebitda_margin" in keys  # "margin" synonym


def test_match_revenue_sales_topline_synonyms():
    for q in ("Acme revenue", "Acme sales", "Acme top line"):
        assert "revenue" in _match_metric_keys(q)


def test_match_ebitda_does_not_false_positive_on_margin():
    # "EBITDA" alone should match adj_ebitda, not ebitda_margin (margin not present).
    keys = _match_metric_keys("Acme EBITDA")
    assert "adj_ebitda" in keys
    # ebitda_margin requires "margin" or "profitability" — not present here.
    assert "ebitda_margin" not in keys


def test_match_word_boundary_not_substring():
    # "leverage" must not match inside "leveraged-buyout" noise — word boundary.
    # Actually "leveraged" contains "leverage" as a substring; word-boundary
    # regex \bleverage\b does NOT match "leveraged" (the 'd' breaks the boundary).
    keys = _match_metric_keys("Acme completed a leveraged buyout")
    assert "net_leverage" not in keys  # \bleverage\b ≠ "leveraged"


def test_match_case_insensitive():
    keys = _match_metric_keys("WHAT IS ACME LEVERAGE?")
    assert "net_leverage" in keys


def test_match_empty_query_returns_empty():
    assert _match_metric_keys("") == {}
    assert _match_metric_keys("   ") == {}


def test_match_no_metric_terms_returns_empty():
    # A question about something unrelated → no metric keys → lane is a no-op.
    assert _match_metric_keys("Who is Acme's CFO?") == {}


def test_match_altman_distress_synonyms():
    keys = _match_metric_keys("Is Acme in distress territory?")
    assert "altman_z" in keys  # "distress" synonym


def test_match_multiple_metrics_ranked_by_score():
    # A query mentioning both leverage and margin → both matched; the one with
    # more synonym hits scores higher.
    keys = _match_metric_keys("Acme leverage and EBITDA margin trend")
    assert "net_leverage" in keys
    assert "ebitda_margin" in keys
    # "margin" + "ebitda margin" (label) + "ebitda_margin" (key) → margin scores
    # higher than leverage ("leverage" only).
    assert keys["ebitda_margin"] >= keys["net_leverage"]


# ── retrieve_metric_facts (integration) ──────────────────────────────────────

def _seed_chunks(db, issuer_id, chunk_ids):
    document_id = str(uuid.uuid4())
    db.add(
        Document(
            id=document_id,
            issuer_id=issuer_id,
            doc_type="TestEvidence",
            file_name=f"{document_id}.txt",
            storage_key=f"test/metric-facts/{document_id}.txt",
        )
    )
    for seq, chunk_id in enumerate(chunk_ids):
        db.add(
            DocumentChunk(
                id=chunk_id,
                document_id=document_id,
                seq=seq,
                text=f"Metric fact evidence {chunk_id}",
            )
        )


def _seed_run_facts(db, issuer_id, run_id, facts):
    """facts: [(metric_key, period, value, unit, headline, chunk_id)]"""
    _seed_chunks(db, issuer_id, [fact[5] for fact in facts])
    for key, period, value, unit, headline, chunk_id in facts:
        db.add(MetricFact(
            issuer_id=issuer_id, run_id=run_id, metric_key=key,
            period=period, value=value, unit=unit, headline=headline,
            qa_status="Pass", provenance="run", document_chunk_id=chunk_id,
            created_at=datetime.now(timezone.utc),
        ))


@pytest.mark.asyncio
async def test_retrieve_metric_facts_topic_filtered(seeded_db):
    """A query about leverage surfaces net_leverage facts, NOT revenue/margin
    facts even though those exist for the same issuer — the lane is
    topic-precision-targeted, not 'inject all KPIs'."""
    async with AsyncSessionLocal() as db:
        acme_id = str(uuid.uuid4())
        run_id = str(uuid.uuid4())
        db.add(Issuer(id=acme_id, name="Acme", industry="Chemicals"))
        db.add(Run(id=run_id, issuer_id=acme_id, status="complete",
                   qa_status="Pass", created_at=datetime.now(timezone.utc),
                   model_id="t", prompt_version="v"))
        await db.flush()
        _seed_run_facts(db, acme_id, run_id, [
            ("net_leverage", "FY2024", 4.4, "x", True, "c-leverage"),
            ("revenue", "FY2024", 1200.0, "$M", True, "c-revenue"),
            ("ebitda_margin", "FY2024", 22.5, "%", True, "c-margin"),
        ])
        await db.commit()
        out = await retrieve_metric_facts(db, "Acme leverage", issuer_ids=[acme_id])
    assert len(out) == 1
    assert out[0].id == f"fact:{acme_id}:net_leverage:raw:FY2024"
    assert out[0].numbers == [4.4, 2024.0]  # value + period year (grounding gate)
    assert "4.4x" in out[0].text
    assert out[0].chunk_id == "c-leverage"


@pytest.mark.asyncio
async def test_retrieve_metric_facts_scoped_to_issuer(seeded_db):
    """The issuer scope filter: a query scoped to Acme does not surface Beta's
    facts even when Beta has the same metric."""
    async with AsyncSessionLocal() as db:
        acme_id, beta_id = str(uuid.uuid4()), str(uuid.uuid4())
        run1, run2 = str(uuid.uuid4()), str(uuid.uuid4())
        db.add_all([
            Issuer(id=acme_id, name="Acme", industry="Chemicals"),
            Issuer(id=beta_id, name="Beta", industry="Chemicals"),
        ])
        db.add_all([
            Run(id=run1, issuer_id=acme_id, status="complete", qa_status="Pass",
                created_at=datetime.now(timezone.utc), model_id="t", prompt_version="v"),
            Run(id=run2, issuer_id=beta_id, status="complete", qa_status="Pass",
                created_at=datetime.now(timezone.utc), model_id="t", prompt_version="v"),
        ])
        await db.flush()
        _seed_run_facts(db, acme_id, run1, [("net_leverage", "FY2024", 4.4, "x", True, "ca")])
        _seed_run_facts(db, beta_id, run2, [("net_leverage", "FY2024", 5.5, "x", True, "cb")])
        await db.commit()
        out = await retrieve_metric_facts(db, "leverage", issuer_ids=[acme_id])
    assert all(e.issuer_id == acme_id for e in out)
    assert len(out) == 1


@pytest.mark.asyncio
async def test_retrieve_metric_facts_unscoped_across_book(seeded_db):
    """Unscoped (``issuer_ids=None``) → facts from all issuers with the matched
    metric, ranked by topic-match score then issuer id."""
    async with AsyncSessionLocal() as db:
        acme_id, beta_id = str(uuid.uuid4()), str(uuid.uuid4())
        run1, run2 = str(uuid.uuid4()), str(uuid.uuid4())
        db.add_all([
            Issuer(id=acme_id, name="Acme", industry="Chemicals"),
            Issuer(id=beta_id, name="Beta", industry="Chemicals"),
        ])
        db.add_all([
            Run(id=run1, issuer_id=acme_id, status="complete", qa_status="Pass",
                created_at=datetime.now(timezone.utc), model_id="t", prompt_version="v"),
            Run(id=run2, issuer_id=beta_id, status="complete", qa_status="Pass",
                created_at=datetime.now(timezone.utc), model_id="t", prompt_version="v"),
        ])
        await db.flush()
        _seed_run_facts(db, acme_id, run1, [("net_leverage", "FY2024", 4.4, "x", True, "ca")])
        _seed_run_facts(db, beta_id, run2, [("net_leverage", "FY2024", 5.5, "x", True, "cb")])
        await db.commit()
        out = await retrieve_metric_facts(db, "leverage", issuer_ids=None)
    # Unscoped → facts from all issuers with the matched metric (the reference
    # deal's issuers may also contribute). Assert my two seeded issuers surface.
    out_iids = {e.issuer_id for e in out}
    assert acme_id in out_iids
    assert beta_id in out_iids
    # Every entry is a net_leverage raw fact (the topic-matched key).
    assert all(":net_leverage:raw:" in e.id for e in out)


@pytest.mark.asyncio
async def test_retrieve_metric_facts_no_match_returns_empty(seeded_db):
    """A query about nothing metric → empty list (lane is a no-op)."""
    async with AsyncSessionLocal() as db:
        out = await retrieve_metric_facts(db, "Who is Acme's CFO?", issuer_ids=None)
    assert out == []


@pytest.mark.asyncio
async def test_retrieve_metric_facts_empty_corpus(seeded_db):
    """Matched key but no stored facts → empty list, not an error."""
    async with AsyncSessionLocal() as db:
        acme_id = str(uuid.uuid4())
        db.add(Issuer(id=acme_id, name="Acme", industry="Chemicals"))
        await db.commit()
        out = await retrieve_metric_facts(db, "leverage", issuer_ids=[acme_id])
    assert out == []


@pytest.mark.asyncio
async def test_retrieve_metric_facts_blocked_excluded(seeded_db):
    """A gate-Blocked fact must never feed the lane — defense-in-depth."""
    async with AsyncSessionLocal() as db:
        acme_id = str(uuid.uuid4())
        run_id = str(uuid.uuid4())
        db.add(Issuer(id=acme_id, name="Acme", industry="Chemicals"))
        db.add(Run(id=run_id, issuer_id=acme_id, status="complete",
                   qa_status="Pass", created_at=datetime.now(timezone.utc),
                   model_id="t", prompt_version="v"))
        await db.flush()
        _seed_chunks(db, acme_id, ["c"])
        db.add(MetricFact(
            issuer_id=acme_id, run_id=run_id, metric_key="net_leverage",
            period="FY2024", value=4.4, unit="x", headline=True,
            qa_status="Blocked", provenance="run", document_chunk_id="c",
            created_at=datetime.now(timezone.utc),
        ))
        await db.commit()
        out = await retrieve_metric_facts(db, "leverage", issuer_ids=[acme_id])
    assert out == []


def test_render_entries_nan_value_filtered():
    """A NaN raw fact must not enter the numbers set — CLAUDE.md engine conv.

    The DB layer (SQLite) converts NaN→NULL and rejects the insert on the NOT
    NULL constraint, so the guard is exercised at the render layer
    (``_render_entries``) which gates every value via ``is_finite_number``
    before it enters the closed ``numbers`` set. A NaN slipping past a plain
    ``isinstance(x, (int, float))`` check would poison the numeric gate's
    grounding pool — ``is_finite_number`` rejects it."""
    from engine.metricfactlane import _render_entries
    from database import MetricFact

    nan_fact = MetricFact(
        issuer_id="i1", run_id="r1", metric_key="net_leverage",
        period="FY2024", value=float("nan"), unit="x", headline=True,
        qa_status="Pass", provenance="run", document_chunk_id="c",
    )
    out = _render_entries([nan_fact], {"i1": "Acme"}, {"net_leverage": 1}, None)
    assert out == []  # NaN filtered by is_finite_number


def test_period_year_extracts_four_digit_year():
    from engine.metricfactlane import _period_year
    assert _period_year("FY2024") == 2024.0
    assert _period_year("Q1-2024") == 2024.0
    assert _period_year("LTM") is None
    assert _period_year("") is None
    assert _period_year("H1-2023") == 2023.0


def test_render_entries_includes_period_year_in_numbers():
    """The grounding gate's numeral regex pulls the year from any sentence
    stating the period (``"FY2024"``), so the year must be in the closed
    ``numbers`` set or a correct sentence gets dropped. The year is
    deterministic from the stored fact (not fabricated)."""
    from engine.metricfactlane import _render_entries
    from database import MetricFact

    fact = MetricFact(
        issuer_id="i1", run_id="r1", metric_key="net_leverage",
        period="FY2024", value=4.4, unit="x", headline=True,
        qa_status="Pass", provenance="run", document_chunk_id="c",
    )
    out = _render_entries([fact], {"i1": "Acme"}, {"net_leverage": 1}, None)
    assert len(out) == 1
    assert out[0].numbers == [4.4, 2024.0]  # value + period year
    assert "(FY2024)" in out[0].text


@pytest.mark.asyncio
async def test_retrieve_metric_facts_latest_per_issuer_key(seeded_db):
    """Two complete runs for the same (issuer, key) → only the latest
    (most recent created_at) headline fact surfaces."""
    from datetime import timedelta
    async with AsyncSessionLocal() as db:
        acme_id = str(uuid.uuid4())
        run_old, run_new = str(uuid.uuid4()), str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        old_ts = now - timedelta(seconds=10)
        new_ts = now
        db.add(Issuer(id=acme_id, name="Acme", industry="Chemicals"))
        db.add_all([
            Run(id=run_old, issuer_id=acme_id, status="complete", qa_status="Pass",
                created_at=old_ts, model_id="t", prompt_version="v"),
            Run(id=run_new, issuer_id=acme_id, status="complete", qa_status="Pass",
                created_at=new_ts, model_id="t", prompt_version="v"),
        ])
        await db.flush()
        _seed_chunks(db, acme_id, ["c-old", "c-new"])
        # Older run's fact
        db.add(MetricFact(
            issuer_id=acme_id, run_id=run_old, metric_key="net_leverage",
            period="FY2023", value=4.0, unit="x", headline=True,
            qa_status="Pass", provenance="run", document_chunk_id="c-old",
            created_at=old_ts))
        # Newer run's fact
        db.add(MetricFact(
            issuer_id=acme_id, run_id=run_new, metric_key="net_leverage",
            period="FY2024", value=4.4, unit="x", headline=True,
            qa_status="Pass", provenance="run", document_chunk_id="c-new",
            created_at=new_ts))
        await db.commit()
        out = await retrieve_metric_facts(db, "leverage", issuer_ids=[acme_id])
    assert len(out) == 1
    assert out[0].numbers[0] == 4.4  # the latest value (year may also be present)
    assert out[0].chunk_id == "c-new"


# ── dedup_against_derivatives (pure) ─────────────────────────────────────────

def _raw(iid, key, period, value):
    return MetricFactEntry(
        id=f"fact:{iid}:{key}:raw:{period}", kind="metric",
        label=f"{iid} {key}", text=f"{iid}: {key} {value} ({period}).",
        numbers=[round(value, 4)], issuer_id=iid, walk=None, chunk_id="c")


def _delta(iid, key, prior, latest):
    return MetricFactEntry(
        id=f"fact:{iid}:{key}:delta", kind="metric",
        label=f"{iid} {key}", text=f"{iid}: {key} {prior}→{latest}.",
        numbers=[round(prior, 4), round(latest, 4), round(abs(latest - prior), 4)],
        issuer_id=iid, walk=None, chunk_id="c")


def test_dedup_removes_raw_when_delta_covers_latest():
    raw = [_raw("i1", "net_leverage", "FY2024", 4.4)]
    derivs = [_delta("i1", "net_leverage", 4.2, 4.4)]
    out = dedup_against_derivatives(raw, derivs)
    assert out == []  # delta already states 4.4


def test_dedup_keeps_raw_when_no_derivative_covers():
    raw = [_raw("i1", "revenue", "FY2024", 1200.0)]
    derivs = [_delta("i1", "net_leverage", 4.2, 4.4)]  # different key
    out = dedup_against_derivatives(raw, derivs)
    assert len(out) == 1  # revenue not covered by a leverage delta


def test_dedup_keeps_raw_when_delta_degraded():
    """A delta degraded (only one complete run → no delta) leaves the raw fact
    as the sole narrator of the figure — dedup must keep it."""
    raw = [_raw("i1", "net_leverage", "FY2024", 4.4)]
    derivs: list = []  # Metric Engine produced no delta for this key
    out = dedup_against_derivatives(raw, derivs)
    assert len(out) == 1


def test_dedup_keeps_raw_for_non_kpi_metric():
    """Revenue isn't in the KPI set the Metric Engine derives over, so no
    derivative covers it — the raw fact survives dedup."""
    raw = [_raw("i1", "revenue", "FY2024", 1200.0)]
    derivs = [_delta("i1", "net_leverage", 4.2, 4.4),
              _delta("i1", "ebitda_margin", 21.0, 22.5)]
    out = dedup_against_derivatives(raw, derivs)
    assert len(out) == 1
    assert out[0].id.startswith("fact:i1:revenue:")


def test_dedup_empty_raw_returns_empty():
    assert dedup_against_derivatives([], [_delta("i1", "net_leverage", 4.2, 4.4)]) == []


def test_dedup_empty_derivatives_returns_all_raw():
    raw = [_raw("i1", "net_leverage", "FY2024", 4.4),
           _raw("i2", "revenue", "FY2024", 1200.0)]
    assert dedup_against_derivatives(raw, []) == raw
