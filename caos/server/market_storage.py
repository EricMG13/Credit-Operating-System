"""Atomic raw-workbook storage with failure-safe cleanup for market imports."""

from __future__ import annotations

import os
import re
import uuid
from pathlib import Path

from config import get_settings


def _root() -> Path:
    root = Path(get_settings().caos_storage_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root.resolve()


def _path_for(key: str) -> Path:
    root = _root()
    path = (root / key).resolve()
    if not path.is_relative_to(root):
        raise ValueError("Market storage key escaped the configured vault.")
    return path


def store_atomic(content: bytes, filename: str) -> str:
    """Write one unique source object atomically and return its vault key."""
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", Path(filename).name) or "market.xlsx"
    key = f"market/{uuid.uuid4().hex}/{safe}"
    final_path = _path_for(key)
    final_path.parent.mkdir(parents=True, exist_ok=False)
    temporary = final_path.with_name(f".{final_path.name}.{uuid.uuid4().hex}.tmp")
    try:
        with temporary.open("xb") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, final_path)
        directory_fd = os.open(final_path.parent, os.O_RDONLY)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
    except Exception:
        temporary.unlink(missing_ok=True)
        final_path.unlink(missing_ok=True)
        try:
            final_path.parent.rmdir()
        except OSError:
            pass
        raise
    return key


def remove_uncommitted(key: str) -> None:
    """Remove only a unique market object created by the failed transaction."""
    if not key.startswith("market/"):
        raise ValueError("Refusing to remove a non-market vault object.")
    path = _path_for(key)
    path.unlink(missing_ok=True)
    try:
        path.parent.rmdir()
    except OSError:
        pass
