"""
Invocation wiring: registry_runner bindings vs. agent signatures (Audit G-01).

Pure-AST, stdlib-only: for every module the runner executes as a generic plan
node, assert that `default_invoke`'s bindings (issuer_id + UPSTREAM_BINDINGS +
CONTEXT_BINDINGS + DOC_ID_MODULES) satisfy the agent function's required
parameters and never pass an unknown kwarg. Modules in NON_PLAN_MODULES are
handled outside the plan loop; CP-6A / CP-6E have bespoke adapters.

Runnable directly:

    python3 tests/backend/test_invoke_wiring.py
"""

from __future__ import annotations

import ast
import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parents[2] / "backend"

# Modules with bespoke adapter branches inside default_invoke.
BESPOKE = {"CP-6A", "CP-6E"}


def _grab(tree: ast.AST, names: set[str]) -> dict:
    out = {}
    for node in ast.walk(tree):
        tgt = val = None
        if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name):
            tgt, val = node.targets[0].id, node.value
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            tgt, val = node.target.id, node.value
        if tgt in names and val is not None:
            out[tgt] = ast.literal_eval(val)
    return out


def _load_tables():
    dispatch = _grab(
        ast.parse((_BACKEND / "agents/registry_dispatch.py").read_text()),
        {"AGENT_DISPATCH"},
    )["AGENT_DISPATCH"]
    c = _grab(
        ast.parse((_BACKEND / "agents/orchestration/registry_runner.py").read_text()),
        {"UPSTREAM_BINDINGS", "CONTEXT_BINDINGS", "NON_PLAN_MODULES", "DOC_ID_MODULES"},
    )
    return dispatch, c


def _signature(spec: str) -> tuple[list[str], list[str]]:
    """Return (required_params, all_params) for a 'pkg.mod:func' spec."""
    mod_path, fname = spec.split(":")
    tree = ast.parse((_BACKEND / (mod_path.replace(".", "/") + ".py")).read_text())
    fn = next(
        n for n in ast.walk(tree)
        if isinstance(n, (ast.AsyncFunctionDef, ast.FunctionDef)) and n.name == fname
    )
    a = fn.args
    names = [x.arg for x in a.args]
    required = names[: len(names) - len(a.defaults)]
    all_params = names + [x.arg for x in a.kwonlyargs]
    return required, all_params


def test_plan_module_signatures_are_satisfiable():
    dispatch, c = _load_tables()
    ub, cb = c["UPSTREAM_BINDINGS"], c["CONTEXT_BINDINGS"]
    non_plan, doc_id = c["NON_PLAN_MODULES"], c["DOC_ID_MODULES"]

    failures = []
    checked = 0
    for mid, spec in dispatch.items():
        if mid in non_plan or mid in BESPOKE:
            continue
        required, all_params = _signature(spec)
        provided = {"issuer_id"} | set(ub.get(mid, {})) | set(cb.get(mid, {}))
        if mid in doc_id:
            provided.add("document_id")
        missing = [r for r in required if r not in provided]
        unexpected = [p for p in provided - {"issuer_id"} if p not in all_params]
        checked += 1
        if missing or unexpected:
            failures.append((mid, spec, missing, unexpected))

    assert not failures, f"unsatisfiable agent invocations: {failures}"
    assert checked >= 16, f"expected >=16 generically-invoked modules, checked {checked}"


def test_non_plan_modules_cover_special_signatures():
    """The modules whose signatures don't fit the generic call MUST be excluded."""
    dispatch, c = _load_tables()
    non_plan = c["NON_PLAN_MODULES"]
    # CP-X (run_type-first), CP-5 (module_id, payload), CP-5B (outputs list)
    # cannot be invoked as fn(issuer_id, **kwargs); CP-0 runs pre-plan.
    for must_exclude in ("CP-0", "CP-X", "CP-5", "CP-5B"):
        assert must_exclude in non_plan, f"{must_exclude} must not be a generic plan node"
    # Sanity: every excluded id actually exists in dispatch (no typos).
    for mid in non_plan:
        assert mid in dispatch, f"NON_PLAN_MODULES contains unknown module {mid!r}"


if __name__ == "__main__":
    test_plan_module_signatures_are_satisfiable()
    test_non_plan_modules_cover_special_signatures()
    print("ok — invoke wiring verified")
