"""
Registry-driven DAG foundation (Redeploy Plan D3).

Pure-stdlib loader + governance validators over `module_registry.json`. This
operationalises three v2 governance rules so they can be enforced in CI before
any LLM agent runs:

  * one-owner-per-object  — CP-X VE-009 (no two modules own the same object)
  * strictly-forward flow — the 'analytical' edge subgraph must be acyclic
  * order consistency     — execution order must respect analytical edges

Run directly for a self-check:  python3 backend/governance/registry.py
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

_REGISTRY_PATH = Path(__file__).with_name("module_registry.json")


@dataclass(frozen=True)
class Module:
    id: str
    name: str
    layer: str
    order: int
    owned_object: str
    gates: tuple[str, ...] = ()
    terminal: bool = False


@dataclass
class Registry:
    modules: dict[str, Module]
    edges: list[tuple[str, str, str]]  # (from, to, type)
    sanctioned_cycles: list[frozenset]

    @property
    def analytical_edges(self) -> list[tuple[str, str]]:
        return [(a, b) for a, b, t in self.edges if t == "analytical"]


def load_registry(path: Path | None = None) -> Registry:
    data = json.loads((path or _REGISTRY_PATH).read_text())
    modules = {
        m["id"]: Module(
            id=m["id"], name=m["name"], layer=m["layer"], order=m["order"],
            owned_object=m["owned_object"], gates=tuple(m.get("gates", [])),
            terminal=bool(m.get("terminal", False)),
        )
        for m in data["modules"]
    }
    edges = [(e["from"], e["to"], e["type"]) for e in data["edges"]]
    cycles = [frozenset(c["between"]) for c in data.get("sanctioned_cycles", [])]
    return Registry(modules=modules, edges=edges, sanctioned_cycles=cycles)


# ── Governance validators ──────────────────────────────────────────────────

def _find_cycle(nodes: set[str], adj: dict[str, list[str]]) -> list[str] | None:
    """Return a cycle path if the directed graph has one, else None (DFS)."""
    WHITE, GRAY, BLACK = 0, 1, 2
    color = {n: WHITE for n in nodes}
    stack: list[str] = []

    def dfs(u: str) -> list[str] | None:
        color[u] = GRAY
        stack.append(u)
        for v in adj.get(u, []):
            if color.get(v, WHITE) == GRAY:
                return stack[stack.index(v):] + [v]
            if color.get(v, WHITE) == WHITE:
                found = dfs(v)
                if found:
                    return found
        stack.pop()
        color[u] = BLACK
        return None

    for n in nodes:
        if color[n] == WHITE:
            found = dfs(n)
            if found:
                return found
    return None


def validate(reg: Registry) -> list[str]:
    """Return a list of governance violations (empty = clean)."""
    violations: list[str] = []
    ids = set(reg.modules)

    # 1. Every edge endpoint is a known module.
    for a, b, t in reg.edges:
        if a not in ids:
            violations.append(f"edge from unknown module: {a} -> {b}")
        if b not in ids:
            violations.append(f"edge to unknown module: {a} -> {b}")

    # 2. One-owner-per-object (VE-009).
    owners: dict[str, list[str]] = {}
    for m in reg.modules.values():
        owners.setdefault(m.owned_object, []).append(m.id)
    for obj, mods in owners.items():
        if len(mods) > 1:
            violations.append(f"VE-009 ownership conflict: '{obj}' owned by {sorted(mods)}")

    # 3. Strictly-forward: the analytical subgraph must be acyclic.
    adj: dict[str, list[str]] = {}
    for a, b in reg.analytical_edges:
        adj.setdefault(a, []).append(b)
    cycle = _find_cycle(ids, adj)
    if cycle:
        violations.append(f"analytical subgraph is cyclic: {' -> '.join(cycle)}")

    # 4. Order consistency: analytical edge u->v requires order[u] < order[v].
    for a, b in reg.analytical_edges:
        if a in reg.modules and b in reg.modules:
            if reg.modules[a].order >= reg.modules[b].order:
                violations.append(
                    f"order violation: {a}(order {reg.modules[a].order}) -> "
                    f"{b}(order {reg.modules[b].order}) is not forward"
                )

    # 5. Non-analytical cycles must be sanctioned.
    for a, b, t in reg.edges:
        if t in ("loop", "trigger"):
            pair = frozenset((a, b))
            reverse = any(x == b and y == a and tt in ("loop", "trigger")
                          for x, y, tt in reg.edges)
            if reverse and not any(pair <= c for c in reg.sanctioned_cycles):
                violations.append(f"unsanctioned bidirectional edge: {a} <-> {b}")

    return violations


def execution_order(reg: Registry) -> list[str]:
    """Modules in canonical execution order."""
    return [m.id for m in sorted(reg.modules.values(), key=lambda m: m.order)]


if __name__ == "__main__":
    import sys

    reg = load_registry()
    problems = validate(reg)
    print(f"Loaded {len(reg.modules)} modules, {len(reg.edges)} edges "
          f"({len(reg.analytical_edges)} analytical).")
    if problems:
        print("GOVERNANCE VIOLATIONS:")
        for p in problems:
            print(f"  - {p}")
        sys.exit(1)
    print("Execution order:", " -> ".join(execution_order(reg)))
    print("OK — registry is governance-clean (ownership unique, analytical DAG acyclic, order consistent).")
