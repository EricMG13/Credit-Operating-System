"""Tests for cross-issuer NL query (Approach A): the metric dictionary, CP-1
fact extraction, the constrained QuerySpec (demo translator + validation), and
the /api/query endpoints over the seeded metric store.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from engine.fixtures import REFERENCE_ISSUER_ID, atlf_payload
from engine.metrics import CATALOG_BY_KEY, METRIC_CATALOG, extract_facts
from nlquery import QueryError, QuerySpec, SemanticSpec, _demo_plan, _demo_translate, validate_spec

CANONICAL = "which issuers have margins most exposed to higher inflation in energy prices"


# ── Dictionary ───────────────────────────────────────────────────────────────
def test_catalog_has_expected_keys_and_polarity():
    keys = {m.key for m in METRIC_CATALOG}
    assert {"ebitda_margin", "net_leverage", "energy_cost_pct"} <= keys
    # energy exposure and leverage are higher-is-worse; margin is higher-is-better.
    assert CATALOG_BY_KEY["energy_cost_pct"].higher_is_better is False
    assert CATALOG_BY_KEY["net_leverage"].higher_is_better is False
    assert CATALOG_BY_KEY["ebitda_margin"].higher_is_better is True


# ── Constrained translation (demo path) + validation ─────────────────────────
def test_demo_translate_maps_energy_question_to_exposure_metric():
    spec = validate_spec(_demo_translate(CANONICAL))
    assert spec.rank_by == "energy_cost_pct"   # driver wins over generic "margin"
    assert spec.direction == "desc"            # "most exposed" → highest first
    assert "ebitda_margin" in spec.metrics     # affected metric still displayed
    assert spec.interpretation                 # restatement present


def test_demo_translate_maps_leverage_and_direction():
    assert validate_spec(_demo_translate("which issuer is most levered")).rank_by == "net_leverage"
    asc = validate_spec(_demo_translate("issuers with the lowest leverage"))
    assert asc.rank_by == "net_leverage" and asc.direction == "asc"


def test_validate_rejects_out_of_vocabulary_metric():
    with pytest.raises(QueryError):
        validate_spec(QuerySpec(rank_by="profit_per_employee"))
    with pytest.raises(QueryError):
        validate_spec(QuerySpec(rank_by="net_leverage",
                                filters=[{"field": "secret_field", "op": "=", "value": 1}]))


def test_validate_clamps_limit_and_normalizes_direction():
    spec = validate_spec(QuerySpec(rank_by="revenue", direction="UP", limit=999))
    assert spec.limit == 50 and spec.direction == "desc"


# ── CP-1 extraction ──────────────────────────────────────────────────────────
def test_extract_facts_projects_cp1_financials_with_citation():
    cp1 = atlf_payload("CP-1")
    facts = extract_facts("run-x", cp1, qa_status="Restricted")
    by_key = {(f["metric_key"], f["period"]): f for f in facts}

    lev = by_key[("net_leverage", "LTM")]
    assert lev["value"] == 5.68 and lev["headline"] is True
    assert lev["provenance"] == "run" and lev["qa_status"] == "Restricted"
    assert lev["source_claim_id"] == "C-10" and lev["source_evidence_id"] == "E-20"

    # ebitda_margin is computed from revenue + adj_ebitda for the LTM period.
    margin = by_key[("ebitda_margin", "LTM_Q1_26")]
    assert margin["unit"] == "%" and round(margin["value"]) == 15
    assert margin["headline"] is True


# ── Endpoints over the seeded store ──────────────────────────────────────────
@pytest.fixture(scope="module")
def client():
    from main import app

    with TestClient(app) as c:
        yield c


def test_catalog_endpoint(client):
    r = client.get("/api/query/catalog")
    assert r.status_code == 200
    assert len(r.json()["metrics"]) == len(METRIC_CATALOG)


def test_canonical_query_ranks_aurora_first(client):
    r = client.post("/api/query/nl", json={"question": CANONICAL})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["rank_by"] == "energy_cost_pct"
    assert body["rows"], "expected ranked issuers"
    assert body["rows"][0]["issuer"]["name"] == "Aurora Chemicals SA"
    # energy_cost_pct is illustrative seed data → a caveat is surfaced.
    assert any("illustrative" in c.lower() for c in body["caveats"])


def test_unknown_metric_question_returns_422(client, monkeypatch):
    # An unmappable question → the planner raises → 422 clarification.
    import nlquery

    def boom(_q):
        raise nlquery.QueryError("unknown metric")

    monkeypatch.setattr(nlquery, "_demo_plan", boom)
    r = client.post("/api/query/nl", json={"question": "rank by vibes"})
    assert r.status_code == 422


def test_run_derived_facts_override_seed_with_citation(client):
    # A completed ATLF run projects CP-1 financials as run-derived, cited facts
    # that take precedence over the seed in cross-issuer ranking.
    run = client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID})
    assert run.status_code == 201, run.text
    body = client.post("/api/query/nl", json={"question": "rank issuers by net leverage"}).json()
    assert body["mode"] == "structured"
    atlf = next((row for row in body["rows"] if row["issuer"]["name"] == "Atlas Forge Industrials"), None)
    assert atlf is not None
    lev = atlf["metrics"]["net_leverage"]
    assert lev["provenance"] == "run"
    assert lev["citation"] and lev["citation"]["evidence_id"] == "E-20"


# ── Planner routing (structured vs semantic) ─────────────────────────────────
def test_demo_plan_routes_metric_vs_document_questions():
    assert _demo_plan(CANONICAL)[0] == "structured"            # metric + superlative
    assert _demo_plan("which issuer is most levered")[0] == "structured"
    assert _demo_plan("which issuers flag energy or input-cost pressure in their filings")[0] == "semantic"
    assert _demo_plan("who discusses covenant headroom")[0] == "semantic"
    mode, spec = _demo_plan("what do the filings say about energy costs")
    assert mode == "semantic" and isinstance(spec, SemanticSpec) and spec.search


# ── Semantic endpoint over the seeded document corpus ────────────────────────
def test_semantic_query_groups_evidence_by_issuer(client):
    body = client.post(
        "/api/query/nl",
        json={"question": "which issuers flag energy or input-cost pressure in their filings"},
    ).json()
    assert body["mode"] == "semantic"
    assert body["rows"], "expected issuers with matching evidence"
    top = body["rows"][0]
    assert top["issuer"]["name"] == "Aurora Chemicals SA"
    # the answer is grounded in a real source excerpt, not a number
    assert top["excerpts"] and "energy" in top["excerpts"][0]["text"].lower()
    assert top["excerpts"][0]["doc"]


def test_semantic_covenant_question_surfaces_telecom(client):
    body = client.post(
        "/api/query/nl",
        json={"question": "which issuers discuss covenant headroom in their documents"},
    ).json()
    assert body["mode"] == "semantic"
    names = {r["issuer"]["name"] for r in body["rows"]}
    assert "Meridian Telecom Holdings" in names
    excerpts = " ".join(e["text"].lower() for r in body["rows"] for e in r["excerpts"])
    assert "covenant" in excerpts
