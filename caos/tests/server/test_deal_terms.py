"""Tests for CP-4D DealTermsExtractor: deterministic term extraction, the
payload it synthesizes, the cov-lite read, and the runner wiring that projects
the term set into deals/deal_terms for the /compare surface.
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from conftest import wait_for_run
from engine.deal_terms import derive_deal_terms, synthesize_deal_terms
from engine.fixtures import REFERENCE_ISSUER_ID
from engine.schemas import ModulePayload, validate_payload

_CA = (
    "Credit Agreement. The Term Loan B is in an aggregate principal amount of $1,787 million. "
    "The Applicable Margin for SOFR loans is S + 275 per annum, subject to a floor of 0.50%. "
    "Incremental facilities include a free and clear amount of $660 million."
)
_MAINT = (
    "The Borrower shall not permit the Net First Lien Leverage Ratio to exceed 5.75x as of the "
    "last day of any fiscal quarter."
)


def _retrieve(chunks):
    async def retrieve(query, k=12):
        return [SimpleNamespace(chunk_id=c, text=t) for c, t in chunks]
    return retrieve


# ── Deterministic extraction ─────────────────────────────────────────────────
def test_derive_core_numerics_and_maintenance():
    terms = {t.term_key: t for t in derive_deal_terms([("c-ca", _CA), ("c-cov", _MAINT)])}
    assert terms["spread_bps"].value_num == 275
    assert terms["floor"].value_num == pytest.approx(0.005)
    assert terms["term_loan_size_musd"].value_num == 1787
    assert terms["net_first_lien_leverage_ratio"].value_num == 5.75
    assert terms["cov_lite"].value_text == "No"  # a maintenance covenant is present
    assert terms["spread_bps"].chunk_id == "c-ca"  # traced to the right chunk


def test_derive_infers_covlite_when_no_maintenance():
    terms = {t.term_key: t for t in derive_deal_terms([("c1", "Operational text. Spread S + 300.")])}
    assert terms["cov_lite"].value_text == "Yes"
    assert terms["cov_lite"].lineage_class == "Analyst Inference"  # inferred from absence, not sourced


def test_derive_empty_corpus_yields_nothing():
    assert derive_deal_terms([]) == []


# ── synthesize_deal_terms payload ────────────────────────────────────────────
def _cp1():
    return ModulePayload(module_id="CP-1", module_name="X", owned_object="o", runtime_output={})


def test_synthesize_payload_valid_and_traced():
    p = asyncio.run(synthesize_deal_terms(_cp1(), _retrieve([("c-ca", _CA), ("c-cov", _MAINT)])))
    assert p.module_id == "CP-4D" and validate_payload(p) == []
    keys = {t["term_key"] for t in p.runtime_output["terms"]}
    assert {"spread_bps", "floor", "term_loan_size_musd", "net_first_lien_leverage_ratio", "cov_lite"} <= keys
    assert p.runtime_output["covenant_structure"] == "maintenance"
    # every claim resolves to a real source chunk (CP-5B)
    assert p.claims and all(c.evidence[0].resolved_chunk_id for c in p.claims)


def test_synthesize_insufficient_without_sources():
    p = asyncio.run(synthesize_deal_terms(_cp1(), _retrieve([])))
    assert p.confidence == "Insufficient Information"
    assert p.runtime_output["terms"] == []
    assert not p.claims


# ── Runner wiring: CP-4D projects into deals/deal_terms for /compare ──────────
@pytest.fixture(scope="module")
def client():
    from main import app

    with TestClient(app) as c:
        yield c


def test_run_projects_deal_terms_into_compare(client):
    run = wait_for_run(
        client, client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID}).json()["id"]
    )
    assert run["status"] == "complete"

    cp4d = client.get(f"/api/runs/{run['id']}/modules/CP-4D").json()
    assert "terms" in cp4d["runtime_output"]

    deals = client.get("/api/compare/deals").json()
    run_deals = [d for d in deals if d["provenance"] == "run" and d["issuer_id"] == REFERENCE_ISSUER_ID]
    assert run_deals, "CP-4D should have projected a run-derived deal"

    seed = next(d for d in deals if d["provenance"] == "seed")
    grid = client.get(
        "/api/compare", params={"deals": f"{run_deals[0]['id']},{seed['id']}", "benchmark": seed["id"]}
    ).json()
    assert grid["sections"] and sum(len(s["rows"]) for s in grid["sections"]) > 0
