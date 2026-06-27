"""Tests for the analytical engine slice: BM25 retrieval, the deterministic
CP-5 gate, CP-5B lineage, payload validation, and the run API end-to-end on the
seeded ATLF reference deal (fixture synthesis, no model key).
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from engine.fixtures import REFERENCE_ISSUER_ID, atlf_payload
from engine.report import assemble_report, committee_export_allowed
from engine.gate import (
    Finding,
    committee_status_from,
    qa_status_from,
    roll_up_qa_status,
    worst_confidence,
)
from engine.lineage import validate_lineage
from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload, validate_payload
from retrieval import bm25_rank, build_index, rank_with_index


# ── BM25 retrieval ───────────────────────────────────────────────────────────
def test_bm25_ranks_relevant_chunk_first():
    corpus = [
        ("c1", "the senior facilities agreement caps add-backs at 25 percent"),
        ("c2", "aftermarket installed base and contract renewal"),
        ("c3", "adjusted net leverage 5.68x and interest coverage 2.1x"),
    ]
    hits = bm25_rank("net leverage coverage", corpus, k=2)
    assert hits, "expected at least one hit"
    assert hits[0].chunk_id == "c3"
    assert all(h.score > 0 for h in hits)


def test_bm25_empty_query_or_no_match_returns_nothing():
    corpus = [("c1", "alpha beta gamma")]
    assert bm25_rank("", corpus) == []
    assert bm25_rank("zzzznotpresent", corpus) == []


def test_prebuilt_index_matches_one_shot_bm25():
    # P4-2: the in-run path builds the BM25 index once and scores every query
    # against it. rank_with_index on a prebuilt index must be numerically
    # identical to the one-shot bm25_rank, across reuse for many queries.
    corpus = [
        ("c1", "the senior facilities agreement caps add-backs at 25 percent"),
        ("c2", "aftermarket installed base and contract renewal"),
        ("c3", "adjusted net leverage 5.68x and interest coverage 2.1x"),
    ]
    index = build_index(corpus)
    for q in ("net leverage coverage", "add-backs facilities", "aftermarket renewal", "", "zzz"):
        reuse = [(h.chunk_id, round(h.score, 9)) for h in rank_with_index(index, q, k=3)]
        oneshot = [(h.chunk_id, round(h.score, 9)) for h in bm25_rank(q, corpus, k=3)]
        assert reuse == oneshot, f"mismatch for {q!r}: {reuse} != {oneshot}"


# ── CP-X dependency layering (intra-run parallelism) ─────────────────────────
def test_dependency_layers_respects_deps_and_groups_independents():
    from engine.registry import REGISTRY
    from engine.runner import _dependency_layers

    routed = [m for m in REGISTRY if m != "CP-0"]  # all implemented analytical modules
    layers = _dependency_layers(routed)

    # Every routed module is placed exactly once.
    flat = [m for layer in layers for m in layer]
    assert sorted(flat) == sorted(routed)
    assert len(flat) == len(set(flat))

    # A module never shares a layer with (or precedes) an in-set dependency.
    layer_of = {m: i for i, layer in enumerate(layers) for m in layer}
    for m in routed:
        for d in REGISTRY[m].depends_on:
            if d in layer_of:
                assert layer_of[d] < layer_of[m], f"{m} must run after its dep {d}"

    # CP-1A and CP-1B both depend only on CP-1, so they land in the same layer —
    # i.e. independent modules are grouped, which is what lets them run concurrently.
    assert layer_of["CP-1A"] == layer_of["CP-1B"]
    assert layer_of["CP-1"] < layer_of["CP-1A"]
    # CP-1A (BusinessTransactionFactPack) and CP-4C (covenant capacity) both depend
    # only on CP-1, so they share a layer — the concrete pair the fan-out overlaps.
    assert layer_of["CP-1A"] == layer_of["CP-4C"]


def test_dependency_layers_degraded_routing_and_edges():
    # When CP-0 comes back thin, `routed` can exclude the foundation (CP-1) or be
    # tiny. Layering must still produce a valid order and never loop/crash.
    from engine.runner import _dependency_layers

    assert _dependency_layers([]) == []
    assert _dependency_layers(["CP-2C"]) == [["CP-2C"]]  # dep (CP-1) outside set → layer 0
    # CP-3C depends on CP-3; with CP-1/CP-1C absent, CP-3 has no in-set dep (layer 0)
    # and CP-3C still sequences after it.
    layers = _dependency_layers(["CP-3C", "CP-3"])  # order shouldn't matter
    flat = [m for layer in layers for m in layer]
    assert sorted(flat) == ["CP-3", "CP-3C"]
    li = {m: i for i, layer in enumerate(layers) for m in layer}
    assert li["CP-3"] < li["CP-3C"]


# ── The deterministic CP-5 gate ──────────────────────────────────────────────
def _f(sev: str) -> Finding:
    return Finding(finding_id="F", severity=sev, description="x")


def test_gate_severity_mapping():
    assert qa_status_from([_f("CRITICAL")]) == "Blocked"
    assert qa_status_from([_f("MATERIAL"), _f("MINOR")]) == "Restricted"
    assert qa_status_from([_f("MINOR")]) == "Passed"
    assert qa_status_from([]) == "Passed"
    # CRITICAL dominates even amid lower severities.
    assert qa_status_from([_f("MINOR"), _f("CRITICAL"), _f("MATERIAL")]) == "Blocked"


def test_committee_status_mapping():
    assert committee_status_from("Blocked", "High") == "Blocked"
    assert committee_status_from("Restricted", "High") == "Restricted"
    assert committee_status_from("Passed", "High") == "Committee Ready"
    assert committee_status_from("Passed", "Insufficient Information") == "Insufficient Information"


def test_run_rollup_and_worst_confidence():
    assert roll_up_qa_status(["Passed", "Restricted"]) == "Restricted"
    assert roll_up_qa_status(["Passed", "Blocked", "Restricted"]) == "Blocked"
    assert roll_up_qa_status([]) == "Not Reviewed"
    assert worst_confidence(["High", "Medium", "Low"]) == "Low"
    assert worst_confidence([]) == "Insufficient Information"


# ── CP-5B lineage validation ─────────────────────────────────────────────────
def test_orphan_claim_is_critical_and_blocks():
    payload = ModulePayload(
        module_id="CP-1", module_name="X", owned_object="o", runtime_output={},
        claims=[ClaimSpec("C-1", "an unsupported assertion", evidence=[])],
    )
    findings = validate_lineage([payload])
    assert any(f.severity == "CRITICAL" for f in findings)
    assert qa_status_from(findings) == "Blocked"


def test_weak_lineage_is_material_and_restricts():
    payload = ModulePayload(
        module_id="CP-1", module_name="X", owned_object="o", runtime_output={},
        claims=[ClaimSpec("C-2", "derived figure", evidence=[
            EvidenceSpec("E-1", "calculated_metric", "Weak Lineage", "model", "Low",
                         resolved_chunk_id="chunk-1"),
        ])],
    )
    findings = validate_lineage([payload])
    assert qa_status_from(findings) == "Restricted"


def test_directly_sourced_claim_raises_no_finding():
    payload = ModulePayload(
        module_id="CP-1", module_name="X", owned_object="o", runtime_output={},
        claims=[ClaimSpec("C-3", "well sourced", evidence=[
            EvidenceSpec("E-2", "table_value", "Directly Sourced", "OM p.1", "High",
                         resolved_chunk_id="chunk-2"),
        ])],
    )
    assert validate_lineage([payload]) == []


# ── Payload validation ───────────────────────────────────────────────────────
def test_validate_payload_rejects_bad_module_and_enums():
    bad = ModulePayload(
        module_id="CP-99", module_name="x", owned_object="o", runtime_output={},
        confidence="Maybe",
    )
    errors = validate_payload(bad)
    assert any("module_id" in e for e in errors)
    assert any("confidence" in e for e in errors)


def test_atlf_fixture_payloads_are_schema_valid():
    assert validate_payload(atlf_payload("CP-0")) == []
    assert validate_payload(atlf_payload("CP-1")) == []
    assert atlf_payload("CP-9X") is None


# ── Run API end-to-end (fixture synthesis) ───────────────────────────────────
@pytest.fixture(scope="module")
def client():
    from main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def atlf_run(client):
    from conftest import wait_for_run

    r = client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID, "as_of_date": "2026-03-31"})
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "queued"
    return wait_for_run(client, r.json()["id"])


def test_run_completes_and_gates_to_restricted(atlf_run):
    assert atlf_run["status"] == "complete"
    # ATLF carries a Weak-Lineage + a Conflicting claim → MATERIAL → Restricted,
    # independently reproducing the seeded "CONDITIONAL / pack HELD" outcome.
    assert atlf_run["qa_status"] == "Restricted"
    assert atlf_run["committee_status"] == "Restricted"
    assert atlf_run["model_id"] == "fixture"


def test_run_per_module_status(atlf_run):
    by_id = {m["module_id"]: m for m in atlf_run["modules"]}
    assert by_id["CP-0"]["qa_status"] == "Passed"
    assert by_id["CP-0"]["committee_status"] == "Committee Ready"
    assert by_id["CP-1"]["qa_status"] == "Restricted"
    # CP-X routed the run; CP-5B / CP-5 auditors ran and persisted.
    assert "CP-X" in by_id and "CP-5B" in by_id and "CP-5" in by_id


def test_cpx_route_plan_persisted(client, atlf_run):
    """CP-X persists an auditable route plan: the wired slice routes Full Run and
    the spec-only modules are shown as Not Implemented but never executed."""
    detail = client.get(f"/api/runs/{atlf_run['id']}/modules/CP-X").json()
    rt = detail["runtime_output"]
    assert rt["gate_status"] == "Full Run"  # ATLF has all four source categories
    by_mod = {r["module_id"]: r for r in rt["readiness_register"]}
    # Every wired analytical module routes Full Run on the ATLF pack.
    for mid in ("CP-1", "CP-1A", "CP-1B", "CP-1C", "CP-2", "CP-2B", "CP-2C",
                "CP-2D", "CP-2E", "CP-2F", "CP-3", "CP-3B", "CP-3C", "CP-3D",
                "CP-4", "CP-4C", "CP-6A", "CP-6E"):
        assert by_mod[mid]["readiness"] == "Full Run", mid
    # The spec-only corpus modules are routed and shown as Not Implemented (the
    # full-mesh honesty fix, engine item #8) but never executed. (engine item #8)
    for mid in ("CP-SR", "CP-MON", "CP-RENDER", "CP-EXTRACT"):
        assert by_mod[mid]["readiness"] == "Not Implemented", mid
    # A spec-only node the route plan never executes has no output row.
    assert client.get(f"/api/runs/{atlf_run['id']}/modules/CP-RENDER").status_code == 404
    # CP-X is an orchestration record, not gated content.
    assert detail["qa_status"] == "Passed" and detail["owned_object"] == "route_plan"


def test_doc_scanners_light_up_on_atlf_corpus(client, atlf_run):
    """The document-grounded scanners produce real, evidence-resolved output on the
    ATLF agreement corpus — proving the retrieve→scan→persist path end to end."""
    cp4 = client.get(f"/api/runs/{atlf_run['id']}/modules/CP-4").json()
    # The indenture's uncapped add-backs + day-one incremental capacity are flagged.
    assert cp4["runtime_output"]["aggressiveness_score"] is not None
    assert cp4["runtime_output"]["provisions_flagged"]
    assert any(ev["document_chunk_id"] for c in cp4["claims"] for ev in c["evidence"])

    # CP-3B maps at least the senior secured notes tranche from the offering docs.
    cp3b = client.get(f"/api/runs/{atlf_run['id']}/modules/CP-3B").json()
    assert "SSN" in cp3b["runtime_output"]["seniority_order"]

    # Honest gap: ATLF has no governance/liquidity disclosure, so those scanners
    # abstain rather than fabricate (they need their own doc types ingested).
    cp2d = client.get(f"/api/runs/{atlf_run['id']}/modules/CP-2D").json()
    assert cp2d["runtime_output"].get("governance_risk_score") is None


def test_qa_endpoint_reports_findings(client, atlf_run):
    qa = client.get(f"/api/runs/{atlf_run['id']}/qa").json()
    assert qa["qa_status"] == "Restricted"
    assert qa["findings_by_severity"]["CRITICAL"] == 0
    assert qa["findings_by_severity"]["MATERIAL"] == 2
    assert any(f["module_id"] == "CP-1" for f in qa["findings"])


def test_cp1_evidence_resolves_to_ingested_chunks(client, atlf_run):
    detail = client.get(f"/api/runs/{atlf_run['id']}/modules/CP-1").json()
    assert detail["claims"], "CP-1 should expose claims"
    for claim in detail["claims"]:
        for ev in claim["evidence"]:
            assert ev["document_chunk_id"], f"{ev['evidence_id']} not linked to a source chunk"


def test_run_unknown_issuer_404(client):
    r = client.post("/api/runs", json={"issuer_id": "no-such-issuer"})
    assert r.status_code == 404


def test_module_not_in_run_404(client, atlf_run):
    # CP-RENDER is an export node the engine never persists as a module output.
    r = client.get(f"/api/runs/{atlf_run['id']}/modules/CP-RENDER")
    assert r.status_code == 404


def test_unknown_run_404(client):
    assert client.get("/api/runs/00000000-0000-0000-0000-000000000000").status_code == 404


def test_list_runs_includes_reference_run(client, atlf_run):
    rows = client.get("/api/runs", params={"issuer_id": REFERENCE_ISSUER_ID}).json()
    assert any(r["id"] == atlf_run["id"] for r in rows)


# ── Committee export gate ────────────────────────────────────────────────────
def test_committee_export_gate_allows_only_committee_ready():
    assert committee_export_allowed("Committee Ready")
    assert not committee_export_allowed("Restricted")
    assert not committee_export_allowed("Blocked")
    assert not committee_export_allowed("Draft Only")


def test_assemble_report_drops_auditor_modules():
    run = SimpleNamespace(
        id="r1", issuer_id="i1", as_of_date="2026-03-31",
        qa_status="Passed", committee_status="Committee Ready", analyst_id="a",
    )
    modules = [
        SimpleNamespace(module_id="CP-1", module_name="Canonical", confidence="High",
                        qa_status="Passed", runtime_output={"net_leverage": 5.0}),
        SimpleNamespace(module_id="CP-5", module_name="QA", confidence="High",
                        qa_status="Passed", runtime_output={}),
    ]
    report = assemble_report(run, modules)
    assert report["committee_status"] == "Committee Ready"
    section_ids = [s["module_id"] for s in report["sections"]]
    assert "CP-1" in section_ids and "CP-5" not in section_ids


def test_export_refused_for_restricted_run(client, atlf_run):
    r = client.post(f"/api/runs/{atlf_run['id']}/report")
    assert r.status_code == 409
    detail = r.json()["detail"]
    assert detail["committee_status"] == "Restricted"
    assert detail["blocking_findings"], "refusal should surface the blocking findings"
    assert any(f["severity"] == "MATERIAL" for f in detail["blocking_findings"])


# ── Item #10: keyless fixture served for a NON-demo issuer is tagged + flagged ─
@pytest.mark.asyncio
async def test_non_atlf_fixture_run_is_tagged_demo_and_flagged(seeded_db):
    """A keyless (offline) run for an issuer that is NOT the genuine Atlas Forge demo
    falls back to the ATLF fixture financials. Those are synthetic, so: the projected
    CP-1 facts are provenance 'demo_fixture' (not 'run'/'fixture'), a MATERIAL
    CP-1-DEMO-FIXTURE finding restricts the run, and the CP-1 row carries a limitation
    making the synthetic origin explicit. The genuine demo issuer keeps 'fixture'."""
    from sqlalchemy import select

    from database import AsyncSessionLocal, Issuer, MetricFact, ModuleOutput, QAFinding, Run
    from engine.fixtures import DEMO_FIXTURE_LIMITATION
    from run_executor import execute_run_by_id

    # An issuer with NO ticker (EDGAR skipped) and NO docs (reported-CP1 returns None)
    # → CP-1 takes the fixture path. A distinct id so it is not the reference issuer.
    other_id = "b0000000-0000-0000-0000-0000000000aa"
    async with AsyncSessionLocal() as s:
        if await s.get(Issuer, other_id) is None:
            s.add(Issuer(id=other_id, name="Imitation Forge Ltd", industry="Industrials",
                         country="USA"))
        run = Run(issuer_id=other_id, analyst_id="t")
        s.add(run)
        await s.commit()
        run_id = run.id

    await execute_run_by_id(run_id)

    async with AsyncSessionLocal() as s:
        run = await s.get(Run, run_id)
        assert run.status == "complete"
        # MATERIAL demo-fixture finding → the run is Restricted (not Committee Ready).
        assert run.qa_status == "Restricted"

        facts = (await s.execute(
            select(MetricFact).where(MetricFact.issuer_id == other_id,
                                     MetricFact.run_id == run_id))).scalars().all()
        assert facts, "the fixture CP-1 should project metric facts"
        provs = {f.provenance for f in facts}
        # The crux: fabricated demo numbers are tagged non-authoritative, never 'run'.
        assert provs == {"demo_fixture"}, provs

        findings = (await s.execute(
            select(QAFinding).where(QAFinding.run_id == run_id))).scalars().all()
        demo = [f for f in findings if f.finding_id == "CP-1-DEMO-FIXTURE"]
        assert len(demo) == 1 and demo[0].severity == "MATERIAL"

        cp1 = (await s.execute(
            select(ModuleOutput).where(ModuleOutput.run_id == run_id,
                                       ModuleOutput.module_id == "CP-1"))).scalar_one()
        assert DEMO_FIXTURE_LIMITATION in (cp1.limitation_flags or [])
