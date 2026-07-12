"""Launcher — binds HOST:PORT (defaults 127.0.0.1:8000 for local dev).

The Docker deploy sets HOST=0.0.0.0 and PORT (deploy/Dockerfile), so the
container binds the wide interface; local `python run.py` stays on localhost.

WEB_CONCURRENCY (E1): number of uvicorn worker PROCESSES. Postgres-only —
run_executor.get_executor() picks QueueWorker (Postgres FOR UPDATE SKIP
LOCKED claim) vs InProcessExecutor (SQLite) by DB dialect at runtime, and
InProcessExecutor's own docstring is explicit that concurrent workers are
NOT safe against SQLite. Migration safety across simultaneously-booting
replicas is already handled (database.py's init_db() takes a Postgres
session-level advisory lock around `alembic upgrade head`, documented as
built for exactly this case) — this flag is the only piece that was
missing. Defaults to 1 (today's shipped single-process posture) so setting
it is an explicit opt-in, never an accidental behavior change.
"""

from __future__ import annotations

import os
from pathlib import Path

import uvicorn


def validate_workers(workers: int, database_url: str) -> None:
    """Raise if >1 worker is requested against a non-Postgres DATABASE_URL."""
    if workers > 1 and not database_url.startswith("postgresql"):
        raise SystemExit(
            f"WEB_CONCURRENCY={workers} requires a Postgres DATABASE_URL — "
            "multiple uvicorn workers against SQLite is unsafe (each worker "
            "would run its own InProcessExecutor with no cross-worker claim "
            "coordination). Leave WEB_CONCURRENCY unset/1 for SQLite."
        )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    host = os.environ.get("HOST", "127.0.0.1")
    workers = int(os.environ.get("WEB_CONCURRENCY", "1"))
    validate_workers(workers, os.environ.get("DATABASE_URL", ""))
    uvicorn.run(
        "main:app", host=host, port=port, workers=workers,
        app_dir=str(Path(__file__).parent),
    )
