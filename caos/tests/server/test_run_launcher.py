"""E1 — WEB_CONCURRENCY guard: multiple uvicorn workers must never launch
against SQLite (each worker's InProcessExecutor has no cross-worker claim
coordination — see run.py's docstring)."""
from __future__ import annotations

import pytest

from run import validate_workers


def test_single_worker_allowed_on_sqlite():
    validate_workers(1, "sqlite+aiosqlite:///./caos.db")  # no raise


def test_two_workers_allowed_on_postgres():
    validate_workers(2, "postgresql+asyncpg://caos:pw@db:5432/caos")  # no raise


def test_multi_worker_rejected_on_sqlite():
    with pytest.raises(SystemExit, match="requires a Postgres DATABASE_URL"):
        validate_workers(2, "sqlite+aiosqlite:///./caos.db")


def test_multi_worker_rejected_on_empty_database_url():
    with pytest.raises(SystemExit):
        validate_workers(2, "")


def test_more_than_two_workers_rejected_even_on_postgres():
    with pytest.raises(SystemExit, match="supported maximum of 2"):
        validate_workers(3, "postgresql+asyncpg://caos:pw@db:5432/caos")


def test_zero_workers_rejected():
    with pytest.raises(SystemExit, match="at least 1"):
        validate_workers(0, "postgresql+asyncpg://caos:pw@db:5432/caos")
