"""
P2 tests: CP-5 QA engine, VE validation, render/extract boundary, X7 loop guard.

Stdlib via package import (all governance modules are pydantic-free here).
Runnable directly:  python3 tests/backend/test_qa_export.py
"""

from __future__ import annotations

import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parents[2] / "backend"
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from governance import export, loop_guard, qa_engine, validation  # noqa: E402
from governance.validation import Finding  # noqa: E402

# A minimal well-formed CP-1C payload envelope.
GOOD = {
    "module_id": "CP-1C", "module_name": "PeerBenchmark", "owned_object": "peer_benchmark",
    "schema_family": "Nested", "runtime_output": {}, "evidence_trace": {},
    "confidence": "Medium", "limitation_flags": [], "qa_status": "Not Reviewed",
    "validation_warnings": [], "downstream_consumers": ["CP-2", "CP-3"],
}


# ── validation / VE taxonomy ────────────────────────────────────────────────

def test_ve_taxonomy_has_20_codes():
    assert len(validation.VE_TAXONOMY) == 20
    assert validation.VE_TAXONOMY["VE-010"][1].value == "MATERIAL"
    assert validation.VE_TAXONOMY["VE-006"][1].value == "CRITICAL"


def test_render_enum_validation_flags_bad_value():
    f = validation.validate_render_enums({"ic_action_bias": "Bogus"})
    assert f and f[0].ve_code == "VE-010"
    assert validation.validate_render_enums({"ic_action_bias": "Core Hold"}) == []


# ── QA engine + severity gate ───────────────────────────────────────────────

def test_clean_payload_passes_committee_ready():
    r = qa_engine.run_qa(GOOD)
    assert r["qa_status"] == "Passed"
    assert r["committee_status"] == "Committee Ready"
    assert r["findings"] == []


def test_missing_envelope_field_blocks():
    bad = {k: v for k, v in GOOD.items() if k != "evidence_trace"}
    r = qa_engine.run_qa(bad)
    assert r["qa_status"] == "Blocked"  # VE-001 CRITICAL


def test_wrong_owned_object_blocks():
    bad = {**GOOD, "owned_object": "not_peer_benchmark"}
    r = qa_engine.run_qa(bad)
    assert r["qa_status"] == "Blocked"  # VE-002 CRITICAL


def test_bad_enum_restricts():
    bad = {**GOOD, "runtime_output": {"ic_action_bias": "Nope"}}
    r = qa_engine.run_qa(bad)
    assert r["qa_status"] == "Restricted"  # VE-010 MATERIAL, no CRITICAL


def test_orphan_claim_detected():
    f = qa_engine.validate_lineage([
        {"claim_id": "c1", "lineage_class": "Untraced", "committee_facing": True},
        {"claim_id": "c2", "lineage_class": "Directly Sourced", "committee_facing": True},
    ])
    assert [x.ve_code for x in f] == ["VE-015"]


def test_agent_findings_merge_and_gate():
    crit = Finding.of("VE-007", "Unsupported Claim", "fabricated metric")
    r = qa_engine.run_qa(GOOD, agent_findings=[crit])
    assert r["qa_status"] == "Blocked"
    assert "VE-007" in r["required_remediation"]


# ── export / extract boundary ───────────────────────────────────────────────

def test_assemble_six_canonical_blocks():
    qa = qa_engine.run_qa(GOOD)
    app = export.assemble_appendices(GOOD, qa, "Acme_CP-1C_20260608.docx")
    assert list(app.keys()) == export.CANONICAL_BLOCKS
    assert len(export.CANONICAL_BLOCKS) == 6


def test_export_manifest_validation():
    m = export.build_export_manifest(GOOD, "f.docx")
    assert export.validate_export_manifest(m) == []
    m_bad = {**m, "separate_artifacts": ["rogue.json"]}
    assert export.validate_export_manifest(m_bad)[0].ve_code == "VE-005"


def test_extract_envelopes_are_cp_extract_only():
    qa = qa_engine.run_qa(GOOD)
    app = export.assemble_appendices(GOOD, qa, "f.docx")
    envs = export.extract_envelopes(app, "CP-1C", "PeerBenchmark", "f.docx")
    assert len(envs) == 6
    assert all(e["agent_id"] == "CP-EXTRACT" for e in envs)
    assert all(e["extraction_status"] == "Success" and e["content_hash"] for e in envs)


# ── X7 cycle guard ──────────────────────────────────────────────────────────

def test_cycle_continues_when_active():
    d = loop_guard.evaluate_cycle(iteration=1, convergence_delta=0.4, new_critical_signals=1)
    assert d.should_continue and d.termination_reason is None


def test_cycle_converges():
    d = loop_guard.evaluate_cycle(iteration=1, convergence_delta=0.02, new_critical_signals=0)
    assert not d.should_continue and d.termination_reason in ("converged", "no_new_signals")


def test_cycle_max_round_trips_and_timeout():
    d2 = loop_guard.evaluate_cycle(iteration=2, convergence_delta=0.4, new_critical_signals=1)
    assert not d2.should_continue and d2.termination_reason == "max_round_trips"
    d3 = loop_guard.evaluate_cycle(iteration=3, convergence_delta=0.4, new_critical_signals=1)
    assert not d3.should_continue and d3.termination_reason == "hard_timeout"


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failed = 0
    for fn in fns:
        try:
            fn(); print(f"PASS  {fn.__name__}")
        except AssertionError as e:
            failed += 1; print(f"FAIL  {fn.__name__}: {e}")
    print(f"\n{len(fns) - failed}/{len(fns)} passed")
    raise SystemExit(1 if failed else 0)
