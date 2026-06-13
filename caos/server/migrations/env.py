"""Alembic environment — async, wired to the app's models and settings.

Reads the database URL from ``config.get_settings()`` (not alembic.ini) so the
CLI and the on-boot programmatic upgrade always target the same database.
Uses the async engine via ``connection.run_sync`` so no separate sync driver is
needed for either SQLite (dev) or asyncpg/Lakebase (prod). ``render_as_batch``
is on so future SQLite ALTERs work.
"""

from __future__ import annotations

import asyncio
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

SERVER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVER_DIR))

from config import get_settings  # noqa: E402
from database import Base  # noqa: E402  (defining the module populates Base.metadata)

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# App settings are the single source of truth for the URL.
config.set_main_option("sqlalchemy.url", get_settings().database_url)
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def _do_run_migrations(connection) -> None:
    context.configure(
        connection=connection, target_metadata=target_metadata, render_as_batch=True
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(_do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
