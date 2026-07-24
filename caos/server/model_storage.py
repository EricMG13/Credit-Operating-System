"""Atomic raw-workbook storage for Model Engine v2 imports."""

from __future__ import annotations

import os  # noqa: F401 — re-exported for tests to monkeypatch os.replace
from pathlib import Path

import vault_storage
from config import get_settings

_NAMESPACE = "models"
_DEFAULT_FILENAME = "model.xlsx"


def _root() -> Path:
    root = Path(get_settings().caos_storage_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root.resolve()


def _path_for(key: str) -> Path:
    return vault_storage.path_for(_root(), key)


def _safe_basename(filename: str, *, limit: int = 240) -> str:
    return vault_storage.safe_basename(filename, _DEFAULT_FILENAME, limit=limit)


def store_atomic(content: bytes, filename: str) -> str:
    """Write a unique workbook object atomically and return its private vault key."""
    return vault_storage.store_atomic(
        _NAMESPACE, content, filename, default_filename=_DEFAULT_FILENAME, root=_root()
    )


def remove_uncommitted(key: str) -> None:
    """Remove only a unique model object created by a failed transaction."""
    vault_storage.remove_uncommitted(_NAMESPACE, key, root=_root())
