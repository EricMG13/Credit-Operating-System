"""
Registry-driven execution planner — deterministic CP-X backbone (Redeploy Plan D3).

CP-X's job is graph planning, not analysis: given CP-0 per-module readiness, it
produces a dependency-ordered route_plan, marks each module Full Run / Ready with
Limitations / Blocked, computes intra-layer parallelism, and propagates
limitations forward. That is fully deterministic from `module_registry.json`, so
it lives here (the LLM CP-X prompt can narrate the gate/summary on top).

Pure stdlib — runnable and testable without backend deps.
"""

from __future__ import annotations

from pathlib import Path

from governance.registry import Registry, load_registry

READINESS_FULL = "Full Run"
READINESS_LIMITED = "Ready with Limitations"
READINESS_BLOCKED = "Blocked"


def _analytical_preds(reg: Registry) -> dict[str, list[str]]:
    preds: dict[str, list[str]] = {m: [] for m in reg.modules}
    for a, b in reg.analytical_edges:
        preds[b].append(a)
    return preds


def _levels(reg: Registry) -> dict[str, int]:
    """Longest-path layer of each module over the analytical DAG (roots = 0)."""
    preds = _analytical_preds(reg)
    order = sorted(reg.modules, key=lambda m: reg.modules[m].order)
    level: dict[str, int] = {}
    for m in order:
        level[m] = 1 + max((level[p] for p in preds[m]), default=-1)
    return level


def build_route_plan(
    ready: set[str],
    limited: set[str] | None = None,
    registry_path: Path | None = None,
) -> dict:
    """
    Build a deterministic route plan.

    ready   — modules CP-0 marked Ready (source dependencies met)
    limited — modules CP-0 flagged Conditional / Not Usable (carry limitation)
    """
    reg = load_registry(registry_path)
    limited = set(limited or set())
    preds = _analytical_preds(reg)
    levels = _levels(reg)

    analytical = [m for m in reg.modules if reg.modules[m].layer not in ("Infra",)]

    status: dict[str, str] = {}
    propagated: dict[str, list[str]] = {}

    # Process in execution order so predecessor status is known first.
    #
    # BLOCKED is reserved for a module whose OWN sources CP-0 could not clear
    # (m not in `ready`). A module CP-0 cleared but whose upstream is missing or
    # limited runs "Ready with Limitations" and carries the limitation forward
    # (CP-X semantics). Module-specific HARD gates (e.g. CP-2B's both-inputs
    # hard-stop, CP-3B's input gates) are enforced inside those agents, not here.
    for m in sorted(analytical, key=lambda x: reg.modules[x].order):
        if m not in ready:
            status[m] = READINESS_BLOCKED
            continue
        missing_preds = [p for p in preds[m] if status.get(p) == READINESS_BLOCKED]
        limited_preds = [p for p in preds[m] if status.get(p) == READINESS_LIMITED]
        carry = sorted(set(missing_preds) | set(limited_preds))
        if m in limited or carry:
            status[m] = READINESS_LIMITED
            if carry:
                propagated[m] = carry
        else:
            status[m] = READINESS_FULL

    runnable = [m for m in analytical if status[m] != READINESS_BLOCKED]
    runnable.sort(key=lambda m: (reg.modules[m].order))

    # Parallel groups: runnable modules sharing a level, no edge between them.
    groups: dict[int, list[str]] = {}
    for m in runnable:
        groups.setdefault(levels[m], []).append(m)
    parallel_groups = [sorted(groups[k], key=lambda m: reg.modules[m].order) for k in sorted(groups)]

    return {
        "execution_sequence": [
            {"order": reg.modules[m].order, "module_id": m,
             "name": reg.modules[m].name, "layer": reg.modules[m].layer,
             "readiness": status[m]}
            for m in runnable
        ],
        "readiness_register": status,
        "parallel_groups": parallel_groups,
        "blocked": sorted([m for m in analytical if status[m] == READINESS_BLOCKED],
                          key=lambda m: reg.modules[m].order),
        "limitation_propagation": propagated,
        "counts": {
            "full_run": sum(1 for s in status.values() if s == READINESS_FULL),
            "limited": sum(1 for s in status.values() if s == READINESS_LIMITED),
            "blocked": sum(1 for s in status.values() if s == READINESS_BLOCKED),
        },
    }


if __name__ == "__main__":
    import json

    reg = load_registry()
    all_analytical = {m for m in reg.modules if reg.modules[m].layer != "Infra"}
    plan = build_route_plan(ready=all_analytical)
    print("Full-readiness plan:")
    print("  parallel groups:")
    for i, g in enumerate(plan["parallel_groups"]):
        print(f"    L{i}: {g}")
    print("  counts:", plan["counts"])
