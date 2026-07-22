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
import importlib
from pathlib import Path
from unittest.mock import MagicMock

import pytest

SERVER_DIR = Path(__file__).resolve().parents[2] / "server"
MIGRATION_MODULES = tuple(
    f"migrations.versions.{path.stem}"
    for path in sorted((SERVER_DIR / "migrations" / "versions").glob("[0-9]*.py"))
)


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


def test_watch_rule_revision_follows_notification_action_label() -> None:
    migration = importlib.import_module("migrations.versions.0066_watch_rule_persistence")
    assert migration.revision == "0066"
    assert migration.down_revision == "0065"


def test_watch_rule_create_idempotency_follows_json_storage_envelopes() -> None:
    migration = importlib.import_module(
        "migrations.versions.0068_watch_rule_create_idempotency"
    )
    assert migration.revision == "0068"
    assert migration.down_revision == "0067"


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


@pytest.mark.parametrize("module_name", MIGRATION_MODULES)
def test_downgrade_contract_on_empty_schema(module_name: str, monkeypatch) -> None:
    """Every revision's rollback path is callable before evidence exists.

    The subprocess round-trip above proves the DDL against SQLite. This focused
    contract test keeps rollback code visible to in-process coverage and also
    exercises the fail-closed migrations' empty-evidence path without mutating
    the shared test database.
    """
    migration = importlib.import_module(module_name)
    operation = MagicMock(name=f"op:{module_name}")
    connection = operation.get_bind.return_value
    connection.dialect.name = "sqlite"
    result = connection.execute.return_value
    result.scalar_one.return_value = 0
    result.fetchmany.return_value = []
    operation.get_context.return_value.as_sql = False
    monkeypatch.setattr(migration, "op", operation)

    if hasattr(migration, "context"):
        context = MagicMock(name=f"context:{module_name}")
        context.is_offline_mode.return_value = False
        context.get_context.return_value.dialect.name = "sqlite"
        monkeypatch.setattr(migration, "context", context)

    migration.downgrade()


@pytest.mark.parametrize("revision", ("0029_fts_and_ledgers", "0030_vector_embeddings", "0040_alert_states_created_at_tz"))
def test_postgres_specific_migration_contracts(revision: str, monkeypatch) -> None:
    migration = importlib.import_module(f"migrations.versions.{revision}")
    operation = MagicMock(name=f"postgres-op:{revision}")
    operation.get_bind.return_value.dialect.name = "postgresql"
    monkeypatch.setattr(migration, "op", operation)

    migration.upgrade()
    if revision == "0040_alert_states_created_at_tz":
        migration.downgrade()

    if revision == "0029_fts_and_ledgers":
        assert operation.add_column.called
    else:
        assert operation.execute.called


@pytest.mark.parametrize(
    "revision",
    ("0055_market_xlsx_v2", "0056_model_engine_v2_persistence", "0058_notification_events", "0065_notification_action_label"),
)
def test_evidence_preserving_downgrades_refuse_destructive_rollback(
    revision: str, monkeypatch,
) -> None:
    migration = importlib.import_module(f"migrations.versions.{revision}")
    operation = MagicMock(name=f"evidence-op:{revision}")
    operation.get_bind.return_value.execute.return_value.scalar_one.return_value = 1
    monkeypatch.setattr(migration, "op", operation)

    with pytest.raises(RuntimeError, match="downgrade refused"):
        migration.downgrade()


def test_notification_action_label_downgrade_is_safe_only_without_populated_labels(
    tmp_path: Path,
) -> None:
    safe_path = tmp_path / "notification-action-label-safe.db"
    safe_url = f"sqlite+aiosqlite:///{safe_path}"
    assert _alembic("upgrade", "head", db_url=safe_url).returncode == 0
    with sqlite3.connect(safe_path) as connection:
        connection.execute(
            """INSERT INTO notification_events
               (id, analyst_id, kind, subject_kind, subject_id, title,
                idempotency_key, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            ("legacy", "owner", "legacy", "run", "run-1", "Legacy", "legacy:1", "2026-07-19 00:00:00"),
        )
    safe = _alembic("downgrade", "0064", db_url=safe_url)
    assert safe.returncode == 0, safe.stderr

    guarded_path = tmp_path / "notification-action-label-guarded.db"
    guarded_url = f"sqlite+aiosqlite:///{guarded_path}"
    assert _alembic("upgrade", "head", db_url=guarded_url).returncode == 0
    with sqlite3.connect(guarded_path) as connection:
        connection.execute(
            """INSERT INTO notification_events
               (id, analyst_id, kind, subject_kind, subject_id, title, href,
                action_label, idempotency_key, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                "rich", "owner", "run_complete", "run", "run-2", "Complete",
                "/pipeline?run=run-2", "Open execution graph", "run:2:complete",
                "2026-07-19 00:00:00",
            ),
        )
    guarded = _alembic("downgrade", "0064", db_url=guarded_url)
    assert guarded.returncode != 0
    assert "0065 downgrade refused" in guarded.stderr


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


def test_0035_dedupes_pre_existing_duplicate_active_runs_before_indexing(
    tmp_path: Path,
) -> None:
    """A dirty DB with duplicate active runs must still pass the 0035 upgrade.

    Migration 0035 adds a partial unique index on runs(issuer_id) WHERE status
    IN ('queued','running'). Without a preflight, CREATE UNIQUE INDEX would
    fail outright against any pre-existing duplicate — exactly the shape an
    H0 migration rehearsal against a real target DB would hit. Seeds three
    active runs for one issuer: an outright-oldest one, and a same-timestamp
    tie broken only by id, to exercise both branches of the dedupe query.
    """
    db_path = tmp_path / "run-dedup.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"
    assert _alembic("upgrade", "0034", db_url=db_url).returncode == 0
    with sqlite3.connect(db_path) as connection:
        connection.execute(
            "INSERT INTO issuers (id, name, created_at) VALUES (?, ?, ?)",
            ("issuer-1", "Dup Co", "2026-07-15 00:00:00"),
        )
        connection.executemany(
            "INSERT INTO runs (id, issuer_id, status, qa_status, committee_status, created_at)"
            " VALUES (?, ?, ?, 'Not Reviewed', 'Draft Only', ?)",
            [
                ("run-1", "issuer-1", "queued", "2026-07-14 00:00:00"),
                # Same created_at as run-3 — only the id tiebreak separates them.
                ("run-2", "issuer-1", "queued", "2026-07-15 00:00:00"),
                ("run-3", "issuer-1", "running", "2026-07-15 00:00:00"),
            ],
        )

    upgraded = _alembic("upgrade", "head", db_url=db_url)
    assert upgraded.returncode == 0, upgraded.stderr

    with sqlite3.connect(db_path) as connection:
        rows = dict(
            connection.execute(
                "SELECT id, status || ':' || COALESCE(error, '') FROM runs"
                " WHERE issuer_id = 'issuer-1'"
            ).fetchall()
        )
        active = connection.execute(
            "SELECT COUNT(*) FROM runs WHERE issuer_id = 'issuer-1'"
            " AND status IN ('queued', 'running')"
        ).fetchone()[0]

        # The index is now live: a second active row for the same issuer is
        # rejected, proving CREATE UNIQUE INDEX actually ran (not skipped).
        # qa_status/committee_status are included so the only possible
        # IntegrityError is the unique-index violation being asserted here,
        # not an unrelated NOT NULL failure on those columns.
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                "INSERT INTO runs (id, issuer_id, status, qa_status, committee_status, created_at)"
                " VALUES ('run-4', 'issuer-1', 'queued', 'Not Reviewed', 'Draft Only',"
                " '2026-07-16 00:00:00')"
            )

    assert rows["run-1"] == "failed:superseded (run-dedup migration 0035)"
    assert rows["run-2"] == "failed:superseded (run-dedup migration 0035)"
    assert rows["run-3"] == "running:"  # newest by (created_at, id) wins, untouched
    assert active == 1
