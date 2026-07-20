"""C3 watch-rule persistence and wire-contract regression tests."""

from __future__ import annotations

import json
import os
import sqlite3
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy import ForeignKeyConstraint


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
        "portfolio_id", "name", "signal_type", "enabled", "paused",
        "current_version", "schedule_kind", "schedule_interval_seconds",
        "next_evaluation_at", "schedule_cursor", "claim_token",
        "claim_expires_at", "last_evaluated_at", "claim_attempt_count",
        "config_json", "created_at", "updated_at",
    )
    assert rules.c.schedule_cursor.type.length == 512
    assert rules.c.claim_token.nullable is True
    assert rules.c.claim_expires_at.nullable is True
    assert rules.c.claim_attempt_count.default.arg == 0
    assert rules.c.paused.default.arg is False
    assert {
        "ck_watch_rules_signal_type", "ck_watch_rules_current_version",
        "ck_watch_rules_schedule_kind", "ck_watch_rules_schedule_state",
        "ck_watch_rules_claim_pair", "ck_watch_rules_claim_attempt_count",
        "ck_watch_rules_config_json",
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


def test_database_uniqueness_json_bounds_and_delete_rules(tmp_path: Path) -> None:
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
            connection.execute("UPDATE watch_rule_evaluations SET detail_json = ?", (json.dumps({"x": "y" * 65536}),))
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute("UPDATE watch_rule_evaluations SET hop_count = 4")
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute("DELETE FROM watch_rules")
        connection.rollback()
        connection.execute("DELETE FROM alert_events WHERE id = 'legacy-c3-event'")
        assert connection.execute("SELECT COUNT(*) FROM alert_event_contexts").fetchone()[0] == 0
        assert connection.execute("SELECT COUNT(*) FROM alert_delivery_intents").fetchone()[0] == 0


def test_schedule_and_delivery_state_checks_reject_invalid_leases(tmp_path: Path) -> None:
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
