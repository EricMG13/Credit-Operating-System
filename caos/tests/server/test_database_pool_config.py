"""Postgres pool sizing stays explicit, bounded, and inert off Postgres."""

from __future__ import annotations

import pytest

from database import _postgres_pool_kwargs


def _resolve(**overrides: object) -> dict:
    values: dict[str, object] = {
        "database_url": "postgresql+asyncpg://caos:pw@db:5432/caos",
        "test_mode": False,
        "configured_pool_size": 0,
        "max_overflow": 5,
        "pool_timeout_s": 30.0,
        "run_concurrency": 2,
        "synth_concurrency": 4,
    }
    values.update(overrides)
    return _postgres_pool_kwargs(**values)  # type: ignore[arg-type]


def test_postgres_auto_pool_preserves_bounded_interactive_headroom() -> None:
    assert _resolve() == {
        "pool_size": 20,
        "max_overflow": 5,
        "pool_timeout": 30.0,
    }


def test_postgres_explicit_pool_override_is_preserved() -> None:
    assert _resolve(configured_pool_size=32, max_overflow=3, pool_timeout_s=7.5) == {
        "pool_size": 32,
        "max_overflow": 3,
        "pool_timeout": 7.5,
    }


@pytest.mark.parametrize(
    ("database_url", "test_mode"),
    [
        ("sqlite+aiosqlite:///./caos.db", False),
        ("postgresql+asyncpg://caos:pw@db:5432/caos", True),
    ],
)
def test_queue_pool_settings_are_inert_for_sqlite_and_tests(
    database_url: str, test_mode: bool
) -> None:
    assert _resolve(database_url=database_url, test_mode=test_mode) == {}


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"configured_pool_size": -1}, "CAOS_DB_POOL_SIZE"),
        ({"max_overflow": -1}, "CAOS_DB_MAX_OVERFLOW"),
        ({"pool_timeout_s": 0}, "CAOS_DB_POOL_TIMEOUT_S"),
        (
            {"max_overflow": 20, "run_concurrency": 2, "synth_concurrency": 4},
            "Automatic Postgres pool",
        ),
    ],
)
def test_invalid_postgres_pool_configuration_fails_fast(
    overrides: dict[str, object], message: str
) -> None:
    with pytest.raises(ValueError, match=message):
        _resolve(**overrides)
