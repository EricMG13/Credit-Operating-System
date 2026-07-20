"""Fixed-window rate limiters for local and credential-sensitive lanes.

Most low-risk lanes use the bounded in-memory limiter. Credential endpoints use
``shared_hit``: a tiny SQLite store shared by every worker in the app container,
so increasing ``WEB_CONCURRENCY`` does not multiply the login-guessing budget.

Caveat: SQLite is container-local. Multiple app *containers* need a networked
shared store before horizontal scale-out; the supported Compose topology is one
app container with one or more workers.
"""

from __future__ import annotations

import os
import sqlite3
import stat
import tempfile
import time
from collections import defaultdict
from pathlib import Path
from threading import Lock
from typing import DefaultDict, Tuple

_lock = Lock()
_windows: DefaultDict[str, Tuple[float, int]] = defaultdict(lambda: (0.0, 0))

_SWEEP_THRESHOLD = 1024  # sweep expired windows once the map grows past this
_MAX_ENTRIES = 4096      # hard ceiling so distinct-key spraying can't grow it unbounded
_DEFAULT_SHARED_DIR = Path(tempfile.gettempdir()) / f"caos-rate-limit-{os.geteuid()}"
_DEFAULT_SHARED_PATH = _DEFAULT_SHARED_DIR / "rate-limit.sqlite3"
_SHARED_PATH = os.getenv("CAOS_RATE_LIMIT_PATH", str(_DEFAULT_SHARED_PATH))


def _validate_shared_parent(path: Path) -> None:
    try:
        parent_stat = os.lstat(path.parent)
    except OSError as exc:
        raise RuntimeError("Rate-limit store parent is unavailable.") from exc
    if not stat.S_ISDIR(parent_stat.st_mode) or stat.S_ISLNK(parent_stat.st_mode):
        raise RuntimeError("Rate-limit store parent must be a real directory.")
    if parent_stat.st_mode & 0o022:
        raise RuntimeError("Rate-limit store parent must not be group/world writable.")


def _create_shared_file(path: Path) -> None:
    flags = os.O_CREAT | os.O_EXCL | os.O_RDWR | getattr(os, "O_NOFOLLOW", 0)
    try:
        descriptor = os.open(path, flags, 0o600)
    except FileExistsError:
        descriptor = None
    except OSError as exc:
        raise RuntimeError("Rate-limit store could not be created securely.") from exc
    if descriptor is not None:
        os.close(descriptor)


def _validate_shared_file(path: Path) -> None:
    try:
        file_stat = os.lstat(path)
    except OSError as exc:
        raise RuntimeError("Rate-limit store is unavailable.") from exc
    if not stat.S_ISREG(file_stat.st_mode) or stat.S_ISLNK(file_stat.st_mode):
        raise RuntimeError("Rate-limit store must be a regular file.")
    if file_stat.st_uid != os.geteuid() or file_stat.st_mode & 0o077:
        raise RuntimeError("Rate-limit store must be owned by the app with mode 0600.")


def _secure_shared_path() -> str:
    path = Path(_SHARED_PATH).absolute()
    if path == _DEFAULT_SHARED_PATH:
        try:
            _DEFAULT_SHARED_DIR.mkdir(mode=0o700)
        except FileExistsError:
            pass
    _validate_shared_parent(path)
    _create_shared_file(path)
    _validate_shared_file(path)
    return str(path)


def _shared_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(_secure_shared_path(), timeout=5, isolation_level=None)
    connection.execute("PRAGMA busy_timeout=5000")
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute(
        """CREATE TABLE IF NOT EXISTS rate_limit_windows (
               key TEXT PRIMARY KEY,
               started_at REAL NOT NULL,
               expires_at REAL NOT NULL,
               count INTEGER NOT NULL
           )"""
    )
    return connection


def reset() -> None:
    """Clear local and shared windows. Used for test isolation."""
    with _lock:
        _windows.clear()
    connection = _shared_connection()
    try:
        connection.execute("DELETE FROM rate_limit_windows")
    finally:
        connection.close()


def hit(key: str, *, max_attempts: int, window_seconds: int) -> bool:
    """Record one attempt. True while the caller is inside the budget."""
    now = time.monotonic()
    with _lock:
        if len(_windows) > _SWEEP_THRESHOLD:
            for k in [k for k, (start, _) in _windows.items() if now - start >= window_seconds]:
                del _windows[k]
        if len(_windows) > _MAX_ENTRIES:
            # Still over the ceiling after evicting expired windows → a caller is
            # spraying distinct keys (e.g. spoofed X-Forwarded-For off-proxy).
            # Evict oldest-start entries down to the sweep threshold so memory
            # stays bounded regardless of topology. Bounded downside: an active
            # window may reset early under spray (favours the sprayer slightly),
            # which beats unbounded growth. S6.
            overflow = len(_windows) - _SWEEP_THRESHOLD
            # Never evict the aggregate backstop keys ("login:*"): created at
            # window start, they sort OLDEST and would be evicted first under
            # exactly the distinct-key spray (spoofed X-Forwarded-For) the global
            # login cap exists to stop — resetting the attacker's budget.
            evictable = [(k, v) for k, v in _windows.items() if not k.endswith(":*")]
            for k, _ in sorted(evictable, key=lambda kv: kv[1][0])[:overflow]:
                del _windows[k]
        start, count = _windows[key]
        if now - start >= window_seconds:
            _windows[key] = (now, 1)
            return True
        _windows[key] = (start, count + 1)
        return count + 1 <= max_attempts


def shared_hit(key: str, *, max_attempts: int, window_seconds: int) -> bool:
    """Record an attempt in a worker-shared, atomic fixed window.

    ``BEGIN IMMEDIATE`` serializes the read/increment pair across processes. The
    table is swept and capped inside the same transaction so source-key spraying
    cannot grow the shared file without bound.
    """
    now = time.time()
    connection = _shared_connection()
    try:
        connection.execute("BEGIN IMMEDIATE")
        connection.execute(
            "DELETE FROM rate_limit_windows WHERE expires_at <= ?", (now,)
        )
        row = connection.execute(
            "SELECT expires_at, count FROM rate_limit_windows WHERE key = ?", (key,)
        ).fetchone()
        if row is None:
            count = 1
            connection.execute(
                "INSERT INTO rate_limit_windows(key, started_at, expires_at, count) "
                "VALUES (?, ?, ?, ?)",
                (key, now, now + window_seconds, count),
            )
        else:
            count = int(row[1]) + 1
            connection.execute(
                "UPDATE rate_limit_windows SET count = ? WHERE key = ?", (count, key)
            )

        total = connection.execute(
            "SELECT COUNT(*) FROM rate_limit_windows"
        ).fetchone()[0]
        overflow = int(total) - _MAX_ENTRIES
        if overflow > 0:
            # Keep aggregate backstops such as login:*; evict the oldest source
            # windows first if a caller sprays distinct keys.
            connection.execute(
                "DELETE FROM rate_limit_windows WHERE key IN ("
                "SELECT key FROM rate_limit_windows WHERE key NOT LIKE '%:*' "
                "ORDER BY started_at ASC LIMIT ?)",
                (overflow,),
            )
        connection.execute("COMMIT")
        return count <= max_attempts
    except Exception:
        try:
            connection.execute("ROLLBACK")
        except sqlite3.Error:
            pass
        raise
    finally:
        connection.close()
