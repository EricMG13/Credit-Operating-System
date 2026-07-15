from __future__ import annotations

from types import SimpleNamespace
from pathlib import Path

from engine.module_contracts import CP2GRuntime, validate_runtime_output
from engine.prompt_bundles import load_prompt_bundle
from engine.schemas import ModulePayload, validate_payload
from engine.specialized_modules import source_gate, unavailable_payload
from engine.synth import _payload_tool, _retrieve_module_hits
import pytest


def _hit(chunk_id: str, text: str):
    return SimpleNamespace(chunk_id=chunk_id, text=text, score=1.0)


def test_module_id_extension_is_literal_cp2g_only():
    base = dict(module_name="x", owned_object="x", runtime_output={})
    cp2g = ModulePayload(module_id="CP-2G", **base)
    cp1g = ModulePayload(module_id="CP-1G", **base)
    assert not any("module pattern" in error for error in validate_payload(cp2g))
    assert any("module pattern" in error for error in validate_payload(cp1g))


def test_cp2g_zero_source_is_blocked_not_not_applicable():
    bundle = load_prompt_bundle("CP-2G")
    payload = unavailable_payload("CP-2G", [], bundle)
    assert payload.runtime_output["module_status"] == "Blocked"
    assert payload.runtime_output["source_register"] == []
    assert payload.runtime_output["gaps"]
    assert validate_payload(payload) == []


def test_cp2g_not_applicable_requires_affirmative_inventory_and_assessment():
    bundle = load_prompt_bundle("CP-2G")
    blocked = unavailable_payload("CP-2G", [], bundle).runtime_output
    blocked.update({
        "module_status": "Not Applicable",
        "status_basis": "No material exposure.",
        "sustainability_linked_debt_status": "Not Applicable",
        "gaps": [],
    })
    errors = validate_runtime_output("CP-2G", blocked)
    assert errors and "affirmative source inventory" in errors[0]


def test_cp2g_valid_not_applicable_has_sourced_immaterial_assessment():
    bundle = load_prompt_bundle("CP-2G")
    runtime = {
        "schema_version": "cp-2g.v1",
        "prompt_bundle_fingerprint": bundle.fingerprint,
        "prompt_bundle_files": list(bundle.files),
        "module_status": "Not Applicable",
        "status_basis": "Issuer filings support no credit-material factor and no linked debt.",
        "source_register": [{
            "source": "Annual report", "source_date": "2025-12-31",
            "source_type": "Regulatory filing", "reliability": "Regulatory Filed",
            "greenwashing_flag": "None Identified", "evidence_ids": ["c1"],
        }],
        "transition_risks": [], "social_event_risks": [],
        "materiality_assessments": [{
            "factor": "Transition exposure", "materiality_class": "Immaterial to Credit",
            "transmission_basis": "No material issuer-specific transmission identified in filed evidence.",
            "catalyst": None, "evidence_ids": ["c1"], "gap_id": None,
        }],
        "sustainability_linked_debt_status": "Not Applicable",
        "sustainability_linked_instruments": [], "demand_access_implications": [],
        "credit_implications": [], "gaps": [],
        "overall_credit_view": "Not Applicable to the current credit view.",
        "cp6a_handoff": None,
    }
    assert CP2GRuntime.model_validate(runtime).module_status == "Not Applicable"


def test_cp4d_source_gate_requires_entity_and_guarantee_evidence():
    status, gaps = source_gate("CP-4D", [_hit("c1", "Collateral and first lien security")])
    assert status == "Blocked"
    assert any("Entity-perimeter" in gap for gap in gaps)
    assert any("Guarantee-status" in gap for gap in gaps)


def test_cp4d_source_gate_does_not_treat_negative_disclosure_as_evidence():
    status, gaps = source_gate("CP-4D", [_hit(
        "c1",
        "Borrower: Example Holdings. Guarantor schedule not provided. "
        "Security documents missing.",
    )])
    assert status == "Blocked"
    assert any("Guarantee-status" in gap for gap in gaps)
    assert any("Security/collateral" in gap for gap in gaps)


def test_synthetic_document_packs_drive_limited_not_clean_source_gates():
    fixture_dir = Path(__file__).parents[1] / "fixtures" / "modules"
    cp4d_text = (fixture_dir / "cp-4d-synthetic-structure.txt").read_text()
    cp2g_text = (fixture_dir / "cp-2g-synthetic-disclosure.txt").read_text()
    assert "SYNTHETIC TEST DOCUMENT" in cp4d_text and "SYNTHETIC TEST DOCUMENT" in cp2g_text
    assert source_gate("CP-4D", [_hit("cp4d-fixture", cp4d_text)])[0] == "Completed with Limitations"
    assert source_gate("CP-2G", [_hit("cp2g-fixture", cp2g_text)])[0] == "Completed with Limitations"


def test_cp4d_offline_fallback_never_fabricates_structural_findings():
    hits = [_hit("c1", "Subsidiary entity and guarantor guarantee schedule with secured collateral lien")]
    payload = unavailable_payload("CP-4D", hits, load_prompt_bundle("CP-4D"))
    assert payload.runtime_output["module_status"] == "Completed with Limitations"
    for key in ("structural_priority", "leakage_routes", "priming_exposures"):
        assert payload.runtime_output[key] == []
    assert validate_payload(payload) == []


def test_specialized_forced_tools_pin_closed_runtime_schemas():
    for module_id, version in (("CP-4D", "cp-4d.v1"), ("CP-2G", "cp-2g.v1")):
        schema = _payload_tool(module_id)["input_schema"]["properties"]["runtime_output"]
        assert schema["additionalProperties"] is False
        assert "module_status" in schema["required"]
        assert schema["properties"]["schema_version"]["const"] == version


@pytest.mark.asyncio
async def test_specialized_retrieval_uses_stable_multi_query_deduplication():
    calls: list[str] = []

    async def retrieve(query: str, k: int):
        calls.append(query)
        return [_hit("shared", "same chunk"), _hit(f"c{len(calls)}", query)]

    hits = await _retrieve_module_hits("CP-2G", "Issuer", retrieve)
    assert len(calls) == 4
    assert [hit.chunk_id for hit in hits] == ["shared", "c1", "c2", "c3", "c4"]


@pytest.mark.asyncio
async def test_cp2g_flag_on_runs_and_cannot_block_the_overall_run(seeded_db, monkeypatch):
    from config import get_settings
    from database import AsyncSessionLocal, ModuleOutput, Run
    from engine.fixtures import REFERENCE_ISSUER_ID
    from run_executor import execute_run_by_id
    from sqlalchemy import select

    settings = get_settings()
    monkeypatch.setattr(settings, "caos_cp_2g_enabled", True)
    monkeypatch.setattr(settings, "caos_cp_4d_enabled", False)
    async with AsyncSessionLocal() as session:
        run = Run(issuer_id=REFERENCE_ISSUER_ID, analyst_id="phase4")
        session.add(run)
        await session.commit()
        run_id = run.id
    await execute_run_by_id(run_id)
    async with AsyncSessionLocal() as session:
        run = await session.get(Run, run_id)
        row = (await session.execute(select(ModuleOutput).where(
            ModuleOutput.run_id == run_id, ModuleOutput.module_id == "CP-2G",
        ))).scalar_one()
        assert run.status == "complete"
        assert run.qa_status != "Blocked"
        assert row.runtime_output["module_status"] in {"Blocked", "Completed with Limitations"}
        assert row.runtime_output["credit_implications"] == []


@pytest.mark.asyncio
async def test_phase4_flags_are_independent_at_execution(seeded_db, monkeypatch):
    from config import get_settings
    from database import AsyncSessionLocal, ModuleOutput, Run
    from engine.fixtures import REFERENCE_ISSUER_ID
    from run_executor import execute_run_by_id
    from sqlalchemy import select

    settings = get_settings()
    monkeypatch.setattr(settings, "caos_cp_2g_enabled", False)
    monkeypatch.setattr(settings, "caos_cp_4d_enabled", True)
    async with AsyncSessionLocal() as session:
        run = Run(issuer_id=REFERENCE_ISSUER_ID, analyst_id="phase4")
        session.add(run)
        await session.commit()
        run_id = run.id
    await execute_run_by_id(run_id)
    async with AsyncSessionLocal() as session:
        rows = (await session.execute(select(ModuleOutput.module_id).where(
            ModuleOutput.run_id == run_id,
        ))).scalars().all()
        assert "CP-4D" in rows
        assert "CP-2G" not in rows
