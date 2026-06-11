"""
Tests for the deterministic registry-driven planner (CP-X backbone).

Stdlib-only: adds backend/ to sys.path and imports the planner package
(governance.registry has no heavy deps). Runnable directly:

    python3 tests/backend/test_registry_planner.py
"""

from __future__ import annotations

import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parents[2] / "backend"
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from agents.orchestration.registry_planner import (  # noqa: E402
    READINESS_BLOCKED,
    READINESS_FULL,
    READINESS_LIMITED,
    build_route_plan,
)
from governance.registry import load_registry  # noqa: E402

REG = load_registry()
ANALYTICAL = {m for m in REG.modules if REG.modules[m].layer != "Infra"}


def test_full_readiness_runs_everything_full():
    plan = build_route_plan(ready=ANALYTICAL)
    assert plan["counts"]["blocked"] == 0
    assert plan["counts"]["full_run"] == len(ANALYTICAL)
    # CP-0 is the first scheduled module; CP-6E is the last analytical (terminal).
    seq = [s["module_id"] for s in plan["execution_sequence"]]
    assert seq[0] == "CP-0"
    assert seq.index("CP-6E") > seq.index("CP-6A") > seq.index("CP-3")


def test_execution_sequence_respects_dependencies():
    plan = build_route_plan(ready=ANALYTICAL)
    pos = {s["module_id"]: i for i, s in enumerate(plan["execution_sequence"])}
    for a, b in REG.analytical_edges:
        assert pos[a] < pos[b], f"{a} must precede {b}"


def test_parallel_group_has_no_internal_edges():
    plan = build_route_plan(ready=ANALYTICAL)
    edgeset = set(REG.analytical_edges)
    for group in plan["parallel_groups"]:
        for x in group:
            for y in group:
                assert (x, y) not in edgeset, f"{x}->{y} cannot be in the same parallel group"


def test_unavailable_module_is_blocked_and_excluded():
    # A module whose OWN sources CP-0 could not clear is Blocked + excluded.
    ready = ANALYTICAL - {"CP-2"}
    plan = build_route_plan(ready=ready)
    assert plan["readiness_register"]["CP-2"] == READINESS_BLOCKED
    assert "CP-2" not in [s["module_id"] for s in plan["execution_sequence"]]


def test_missing_upstream_degrades_downstream_to_limited():
    # CP-2 unavailable but CP-2B/CP-6A are CP-0-ready -> they run with limitations
    # (CP-X semantics); the module-specific hard-stop lives in the agent.
    ready = ANALYTICAL - {"CP-2"}
    plan = build_route_plan(ready=ready)
    assert plan["readiness_register"]["CP-2B"] == READINESS_LIMITED
    assert plan["readiness_register"]["CP-6A"] == READINESS_LIMITED
    assert "CP-2" in plan["limitation_propagation"].get("CP-2B", [])


def test_limitation_propagates_forward():
    plan = build_route_plan(ready=ANALYTICAL, limited={"CP-1"})
    assert plan["readiness_register"]["CP-1"] == READINESS_LIMITED
    # A direct CP-1 consumer inherits the limitation.
    assert plan["readiness_register"]["CP-2"] == READINESS_LIMITED
    assert "CP-1" in plan["limitation_propagation"].get("CP-2", [])


def test_earnings_update_pathway():
    # Minimal pathway: CP-0 -> CP-1 -> CP-1B -> CP-2 (+ QA).
    ready = {"CP-0", "CP-X", "CP-1", "CP-1B", "CP-2", "CP-5B", "CP-5"}
    plan = build_route_plan(ready=ready)
    run = [s["module_id"] for s in plan["execution_sequence"]]
    assert {"CP-0", "CP-1", "CP-1B", "CP-2"} <= set(run)
    assert "CP-3" not in run  # not ready -> excluded


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
