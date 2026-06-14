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

    # CP-5C semantic committee review (engine/council.py). An ensemble of
    # adversarial reviewer "seats" that emit CP-5 findings the deterministic
    # gate then consumes — it never decides status itself. Off by default: it
    # is an LLM fan-out (one call per seat per run) and so costs tokens, and it
    # needs anthropic_api_key. When unset the runner uses the no-op
    # FixtureReviewer, so the engine stays fully exercisable offline.
    council_enabled: bool = False
    council_seats: int = 4  # number of reviewer lanes used (1-4)
    # Stage-2 anonymized peer round: after the seats raise findings, show the
    # pooled findings back to the panel with authorship stripped and let them
    # confirm/reject and recalibrate severity. Trims single-seat false positives
    # at the cost of a second LLM fan-out. No effect unless council_enabled.
    council_peer_round: bool = False

    # Upload cap (MB).
    max_upload_mb: int = 250

    # Optional: external markitdown CLI for structure-preserving document → text
    # extraction (tables, headings — better for financials/covenants than the
    # built-in pypdf/openpyxl). markitdown needs Python 3.10+, so it runs
    # out-of-process: set this to a command that invokes it in a 3.10+ env, e.g.
    # "/opt/markitdown/.venv/bin/markitdown". Empty = use the built-in
    # extractors. See caos/docs/TOOLING_REVIEW.md.
    markitdown_cmd: str = ""
    markitdown_timeout_s: int = 60


@lru_cache
def get_settings() -> Settings:
    return Settings()
