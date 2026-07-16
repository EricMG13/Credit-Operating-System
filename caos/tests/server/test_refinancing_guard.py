"""CP-3D interior-container guard (triage 2026-07-16 P3 — the BE3 stray)."""

from __future__ import annotations

import asyncio

from engine.refinancing import synthesize_refinancing
from engine.schemas import ModulePayload


def _cp1(nf) -> ModulePayload:
    return ModulePayload(module_id="CP-1", module_name="X", owned_object="o",
                         runtime_output={"normalized_financials": nf})


def test_narrative_or_null_normalized_financials_degrades_not_raises():
    # A live-LLM CP-1 can carry normalized_financials as a narrative string or
    # null; the chained `.get` used to raise AttributeError into the module
    # gate (Blocked) instead of the module's own Insufficient path.
    for nf in ("not disclosed this quarter", None, 42):
        p = asyncio.run(synthesize_refinancing(_cp1(nf), None))
        assert p.module_id == "CP-3D"
        assert p.confidence == "Insufficient Information"
