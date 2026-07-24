"""C3 watch-rule persistence and wire-contract regression tests."""

from __future__ import annotations

import json
import os
import sqlite3
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from queue import Queue
from threading import Barrier, Thread
from uuid import uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy import ForeignKeyConstraint, create_engine
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.exc import DatabaseError
from sqlalchemy.schema import CreateTable


SERVER_DIR = Path(__file__).resolve().parents[2] / "server"
SIGNAL_TYPES = {
    "run_finding",
    "qa_gate",
    "covenant",
    "edgar_filing",
    "market_move",
    "cp1b_monitoring",
    "cp1c_peer_outlier",
    "news",
}


def _alembic(*args: str, db_url: str) -> subprocess.CompletedProcess:
    env = {
        **os.environ,
        "DATABASE_URL": db_url,
        "SESSION_SECRET": "test-watch-rule-migration",
        "ANALYST_SIGNUP_CODE": "test",
        "ANTHROPIC_API_KEY": "",
    }
    return subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=str(SERVER_DIR),
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
    )


def _table_signature(connection: sqlite3.Connection, table: str) -> tuple:
    return (
        tuple(connection.execute(f"PRAGMA table_info({table})")),
        tuple(connection.execute(f"PRAGMA index_list({table})")),
        tuple(connection.execute(f"SELECT * FROM {table} ORDER BY id")),
    )


def _constraint_names(table) -> set[str]:
    return {constraint.name for constraint in table.constraints if constraint.name}


def _index_signature(table) -> dict[str, tuple[tuple[str, ...], bool]]:
    def expression_name(expression) -> str:
        element = expression
        while hasattr(element, "element"):
            element = element.element
        return element if isinstance(element, str) else element.name

    return {
        index.name: (tuple(expression_name(expression) for expression in index.expressions), index.unique)
        for index in table.indexes
    }


def _foreign_key_signature(table) -> set[tuple[tuple[str, ...], str, str | None]]:
    result = set()
    for constraint in table.constraints:
        if not isinstance(constraint, ForeignKeyConstraint):
            continue
        columns = tuple(column.name for column in constraint.columns)
        targets = tuple(element.target_fullname for element in constraint.elements)
        result.add((columns, ",".join(targets), constraint.ondelete))
    return result


def test_models_expose_all_additive_tables_without_changing_legacy_models() -> None:
    from database import (
        AlertDeliveryIntent,
        AlertEvent,
        AlertEventContext,
        AlertState,
        WatchRule,
        WatchRuleEvaluation,
        WatchRuleVersion,
    )

    assert [
        WatchRule.__tablename__,
        WatchRuleVersion.__tablename__,
        WatchRuleEvaluation.__tablename__,
        AlertEventContext.__tablename__,
        AlertDeliveryIntent.__tablename__,
    ] == [
        "watch_rules",
        "watch_rule_versions",
        "watch_rule_evaluations",
        "alert_event_contexts",
        "alert_delivery_intents",
    ]
    assert tuple(AlertEvent.__table__.columns.keys()) == (
        "id", "alert_key", "context_id", "issuer_id", "run_id", "kind",
        "title", "impact", "evidence", "authority", "created_by", "created_at",
        "updated_at",
    )
    assert tuple(AlertState.__table__.columns.keys()) == (
        "id", "alert_key", "state", "assignee", "note", "analyst_id",
        "created_at", "resolved_at", "resolution_note",
    )
    assert AlertEvent.__table__.c.id.type.length == 36
    assert AlertState.__table__.c.alert_key.type.length == 160


def test_model_metadata_freezes_keys_indexes_checks_and_lease_fields() -> None:
    from database import (
        AlertDeliveryIntent,
        AlertEventContext,
        WatchRule,
        WatchRuleEvaluation,
        WatchRuleVersion,
    )

    rules = WatchRule.__table__
    assert tuple(rules.columns.keys()) == (
        "id", "tenant_id", "owner_user_id", "team_id_snapshot", "issuer_id",
        "portfolio_id", "create_idempotency_key", "create_request_sha256",
        "name", "signal_type", "enabled", "paused", "current_version",
        "schedule_kind", "schedule_interval_seconds", "next_evaluation_at",
        "schedule_cursor", "claim_token", "claim_expires_at",
        "last_evaluated_at", "claim_attempt_count", "config_json",
        "created_at", "updated_at",
    )
    assert rules.c.create_idempotency_key.type.length == 128
    assert rules.c.create_idempotency_key.nullable is True
    assert rules.c.create_request_sha256.type.length == 64
    assert rules.c.create_request_sha256.nullable is True
    assert rules.c.schedule_cursor.type.length == 512
    assert rules.c.claim_token.nullable is True
    assert rules.c.claim_expires_at.nullable is True
    assert rules.c.claim_attempt_count.default.arg == 0
    assert rules.c.paused.default.arg is False
    assert {
        "ck_watch_rules_signal_type", "ck_watch_rules_current_version",
        "ck_watch_rules_schedule_kind", "ck_watch_rules_schedule_state",
        "ck_watch_rules_claim_pair", "ck_watch_rules_claim_attempt_count",
        "ck_watch_rules_config_json", "ck_watch_rules_create_idempotency",
        "uq_watch_rules_create_idempotency",
    } <= _constraint_names(rules)
    rule_indexes = _index_signature(rules)
    assert rule_indexes["ix_watch_rules_due_claim"] == (
        ("next_evaluation_at", "claim_expires_at"), False
    )
    assert rule_indexes["ix_watch_rules_tenant_owner"] == (
        ("tenant_id", "owner_user_id"), False
    )
    assert rule_indexes["ix_watch_rules_tenant_team"] == (
        ("tenant_id", "team_id_snapshot"), False
    )
    assert rule_indexes["ix_watch_rules_tenant_issuer"] == (
        ("tenant_id", "issuer_id"), False
    )
    assert rule_indexes["ix_watch_rules_tenant_portfolio"] == (
        ("tenant_id", "portfolio_id"), False
    )
    due = next(index for index in rules.indexes if index.name == "ix_watch_rules_due_claim")
    assert str(due.dialect_options["sqlite"]["where"]) == (
        "enabled AND NOT paused AND schedule_kind IN ('interval','edgar')"
    )

    versions = WatchRuleVersion.__table__
    assert "uq_watch_rule_versions_rule_version" in _constraint_names(versions)
    assert _index_signature(versions)["ix_watch_rule_versions_rule_version"][0] == (
        "watch_rule_id", "version"
    )
    assert (("watch_rule_id",), "watch_rules.id", "RESTRICT") in _foreign_key_signature(versions)

    evaluations = WatchRuleEvaluation.__table__
    assert "uq_watch_rule_evaluations_tenant_observation" in _constraint_names(evaluations)
    assert {
        "ck_watch_rule_evaluations_signal_type",
        "ck_watch_rule_evaluations_outcome",
        "ck_watch_rule_evaluations_hop_count",
        "ck_watch_rule_evaluations_subject_scope_json",
        "ck_watch_rule_evaluations_detail_json",
    } <= _constraint_names(evaluations)
    assert (("watch_rule_id", "rule_version"),
            "watch_rule_versions.watch_rule_id,watch_rule_versions.version",
            "RESTRICT") in _foreign_key_signature(evaluations)
    assert _index_signature(evaluations)["ix_watch_rule_evaluations_tenant_owner"][0] == (
        "tenant_id", "owner_user_id"
    )

    contexts = AlertEventContext.__table__
    assert contexts.c.alert_event_id.type.length == 36
    assert {"uq_alert_event_contexts_alert_event", "uq_alert_event_contexts_evaluation"} <= (
        _constraint_names(contexts) | set(_index_signature(contexts))
    )
    assert (("alert_event_id",), "alert_events.id", "CASCADE") in _foreign_key_signature(contexts)
    assert (("watch_rule_id", "rule_version"),
            "watch_rule_versions.watch_rule_id,watch_rule_versions.version",
            "RESTRICT") in _foreign_key_signature(contexts)

    intents = AlertDeliveryIntent.__table__
    assert intents.c.alert_event_id.type.length == 36
    assert intents.c.lease_token.nullable is True
    assert intents.c.lease_expires_at.nullable is True
    assert intents.c.rendered_intent.nullable is True
    assert "uq_alert_delivery_intents_destination" in _constraint_names(intents)
    assert {
        "ck_alert_delivery_intents_channel", "ck_alert_delivery_intents_status",
        "ck_alert_delivery_intents_attempts", "ck_alert_delivery_intents_lease_pair",
        "ck_alert_delivery_intents_rendered_intent",
    } <= _constraint_names(intents)
    intent_indexes = _index_signature(intents)
    assert intent_indexes["ix_alert_delivery_intents_status_available"][0] == (
        "status", "available_at"
    )
    assert intent_indexes["ix_alert_delivery_intents_lease_expires_at"][0] == (
        "lease_expires_at",
    )
    assert intent_indexes["ix_alert_delivery_intents_tenant_owner_created"][0] == (
        "tenant_id", "owner_user_id", "created_at"
    )
    assert (("alert_event_context_id",), "alert_event_contexts.id", "CASCADE") in (
        _foreign_key_signature(intents)
    )


def test_model_json_constraints_compile_for_sqlite_and_postgresql() -> None:
    from database import (
        AlertDeliveryIntent,
        AlertEventContext,
        WatchRule,
        WatchRuleEvaluation,
        WatchRuleVersion,
    )

    tables = (
        WatchRule.__table__,
        WatchRuleVersion.__table__,
        WatchRuleEvaluation.__table__,
        AlertEventContext.__table__,
        AlertDeliveryIntent.__table__,
    )
    sqlite_ddl = "\n".join(
        str(CreateTable(table).compile(dialect=sqlite.dialect())) for table in tables
    )
    postgres_ddl = "\n".join(
        str(CreateTable(table).compile(dialect=postgresql.dialect())) for table in tables
    )

    assert "json_valid" in sqlite_ddl
    assert "json_type" in sqlite_ddl
    assert "AS BLOB" in sqlite_ddl
    assert "jsonb_typeof" not in sqlite_ddl
    assert "octet_length" not in sqlite_ddl
    assert "jsonb_typeof" in postgres_ddl
    assert "octet_length" in postgres_ddl
    assert "json_valid" not in postgres_ddl
    assert "json_type(" not in postgres_ddl
    assert "json_extract" not in postgres_ddl
    assert "AS BLOB" not in postgres_ddl


def test_json_checks_compile_documented_dialect_storage_envelopes() -> None:
    """CHECKs bound storage renderings, while canonical validation owns wire size."""
    from database import AlertDeliveryIntent, WatchRule

    sqlite_ddl = "\n".join(
        str(CreateTable(table).compile(dialect=sqlite.dialect()))
        for table in (WatchRule.__table__, AlertDeliveryIntent.__table__)
    )
    postgres_ddl = "\n".join(
        str(CreateTable(table).compile(dialect=postgresql.dialect()))
        for table in (WatchRule.__table__, AlertDeliveryIntent.__table__)
    )

    assert "length(CAST(config_json AS BLOB)) <= 262144" in sqlite_ddl
    assert "length(CAST(rendered_intent AS BLOB)) <= 1048576" in sqlite_ddl
    assert "octet_length(CAST(config_json AS text)) <= 4194304" in postgres_ddl
    assert (
        "octet_length(CAST(rendered_intent AS text)) <= 16777216"
        in postgres_ddl
    )

    # A compact canonical object can contain many finite exponent-form floats.
    # PostgreSQL jsonb text renders those as fixed numeric values, which is far
    # beyond a whitespace-only envelope; the 64x logical-text cap covers it.
    exponent_values = [1e-300] * 128
    canonical = json.dumps(
        {"values": exponent_values}, separators=(",", ":")
    ).encode("utf-8")
    jsonb_text_like = (
        '{"values": ['
        + ", ".join(format(value, ".300f") for value in exponent_values)
        + "]}"
    ).encode("utf-8")
    assert len(canonical) < 64 * 1024
    assert len(jsonb_text_like) > 4 * len(canonical)


def test_postgresql_migration_ddl_uses_bounded_json_storage_envelopes() -> None:
    postgres_url = "postgresql+asyncpg://caos:caos@localhost/caos"
    upgrade = _alembic("upgrade", "0066:0067", "--sql", db_url=postgres_url)
    assert upgrade.returncode == 0, upgrade.stderr
    assert "DROP CONSTRAINT ck_watch_rules_config_json" in upgrade.stdout
    assert (
        "octet_length(CAST(config_json AS text)) <= 4194304"
        in upgrade.stdout
    )
    assert (
        "octet_length(CAST(rendered_intent AS text)) <= 16777216"
        in upgrade.stdout
    )


def test_postgresql_0067_downgrade_refuses_offline_destructive_ddl() -> None:
    postgres_url = "postgresql+asyncpg://caos:caos@localhost/caos"
    downgrade = _alembic(
        "downgrade", "0067:0066", "--sql", db_url=postgres_url
    )

    assert downgrade.returncode != 0
    assert "0067 cannot downgrade in offline mode" in downgrade.stderr
    assert "DROP CONSTRAINT" not in downgrade.stdout
    assert "DROP COLUMN" not in downgrade.stdout


def test_postgresql_0068_ddl_adds_scoped_create_idempotency_and_blocks_offline_removal() -> None:
    postgres_url = "postgresql+asyncpg://caos:caos@localhost/caos"
    upgrade = _alembic("upgrade", "0067:0068", "--sql", db_url=postgres_url)
    assert upgrade.returncode == 0, upgrade.stderr
    assert "ADD COLUMN create_idempotency_key VARCHAR(128)" in upgrade.stdout
    assert "ADD COLUMN create_request_sha256 VARCHAR(64)" in upgrade.stdout
    assert "ck_watch_rules_create_idempotency" in upgrade.stdout
    assert "^[A-Za-z0-9._:-]{1,128}$" in upgrade.stdout
    assert "^[0-9a-f]{64}$" in upgrade.stdout
    assert "uq_watch_rules_create_idempotency" in upgrade.stdout
    assert "tenant_id, owner_user_id, create_idempotency_key" in upgrade.stdout

    downgrade = _alembic(
        "downgrade", "0068:0067", "--sql", db_url=postgres_url
    )
    assert downgrade.returncode != 0
    assert "0068 cannot downgrade in offline mode" in downgrade.stderr
    assert "DROP CONSTRAINT" not in downgrade.stdout
    assert "DROP COLUMN" not in downgrade.stdout


def test_0068_upgrades_legacy_rules_with_nullable_retry_identity(
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "watch-rule-existing-0067.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"
    upgraded_0067 = _alembic("upgrade", "0067", db_url=db_url)
    assert upgraded_0067.returncode == 0, upgraded_0067.stderr
    with sqlite3.connect(db_path) as connection:
        rule_id, version_id = _insert_rule_and_version(connection)
        connection.commit()

    # Target 0068 explicitly rather than "head": this test asserts the state
    # produced by the 0068 migration, so it must not drift every time a later
    # revision is added on top.
    upgraded_0068 = _alembic("upgrade", "0068", db_url=db_url)
    assert upgraded_0068.returncode == 0, upgraded_0068.stderr
    with sqlite3.connect(db_path) as connection:
        assert connection.execute(
            "SELECT version_num FROM alembic_version"
        ).fetchone() == ("0068",)
        assert connection.execute(
            "SELECT create_idempotency_key, create_request_sha256 "
            "FROM watch_rules WHERE id = ?",
            (rule_id,),
        ).fetchone() == (None, None)
        assert connection.execute(
            "SELECT watch_rule_id FROM watch_rule_versions WHERE id = ?",
            (version_id,),
        ).fetchone() == (rule_id,)


def test_0068_enforces_retry_pair_format_and_tenant_owner_scope(
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "watch-rule-create-idempotency.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"
    upgraded = _alembic("upgrade", "head", db_url=db_url)
    assert upgraded.returncode == 0, upgraded.stderr
    now = "2026-07-22 12:00:00+00:00"
    insert_sql = """INSERT INTO watch_rules
        (id, tenant_id, owner_user_id, team_id_snapshot,
         create_idempotency_key, create_request_sha256, name, signal_type,
         enabled, paused, current_version, schedule_kind, claim_attempt_count,
         config_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"""

    def values(
        row_id: str,
        *,
        tenant: str = "tenant-a",
        owner: str = "owner-a",
        key: str | None = "client-key",
        digest: str | None = "a" * 64,
    ) -> tuple:
        return (
            row_id, tenant, owner, "team", key, digest, "Rule", "run_finding",
            1, 0, 1, "event_driven", 0, "{}", now, now,
        )

    with sqlite3.connect(db_path) as connection:
        connection.execute(insert_sql, values("legacy-null", key=None, digest=None))
        connection.execute(insert_sql, values("valid"))
        connection.execute(
            insert_sql, values("other-owner", owner="owner-b")
        )
        connection.execute(
            insert_sql, values("other-tenant", tenant="tenant-b")
        )
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(insert_sql, values("duplicate-scope"))
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                insert_sql,
                values("missing-hash", key="missing-hash-key", digest=None),
            )
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(insert_sql, values("missing-key", key=None))
        for index, bad_key in enumerate(
            ("contains spaces", "x" * 129, "contains\x00nul", "é")
        ):
            with pytest.raises(sqlite3.IntegrityError):
                connection.execute(
                    insert_sql, values(f"bad-key-{index}", key=bad_key)
                )
        for index, bad_hash in enumerate(("A" * 64, "g" * 64, "a" * 63)):
            with pytest.raises(sqlite3.IntegrityError):
                connection.execute(
                    insert_sql, values(f"bad-hash-{index}", digest=bad_hash)
                )
        assert connection.execute(
            "SELECT COUNT(*) FROM watch_rules "
            "WHERE create_idempotency_key = 'client-key'"
        ).fetchone() == (3,)


def test_0068_downgrade_refuses_to_drop_populated_retry_identity(
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "watch-rule-idempotency-downgrade.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"
    upgraded = _alembic("upgrade", "head", db_url=db_url)
    assert upgraded.returncode == 0, upgraded.stderr
    with sqlite3.connect(db_path) as connection:
        rule_id, version_id = _insert_rule_and_version(connection)
        connection.execute(
            "UPDATE watch_rules SET create_idempotency_key = ?, "
            "create_request_sha256 = ? WHERE id = ?",
            ("durable-key", "b" * 64, rule_id),
        )
        connection.commit()

    rejected = _alembic("downgrade", "0067", db_url=db_url)
    assert rejected.returncode != 0
    assert "0068 cannot downgrade" in rejected.stderr
    with sqlite3.connect(db_path) as connection:
        assert connection.execute(
            "SELECT version_num FROM alembic_version"
        ).fetchone() == ("0068",)
        assert connection.execute(
            "SELECT create_idempotency_key, create_request_sha256 "
            "FROM watch_rules WHERE id = ?",
            (rule_id,),
        ).fetchone() == ("durable-key", "b" * 64)
        connection.execute(
            "UPDATE watch_rules SET create_idempotency_key = NULL, "
            "create_request_sha256 = NULL WHERE id = ?",
            (rule_id,),
        )
        connection.commit()

    downgraded = _alembic("downgrade", "0067", db_url=db_url)
    assert downgraded.returncode == 0, downgraded.stderr
    with sqlite3.connect(db_path) as connection:
        assert connection.execute(
            "SELECT version_num FROM alembic_version"
        ).fetchone() == ("0067",)
        assert "create_idempotency_key" not in {
            row[1] for row in connection.execute("PRAGMA table_info(watch_rules)")
        }
        assert connection.execute(
            "SELECT watch_rule_id FROM watch_rule_versions WHERE id = ?",
            (version_id,),
        ).fetchone() == (rule_id,)


def test_existing_0066_database_receives_json_envelopes_via_0067(
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "watch-rule-existing-0066.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"
    upgraded_0066 = _alembic("upgrade", "0066", db_url=db_url)
    assert upgraded_0066.returncode == 0, upgraded_0066.stderr

    now = "2026-07-20 12:00:00+00:00"
    canonical_overhead = len('{"payload":""}'.encode("utf-8"))
    unicode_units, ascii_remainder = divmod(65536 - canonical_overhead, 2)
    wire_valid = {"payload": "é" * unicode_units + "x" * ascii_remainder}
    sqlite_rendering = json.dumps(wire_valid)
    with sqlite3.connect(db_path) as connection:
        assert connection.execute(
            "SELECT version_num FROM alembic_version"
        ).fetchone() == ("0066",)
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                """INSERT INTO watch_rules
                   (id, tenant_id, owner_user_id, team_id_snapshot, name,
                    signal_type, enabled, paused, current_version, schedule_kind,
                    claim_attempt_count, config_json, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    str(uuid4()), "tenant", "owner", "team", "Old bound",
                    "run_finding", 1, 0, 1, "event_driven", 0,
                    sqlite_rendering, now, now,
                ),
            )

    upgraded_0067 = _alembic("upgrade", "0067", db_url=db_url)
    assert upgraded_0067.returncode == 0, upgraded_0067.stderr
    with sqlite3.connect(db_path) as connection:
        assert connection.execute(
            "SELECT version_num FROM alembic_version"
        ).fetchone() == ("0067",)
        connection.execute(
            """INSERT INTO watch_rules
               (id, tenant_id, owner_user_id, team_id_snapshot, name,
                signal_type, enabled, paused, current_version, schedule_kind,
                claim_attempt_count, config_json, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                str(uuid4()), "tenant", "owner", "team", "Widened bound",
                "run_finding", 1, 0, 1, "event_driven", 0,
                sqlite_rendering, now, now,
            ),
        )
        assert connection.execute(
            """SELECT COUNT(*) FROM sqlite_master
               WHERE type = 'trigger'
                 AND name = 'trg_watch_rule_versions_immutable'"""
        ).fetchone() == (1,)


def test_migration_json_storage_envelope_accepts_wire_limit_and_rejects_raw_overflow(
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "watch-rule-json-envelope.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"
    upgraded = _alembic("upgrade", "head", db_url=db_url)
    assert upgraded.returncode == 0, upgraded.stderr
    now = "2026-07-20 12:00:00+00:00"
    canonical_overhead = len('{"payload":""}'.encode("utf-8"))
    unicode_units, ascii_remainder = divmod(65536 - canonical_overhead, 2)
    wire_valid = {"payload": "é" * unicode_units + "x" * ascii_remainder}
    canonical = json.dumps(
        wire_valid,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    sqlite_rendering = json.dumps(wire_valid)
    assert len(canonical) == 65536
    assert 65536 < len(sqlite_rendering.encode("utf-8")) <= 262144

    with sqlite3.connect(db_path) as connection:
        connection.execute(
            """INSERT INTO watch_rules
               (id, tenant_id, owner_user_id, team_id_snapshot, name, signal_type,
                enabled, paused, current_version, schedule_kind, claim_attempt_count,
                config_json, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                str(uuid4()), "tenant", "owner", "team", "Near limit",
                "run_finding", 1, 0, 1, "event_driven", 0,
                sqlite_rendering, now, now,
            ),
        )
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                "UPDATE watch_rules SET config_json = ?",
                (json.dumps({"payload": "x" * 262144}),),
            )

        _insert_graph(connection)
        rendered_units, rendered_remainder = divmod(
            262144 - canonical_overhead, 2
        )
        rendered_wire_valid = {
            "payload": "é" * rendered_units + "x" * rendered_remainder
        }
        rendered_canonical = json.dumps(
            rendered_wire_valid,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        rendered_sqlite = json.dumps(rendered_wire_valid)
        assert len(rendered_canonical) == 262144
        assert 262144 < len(rendered_sqlite.encode("utf-8")) <= 1048576
        connection.execute(
            """UPDATE alert_delivery_intents
               SET status = 'rendered_intent', rendered_intent = ?
               WHERE id = '00000000-0000-0000-0000-000000000005'""",
            (rendered_sqlite,),
        )
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                """UPDATE alert_delivery_intents SET rendered_intent = ?
                   WHERE id = '00000000-0000-0000-0000-000000000005'""",
                (json.dumps({"payload": "x" * 1048576}),),
            )


def test_0067_incompatible_downgrade_preflights_without_mutating_database(
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "watch-rule-0067-incompatible-downgrade.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"
    upgraded = _alembic("upgrade", "0067", db_url=db_url)
    assert upgraded.returncode == 0, upgraded.stderr

    oversized = json.dumps({"payload": "x" * 65536})
    assert 65536 < len(oversized.encode("utf-8")) <= 262144
    with sqlite3.connect(db_path) as connection:
        rule_id, version_id = _insert_rule_and_version(connection)
        connection.execute(
            "UPDATE watch_rules SET config_json = ? WHERE id = ?",
            (oversized, rule_id),
        )
        connection.commit()
        before = connection.execute(
            "SELECT config_json FROM watch_rules WHERE id = ?", (rule_id,)
        ).fetchone()

    rejected = _alembic("downgrade", "0066", db_url=db_url)
    assert rejected.returncode != 0
    assert "watch_rules.config_json" in rejected.stderr
    assert "cannot downgrade" in rejected.stderr.lower()

    with sqlite3.connect(db_path) as connection:
        assert connection.execute(
            "SELECT version_num FROM alembic_version"
        ).fetchone() == ("0067",)
        assert connection.execute(
            "SELECT config_json FROM watch_rules WHERE id = ?", (rule_id,)
        ).fetchone() == before
        assert connection.execute(
            """SELECT COUNT(*) FROM sqlite_master
               WHERE type = 'table' AND name LIKE '_alembic_tmp_%'"""
        ).fetchone() == (0,)
        assert connection.execute(
            """SELECT COUNT(*) FROM sqlite_master
               WHERE type = 'trigger'
                 AND name = 'trg_watch_rule_versions_immutable'"""
        ).fetchone() == (1,)
        with pytest.raises(sqlite3.IntegrityError, match="immutable"):
            connection.execute(
                "UPDATE watch_rule_versions SET config_json = '{}' WHERE id = ?",
                (version_id,),
            )
        connection.execute(
            "UPDATE watch_rules SET config_json = '{}' WHERE id = ?", (rule_id,)
        )
        connection.commit()

    downgraded = _alembic("downgrade", "0066", db_url=db_url)
    assert downgraded.returncode == 0, downgraded.stderr
    reupgraded = _alembic("upgrade", "head", db_url=db_url)
    assert reupgraded.returncode == 0, reupgraded.stderr


def test_create_all_installs_watch_rule_version_immutability_trigger() -> None:
    from database import Base, WatchRule, WatchRuleVersion

    sync_engine = create_engine("sqlite://")
    Base.metadata.create_all(
        sync_engine,
        tables=[WatchRule.__table__, WatchRuleVersion.__table__],
    )
    now = "2026-07-20 12:00:00+00:00"
    rule_id = str(uuid4())
    version_id = str(uuid4())
    with sync_engine.begin() as connection:
        connection.exec_driver_sql(
            """INSERT INTO watch_rules
               (id, tenant_id, owner_user_id, team_id_snapshot, name, signal_type,
                enabled, paused, current_version, schedule_kind, claim_attempt_count,
                config_json, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (rule_id, "tenant", "owner", "team", "Rule", "run_finding", 1, 0,
             1, "event_driven", 0, "{}", now, now),
        )
        connection.exec_driver_sql(
            """INSERT INTO watch_rule_versions
               (id, watch_rule_id, version, owner_user_id, team_id_snapshot,
                signal_type, config_json, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (version_id, rule_id, 1, "owner", "team", "run_finding", "{}", now),
        )
        with pytest.raises(DatabaseError, match="immutable"):
            connection.exec_driver_sql(
                "UPDATE watch_rule_versions SET owner_user_id = 'other' WHERE id = ?",
                (version_id,),
            )


def test_upgrade_and_reverse_downgrade_preserve_populated_legacy_alerts(tmp_path: Path) -> None:
    db_path = tmp_path / "watch-rule-roundtrip.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"
    up_legacy = _alembic("upgrade", "0065", db_url=db_url)
    assert up_legacy.returncode == 0, up_legacy.stderr
    with sqlite3.connect(db_path) as connection:
        connection.execute(
            """INSERT INTO alert_events
               (id, alert_key, kind, title, impact, evidence, authority, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            ("legacy-event", "legacy:key", "legacy", "Legacy", "unchanged", "{}", "{}",
             "2026-07-20 00:00:00", "2026-07-20 00:00:00"),
        )
        connection.execute(
            """INSERT INTO alert_states
               (id, alert_key, state, created_at)
               VALUES (?, ?, ?, ?)""",
            ("legacy-state", "legacy:key", "open", "2026-07-20 00:00:00"),
        )
        before_events = _table_signature(connection, "alert_events")
        before_states = _table_signature(connection, "alert_states")

    upgraded = _alembic("upgrade", "head", db_url=db_url)
    assert upgraded.returncode == 0, upgraded.stderr
    with sqlite3.connect(db_path) as connection:
        tables = {row[0] for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )}
        assert {
            "watch_rules", "watch_rule_versions", "watch_rule_evaluations",
            "alert_event_contexts", "alert_delivery_intents",
        } <= tables
        assert _table_signature(connection, "alert_events") == before_events
        assert _table_signature(connection, "alert_states") == before_states

    downgraded = _alembic("downgrade", "0065", db_url=db_url)
    assert downgraded.returncode == 0, downgraded.stderr
    with sqlite3.connect(db_path) as connection:
        tables = {row[0] for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )}
        assert not ({
            "watch_rules", "watch_rule_versions", "watch_rule_evaluations",
            "alert_event_contexts", "alert_delivery_intents",
        } & tables)
        assert _table_signature(connection, "alert_events") == before_events
        assert _table_signature(connection, "alert_states") == before_states


def _insert_graph(connection: sqlite3.Connection, *, observation_key: str = "a" * 64) -> None:
    now = "2026-07-20 12:00:00+00:00"
    rule_id = "00000000-0000-0000-0000-000000000001"
    version_id = "00000000-0000-0000-0000-000000000002"
    evaluation_id = "00000000-0000-0000-0000-000000000003"
    context_id = "00000000-0000-0000-0000-000000000004"
    intent_id = "00000000-0000-0000-0000-000000000005"
    correlation_id = "00000000-0000-0000-0000-000000000006"
    connection.execute("PRAGMA foreign_keys=ON")
    connection.execute(
        """INSERT INTO watch_rules
           (id, tenant_id, owner_user_id, team_id_snapshot, name, signal_type,
            enabled, paused, current_version, schedule_kind, claim_attempt_count,
            config_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (rule_id, "tenant", "owner", "team", "Rule", "run_finding", 1, 0, 1,
         "event_driven", 0, "{}", now, now),
    )
    connection.execute(
        """INSERT INTO watch_rule_versions
           (id, watch_rule_id, version, owner_user_id, team_id_snapshot,
            signal_type, config_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (version_id, rule_id, 1, "owner", "team", "run_finding", "{}", now),
    )
    connection.execute(
        """INSERT INTO watch_rule_evaluations
           (id, tenant_id, owner_user_id, team_id_snapshot, watch_rule_id,
            rule_version, signal_type, subject_scope_json, source_identity,
            observation_key, outcome, correlation_id, correlation_root_id,
            hop_count, evaluated_at, detail_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (evaluation_id, "tenant", "owner", "team", rule_id, 1, "run_finding",
         '{"issuer_id":null,"portfolio_id":null,"tenant_id":"tenant"}', "run:1",
         observation_key, "matched", correlation_id, correlation_id, 0, now, "{}"),
    )
    connection.execute(
        """INSERT INTO alert_events
           (id, alert_key, kind, title, impact, evidence, authority, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        ("legacy-c3-event", f"c3:{observation_key}", "run_finding", "Matched", "", "{}", "{}", now, now),
    )
    connection.execute(
        """INSERT INTO alert_event_contexts
           (id, tenant_id, owner_user_id, team_id_snapshot, alert_event_id,
            watch_rule_evaluation_id, watch_rule_id, rule_version, signal_type,
            correlation_root_id, hop_count, context_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (context_id, "tenant", "owner", "team", "legacy-c3-event", evaluation_id,
         rule_id, 1, "run_finding", correlation_id, 0, "{}", now),
    )
    connection.execute(
        """INSERT INTO alert_delivery_intents
           (id, tenant_id, owner_user_id, team_id_snapshot, alert_event_id,
            alert_event_context_id, channel, destination_ref, status,
            attempt_count, max_attempts, available_at, correlation_root_id,
            created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (intent_id, "tenant", "owner", "team", "legacy-c3-event", context_id,
         "in_app", "owner:inbox", "pending", 0, 5, now, correlation_id, now, now),
    )


def _insert_rule_and_version(connection: sqlite3.Connection) -> tuple[str, str]:
    now = "2026-07-20 12:00:00+00:00"
    rule_id = "10000000-0000-0000-0000-000000000001"
    version_id = "10000000-0000-0000-0000-000000000002"
    connection.execute("PRAGMA foreign_keys=ON")
    connection.execute(
        """INSERT INTO watch_rules
           (id, tenant_id, owner_user_id, team_id_snapshot, name, signal_type,
            enabled, paused, current_version, schedule_kind, claim_attempt_count,
            config_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (rule_id, "tenant", "owner", "team", "Rule", "run_finding", 1, 0, 1,
         "event_driven", 0, "{}", now, now),
    )
    connection.execute(
        """INSERT INTO watch_rule_versions
           (id, watch_rule_id, version, owner_user_id, team_id_snapshot,
            signal_type, config_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (version_id, rule_id, 1, "owner", "team", "run_finding", "{}", now),
    )
    return rule_id, version_id


def _evaluation_insert(evaluation_id: str) -> tuple[str, tuple]:
    now = "2026-07-20 12:00:00+00:00"
    correlation_id = "10000000-0000-0000-0000-000000000006"
    return (
        """INSERT INTO watch_rule_evaluations
           (id, tenant_id, owner_user_id, team_id_snapshot, watch_rule_id,
            rule_version, signal_type, subject_scope_json, source_identity,
            observation_key, outcome, correlation_id, correlation_root_id,
            hop_count, evaluated_at, detail_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (evaluation_id, "tenant", "owner", "team",
         "10000000-0000-0000-0000-000000000001", 1, "run_finding",
         '{"issuer_id":null,"portfolio_id":null,"tenant_id":"tenant"}',
         "run:concurrent", "e" * 64, "matched", correlation_id, correlation_id,
         0, now, "{}"),
    )


def test_concurrent_observation_conflict_and_dependent_uniqueness(tmp_path: Path) -> None:
    db_path = tmp_path / "watch-rule-concurrent.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"
    upgraded = _alembic("upgrade", "head", db_url=db_url)
    assert upgraded.returncode == 0, upgraded.stderr
    with sqlite3.connect(db_path) as connection:
        _insert_rule_and_version(connection)
        connection.commit()

    barrier = Barrier(2)
    results: Queue[str] = Queue()

    def insert_observation(evaluation_id: str) -> None:
        connection = sqlite3.connect(db_path, timeout=5)
        connection.execute("PRAGMA busy_timeout=5000")
        connection.execute("PRAGMA foreign_keys=ON")
        try:
            statement, values = _evaluation_insert(evaluation_id)
            barrier.wait(timeout=5)
            connection.execute(statement, values)
            connection.commit()
            results.put("success")
        except sqlite3.IntegrityError:
            connection.rollback()
            results.put("integrity")
        except BaseException as exc:  # surfaced below; never swallowed by worker threads
            connection.rollback()
            results.put(f"unexpected:{type(exc).__name__}:{exc}")
        finally:
            connection.close()

    workers = [
        Thread(target=insert_observation, args=(f"20000000-0000-0000-0000-00000000000{i}",))
        for i in (1, 2)
    ]
    for worker in workers:
        worker.start()
    for worker in workers:
        worker.join(timeout=10)
        assert not worker.is_alive(), "concurrent observation insert did not terminate"

    outcomes = sorted(results.get_nowait() for _ in workers)
    assert outcomes == ["integrity", "success"]

    now = "2026-07-20 12:00:00+00:00"
    correlation_id = "10000000-0000-0000-0000-000000000006"
    with sqlite3.connect(db_path) as connection:
        connection.execute("PRAGMA foreign_keys=ON")
        evaluation_id = connection.execute(
            "SELECT id FROM watch_rule_evaluations"
        ).fetchone()[0]
        assert connection.execute(
            "SELECT COUNT(*) FROM watch_rule_evaluations"
        ).fetchone()[0] == 1
        connection.execute(
            """INSERT INTO alert_events
               (id, alert_key, kind, title, impact, evidence, authority, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            ("concurrent-event", f"c3:{'e' * 64}", "run_finding", "Matched", "",
             "{}", "{}", now, now),
        )
        context_values = (
            "30000000-0000-0000-0000-000000000001", "tenant", "owner", "team",
            "concurrent-event", evaluation_id,
            "10000000-0000-0000-0000-000000000001", 1, "run_finding",
            correlation_id, 0, "{}", now,
        )
        context_sql = """INSERT INTO alert_event_contexts
            (id, tenant_id, owner_user_id, team_id_snapshot, alert_event_id,
             watch_rule_evaluation_id, watch_rule_id, rule_version, signal_type,
             correlation_root_id, hop_count, context_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"""
        connection.execute(context_sql, context_values)
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                context_sql,
                ("30000000-0000-0000-0000-000000000002", *context_values[1:]),
            )
        intent_values = (
            "40000000-0000-0000-0000-000000000001", "tenant", "owner", "team",
            "concurrent-event", context_values[0], "email", "desk", "pending", 0,
            5, now, correlation_id, now, now,
        )
        intent_sql = """INSERT INTO alert_delivery_intents
            (id, tenant_id, owner_user_id, team_id_snapshot, alert_event_id,
             alert_event_context_id, channel, destination_ref, status,
             attempt_count, max_attempts, available_at, correlation_root_id,
             created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"""
        connection.execute(intent_sql, intent_values)
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                intent_sql,
                ("40000000-0000-0000-0000-000000000002", *intent_values[1:]),
            )


def test_atomic_graph_materialization_rolls_back_on_delivery_conflict(tmp_path: Path) -> None:
    db_path = tmp_path / "watch-rule-atomic.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"
    upgraded = _alembic("upgrade", "head", db_url=db_url)
    assert upgraded.returncode == 0, upgraded.stderr
    with sqlite3.connect(db_path) as connection:
        rule_id, _ = _insert_rule_and_version(connection)
        connection.commit()
        evaluation_id = "50000000-0000-0000-0000-000000000001"
        event_id = "atomic-event"
        context_id = "50000000-0000-0000-0000-000000000002"
        correlation_id = "50000000-0000-0000-0000-000000000003"
        now = "2026-07-20 12:00:00+00:00"
        statement, values = _evaluation_insert(evaluation_id)

        with pytest.raises(sqlite3.IntegrityError):
            with connection:
                connection.execute(statement, values)
                connection.execute(
                    """INSERT INTO alert_events
                       (id, alert_key, kind, title, impact, evidence, authority,
                        created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (event_id, f"c3:{'e' * 64}", "run_finding", "Atomic", "",
                     "{}", "{}", now, now),
                )
                connection.execute(
                    """INSERT INTO alert_event_contexts
                       (id, tenant_id, owner_user_id, team_id_snapshot,
                        alert_event_id, watch_rule_evaluation_id, watch_rule_id,
                        rule_version, signal_type, correlation_root_id, hop_count,
                        context_json, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (context_id, "tenant", "owner", "team", event_id, evaluation_id,
                     rule_id, 1, "run_finding", correlation_id, 0, "{}", now),
                )
                intent_values = (
                    "50000000-0000-0000-0000-000000000004", "tenant", "owner",
                    "team", event_id, context_id, "email", "desk", "pending", 0,
                    5, now, correlation_id, now, now,
                )
                intent_sql = """INSERT INTO alert_delivery_intents
                    (id, tenant_id, owner_user_id, team_id_snapshot, alert_event_id,
                     alert_event_context_id, channel, destination_ref, status,
                     attempt_count, max_attempts, available_at, correlation_root_id,
                     created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"""
                connection.execute(intent_sql, intent_values)
                connection.execute(
                    intent_sql,
                    ("50000000-0000-0000-0000-000000000005", *intent_values[1:]),
                )

        assert connection.execute(
            "SELECT COUNT(*) FROM watch_rule_evaluations"
        ).fetchone()[0] == 0
        assert connection.execute(
            "SELECT COUNT(*) FROM alert_events WHERE id = ?", (event_id,)
        ).fetchone()[0] == 0
        assert connection.execute(
            "SELECT COUNT(*) FROM alert_event_contexts"
        ).fetchone()[0] == 0
        assert connection.execute(
            "SELECT COUNT(*) FROM alert_delivery_intents"
        ).fetchone()[0] == 0


def test_watch_rule_version_updates_are_rejected_by_migrated_database(
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "watch-rule-immutable.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"
    upgraded = _alembic("upgrade", "head", db_url=db_url)
    assert upgraded.returncode == 0, upgraded.stderr
    with sqlite3.connect(db_path) as connection:
        _insert_rule_and_version(connection)
        connection.commit()
        with pytest.raises(sqlite3.IntegrityError, match="immutable"):
            connection.execute(
                "UPDATE watch_rule_versions SET owner_user_id = 'other'"
            )


def test_postgresql_offline_ddl_installs_and_removes_immutability_trigger() -> None:
    postgres_url = "postgresql+asyncpg://caos:caos@localhost/caos"
    upgrade = _alembic("upgrade", "0065:0066", "--sql", db_url=postgres_url)
    assert upgrade.returncode == 0, upgrade.stderr
    assert "CREATE FUNCTION c3_reject_watch_rule_version_update()" in upgrade.stdout
    assert "CREATE TRIGGER trg_watch_rule_versions_immutable" in upgrade.stdout
    assert "BEFORE UPDATE ON watch_rule_versions" in upgrade.stdout

    downgrade = _alembic("downgrade", "0066:0065", "--sql", db_url=postgres_url)
    assert downgrade.returncode == 0, downgrade.stderr
    assert "DROP TRIGGER IF EXISTS trg_watch_rule_versions_immutable" in downgrade.stdout
    assert "DROP FUNCTION IF EXISTS c3_reject_watch_rule_version_update()" in downgrade.stdout


def test_sqlite_rejects_contract_string_overflow_across_all_five_tables(
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "watch-rule-string-bounds.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"
    upgraded = _alembic("upgrade", "head", db_url=db_url)
    assert upgraded.returncode == 0, upgraded.stderr
    now = "2026-07-20 12:00:00+00:00"
    rule_sql = """INSERT INTO watch_rules
        (id, tenant_id, owner_user_id, team_id_snapshot, name, signal_type,
         enabled, paused, current_version, schedule_kind,
         schedule_interval_seconds, schedule_cursor, claim_attempt_count,
         config_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"""
    version_sql = """INSERT INTO watch_rule_versions
        (id, watch_rule_id, version, owner_user_id, team_id_snapshot, signal_type,
         config_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)"""
    evaluation_sql = """INSERT INTO watch_rule_evaluations
        (id, tenant_id, owner_user_id, team_id_snapshot, watch_rule_id,
         rule_version, signal_type, subject_scope_json, source_identity,
         observation_key, outcome, correlation_id, correlation_root_id,
         hop_count, evaluated_at, detail_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"""
    context_sql = """INSERT INTO alert_event_contexts
        (id, tenant_id, owner_user_id, team_id_snapshot, alert_event_id,
         watch_rule_evaluation_id, watch_rule_id, rule_version, signal_type,
         correlation_root_id, hop_count, context_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"""
    intent_sql = """INSERT INTO alert_delivery_intents
        (id, tenant_id, owner_user_id, team_id_snapshot, alert_event_id,
         alert_event_context_id, channel, destination_ref, status, attempt_count,
         max_attempts, available_at, rendered_intent, not_sent_reason,
         correlation_root_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"""
    scope = '{"issuer_id":null,"portfolio_id":null,"tenant_id":"tenant"}'
    correlation_id = "60000000-0000-0000-0000-000000000006"

    with sqlite3.connect(db_path) as connection:
        invalid_writes = (
            (rule_sql, ("60000000-0000-0000-0000-000000000001", "tenant", "owner",
                        "team", "n" * 161, "run_finding", 1, 0, 1,
                        "event_driven", None, None, 0, "{}", now, now)),
            (rule_sql, ("60000000-0000-0000-0000-000000000002", "tenant", "owner",
                        "team", "Rule", "s" * 33, 0, 0, 1,
                        "event_driven", None, None, 0, "{}", now, now)),
            (rule_sql, ("60000000-0000-0000-0000-000000000003", "tenant", "owner",
                        "team", "Rule", "run_finding", 0, 0, 1,
                        "interval", 60, "c" * 513, 0, "{}", now, now)),
            (version_sql, ("60000000-0000-0000-0000-000000000004",
                           "60000000-0000-0000-0000-000000000099", 1,
                           "o" * 256, "team", "run_finding", "{}", now)),
            (evaluation_sql, ("60000000-0000-0000-0000-000000000005", "tenant",
                              "owner", "team",
                              "60000000-0000-0000-0000-000000000099", 1,
                              "run_finding", scope, "s" * 513, "a" * 64,
                              "matched", correlation_id, correlation_id, 0, now, "{}")),
            (evaluation_sql, ("60000000-0000-0000-0000-000000000007", "tenant",
                              "owner", "team",
                              "60000000-0000-0000-0000-000000000099", 1,
                              "run_finding", scope, "source", "a" * 65,
                              "matched", correlation_id, correlation_id, 0, now, "{}")),
            (context_sql, ("60000000-0000-0000-0000-000000000008", "tenant",
                           "owner", "team", "a" * 37,
                           "60000000-0000-0000-0000-000000000098",
                           "60000000-0000-0000-0000-000000000099", 1,
                           "run_finding", correlation_id, 0, "{}", now)),
            (intent_sql, ("60000000-0000-0000-0000-000000000009", "tenant", "owner",
                          "team", "a" * 37,
                          "60000000-0000-0000-0000-000000000097", "email", "desk",
                          "pending", 0, 5, now, None, None, correlation_id, now, now)),
            (intent_sql, ("60000000-0000-0000-0000-000000000010", "tenant", "owner",
                          "team", "event",
                          "60000000-0000-0000-0000-000000000097", "email", "d" * 257,
                          "pending", 0, 5, now, None, None, correlation_id, now, now)),
            (intent_sql, ("60000000-0000-0000-0000-000000000011", "tenant", "owner",
                          "team", "event",
                          "60000000-0000-0000-0000-000000000097", "email", "desk",
                          "p" * 25, 0, 5, now, None, None, correlation_id, now, now)),
            (intent_sql, ("60000000-0000-0000-0000-000000000012", "tenant", "owner",
                          "team", "event",
                          "60000000-0000-0000-0000-000000000097", "email", "desk",
                          "not_sent", 1, 5, now, None, "r" * 257,
                          correlation_id, now, now)),
        )
        for statement, values in invalid_writes:
            with pytest.raises(sqlite3.IntegrityError):
                connection.execute(statement, values)


def test_delivery_lease_and_terminal_payload_state_checks_execute(tmp_path: Path) -> None:
    db_path = tmp_path / "watch-rule-delivery-states.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"
    upgraded = _alembic("upgrade", "head", db_url=db_url)
    assert upgraded.returncode == 0, upgraded.stderr
    now = "2026-07-20 12:00:00+00:00"
    lease_token = "70000000-0000-0000-0000-000000000001"
    statement = """INSERT INTO alert_delivery_intents
        (id, tenant_id, owner_user_id, team_id_snapshot, alert_event_id,
         alert_event_context_id, channel, destination_ref, status, attempt_count,
         max_attempts, available_at, lease_token, lease_expires_at,
         rendered_intent, not_sent_reason, correlation_root_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"""
    with sqlite3.connect(db_path) as connection:
        _insert_graph(connection)
        connection.commit()
        common = (
            "tenant", "owner", "team", "legacy-c3-event",
            "00000000-0000-0000-0000-000000000004", "email",
        )

        def values(
            suffix: int,
            destination: str,
            status: str,
            token=None,
            expiry=None,
            rendered=None,
            reason=None,
        ) -> tuple:
            return (
                f"70000000-0000-0000-0000-{suffix:012d}", *common, destination,
                status, 1, 5, now, token, expiry, rendered, reason,
                "00000000-0000-0000-0000-000000000006", now, now,
            )

        connection.execute(
            statement, values(2, "leased-valid", "leased", lease_token, now)
        )
        connection.execute(
            statement, values(3, "rendered-valid", "rendered_intent", rendered="{}")
        )
        connection.execute(
            statement, values(4, "not-sent-valid", "not_sent", reason="bounded")
        )
        invalid = (
            values(5, "leased-no-token", "leased", None, now),
            values(6, "pending-with-token", "pending", lease_token, now),
            values(7, "rendered-no-payload", "rendered_intent"),
            values(8, "rendered-with-reason", "rendered_intent", rendered="{}", reason="bad"),
            values(9, "not-sent-no-reason", "not_sent"),
            values(10, "not-sent-with-rendered", "not_sent", rendered="{}", reason="bad"),
        )
        for row in invalid:
            with pytest.raises(sqlite3.IntegrityError):
                connection.execute(statement, row)


def test_database_json_bounds_and_delete_rules(tmp_path: Path) -> None:
    db_path = tmp_path / "watch-rule-behavior.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"
    upgraded = _alembic("upgrade", "head", db_url=db_url)
    assert upgraded.returncode == 0, upgraded.stderr
    with sqlite3.connect(db_path) as connection:
        _insert_graph(connection)
        connection.commit()
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                """INSERT INTO watch_rule_evaluations
                   (id, tenant_id, owner_user_id, team_id_snapshot, watch_rule_id,
                    rule_version, signal_type, subject_scope_json, source_identity,
                    observation_key, outcome, correlation_id, correlation_root_id,
                    hop_count, evaluated_at, detail_json)
                   SELECT ?, tenant_id, owner_user_id, team_id_snapshot, watch_rule_id,
                    rule_version, signal_type, subject_scope_json, 'replay',
                    observation_key, outcome, correlation_id, correlation_root_id,
                    hop_count, evaluated_at, detail_json
                   FROM watch_rule_evaluations LIMIT 1""",
                ("00000000-0000-0000-0000-000000000099",),
            )
        connection.rollback()
        assert connection.execute("SELECT COUNT(*) FROM watch_rule_evaluations").fetchone()[0] == 1
        assert connection.execute("SELECT COUNT(*) FROM alert_event_contexts").fetchone()[0] == 1
        assert connection.execute("SELECT COUNT(*) FROM alert_delivery_intents").fetchone()[0] == 1

        with pytest.raises(sqlite3.IntegrityError):
            connection.execute("UPDATE watch_rules SET config_json = ?", ("[]",))
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                "UPDATE watch_rule_evaluations SET detail_json = ?",
                (json.dumps({"x": "y" * (4 * 65536)}),),
            )
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute("UPDATE watch_rule_evaluations SET hop_count = 4")
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute("DELETE FROM watch_rules")
        connection.rollback()
        connection.execute("DELETE FROM alert_events WHERE id = 'legacy-c3-event'")
        assert connection.execute("SELECT COUNT(*) FROM alert_event_contexts").fetchone()[0] == 0
        assert connection.execute("SELECT COUNT(*) FROM alert_delivery_intents").fetchone()[0] == 0


def test_schedule_state_checks_reject_invalid_claims(tmp_path: Path) -> None:
    db_path = tmp_path / "watch-rule-state-checks.db"
    db_url = f"sqlite+aiosqlite:///{db_path}"
    upgraded = _alembic("upgrade", "head", db_url=db_url)
    assert upgraded.returncode == 0, upgraded.stderr
    with sqlite3.connect(db_path) as connection:
        now = "2026-07-20 12:00:00+00:00"
        base = (
            "00000000-0000-0000-0000-000000000010", "tenant", "owner", "team",
            "Rule", "run_finding", 1, 0, 1,
        )
        statement = """INSERT INTO watch_rules
            (id, tenant_id, owner_user_id, team_id_snapshot, name, signal_type,
             enabled, paused, current_version, schedule_kind,
             schedule_interval_seconds, next_evaluation_at, claim_token,
             claim_expires_at, claim_attempt_count, config_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"""
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(statement, (*base, "event_driven", 60, None, None, None, 0, "{}", now, now))
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(statement, (*base, "interval", 59, now, None, None, 0, "{}", now, now))
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(statement, (*base, "interval", 60, now, str(uuid4()), None, 1, "{}", now, now))
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(statement, (*base, "interval", 60, now, None, None, 6, "{}", now, now))
        connection.rollback()
        connection.execute(statement, (*base, "event_driven", None, None, None, None, 0, "{}", now, now))
        assert connection.execute("SELECT schedule_kind FROM watch_rules").fetchone()[0] == "event_driven"


def _valid_observation_payload() -> dict:
    correlation = uuid4()
    return {
        "signal_type": "run_finding",
        "subject_scope": {"tenant_id": "tenant", "issuer_id": None, "portfolio_id": None},
        "source_identity": "run:abc:cp5:finding:1",
        "observed_at": datetime.now(timezone.utc),
        "numeric_value": 4.25,
        "detail": {},
        "source_artifact_refs": ("run:abc",),
        "correlation_id": correlation,
        "correlation_root_id": correlation,
        "hop_count": 0,
    }


def test_signal_observation_validates_finite_values_scope_and_canonical_identity() -> None:
    from alert_contracts import SignalObservation

    payload = _valid_observation_payload()
    observation = SignalObservation.model_validate(payload)
    assert observation.numeric_value == 4.25
    assert observation.subject_scope.canonical_json() == (
        '{"issuer_id":null,"portfolio_id":null,"tenant_id":"tenant"}'
    )
    assert observation.source_artifact_refs == ("run:abc",)
    with pytest.raises(ValidationError):
        SignalObservation.model_validate({**payload, "numeric_value": float("nan")})
    with pytest.raises(ValidationError):
        SignalObservation.model_validate({**payload, "numeric_value": None})
    with pytest.raises(ValidationError):
        SignalObservation.model_validate({**payload, "subject_scope": {"tenant_id": "é" * 128}})
    with pytest.raises(ValidationError):
        SignalObservation.model_validate({**payload, "unexpected": True})
    with pytest.raises(ValidationError):
        SignalObservation.model_validate({**payload, "observed_at": datetime(2026, 7, 20)})
    with pytest.raises(ValidationError):
        observation.numeric_value = 3.0


@pytest.mark.parametrize("boolean", (True, False))
def test_wire_numeric_and_integer_fields_reject_booleans(boolean: bool) -> None:
    from alert_contracts import AlertCandidate, EvaluationTrigger, SignalObservation, SinkResult

    observation = _valid_observation_payload()
    with pytest.raises(ValidationError):
        SignalObservation.model_validate({**observation, "numeric_value": boolean})
    with pytest.raises(ValidationError):
        SignalObservation.model_validate({**observation, "hop_count": boolean})

    common = {
        "trigger_kind": "manual",
        "trigger_identity": "manual:1",
        "watch_rule_id": uuid4(),
        "rule_version": 1,
        "occurred_at": datetime.now(timezone.utc),
        "scheduled_for": None,
        "correlation_id": uuid4(),
        "correlation_root_id": uuid4(),
        "hop_count": 0,
    }
    with pytest.raises(ValidationError):
        EvaluationTrigger.model_validate({**common, "rule_version": boolean})
    with pytest.raises(ValidationError):
        EvaluationTrigger.model_validate({**common, "hop_count": boolean})

    key = "a" * 64
    candidate = {
        "evaluation_id": uuid4(),
        "watch_rule_id": uuid4(),
        "rule_version": 1,
        "observation_key": key,
        "alert_key": f"c3:{key}",
        "signal_type": "run_finding",
        "subject_scope": {"tenant_id": "tenant", "issuer_id": None, "portfolio_id": None},
        "issuer_id": None,
        "portfolio_id": None,
        "kind": "run_finding",
        "title": "Matched",
        "impact": "",
        "evidence": {},
        "authority": {},
        "correlation_id": uuid4(),
        "correlation_root_id": uuid4(),
        "hop_count": 0,
    }
    with pytest.raises(ValidationError):
        AlertCandidate.model_validate({**candidate, "rule_version": boolean})
    with pytest.raises(ValidationError):
        AlertCandidate.model_validate({**candidate, "hop_count": boolean})
    with pytest.raises(ValidationError):
        SinkResult(
            channel="email",
            status="not_sent",
            attempt_count=boolean,
        )

    assert SignalObservation.model_validate(
        {**observation, "numeric_value": 1, "hop_count": 1}
    ).numeric_value == 1.0
    assert EvaluationTrigger.model_validate(common).rule_version == 1
    assert AlertCandidate.model_validate(candidate).hop_count == 0
    assert SinkResult(channel="email", status="not_sent", attempt_count=1).attempt_count == 1


def test_wire_contracts_enforce_trigger_candidate_and_sink_state_machines() -> None:
    from alert_contracts import AlertCandidate, EvaluationTrigger, SinkIntent, SinkResult

    correlation = uuid4()
    common = {
        "correlation_id": correlation,
        "correlation_root_id": correlation,
        "hop_count": 0,
    }
    with pytest.raises(ValidationError):
        EvaluationTrigger(
            trigger_kind="scheduled_edgar", trigger_identity="filing:1",
            watch_rule_id=uuid4(), rule_version=1,
            occurred_at=datetime.now(timezone.utc), scheduled_for=None, **common,
        )
    trigger = EvaluationTrigger(
        trigger_kind="scheduled_watchlist", trigger_identity="slot:1",
        watch_rule_id=uuid4(), rule_version=1,
        occurred_at=datetime.now(timezone.utc), scheduled_for=datetime.now(timezone.utc),
        **common,
    )
    assert trigger.scheduled_for is not None

    observation_key = "a" * 64
    candidate_payload = {
        "evaluation_id": uuid4(), "watch_rule_id": uuid4(), "rule_version": 1,
        "observation_key": observation_key, "alert_key": f"c3:{observation_key}",
        "signal_type": "run_finding",
        "subject_scope": {"tenant_id": "tenant", "issuer_id": "issuer", "portfolio_id": None},
        "issuer_id": "issuer", "portfolio_id": None, "run_id": "run-1",
        "kind": "run_finding", "title": "Matched", "impact": "",
        "evidence": {}, "authority": {}, **common,
    }
    assert AlertCandidate.model_validate(candidate_payload).alert_key == f"c3:{observation_key}"
    with pytest.raises(ValidationError):
        AlertCandidate.model_validate({**candidate_payload, "alert_key": f"c3:{'b' * 64}"})
    with pytest.raises(ValidationError):
        AlertCandidate.model_validate({**candidate_payload, "issuer_id": "other"})

    pending = SinkIntent(
        channel="email", destination_ref="desk-channel", idempotency_key="b" * 64,
        status="pending", rendered_intent=None, not_sent_reason=None,
    )
    assert pending.status == "pending"
    with pytest.raises(ValidationError):
        SinkIntent(
            channel="email", destination_ref="desk-channel", idempotency_key="b" * 64,
            status="rendered_intent", rendered_intent=None, not_sent_reason=None,
        )
    with pytest.raises(ValidationError):
        SinkIntent(
            channel="email", destination_ref="desk-channel", idempotency_key="b" * 64,
            status="sent", rendered_intent={}, not_sent_reason=None,
        )
    assert SinkResult(channel="email", status="not_sent", attempt_count=5, error_class="bounded").status == "not_sent"
    with pytest.raises(ValidationError):
        SinkResult(channel="email", status="delivered", attempt_count=1)


def test_wire_json_payloads_are_bounded_objects() -> None:
    from alert_contracts import AlertCandidate, SinkIntent

    observation_key = "c" * 64
    correlation = uuid4()
    candidate = {
        "evaluation_id": uuid4(), "watch_rule_id": uuid4(), "rule_version": 1,
        "observation_key": observation_key, "alert_key": f"c3:{observation_key}",
        "signal_type": "qa_gate",
        "subject_scope": {"tenant_id": "tenant", "issuer_id": None, "portfolio_id": None},
        "issuer_id": None, "portfolio_id": None, "kind": "qa_gate", "title": "QA",
        "impact": "", "evidence": {"ok": True}, "authority": {},
        "correlation_id": correlation, "correlation_root_id": correlation, "hop_count": 0,
    }
    assert AlertCandidate.model_validate(candidate).evidence == {"ok": True}
    with pytest.raises(ValidationError):
        AlertCandidate.model_validate({**candidate, "evidence": ["not", "object"]})
    with pytest.raises(ValidationError):
        AlertCandidate.model_validate({**candidate, "authority": {"x": "y" * 65536}})
    with pytest.raises(ValidationError):
        SinkIntent(
            channel="in_app", destination_ref="owner", idempotency_key="d" * 64,
            status="rendered_intent", rendered_intent={"x": "y" * (256 * 1024)},
        )
