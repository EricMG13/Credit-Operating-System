"""
Agent coverage vs. the module registry (P1).

Stdlib-only: cross-checks `agents/registry_dispatch.py` against
`governance/module_registry.json` so the implemented/pending split can never
silently drift from the canonical module set. Runnable directly:

    python3 tests/backend/test_agent_coverage.py
"""

from __future__ import annotations

import importlib.util
import re
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]


def _load(name: str, rel: str):
    spec = importlib.util.spec_from_file_location(name, _ROOT / rel)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod


_reg = _load("cp_registry", "backend/governance/registry.py")
REG = _reg.load_registry()
ALL_IDS = set(REG.modules)
INFRA = {m.id for m in REG.modules.values() if m.layer == "Infra"}
NON_INFRA = ALL_IDS - INFRA

# Parse registry_dispatch.py as text (avoids importing agent deps).
_dispatch_src = (_ROOT / "backend/agents/registry_dispatch.py").read_text()


def _string_set(var: str) -> set[str]:
    # Matches both `VAR: set[str] = { ... }` and `VAR: set[str] = set()`.
    m = re.search(rf"{var}[^=]*=\s*(set\(\)|\{{.*?\}})", _dispatch_src, re.S)
    return set(re.findall(r'"(CP-[0-9A-Z]+)"', m.group(1)))


def _dispatch_keys() -> set[str]:
    block = re.search(r"AGENT_DISPATCH[^=]*=\s*\{(.*?)\n\}", _dispatch_src, re.S).group(1)
    return set(re.findall(r'"(CP-[0-9A-Z]+)":', block))


IMPLEMENTED = _dispatch_keys()
PENDING = _string_set("PENDING")
NEW_ENVELOPE = _string_set("NEW_ENVELOPE")
INFRA_DECL = _string_set("INFRA")


def test_dispatch_keys_are_real_modules():
    assert IMPLEMENTED <= ALL_IDS, IMPLEMENTED - ALL_IDS


def test_pending_are_real_modules():
    assert PENDING <= ALL_IDS, PENDING - ALL_IDS


def test_implemented_and_pending_partition_non_infra():
    # Every non-infra module is either implemented or pending, with no overlap.
    assert IMPLEMENTED.isdisjoint(PENDING)
    assert (IMPLEMENTED | PENDING) == NON_INFRA, NON_INFRA ^ (IMPLEMENTED | PENDING)


def test_new_envelope_agents_are_implemented():
    assert NEW_ENVELOPE <= IMPLEMENTED


def test_infra_declaration_matches_registry():
    assert INFRA_DECL == INFRA


def test_the_two_new_p1_agents_present():
    assert {"CP-1C", "CP-2E"} <= IMPLEMENTED
    assert {"CP-1C", "CP-2E"} <= NEW_ENVELOPE


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
