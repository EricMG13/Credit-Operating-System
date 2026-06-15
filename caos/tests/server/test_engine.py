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
from retrieval import bm25_rank


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
    # CP-5B / CP-5 auditors ran and persisted.
    assert "CP-5B" in by_id and "CP-5" in by_id


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
    r = client.get(f"/api/runs/{atlf_run['id']}/modules/CP-4")
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
