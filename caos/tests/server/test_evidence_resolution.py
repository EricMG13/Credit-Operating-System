"""Regression: in the LIVE LLM path, a sourced citation the model did not ground
must stay unresolved so CP-5B's 'unresolved sourced citation -> MINOR' lane fires
(the back-fill must not silently anchor an LLM-fabricated locator to a claim-text
match). Deterministic / fixture evidence keeps the back-fill for click-to-source.
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from engine import runner
from engine.lineage import validate_lineage
from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload


async def _retrieve(query, k=3):
    return [SimpleNamespace(chunk_id="chunk-x", text="some ingested text")]


def _payload(extraction_type):
    return ModulePayload(
        module_id="CP-1", module_name="x", owned_object="o", runtime_output={},
        claims=[ClaimSpec(
            claim_id="C1", claim_text="net leverage is 5x",
            evidence=[EvidenceSpec(
                evidence_id="E-1", extraction_type=extraction_type,
                lineage_class="Directly Sourced", source_locator="p.999", confidence="High",
            )],
        )],
    )


@pytest.mark.asyncio
async def test_live_leaves_ungrounded_sourced_unresolved_and_lineage_flags_minor():
    p = _payload("table_value")  # a sourced extraction type
    await runner._resolve_evidence(p, _retrieve, suppress_sourced=True)
    assert p.claims[0].evidence[0].resolved_chunk_id is None  # NOT back-filled
    findings = validate_lineage([p])
    assert any(f.severity == "MINOR" and "E-1" in f.description for f in findings), \
        "CP-5B should flag the unresolved sourced citation"


@pytest.mark.asyncio
async def test_live_still_resolves_non_sourced():
    p = _payload("documentary_fact")  # not a sourced type
    await runner._resolve_evidence(p, _retrieve, suppress_sourced=True)
    assert p.claims[0].evidence[0].resolved_chunk_id == "chunk-x"


@pytest.mark.asyncio
async def test_fixture_path_still_resolves_sourced():
    """Offline / fixture evidence is trusted and depends on runtime resolution."""
    p = _payload("table_value")
    await runner._resolve_evidence(p, _retrieve, suppress_sourced=False)
    assert p.claims[0].evidence[0].resolved_chunk_id == "chunk-x"
