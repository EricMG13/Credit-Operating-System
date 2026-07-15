#!/usr/bin/env python3
"""Gate new or worsening C901 findings while retiring bounded legacy debt."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_BASELINE = Path("caos/scripts/complexity_baseline.json")
RULE_THRESHOLD = 10
MESSAGE_RE = re.compile(
    r"^`(?P<symbol>[^`]+)` is too complex "
    r"\((?P<actual>[0-9]+) > (?P<threshold>[0-9]+)\)$"
)
EXCLUDED_PARTS = frozenset({".agent-reviews", ".venv", ".goal"})


class GateError(RuntimeError):
    """Raised when gate inputs or tool output are unsafe to interpret."""


@dataclass(frozen=True, order=True)
class Finding:
    path: str
    symbol: str
    complexity: int
    threshold: int = RULE_THRESHOLD

    @property
    def key(self) -> tuple[str, str]:
        return (self.path, self.symbol)


def _run(command: list[str]) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(  # noqa: S603 - arguments are explicit, never shell-expanded
        command,
        cwd=REPO_ROOT,
        check=False,
        capture_output=True,
    )


def _changed_python_paths(base_ref: str) -> set[str]:
    result = _run(
        [
            "git",
            "diff",
            "--name-only",
            "-z",
            f"{base_ref}...HEAD",
            "--",
            "*.py",
        ]
    )
    if result.returncode != 0:
        detail = result.stderr.decode(errors="replace").strip()
        raise GateError(f"git diff failed: {detail or 'unknown error'}")

    paths = {
        os.fsdecode(raw)
        for raw in result.stdout.split(b"\0")
        if raw
    }
    return {
        path
        for path in paths
        if not EXCLUDED_PARTS.intersection(PurePosixPath(path).parts)
    }


def _require_exact_keys(value: dict[str, Any], expected: set[str], label: str) -> None:
    if set(value) != expected:
        raise GateError(f"{label} must contain exactly {sorted(expected)}")


def _baseline_entry(raw: Any, index: int) -> tuple[tuple[str, str], int]:
    if not isinstance(raw, dict):
        raise GateError(f"baseline entry {index} must be an object")
    _require_exact_keys(raw, {"path", "symbol", "max_complexity"}, f"entry {index}")
    path = raw["path"]
    symbol = raw["symbol"]
    maximum = raw["max_complexity"]
    if not isinstance(path, str) or not path or PurePosixPath(path).is_absolute():
        raise GateError(f"baseline entry {index} has an invalid relative path")
    if ".." in PurePosixPath(path).parts or "\\" in path:
        raise GateError(f"baseline entry {index} path must be repo-relative POSIX")
    if not isinstance(symbol, str) or not symbol:
        raise GateError(f"baseline entry {index} has an invalid symbol")
    if isinstance(maximum, bool) or not isinstance(maximum, int) or maximum <= RULE_THRESHOLD:
        raise GateError(f"baseline entry {index} maximum must exceed {RULE_THRESHOLD}")
    return (path, symbol), maximum


def _load_baseline(path: Path) -> dict[tuple[str, str], int]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise GateError(f"cannot read complexity baseline: {exc}") from exc
    if not isinstance(payload, dict):
        raise GateError("complexity baseline must be an object")
    _require_exact_keys(payload, {"version", "threshold", "reason", "entries"}, "baseline")
    if payload["version"] != 1 or payload["threshold"] != RULE_THRESHOLD:
        raise GateError(f"baseline must use version 1 and threshold {RULE_THRESHOLD}")
    if not isinstance(payload["reason"], str) or not payload["reason"].strip():
        raise GateError("baseline reason must be non-empty")
    if not isinstance(payload["entries"], list):
        raise GateError("baseline entries must be a list")

    baseline: dict[tuple[str, str], int] = {}
    for index, raw in enumerate(payload["entries"]):
        key, maximum = _baseline_entry(raw, index)
        if key in baseline:
            raise GateError(f"duplicate baseline entry: {key[0]}::{key[1]}")
        baseline[key] = maximum
    return baseline


def _repo_relative(filename: Any) -> str:
    if not isinstance(filename, str) or not filename:
        raise GateError("Ruff finding has no filename")
    candidate = Path(filename)
    candidate = candidate if candidate.is_absolute() else REPO_ROOT / candidate
    try:
        return candidate.resolve().relative_to(REPO_ROOT.resolve()).as_posix()
    except ValueError as exc:
        raise GateError(f"Ruff reported a file outside the repository: {filename}") from exc


def _finding(raw: Any) -> Finding:
    if not isinstance(raw, dict) or raw.get("code") != "C901":
        raise GateError("Ruff JSON contained a non-C901 finding")
    message = raw.get("message")
    match = MESSAGE_RE.fullmatch(message) if isinstance(message, str) else None
    if match is None:
        raise GateError(f"unrecognized C901 message: {message!r}")
    return Finding(
        path=_repo_relative(raw.get("filename")),
        symbol=match.group("symbol"),
        complexity=int(match.group("actual")),
        threshold=int(match.group("threshold")),
    )


def _run_ruff(paths: set[str], executable: str) -> list[Finding]:
    existing = sorted(path for path in paths if (REPO_ROOT / path).is_file())
    if not existing:
        return []
    result = _run(
        [executable, "check", "--select", "C901", "--output-format", "json", *existing]
    )
    if result.returncode not in {0, 1}:
        detail = result.stderr.decode(errors="replace").strip()
        raise GateError(f"Ruff failed: {detail or 'unknown error'}")
    try:
        raw_findings = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise GateError(f"Ruff returned invalid JSON: {exc}") from exc
    if not isinstance(raw_findings, list):
        raise GateError("Ruff JSON root must be a list")

    findings = [_finding(raw) for raw in raw_findings]
    keys = [finding.key for finding in findings]
    if len(keys) != len(set(keys)):
        raise GateError("Ruff returned duplicate path-and-symbol findings")
    if any(finding.threshold != RULE_THRESHOLD for finding in findings):
        raise GateError(f"Ruff C901 threshold drifted from {RULE_THRESHOLD}")
    return sorted(findings)


def _assess_findings(
    findings: list[Finding],
    baseline: dict[tuple[str, str], int],
    changed_paths: set[str],
) -> list[str]:
    current = {finding.key: finding for finding in findings}
    problems: list[str] = []
    for finding in findings:
        maximum = baseline.get(finding.key)
        label = f"{finding.path}::{finding.symbol}"
        if maximum is None:
            problems.append(f"new C901 finding: {label} ({finding.complexity})")
        elif finding.complexity > maximum:
            problems.append(f"complexity increased: {label} ({finding.complexity} > {maximum})")
        elif finding.complexity < maximum:
            problems.append(f"lower stale maximum: {label} ({maximum} -> {finding.complexity})")
    for key in sorted(baseline):
        if key[0] in changed_paths and key not in current:
            problems.append(f"remove stale baseline entry: {key[0]}::{key[1]}")
    return problems


def _arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-ref", required=True)
    parser.add_argument("--baseline", type=Path, default=DEFAULT_BASELINE)
    parser.add_argument("--ruff", default="ruff")
    return parser.parse_args()


def main() -> int:
    args = _arguments()
    baseline_path = args.baseline if args.baseline.is_absolute() else REPO_ROOT / args.baseline
    try:
        changed_paths = _changed_python_paths(args.base_ref)
        baseline = _load_baseline(baseline_path)
        findings = _run_ruff(changed_paths, args.ruff)
        problems = _assess_findings(findings, baseline, changed_paths)
    except (GateError, OSError) as exc:
        print(f"complexity gate error: {exc}", file=sys.stderr)
        return 2
    if problems:
        print("Complexity delta gate failed:")
        for problem in problems:
            print(f"  - {problem}")
        return 1
    print(
        "Complexity delta gate passed: "
        f"{len(findings)} bounded finding(s) across {len(changed_paths)} changed Python path(s)."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
