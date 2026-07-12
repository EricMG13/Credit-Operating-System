"""Regression: an unexpected (non-SynthesisError) exception in one module must
isolate to that module's Blocked gate, not abort the whole run and discard the
already-completed peers in its layer. (Trigger in the wild: a malformed live CP-1
shape making a downstream pure module raise TypeError mid-gather.)"""
from __future__ import annotations

import pytest
from sqlalchemy import select

import engine.runner as runner
from engine.fixtures import REFERENCE_ISSUER_ID


@pytest.mark.asyncio
async def test_non_synthesiserror_isolates_to_blocked(seeded_db, monkeypatch):
    from database import AsyncSessionLocal, ModuleOutput, Run
    from run_executor import execute_run_by_id

    # The dispatch moved behind the bindings seam (spec P1·C1); runner imports
    # resolve_binding by name, so patch it on runner. It takes a single RunContext.
    orig = runner.resolve_binding

    async def boom(ctx, *a, **k):
        if ctx.module_id == "CP-2F":  # a pure, fan-out module → runs in the layer gather
            raise TypeError("simulated malformed-upstream crash")
        return await orig(ctx, *a, **k)

    monkeypatch.setattr(runner, "resolve_binding", boom)

    async with AsyncSessionLocal() as s:
        run = Run(issuer_id=REFERENCE_ISSUER_ID, analyst_id="t")
        s.add(run)
        await s.commit()
        run_id = run.id

    await execute_run_by_id(run_id)

    async with AsyncSessionLocal() as s:
        run = await s.get(Run, run_id)
        # The whole point: the run completes instead of failing.
        assert run.status == "complete"
        rows = (await s.execute(
            select(ModuleOutput).where(ModuleOutput.run_id == run_id)
        )).scalars().all()
        by = {r.module_id: r for r in rows}
        assert by["CP-2F"].qa_status == "Blocked"        # the fault was gated
        assert by["CP-1A"].qa_status != "Blocked"        # a same-layer peer survived
