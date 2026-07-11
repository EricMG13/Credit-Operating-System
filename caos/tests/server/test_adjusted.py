"""CP-1A is the BusinessTransactionFactPack; the adjusted-EBITDA reconciliation is
folded into CP-1. Tests cover deterministic add-back extraction, the reconciliation
(now embedded in CP-1), the materiality-gated CP-5 finding, the fact-pack scan, and
the runner wiring on the seeded ATLF deal.
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from engine.adjusted import (
    derive_addbacks,
    reconcile_adjusted_ebitda,
    reconciliation_finding,
)
from engine.factpack import scan_facts, synthesize_fact_pack
from conftest import wait_for_run
from engine.fixtures import REFERENCE_ISSUER_ID
from engine.schemas import ModulePayload, validate_payload


# ── Deterministic add-back extraction ────────────────────────────────────────
def test_derive_addbacks_finds_load_not_cap():
    chunks = [
        ("c-sfa", "The senior facilities agreement caps cost-saving add-backs at 25 percent "
                  "over a trailing 24 month period."),  # a CAP — must NOT match
        ("c-om", "Adjusted EBITDA add-backs represent 18.2 percent of adjusted EBITDA, "
                 "driven by run-rate cost savings and synergies."),
    ]
    res = derive_addbacks(chunks)
    assert res is not None
    pct, categories, chunk_id, exact = res
    assert pct == pytest.approx(0.182)
    assert chunk_id == "c-om"
    assert exact is True  # deterministic: figure regex-matched in that exact chunk
    assert "run-rate" in categories and "cost savings" in categories


def test_derive_addbacks_none_without_disclosure():
    assert derive_addbacks([("c1", "Revenue grew 8 percent year over year.")]) is None
    # an add-back mention without an "of EBITDA" load is not a quantified disclosure
    assert derive_addbacks([("c2", "Various add-backs are permitted under the agreement.")]) is None


# ── Reconciliation (folded into CP-1) ─────────────────────────────────────────
def _cp1(lev=5.68, nd=2391.0):
    return ModulePayload(
        module_id="CP-1", module_name="X", owned_object="o",
        runtime_output={"normalized_financials": {
            "net_leverage_adj_ltm": lev, "net_debt_ltm": nd}},
    )


def test_reconcile_adjusted_ebitda_returns_dict_and_claim():
    async def retrieve(query, k=6):
        return [SimpleNamespace(
            chunk_id="c-om",
            text="Adjusted EBITDA add-backs represent 18.2 percent of adjusted EBITDA.")]

    res = asyncio.run(reconcile_adjusted_ebitda(_cp1(), retrieve))
    assert res is not None
    recon, claim = res
    assert recon["addback_pct"] == pytest.approx(0.182)
    assert recon["leverage_current"] == 5.68
    # excluding 18.2% add-backs, leverage rises from 5.68x toward ~6.9x
    assert recon["leverage_excl_addbacks"] == pytest.approx(6.94, abs=0.05)
    assert recon["leverage_gap_turns"] == pytest.approx(1.26, abs=0.05)
    assert claim.claim_id == "C-ADJ1" and claim.evidence[0].resolved_chunk_id == "c-om"


def test_reconcile_none_without_disclosure():
    async def retrieve(query, k=6):
        return [SimpleNamespace(chunk_id="c1", text="No add-back disclosure here.")]

    assert asyncio.run(reconcile_adjusted_ebitda(_cp1(), retrieve)) is None


# ── The materiality-gated CP-5 finding (reads CP-1's embedded reconciliation) ──
def _cp1_recon(pct, gap, lev=5.68, lev_excl=6.94):
    return ModulePayload(
        module_id="CP-1", module_name="X", owned_object="o",
        runtime_output={"adjusted_ebitda_reconciliation": {
            "addback_pct": pct, "leverage_gap_turns": gap,
            "leverage_current": lev, "leverage_excl_addbacks": lev_excl}},
    )


def test_reconciliation_finding_fires_when_material():
    f = reconciliation_finding(_cp1_recon(0.182, 1.26))
    assert f is not None
    assert f.severity == "MINOR" and f.lane == 2 and f.module_id == "CP-1"
    assert f.finding_id == "CP-1A-RECON" and f.affected_claim_id == "C-ADJ1"


def test_reconciliation_finding_silent_when_immaterial():
    assert reconciliation_finding(_cp1_recon(0.05, 0.2)) is None
    assert reconciliation_finding(None) is None
    # CP-1 with no reconciliation embedded → nothing to flag
    assert reconciliation_finding(ModulePayload("CP-1", "X", "o", {})) is None


# ── CP-1A BusinessTransactionFactPack (doc scan) ──────────────────────────────
def test_factpack_scans_credit_relevant_areas():
    facts = scan_facts([
        ("c1", "The leveraged buyout of the company by its financial sponsor closed in 2021."),
        ("c2", "The group is headquartered in Frankfurt and operates in 12 countries."),
    ])
    codes = {f["code"] for f in facts}
    assert {"transaction", "ownership", "geography"} <= codes


def test_synthesize_fact_pack_payload_and_insufficient():
    async def found(query, k=8):
        return [SimpleNamespace(
            chunk_id="c1",
            text="Acquisition of the target by its private equity sponsor; headquartered in Berlin.")]

    p = asyncio.run(synthesize_fact_pack(found))
    assert p.module_id == "CP-1A" and p.owned_object == "business_transaction_fact_register"
    assert validate_payload(p) == [] and p.runtime_output["fact_areas"]

    async def empty(query, k=8):
        return [SimpleNamespace(chunk_id="c1", text="nothing notable in this chunk")]

    p2 = asyncio.run(synthesize_fact_pack(empty))
    assert p2.confidence == "Insufficient Information"


# ── Runner wiring on the ATLF deal ───────────────────────────────────────────
@pytest.fixture(scope="module")
def client():
    from main import app

    with TestClient(app) as c:
        yield c


def test_run_folds_reconciliation_into_cp1_and_factpack_is_cp1a(client):
    run = wait_for_run(client, client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID}).json()["id"])

    cp1 = client.get(f"/api/runs/{run['id']}/modules/CP-1").json()
    recon = cp1["runtime_output"]["adjusted_ebitda_reconciliation"]
    assert recon["addback_pct"] == pytest.approx(0.182, abs=0.001)
    assert recon["leverage_gap_turns"] > 0

    cp1a = client.get(f"/api/runs/{run['id']}/modules/CP-1A").json()
    assert cp1a["owned_object"] == "business_transaction_fact_register"

    qa = client.get(f"/api/runs/{run['id']}/qa").json()
    recon_f = [f for f in qa["findings"] if f["finding_id"] == "CP-1A-RECON"]
    assert recon_f and recon_f[0]["severity"] == "MINOR"
    # An informational add-back finding must not by itself escalate the gate.
    assert qa["findings_by_severity"]["CRITICAL"] == 0


# ── L-2: add-back caller maps the schema-validated extraction model ───────────
@pytest.mark.asyncio
async def test_llm_addbacks_maps_validated_model(monkeypatch):
    """_llm_addbacks now consumes a validated _AddbackExtract (not a raw dict):
    it reads typed attrs and applies only the domain range itself."""
    import engine.adjusted as adj

    async def fake_extract(retrieve, *, query, k, system, schema=None):
        assert schema is adj._AddbackExtract  # the caller opts into the typed boundary
        model = schema.model_validate(
            {"addback_pct": 0.18, "categories": ["synergies", "run-rate"], "chunk_id": "c1"}
        )
        return model, [SimpleNamespace(chunk_id="c1", text="add-backs capped at 18% of Adjusted EBITDA")]

    monkeypatch.setattr(adj, "extract_json", fake_extract)
    pct, cats, chunk_id, exact = await adj._llm_addbacks(lambda q, k=6: [])
    assert pct == 0.18 and cats == ["synergies", "run-rate"]
    assert chunk_id == "c1" and exact is True


@pytest.mark.asyncio
async def test_llm_addbacks_rejects_out_of_range_pct(monkeypatch):
    """An in-shape but out-of-range pct (>1) is the caller's domain check, not the
    schema's — it must still degrade to None (→ deterministic fallback)."""
    import engine.adjusted as adj

    async def fake_extract(retrieve, *, query, k, system, schema=None):
        return schema.model_validate({"addback_pct": 1.5}), [SimpleNamespace(chunk_id="c1", text="")]

    monkeypatch.setattr(adj, "extract_json", fake_extract)
    assert await adj._llm_addbacks(lambda q, k=6: []) is None


@pytest.mark.asyncio
async def test_llm_addbacks_rejects_ungrounded_pct(monkeypatch):
    """A sign/range-valid pct with NO basis in its own cited chunk (hallucinated
    or prompt-injected) must degrade to None, not pass through on range alone —
    the gap the previous sign/range-only clamp left open."""
    import engine.adjusted as adj

    async def fake_extract(retrieve, *, query, k, system, schema=None):
        model = schema.model_validate(
            {"addback_pct": 0.40, "categories": ["synergies"], "chunk_id": "c1"}
        )
        # Chunk says nothing about a 40% add-back load.
        return model, [SimpleNamespace(chunk_id="c1", text="The credit agreement matures in 2031.")]

    monkeypatch.setattr(adj, "extract_json", fake_extract)
    assert await adj._llm_addbacks(lambda q, k=6: []) is None


@pytest.mark.asyncio
async def test_llm_addbacks_grounds_fraction_form_too(monkeypatch):
    """An unusual '0.18x EBITDA' phrasing (fraction, not percent) still grounds —
    both forms are tried."""
    import engine.adjusted as adj

    async def fake_extract(retrieve, *, query, k, system, schema=None):
        model = schema.model_validate({"addback_pct": 0.18, "chunk_id": "c1"})
        return model, [SimpleNamespace(chunk_id="c1", text="add-backs of 0.18x Adjusted EBITDA")]

    monkeypatch.setattr(adj, "extract_json", fake_extract)
    pct, _, chunk_id, _ = await adj._llm_addbacks(lambda q, k=6: [])
    assert pct == 0.18 and chunk_id == "c1"
