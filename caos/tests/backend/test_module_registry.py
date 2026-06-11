"""
Governance tests over the registry-driven DAG foundation (P0).

Pure-stdlib: imports only backend/governance/registry.py (no app, no pydantic),
so it runs even when full backend deps are not installed. Also runnable directly:

    python3 tests/backend/test_module_registry.py
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

_REG_PY = Path(__file__).resolve().parents[2] / "backend" / "governance" / "registry.py"
_spec = importlib.util.spec_from_file_location("cp_registry", _REG_PY)
_mod = importlib.util.module_from_spec(_spec)
sys.modules["cp_registry"] = _mod  # required for dataclass __module__ resolution
_spec.loader.exec_module(_mod)  # type: ignore[union-attr]

load_registry = _mod.load_registry
validate = _mod.validate
execution_order = _mod.execution_order

REG = load_registry()

# Canonical order from MODULE_EXECUTION_ORDER_v2 (analytical + L7; infra appended).
EXPECTED_ORDER = [
    "CP-0", "CP-X", "CP-1", "CP-1A", "CP-1B", "CP-1C", "CP-2", "CP-2B", "CP-2C",
    "CP-2D", "CP-2E", "CP-2F", "CP-3", "CP-3D", "CP-3B", "CP-3C", "CP-4", "CP-4C",
    "CP-5B", "CP-5", "CP-6A", "CP-6E", "CP-SR", "CP-MON", "CP-RENDER",
    "CP-EXTRACT", "CP-DB",
]


def test_no_governance_violations():
    assert validate(REG) == []


def test_all_24_modules_plus_infra_present():
    assert len(REG.modules) == 27  # 24 analytical+L7 + 3 infra


def test_one_owner_per_object():
    objects = [m.owned_object for m in REG.modules.values()]
    assert len(objects) == len(set(objects)), "duplicate owned_object (VE-009)"


def test_execution_order_matches_corpus():
    assert execution_order(REG) == EXPECTED_ORDER


def test_every_edge_endpoint_is_known():
    ids = set(REG.modules)
    for a, b, _ in REG.edges:
        assert a in ids and b in ids


def test_only_sanctioned_bidirectional_edge_is_sr_mon():
    bidir = set()
    for a, b, t in REG.edges:
        if any(x == b and y == a for x, y, _ in REG.edges):
            bidir.add(frozenset((a, b)))
    assert bidir == {frozenset(("CP-SR", "CP-MON"))}


def test_terminal_module_is_cp6e():
    terminal = [m.id for m in REG.modules.values() if m.terminal]
    assert terminal == ["CP-6E"]


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failed = 0
    for fn in fns:
        try:
            fn()
            print(f"PASS  {fn.__name__}")
        except AssertionError as e:
            failed += 1
            print(f"FAIL  {fn.__name__}: {e}")
    print(f"\n{len(fns) - failed}/{len(fns)} passed")
    raise SystemExit(1 if failed else 0)
