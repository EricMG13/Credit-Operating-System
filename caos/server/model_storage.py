"""Atomic raw-workbook storage for Model Engine v2 imports."""

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
        raise ValueError("Model storage key escaped the configured vault.")
    return path


def _safe_basename(filename: str, *, limit: int = 240) -> str:
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", Path(filename).name)
    if safe in {"", ".", ".."}:
        safe = "model.xlsx"
    if len(safe.encode("utf-8")) <= limit:
        return safe
    raw_suffix = Path(safe).suffix
    suffix = raw_suffix[:16]
    stem = safe[: -len(raw_suffix)] if raw_suffix else safe
    return f"{stem[: limit - len(suffix)]}{suffix}"


def store_atomic(content: bytes, filename: str) -> str:
    """Write a unique workbook object atomically and return its private vault key."""
    safe = _safe_basename(filename)
    key = f"models/{uuid.uuid4().hex}/{safe}"
    final_path = _path_for(key)
    final_path.parent.mkdir(parents=True, exist_ok=False)
    # The object directory is already UUID-unique, so a fixed short temp name is
    # collision-free without combining two attacker-influenced components.
    temporary = final_path.parent / ".upload.tmp"
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
        for cleanup in (
            lambda: temporary.unlink(missing_ok=True),
            lambda: final_path.unlink(missing_ok=True),
            final_path.parent.rmdir,
        ):
            try:
                cleanup()
            except OSError:
                pass
        raise
    return key


def remove_uncommitted(key: str) -> None:
    """Remove only a unique model object created by a failed transaction."""
    if not key.startswith("models/"):
        raise ValueError("Refusing to remove a non-model vault object.")
    path = _path_for(key)
    path.unlink(missing_ok=True)
    try:
        path.parent.rmdir()
    except OSError:
        pass
