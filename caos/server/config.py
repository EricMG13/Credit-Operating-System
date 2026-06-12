"""CAOS server configuration.

One process, environment-driven. Local dev runs with the defaults (SQLite +
./data storage + demo seed). On Databricks the app.yaml / app resource sets:

  DATABASE_URL        Lakebase (Postgres) SQLAlchemy URL; default is SQLite.
  CAOS_STORAGE_DIR    Unity Catalog Volume path (/Volumes/...) for the
                      document vault; default is ./data/vault.
  ANTHROPIC_API_KEY   Databricks secret; chat falls back to canned demo
                      replies when unset.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

SERVER_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"

    # SQLAlchemy async URL. Default: local SQLite file next to the server.
    # On Databricks point this at Lakebase: postgresql+asyncpg://...
    database_url: str = f"sqlite+aiosqlite:///{SERVER_DIR / 'data' / 'caos.db'}"

    # Document vault root. On Databricks use a UC Volume mount.
    caos_storage_dir: str = str(SERVER_DIR / "data" / "vault")

    # Built frontend (Next.js static export). Served at "/".
    caos_static_dir: str = str(SERVER_DIR / "static")

    # Seed the three demo issuers on first boot.
    caos_demo_seed: bool = True

    # Anthropic — optional; chat degrades to demo replies without it.
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-4-8"

    # Upload cap (MB).
    max_upload_mb: int = 250


@lru_cache
def get_settings() -> Settings:
    return Settings()
