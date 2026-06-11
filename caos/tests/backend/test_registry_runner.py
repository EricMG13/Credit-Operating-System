"""
Tests for the registry-driven runner (planner->runner loop).

Uses a fake `invoke` so the orchestration logic is verified without
pydantic/anthropic. Runnable directly:

    python3 tests/backend/test_registry_runner.py
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parents[2] / "backend"
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from agents.orchestration.registry_planner import build_route_plan  # noqa: E402
from agents.orchestration.registry_runner import execute_plan  # noqa: E402
from governance.registry import load_registry  # noqa: E402

REG = load_registry()
ANALYTICAL = {m for m in REG.modules if REG.modules[m].layer != "Infra"}


def _run(ready: set[str]):
    """Execute a plan with a recording fake invoke; return (results, received)."""
    received: dict[str, set] = {}

    async def fake_invoke(module_id, upstream, context):
        received[module_id] = set(upstream)
        return {"module_id": module_id, "qa_status": "Passed"}

    plan = build_route_plan(ready=ready)
    results = asyncio.run(execute_plan(plan, fake_invoke, registry=REG))
    return plan, results, received


def test_every_runnable_module_invoked_once():
    plan, results, received = _run(ANALYTICAL)
    runnable = {s["module_id"] for s in plan["execution_sequence"]}
    assert set(received) == runnable
    assert set(results) == runnable


def test_upstream_outputs_threaded_to_each_module():
    plan, results, received = _run(ANALYTICAL)
    runnable = {s["module_id"] for s in plan["execution_sequence"]}
    for a, b in REG.analytical_edges:
        if a in runnable and b in runnable:
            # When b ran, a's output must already have been supplied as upstream.
            assert a in received[b], f"{a} not threaded into {b}"


def test_cp6a_receives_its_many_upstreams():
    _, results, received = _run(ANALYTICAL)
    # CP-6A should receive several of its analytical predecessors.
    assert {"CP-2", "CP-3", "CP-4C"} <= received["CP-6A"]


def test_blocked_module_not_invoked_descendants_degrade():
    ready = ANALYTICAL - {"CP-2"}
    plan, results, received = _run(ready)
    assert "CP-2" not in received                 # blocked -> never invoked
    assert "CP-2B" in received                    # limited -> still runs
    assert "CP-2" not in received["CP-2B"]         # without the blocked upstream


def test_results_collected_for_all_runnable():
    plan, results, received = _run(ANALYTICAL)
    assert all(r["qa_status"] == "Passed" for r in results.values())


def test_qa_gate_withholds_blocked_output_from_downstream():
    received: dict[str, set] = {}

    async def fake_invoke(module_id, upstream, context):
        received[module_id] = set(upstream)
        return {"module_id": module_id}

    # QA blocks CP-2 -> its output must not be threaded into CP-2B / CP-6A.
    def fake_qa(out):
        status = "Blocked" if out["module_id"] == "CP-2" else "Passed"
        return {"qa_status": status}

    plan = build_route_plan(ready=ANALYTICAL)
    results = asyncio.run(execute_plan(plan, fake_invoke, registry=REG, qa=fake_qa))
    assert results["CP-2"]["_qa"]["qa_status"] == "Blocked"
    assert "CP-2" not in received["CP-2B"]   # downstream degrades
    assert "CP-2" not in received["CP-6A"]


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
