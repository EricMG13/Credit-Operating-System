"""Fail-closed contract for immutable resources in the CAOS app image."""

from __future__ import annotations

import hashlib
import json

from engine.prompt_bundles import SPECIALIZED_MODULES, load_prompt_bundle
from engine.synth import prompt_corpus_fingerprint
from routes.rv import _REFERENCE_PATH


def collect_resource_contract() -> dict[str, object]:
    """Load resources through their production consumers and return safe evidence."""
    prompt_fingerprint = prompt_corpus_fingerprint()
    if prompt_fingerprint == "noprompts":
        raise RuntimeError("The runtime prompt corpus is absent.")

    bundles = {
        module_id: load_prompt_bundle(module_id).fingerprint
        for module_id in sorted(SPECIALIZED_MODULES)
    }

    raw_market_data = _REFERENCE_PATH.read_bytes()
    rows = json.loads(raw_market_data)
    if not isinstance(rows, list) or not rows or not all(isinstance(row, dict) for row in rows):
        raise RuntimeError("The RV reference snapshot must be a non-empty JSON row list.")

    return {
        "prompt_corpus_fingerprint": prompt_fingerprint,
        "specialized_bundles": bundles,
        "rv_reference": {
            "path": str(_REFERENCE_PATH),
            "rows": len(rows),
            "sha256": hashlib.sha256(raw_market_data).hexdigest(),
        },
    }


def main() -> None:
    print(json.dumps(collect_resource_contract(), sort_keys=True))


if __name__ == "__main__":
    main()
