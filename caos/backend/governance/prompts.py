"""
Loader for module ACTIVE_PROMPTs from the Modular OS corpus.

The corpus is the source of truth for each module's system prompt
(`CP-<ID>_ACTIVE_PROMPT.md`). Agents load their prompt at runtime rather than
embedding a copy, so prompt edits in the corpus propagate.

Path resolution order:
  1. env CAOS_MODULAR_OS_PATH                                (explicit override)
  2. backend/governance/corpus/                              (vendored at deploy)
  3. <repo>/Modular OS                                       (this monorepo)
  4. ~/Documents/Modular OS                                  (legacy local dev)
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

# Walk up from this file to find a "Modular OS" sibling of the project root.
_BACKEND_ROOT = Path(__file__).resolve().parents[1]   # .../caos/backend
_PROJECT_ROOT = _BACKEND_ROOT.parent.parent           # .../Credit Operating System
_IN_REPO_CORPUS = _PROJECT_ROOT / "Modular OS"

_CANDIDATES = [
    os.environ.get("CAOS_MODULAR_OS_PATH"),
    str(Path(__file__).with_name("corpus")),
    str(_IN_REPO_CORPUS),
    str(Path.home() / "Documents" / "Modular OS"),
]


def _corpus_root() -> Path:
    for c in _CANDIDATES:
        if c and Path(c).is_dir():
            return Path(c)
    raise FileNotFoundError(
        "Modular OS corpus not found. Set CAOS_MODULAR_OS_PATH or vendor it at "
        "backend/governance/corpus/."
    )


@lru_cache(maxsize=64)
def load_active_prompt(module_id: str) -> str:
    """Return the raw ACTIVE_PROMPT markdown for a module (e.g. 'CP-1C')."""
    path = _corpus_root() / module_id / f"{module_id}_ACTIVE_PROMPT.md"
    if not path.is_file():
        raise FileNotFoundError(f"ACTIVE_PROMPT not found for {module_id}: {path}")
    return path.read_text()
