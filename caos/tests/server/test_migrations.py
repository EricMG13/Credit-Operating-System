"""Alembic migration guards.

Locks two invariants that drifted undetected once already (0027 reconciled
model↔schema nullability after an orphaned first attempt):

  * exactly one head — a fork would make ``upgrade head`` ambiguous;
  * the migration chain matches the ORM models (``alembic check`` clean) and
    round-trips (upgrade head -> downgrade base -> upgrade head).

Runs alembic as a subprocess against a throwaway DB — the round-trip's
``downgrade base`` would otherwise wipe the process-shared test DB the rest of
the suite depends on (see conftest). This test is what enforces ``alembic
check`` in CI: it is collected by the same ``pytest caos/tests/server`` step
that runs on both the 3.11 and 3.14 legs, so drift fails the build going
forward.
"""

import subprocess
import sqlite3
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parents[2] / "server"


def _alembic(*args: str, db_url: str) -> subprocess.CompletedProcess:
    # Self-contained env: own DB (never the shared test DB) + the secrets config
    # requires at import, keys blanked so nothing hits the network.
    env = {
        **_base_env(),
        "DATABASE_URL": db_url,
    }
    return subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=str(SERVER_DIR),
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
    )


def _base_env() -> dict:
    import os

    return {
        **os.environ,
        "SESSION_SECRET": "test-migrations",
        "ANALYST_SIGNUP_CODE": "test",
        "ANTHROPIC_API_KEY": "",
    }


def test_single_head() -> None:
    r = _alembic("heads", db_url="sqlite+aiosqlite:///:memory:")
    assert r.returncode == 0, r.stderr
    heads = [ln for ln in r.stdout.splitlines() if "(head)" in ln]
    assert len(heads) == 1, f"expected exactly one head, got: {r.stdout}"


def test_check_matches_models(tmp_path: Path) -> None:
    db = f"sqlite+aiosqlite:///{tmp_path/'check.db'}"
    up = _alembic("upgrade", "head", db_url=db)
    assert up.returncode == 0, up.stderr
    chk = _alembic("check", db_url=db)
    assert chk.returncode == 0, f"schema drifted from models:\n{chk.stdout}\n{chk.stderr}"


def test_upgrade_downgrade_roundtrip(tmp_path: Path) -> None:
    db = f"sqlite+aiosqlite:///{tmp_path/'roundtrip.db'}"
    for step in (("upgrade", "head"), ("downgrade", "base"), ("upgrade", "head")):
        r = _alembic(*step, db_url=db)
        assert r.returncode == 0, f"{step} failed:\n{r.stderr}"


def test_issuer_uniqueness_migration_is_team_aware_and_refuses_existing_duplicates(
    tmp_path: Path,
) -> None:
    good_path = tmp_path / "team-aware.db"
    good_url = f"sqlite+aiosqlite:///{good_path}"
    assert _alembic("upgrade", "0058", db_url=good_url).returncode == 0
    with sqlite3.connect(good_path) as connection:
        connection.executemany(
            "INSERT INTO issuers (id, name, team_id, created_at) VALUES (?, ?, ?, ?)",
            [
                ("team-a-issuer", "Same Name", "team-a", "2026-07-15 00:00:00"),
                ("team-b-issuer", " same name ", "team-b", "2026-07-15 00:00:00"),
            ],
        )
    upgraded = _alembic("upgrade", "head", db_url=good_url)
    assert upgraded.returncode == 0, upgraded.stderr

    bad_path = tmp_path / "duplicate.db"
    bad_url = f"sqlite+aiosqlite:///{bad_path}"
    assert _alembic("upgrade", "0058", db_url=bad_url).returncode == 0
    with sqlite3.connect(bad_path) as connection:
        connection.executemany(
            "INSERT INTO issuers (id, name, team_id, created_at) VALUES (?, ?, ?, ?)",
            [
                ("duplicate-a", "Élan Credit", "team-a", "2026-07-15 00:00:00"),
                ("duplicate-b", " élan credit ", "team-a", "2026-07-15 00:00:00"),
            ],
        )
    refused = _alembic("upgrade", "head", db_url=bad_url)
    assert refused.returncode != 0
    assert "duplicate normalized issuer name" in refused.stderr
