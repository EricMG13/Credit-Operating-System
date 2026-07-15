"""Regression tests for the bounded C901 compatibility gate."""

import importlib.util
import sys
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "check_complexity_delta.py"
SPEC = importlib.util.spec_from_file_location("check_complexity_delta", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
complexity_delta = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = complexity_delta
SPEC.loader.exec_module(complexity_delta)


def _finding(symbol: str, complexity: int = 12):
    return complexity_delta.Finding("path with spaces/module.py", symbol, complexity)


def test_exact_baseline_is_accepted():
    finding = _finding("bounded")
    problems = complexity_delta._assess_findings(
        [finding], {finding.key: 12}, {finding.path}
    )
    assert problems == []


def test_new_worse_lower_and_stale_findings_fail_closed():
    new = _finding("new", 11)
    worse = _finding("worse", 14)
    lower = _finding("lower", 11)
    stale_key = (new.path, "removed")
    baseline = {worse.key: 13, lower.key: 13, stale_key: 12}

    problems = complexity_delta._assess_findings(
        [new, worse, lower], baseline, {new.path}
    )

    assert any("new C901 finding" in problem for problem in problems)
    assert any("complexity increased" in problem for problem in problems)
    assert any("lower stale maximum" in problem for problem in problems)
    assert any("remove stale baseline entry" in problem for problem in problems)
