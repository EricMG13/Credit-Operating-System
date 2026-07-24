"""Atomic raw-workbook vault storage shared by market and model imports.

Pure/root-explicit by design: callers own their `get_settings()` resolution
(each import site's `_root()` is monkeypatchable in tests independent of the
other's) and pass the resolved `root` in.
"""

from __future__ import annotations

import os
import re
import uuid
from pathlib import Path


def path_for(root: Path, key: str) -> Path:
    path = (root / key).resolve()
    if not path.is_relative_to(root):
        raise ValueError("Vault storage key escaped the configured vault.")
    return path


def safe_basename(filename: str, default: str, *, limit: int = 240) -> str:
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", Path(filename).name)
    if safe in {"", ".", ".."}:
        safe = default
    if len(safe.encode("utf-8")) <= limit:
        return safe
    raw_suffix = Path(safe).suffix
    suffix = raw_suffix[:16]
    stem = safe[: -len(raw_suffix)] if raw_suffix else safe
    return f"{stem[: limit - len(suffix)]}{suffix}"


def store_atomic(namespace: str, content: bytes, filename: str, *, default_filename: str, root: Path) -> str:
    """Write one unique source object atomically and return its vault key."""
    safe = safe_basename(filename, default_filename)
    key = f"{namespace}/{uuid.uuid4().hex}/{safe}"
    final_path = path_for(root, key)
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


def remove_uncommitted(namespace: str, key: str, *, root: Path) -> None:
    """Remove only a unique vault object created by a failed transaction."""
    if not key.startswith(f"{namespace}/"):
        raise ValueError(f"Refusing to remove a non-{namespace} vault object.")
    path = path_for(root, key)
    path.unlink(missing_ok=True)
    try:
        path.parent.rmdir()
    except OSError:
        pass
