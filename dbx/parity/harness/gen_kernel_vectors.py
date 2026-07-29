#!/usr/bin/env python3
"""SEED-TIME generator: record legacy kernel behaviour as golden vectors.

Runs against a checkout of the pinned legacy repository (see
``dbx/parity/corpus/SEED_SOURCE.txt``) and writes two files into
``dbx/parity/corpus/``:

- ``kernel_vectors.json`` — recorded inputs→outputs for the numeric-safety
  guards, the period kernel, and the deterministic CP-5A gate (legacy CP-5).
- ``legacy_registry_snapshot.json`` — the legacy module registry dumped as data
  (feeds the alias-map parity test; resolution is by legacy ID + owned_object).

Deterministic by construction: curated input sets, sorted iteration, no clock,
no randomness. Outputs are frozen by ``MANIFEST.sha256`` after seeding; this
script is never invoked by tests (checklist 9.1 — the recorded vectors ARE the
golden master for the kernel surface).

Float specials cannot survive JSON, so values are encoded as:
    nan  -> {"__special__": "nan"}
    inf  -> {"__special__": "inf"}
    -inf -> {"__special__": "-inf"}
Every other value (bool/int/float/str/None/list/dict) is stored verbatim.
A call that raises is recorded as {"raises": "<ExceptionName>"} — parity must
reproduce the exception class, not swallow it.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from types import SimpleNamespace


def _enc(value: object) -> object:
    if isinstance(value, float):
        if math.isnan(value):
            return {"__special__": "nan"}
        if math.isinf(value):
            return {"__special__": "inf" if value > 0 else "-inf"}
    return value


def _outcome(fn, *args):
    try:
        return {"out": _enc(fn(*args))}
    except Exception as exc:  # noqa: BLE001 - the exception class IS the recorded behaviour
        return {"raises": type(exc).__name__}


# Curated specials: every class the audit's EC-01..EC-06 cases name, plus the
# adversaries the legacy docstrings call out (bool(NaN) is True; overflow of
# finite operands; -0.0; subnormals; bool-as-int).
SPECIALS: list[object] = [
    float("nan"), float("inf"), float("-inf"), -0.0, 0.0, 1.0, -1.5, 2.75,
    1e308, -1e308, 1e-308, 5e-324, 123, -7, 0, True, False, None, "12", "",
]
NON_SCALARS: list[object] = [[], {}, ["1"], {"a": 1}]

# Period-label grammar incl. the documented adversaries: 2- vs 4-digit years,
# quarters/halves/FY, dated & undated LTM, whitespace variants (EC-04/05/06,
# audit class B).
LABELS = [
    "FY2025", "FY 2025", "FY24", "fy2025", "2025", "2024", "26", "1999",
    "Q1 2026", "Q3 2026", "Q4 2023", "Q2 25", "q1 2026",
    "H1 2025", "H2 2024", "H1 25",
    "LTM", "LTM_2025", "LTM 2025", "LTM Q3 2025", "LTM2025",
    "FY2025A", "2025E", "TTM 2025", "9M 2025", "",
    " FY2025 ", "Q3-2025", "CY2025",
]

SERIES: list[dict[str, float]] = [
    {"Q1 2026": 100.0, "Q3 2026": 120.0},
    {"Q3 2026": 120.0, "Q1 2026": 100.0},
    {"FY2025": 500.0, "LTM_2025": 560.0},
    {"FY2025": 500.0, "LTM": 560.0},
    {"LTM": 560.0, "FY2025": 500.0},
    {"H1 2025": 1.0, "Q3 2025": 2.0},
    {"26": 1.0, "2024": 2.0},
    {"FY2024": 400.0, "FY2025": 500.0, "Q1 2026": 90.0},
    {"Q1 2025": 1.0, "Q2 2025": 2.0, "Q3 2025": 3.0},
    {"FY2025": 0.0},
    {"FY2025": 500.0, "FY2025A": 510.0},
    {},
]

QA_SEVERITY_SETS = [
    [], ["MINOR"], ["MATERIAL"], ["CRITICAL"], ["MINOR", "MINOR"],
    ["MINOR", "MATERIAL"], ["MATERIAL", "CRITICAL"],
    ["MINOR", "MATERIAL", "CRITICAL"], ["WEIRD"], ["MINOR", "WEIRD"],
]

STATUS_LISTS = [
    [], ["Passed"], ["Passed", "Passed"], ["Passed", "Restricted"],
    ["Restricted", "Blocked"], ["Not Reviewed"], ["Passed", "Not Reviewed"],
    ["Passed", "definitely-not-a-status"], ["weird", "weirder"],
    ["Blocked", "Passed", "Restricted", "Not Reviewed"],
]

QA_STATUSES = ["Passed", "Restricted", "Blocked", "Not Reviewed", "weird-status"]
CONFIDENCES = ["High", "Medium", "Low", "Insufficient Information", "weird"]
COMMITTEE_STATUSES = [
    "Committee Ready", "Draft Only", "Restricted", "Blocked",
    "Insufficient Information", "weird",
]


def build_vectors(periods, gate) -> dict:
    vectors: dict[str, list] = {}

    vectors["is_finite_number"] = [
        {"in": _enc(x), **_outcome(periods.is_finite_number, x)}
        for x in SPECIALS + NON_SCALARS
    ]
    for name in ("safe_div", "safe_mul", "safe_add"):
        fn = getattr(periods, name)
        vectors[name] = [
            {"a": _enc(a), "b": _enc(b), **_outcome(fn, a, b)}
            for a in SPECIALS
            for b in SPECIALS
        ]
    for name in ("sort_key", "year", "is_annual_label"):
        fn = getattr(periods, name)
        vectors[name] = [{"label": lb, **_outcome(fn, lb)} for lb in LABELS]
    for name in ("latest", "latest_annual"):
        fn = getattr(periods, name)
        vectors[name] = [{"series": s, **_outcome(fn, s)} for s in SERIES]

    vectors["qa_status_from"] = [
        {
            "severities": sevs,
            **_outcome(
                gate.qa_status_from,
                [SimpleNamespace(severity=s) for s in sevs],
            ),
        }
        for s_i, sevs in enumerate(QA_SEVERITY_SETS)
        for _ in [s_i]
    ]
    vectors["roll_up_qa_status"] = [
        {"statuses": sts, **_outcome(gate.roll_up_qa_status, sts)}
        for sts in STATUS_LISTS
    ]
    vectors["committee_status_from"] = [
        {"qa_status": qa, "confidence": conf,
         **_outcome(gate.committee_status_from, qa, conf)}
        for qa in QA_STATUSES
        for conf in CONFIDENCES
    ]
    vectors["cap_committee_status_for_blocked_upstream"] = [
        {"committee_status": cs,
         **_outcome(gate.cap_committee_status_for_blocked_upstream, cs)}
        for cs in COMMITTEE_STATUSES
    ]
    return vectors


def build_registry_snapshot(registry) -> dict:
    entries = []
    for module_id in sorted(registry.REGISTRY):
        spec = registry.REGISTRY[module_id]
        entries.append(
            {
                "module_id": spec.module_id,
                "module_name": spec.module_name,
                "layer": spec.layer,
                "owned_object": spec.owned_object,
                "depends_on": list(spec.depends_on),
                "after": list(spec.after),
                "required_sources": list(spec.required_sources),
                "implemented": spec.implemented,
                "feature_flag": spec.feature_flag,
                "session_bound": spec.session_bound,
                "run_blocking": spec.run_blocking,
            }
        )
    return {"source": "caos/server/engine/registry.py", "entries": entries}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--legacy-root", type=Path, required=True,
        help="checkout root of the pinned legacy repository",
    )
    parser.add_argument(
        "--out-dir", type=Path, required=True,
        help="dbx/parity/corpus directory to write the two JSON files into",
    )
    args = parser.parse_args()

    sys.path.insert(0, str(args.legacy_root / "caos" / "server"))
    from engine import gate, periods, registry  # noqa: E402

    args.out_dir.mkdir(parents=True, exist_ok=True)
    vectors_path = args.out_dir / "kernel_vectors.json"
    snapshot_path = args.out_dir / "legacy_registry_snapshot.json"
    vectors_path.write_text(
        json.dumps(build_vectors(periods, gate), indent=1, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    snapshot_path.write_text(
        json.dumps(build_registry_snapshot(registry), indent=1, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {vectors_path} and {snapshot_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
