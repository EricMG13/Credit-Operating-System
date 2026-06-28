"""Tests for cross-issuer NL query (Approach A): the metric dictionary, CP-1
fact extraction, the constrained QuerySpec (demo translator + validation), and
the /api/query endpoints over the seeded metric store.
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from engine.fixtures import REFERENCE_ISSUER_ID, atlf_payload
from engine.metrics import CATALOG_BY_KEY, METRIC_CATALOG, derive_energy_cost_pct, extract_facts
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


def test_validate_rejects_ilike_op_on_metric_filter():
    # #4: ilike is text-only; a metric filter with it used to silently pass every row.
    with pytest.raises(QueryError):
        validate_spec(QuerySpec(rank_by="net_leverage",
                                filters=[{"field": "net_leverage", "op": "ilike", "value": 5}]))


def test_validate_rejects_non_numeric_metric_filter_value():
    with pytest.raises(QueryError):
        validate_spec(QuerySpec(rank_by="net_leverage",
                                filters=[{"field": "net_leverage", "op": ">", "value": "abc"}]))


def test_validate_accepts_numeric_metric_filter():
    spec = validate_spec(QuerySpec(rank_by="net_leverage",
                                   filters=[{"field": "net_leverage", "op": ">", "value": 3.0}]))
    assert spec.filters[0].field == "net_leverage" and spec.filters[0].op == ">"


def test_passes_fails_closed_on_unparseable_or_unknown_op():
    # #4: defense-in-depth — an unevaluable filter EXCLUDES, never admits everything.
    from nlquery import _passes
    assert _passes(5.0, ">", "abc") is False    # was True (admitted all rows)
    assert _passes(5.0, "ilike", 3.0) is False  # unknown numeric op excludes
    assert _passes(5.0, ">", 3.0) is True       # normal path intact


def test_validate_clamps_limit_and_normalizes_direction():
    spec = validate_spec(QuerySpec(rank_by="revenue", direction="UP", limit=999))
    assert spec.limit == 50 and spec.direction == "desc"


# ── CP-1 extraction ──────────────────────────────────────────────────────────
def test_extract_facts_projects_cp1_financials_with_citation():
    cp1 = atlf_payload("CP-1")
    facts = extract_facts("run-x", cp1, qa_status="Restricted")
    by_key = {(f["metric_key"], f["period"]): f for f in facts}

    # Net leverage is projected as a per-period series now (drives the leverage
    # trend); the headline is the latest period (LTM_Q1_26), same 5.68 value + cite.
    lev = by_key[("net_leverage", "LTM_Q1_26")]
    assert lev["value"] == 5.68 and lev["headline"] is True
    # ATLF is the seeded demo fixture, so its facts carry 'fixture' provenance — not
    # 'run' — so they never pose as a real issuer run in the cross-issuer store (#04).
    assert lev["provenance"] == "fixture" and lev["qa_status"] == "Restricted"
    assert lev["source_claim_id"] == "C-10" and lev["source_evidence_id"] == "E-20"
    # earlier fiscal years are present too (non-headline), forming the trend series.
    assert by_key[("net_leverage", "FY23")]["value"] == 6.7

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
    # provenance/corroboration caveats are surfaced (energy is evidence-derived,
    # not seeded — its provenance is asserted in the derived/run-provenance tests).
    assert body["caveats"]


def test_user_info_query_is_admin_only(client):
    r = client.post("/api/query/nl", json={"question": "display all runs by user Pat Lender"})
    assert r.status_code == 403, r.text
    assert "admin-only" in r.json()["detail"]


def test_ranking_reports_total_ranked_for_top_n_labeling(client):
    # OBS-002: the result must carry the universe count (issuers eligible before
    # the top-N display cap) so the UI can say "top N of M" instead of implying
    # the returned cohort is the whole population. Invariant: rows is a slice of
    # total_ranked, never larger.
    body = client.post("/api/query/nl", json={"question": "which issuer is most levered"}).json()
    assert body["rank_by"] == "net_leverage"
    assert isinstance(body["total_ranked"], int)
    assert body["total_ranked"] >= len(body["rows"]) >= 1


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
    from conftest import wait_for_run

    run = client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID})
    assert run.status_code == 201, run.text
    wait_for_run(client, run.json()["id"])
    body = client.post("/api/query/nl", json={"question": "rank issuers by net leverage"}).json()
    assert body["mode"] == "structured"
    atlf = next((row for row in body["rows"] if row["issuer"]["name"] == "Atlas Forge Industrials"), None)
    assert atlf is not None
    lev = atlf["metrics"]["net_leverage"]
    # ATLF runs the offline fixture path, so its run-derived facts carry 'fixture'
    # provenance (they still supersede the seed facts and keep the citation). (#04)
    assert lev["provenance"] == "fixture"
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


# ── Hybrid composition (rank + corroborating evidence) ───────────────────────
def test_demo_translate_sets_evidence_only_on_driver_questions():
    assert _demo_translate(CANONICAL).evidence  # "exposed to … energy" → driver phrase
    assert _demo_translate("which issuer is most levered").evidence is None


def test_canonical_query_is_hybrid_and_corroborates_the_ranking(client):
    body = client.post("/api/query/nl", json={"question": CANONICAL}).json()
    assert body["mode"] == "hybrid"
    assert body["rank_by"] == "energy_cost_pct"
    top = body["rows"][0]
    assert top["issuer"]["name"] == "Aurora Chemicals SA"
    # ranked metric is still present AND a document excerpt corroborates it
    assert top["metrics"]["energy_cost_pct"]["value"] == 28.0
    assert top["evidence"] and "energy" in top["evidence"]["text"].lower()
    assert top["evidence"]["doc"]


def test_pure_metric_query_stays_structured_without_evidence(client):
    body = client.post("/api/query/nl", json={"question": "which issuer is most levered"}).json()
    assert body["mode"] == "structured"
    assert all(row.get("evidence") is None for row in body["rows"])


# ── Evidence-derived energy_cost_pct ─────────────────────────────────────────
def test_derive_energy_cost_pct_extracts_cited_value():
    aurora = [
        ("c0", "aurora_om.pdf", "Production is energy-intensive: electricity and natural gas "
         "are roughly 28 percent of cost of goods sold."),
    ]
    val, chunk_id, doc = derive_energy_cost_pct(aurora)
    assert val == 28.0 and chunk_id == "c0" and doc == "aurora_om.pdf"
    # ignores an unrelated percentage (e.g. a gross-margin figure)
    assert derive_energy_cost_pct([("c", "f.pdf", "92 percent gross margin; no energy disclosure")]) is None
    assert derive_energy_cost_pct([("c", "f.pdf", "no figures here")]) is None


def test_canonical_energy_is_derived_and_cited(client):
    top = client.post("/api/query/nl", json={"question": CANONICAL}).json()["rows"][0]
    assert top["issuer"]["name"] == "Aurora Chemicals SA"
    energy = top["metrics"]["energy_cost_pct"]
    assert energy["value"] == 28.0
    assert energy["provenance"] == "derived"          # extracted from the filing, not seeded
    assert energy["citation"] and energy["citation"]["chunk_id"]  # cited to its source chunk


# ── CP-2 cost-structure module (run-derived, QA-gated energy) ────────────────
def test_cp2_synthesizes_cited_metric_and_gates_clean():
    from engine.coststructure import synthesize_cost_structure
    from engine.lineage import validate_lineage
    from engine.schemas import validate_payload

    async def found(_q, _k):
        return [SimpleNamespace(chunk_id="ch1",
                                text="energy and freight are roughly 12 percent of cost of goods sold",
                                score=2.0)]

    async def none(_q, _k):
        return [SimpleNamespace(chunk_id="x", text="no energy disclosure", score=1.0)]

    p = asyncio.run(synthesize_cost_structure("ATLF", found))
    assert p.module_id == "CP-2" and p.runtime_output["energy_cost_pct"] == 12.0
    assert validate_payload(p) == []          # schema-valid
    assert validate_lineage([p]) == []        # Calculated lineage → no QA finding
    assert p.claims[0].evidence[0].evidence_id == "E-CS1"

    p2 = asyncio.run(synthesize_cost_structure("X", none))
    assert p2.runtime_output["energy_cost_pct"] is None and not p2.claims


def test_run_emits_cp2_and_upgrades_energy_to_run_provenance(client):
    from conftest import wait_for_run

    run = client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID})
    assert run.status_code == 201, run.text
    finished = wait_for_run(client, run.json()["id"])
    assert any(m["module_id"] == "CP-2" for m in finished["modules"])
    cp2 = client.get(f"/api/runs/{run.json()['id']}/modules/CP-2").json()
    assert cp2["runtime_output"]["energy_cost_pct"] == 12.0
    assert cp2["claims"] and cp2["claims"][0]["evidence"][0]["evidence_id"] == "E-CS1"

    rows = client.post("/api/query/nl", json={"question": CANONICAL}).json()["rows"]
    atlf = next(r for r in rows if r["issuer"]["name"] == "Atlas Forge Industrials")
    energy = atlf["metrics"]["energy_cost_pct"]
    assert energy["provenance"] == "run"      # CP-2 run fact overrides the seed
    assert energy["citation"]["evidence_id"] == "E-CS1"
    assert energy["citation"]["chunk_id"]


# ── Click-to-source chunk endpoint ───────────────────────────────────────────
def test_chunk_endpoint_returns_text_and_404(client):
    sem = client.post("/api/query/nl",
                      json={"question": "which issuers flag energy or input-cost pressure in their filings"}).json()
    chunk_id = sem["rows"][0]["excerpts"][0]["chunk_id"]
    r = client.get(f"/api/query/chunk/{chunk_id}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["chunk_id"] == chunk_id and body["text"] and body["doc"] and body["issuer_name"]
    assert client.get("/api/query/chunk/does-not-exist").status_code == 404


# ── Unmatched /api/* → JSON 404, not the SPA 404.html ────────────────────────
def test_unknown_api_path_returns_json_404(client):
    # The "/" StaticFiles(html=True) mount would otherwise serve the ~9KB SPA
    # 404 page for any unmatched path, skewing the caos.access volume feed.
    r = client.get("/api/nope")
    assert r.status_code == 404
    assert r.headers["content-type"].startswith("application/json")
    assert r.json() == {"detail": "Not Found"}
    assert len(r.content) < 100   # small JSON body, not the SPA HTML page
