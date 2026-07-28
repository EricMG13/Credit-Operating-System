#!/usr/bin/env python3
"""Normalize one-release legacy module payloads to the v2 output classes."""

from __future__ import annotations

import argparse
import json
from copy import deepcopy
from pathlib import Path
from typing import Any, Mapping, Sequence


LEGACY_OUTPUT_CLASS = "ARTIFACT_PAIR"
CANONICAL_OUTPUT_CLASS = "CANONICAL_MARKDOWN"
DISPLAY_OUTPUT_CLASS = "DISPLAY_DIGEST"


def normalize_module_payload(payload: Mapping[str, Any]) -> dict[str, Any]:
    """Return a copy with the retired analytical output class normalized."""

    normalized = deepcopy(dict(payload))
    output_class = normalized.get("output_class")
    if output_class == LEGACY_OUTPUT_CLASS:
        normalized["output_class"] = CANONICAL_OUTPUT_CLASS
    elif output_class not in {CANONICAL_OUTPUT_CLASS, DISPLAY_OUTPUT_CLASS}:
        raise ValueError(f"unsupported output_class: {output_class!r}")

    module_id = normalized.get("module_id")
    if module_id == "CP-EMAIL" and normalized["output_class"] != DISPLAY_OUTPUT_CLASS:
        raise ValueError("CP-EMAIL is identity-locked to DISPLAY_DIGEST")
    if module_id != "CP-EMAIL" and normalized["output_class"] == DISPLAY_OUTPUT_CLASS:
        raise ValueError("DISPLAY_DIGEST is identity-locked to CP-EMAIL")
    return normalized


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="legacy or v2 JSON payload")
    parser.add_argument(
        "--output",
        type=Path,
        help="write normalized JSON here; defaults to stdout",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    try:
        payload = json.loads(args.input.read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            raise ValueError("payload must be a JSON object")
        normalized = normalize_module_payload(payload)
        rendered = json.dumps(normalized, indent=2, sort_keys=True) + "\n"
        if args.output is None:
            print(rendered, end="")
        else:
            args.output.write_text(rendered, encoding="utf-8")
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as error:
        print(f"ERROR: {error}")
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
