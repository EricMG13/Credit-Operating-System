"""Focused schema and rollback guards for Model Engine v2 persistence."""

from __future__ import annotations

import sqlite3


_TABLES = {"model_drafts_v2", "model_override_events", "model_workbook_imports"}
_CHECKPOINT_COLUMNS = {
    "engine_version",
    "source_fingerprint",
    "input_fingerprint",
    "calculation_hash",
    "draft_revision",
}
_REPORT_COLUMNS = {
    "model_engine_version",
    "model_source_fingerprint",
    "model_input_fingerprint",
    "model_calculation_hash",
    "model_draft_revision",
}


def _schema(db_path) -> tuple[set[str], set[str], set[str]]:
    with sqlite3.connect(db_path) as connection:
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }
        checkpoint_columns = {
            row[1]
            for row in connection.execute("PRAGMA table_info(model_checkpoints)")
        }
        report_columns = {
            row[1]
            for row in connection.execute("PRAGMA table_info(report_versions)")
        }
    return tables, checkpoint_columns, report_columns


def test_0056_roundtrips_empty_and_refuses_model_v2_evidence_rollback(tmp_path):
    from test_migrations import _alembic

    db_path = tmp_path / "model-v2-persistence.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"
    assert _alembic("upgrade", "0055", db_url=db_url).returncode == 0

    for command, revision, present in (
        ("upgrade", "0056", True),
        ("downgrade", "0055", False),
        ("upgrade", "0056", True),
    ):
        result = _alembic(command, revision, db_url=db_url)
        assert result.returncode == 0, result.stderr
        tables, checkpoint_columns, report_columns = _schema(db_path)
        assert _TABLES.issubset(tables) is present
        assert _CHECKPOINT_COLUMNS.issubset(checkpoint_columns) is present
        assert _REPORT_COLUMNS.issubset(report_columns) is present

    with sqlite3.connect(db_path) as connection:
        connection.execute(
            """INSERT INTO model_drafts_v2
            (id, issuer_id, analyst_id, payload, calculation, source_fingerprint,
             input_fingerprint, engine_version, calculation_hash, revision,
             created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                "rollback-model-draft", "rollback-issuer", "rollback-owner", "{}", "{}",
                "1" * 64, "2" * 64, "2.0.0", "3" * 64, 1,
                "2026-07-14T00:00:00Z", "2026-07-14T00:00:00Z",
            ),
        )
        connection.commit()
    refused = _alembic("downgrade", "0055", db_url=db_url)
    assert refused.returncode != 0
    assert "0056 downgrade refused" in refused.stderr

    with sqlite3.connect(db_path) as connection:
        connection.execute("DELETE FROM model_drafts_v2")
        connection.execute(
            """INSERT INTO model_checkpoints
            (id, issuer_id, analyst_id, context_id, label, payload_hash, payload,
             authority, engine_version, source_fingerprint, input_fingerprint,
             calculation_hash, draft_revision, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                "rollback-model-checkpoint", "rollback-issuer", "rollback-owner",
                "rollback-context", "V2 checkpoint", "4" * 64, "{}", "{}",
                "2.0.0", "1" * 64, "2" * 64, "3" * 64, 1,
                "2026-07-14T00:00:00Z",
            ),
        )
        connection.commit()
    refused_checkpoint = _alembic("downgrade", "0055", db_url=db_url)
    assert refused_checkpoint.returncode != 0
    assert "0056 downgrade refused" in refused_checkpoint.stderr

    with sqlite3.connect(db_path) as connection:
        connection.execute("DELETE FROM model_checkpoints")
        connection.execute(
            """INSERT INTO report_versions
            (id, context_id, analyst_id, run_id, model_checkpoint_id, status,
             payload, document_sha256, authority, model_engine_version,
             model_source_fingerprint, model_input_fingerprint,
             model_calculation_hash, model_draft_revision, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                "rollback-model-report", "rollback-context", "rollback-owner",
                "rollback-run", "rollback-model-checkpoint", "published", "{}",
                "5" * 64, "{}", "2.0.0", "1" * 64, "2" * 64, "3" * 64, 1,
                "2026-07-14T00:00:00Z",
            ),
        )
        connection.commit()
    refused_report = _alembic("downgrade", "0055", db_url=db_url)
    assert refused_report.returncode != 0
    assert "0056 downgrade refused" in refused_report.stderr

    with sqlite3.connect(db_path) as connection:
        connection.execute("DELETE FROM report_versions")
        connection.execute(
            """INSERT INTO model_checkpoints
            (id, issuer_id, analyst_id, context_id, label, payload_hash, payload,
             authority, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                "legacy-model-checkpoint", "legacy-issuer", "legacy-owner",
                "legacy-context", "Legacy checkpoint", "6" * 64, "{}", "{}",
                "2026-07-14T00:00:00Z",
            ),
        )
        connection.execute(
            """INSERT INTO report_versions
            (id, context_id, analyst_id, run_id, model_checkpoint_id, status,
             payload, document_sha256, authority, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                "legacy-model-report", "legacy-context", "legacy-owner", "legacy-run",
                "legacy-model-checkpoint", "published", "{}", "7" * 64, "{}",
                "2026-07-14T00:00:00Z",
            ),
        )
        connection.commit()
    clean = _alembic("downgrade", "0055", db_url=db_url)
    assert clean.returncode == 0, clean.stderr
    tables, checkpoint_columns, report_columns = _schema(db_path)
    assert _TABLES.isdisjoint(tables)
    assert _CHECKPOINT_COLUMNS.isdisjoint(checkpoint_columns)
    assert _REPORT_COLUMNS.isdisjoint(report_columns)
    with sqlite3.connect(db_path) as connection:
        assert connection.execute(
            "SELECT COUNT(*) FROM model_checkpoints WHERE id = 'legacy-model-checkpoint'"
        ).fetchone()[0] == 1
        assert connection.execute(
            "SELECT COUNT(*) FROM report_versions WHERE id = 'legacy-model-report'"
        ).fetchone()[0] == 1


def test_0057_refuses_0056_evidence_before_mutating_schema_or_revision(tmp_path):
    from test_migrations import _alembic

    db_path = tmp_path / "model-v2-0057-preflight.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"
    upgraded = _alembic("upgrade", "0057", db_url=db_url)
    assert upgraded.returncode == 0, upgraded.stderr

    with sqlite3.connect(db_path) as connection:
        connection.execute(
            """INSERT INTO model_drafts_v2
            (id, issuer_id, analyst_id, payload, calculation, source_fingerprint,
             input_fingerprint, engine_version, calculation_hash, revision,
             created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                "0057-preflight-draft", "0057-preflight-issuer",
                "0057-preflight-owner", "{}", "{}", "1" * 64, "2" * 64,
                "2.0.0", "3" * 64, 1, "2026-07-14T00:00:00Z",
                "2026-07-14T00:00:00Z",
            ),
        )
        connection.commit()

    refused = _alembic("downgrade", "0056", db_url=db_url)
    assert refused.returncode != 0
    assert "0057 downgrade refused: model-v2 evidence exists" in refused.stderr

    with sqlite3.connect(db_path) as connection:
        revision = connection.execute(
            "SELECT version_num FROM alembic_version"
        ).fetchone()[0]
        columns = {
            row[1] for row in connection.execute(
                "PRAGMA table_info(model_workbook_imports)"
            )
        }
        draft_count = connection.execute(
            "SELECT COUNT(*) FROM model_drafts_v2 WHERE id = '0057-preflight-draft'"
        ).fetchone()[0]
    assert revision == "0057"
    assert "import_fingerprint" in columns
    assert draft_count == 1


def test_0057_postgres_offline_sql_fails_with_online_only_contract() -> None:
    from test_migrations import _alembic

    result = _alembic(
        "upgrade",
        "0056:0057",
        "--sql",
        db_url="postgresql+asyncpg://offline:offline@localhost/caos",
    )

    assert result.returncode != 0
    assert "0057 upgrade is online-only" in result.stderr
