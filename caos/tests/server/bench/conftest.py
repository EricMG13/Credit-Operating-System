"""Bench-package conftest — put the bench dir on sys.path so the seed-labels
module is importable as a top-level name (`from seed_labels import ...`).

The root conftest only puts `SERVER_DIR` on the path (for `engine.*` /
`retrieval` imports); the bench harness lives under `tests/`, which is not on
the path by default. This file runs before any bench test module imports.

(Bench corpora COMMIT synthetic issuers into the shared process-global DB; the
root conftest's ``_restore_issuer_baseline`` autouse fixture deletes them on
teardown so their names can't leak into later suites.)
"""
import sys
from pathlib import Path

_BENCH_DIR = Path(__file__).resolve().parent
if str(_BENCH_DIR) not in sys.path:
    sys.path.insert(0, str(_BENCH_DIR))
