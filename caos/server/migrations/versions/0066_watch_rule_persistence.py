"""Add C3 watch-rule persistence and delivery intents.

Revision ID: 0066
Revises: 0065
Create Date: 2026-07-20
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "0066"
down_revision: Union[str, None] = "0065"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_SIGNALS = (
    "'run_finding','qa_gate','covenant','edgar_filing','market_move',"
    "'cp1b_monitoring','cp1c_peer_outlier','news'"
)


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def _json_object_check(column: str, maximum: int) -> str:
    if _is_postgres():
        return (
            f"jsonb_typeof({column}) = 'object' "
            f"AND octet_length(CAST({column} AS text)) <= {maximum}"
        )
    return (
        f"json_valid({column}) AND json_type({column}) = 'object' "
        f"AND length(CAST({column} AS BLOB)) <= {maximum}"
    )


def _subject_scope_check() -> str:
    if _is_postgres():
        return (
            "jsonb_typeof(subject_scope_json) = 'object' "
            "AND octet_length(CAST(subject_scope_json AS text)) <= 65536 "
            "AND subject_scope_json ?& ARRAY['tenant_id','issuer_id','portfolio_id'] "
            "AND (subject_scope_json - ARRAY['tenant_id','issuer_id','portfolio_id']) = '{}'::jsonb "
            "AND jsonb_typeof(subject_scope_json -> 'tenant_id') = 'string' "
            "AND octet_length(subject_scope_json ->> 'tenant_id') BETWEEN 1 AND 255 "
            "AND (jsonb_typeof(subject_scope_json -> 'issuer_id') = 'null' "
            "OR (jsonb_typeof(subject_scope_json -> 'issuer_id') = 'string' "
            "AND octet_length(subject_scope_json ->> 'issuer_id') BETWEEN 1 AND 36)) "
            "AND (jsonb_typeof(subject_scope_json -> 'portfolio_id') = 'null' "
            "OR (jsonb_typeof(subject_scope_json -> 'portfolio_id') = 'string' "
            "AND octet_length(subject_scope_json ->> 'portfolio_id') BETWEEN 1 AND 36))"
        )
    return (
        "json_valid(subject_scope_json) "
        "AND json_type(subject_scope_json) = 'object' "
        "AND length(CAST(subject_scope_json AS BLOB)) <= 65536 "
        "AND json_remove(subject_scope_json, '$.tenant_id', '$.issuer_id', "
        "'$.portfolio_id') = '{}' "
        "AND json_type(subject_scope_json, '$.tenant_id') = 'text' "
        "AND length(CAST(json_extract(subject_scope_json, '$.tenant_id') AS BLOB)) "
        "BETWEEN 1 AND 255 "
        "AND json_type(subject_scope_json, '$.issuer_id') IS NOT NULL "
        "AND json_type(subject_scope_json, '$.issuer_id') IN ('null','text') "
        "AND (json_type(subject_scope_json, '$.issuer_id') = 'null' OR "
        "length(CAST(json_extract(subject_scope_json, '$.issuer_id') AS BLOB)) "
        "BETWEEN 1 AND 36) "
        "AND json_type(subject_scope_json, '$.portfolio_id') IS NOT NULL "
        "AND json_type(subject_scope_json, '$.portfolio_id') IN ('null','text') "
        "AND (json_type(subject_scope_json, '$.portfolio_id') = 'null' OR "
        "length(CAST(json_extract(subject_scope_json, '$.portfolio_id') AS BLOB)) "
        "BETWEEN 1 AND 36)"
    )


def _string_bounds(*bounds: tuple[str, int, int, bool]) -> str:
    clauses = []
    for column, minimum, maximum, nullable in bounds:
        check = f"length({column}) BETWEEN {minimum} AND {maximum}"
        clauses.append(f"({column} IS NULL OR {check})" if nullable else check)
    return " AND ".join(clauses)


def _observation_key_check() -> str:
    if _is_postgres():
        return "length(observation_key) = 64 AND observation_key ~ '^[0-9a-f]{64}$'"
    return (
        "length(observation_key) = 64 AND "
        "observation_key NOT GLOB '*[^0-9a-f]*'"
    )


def _create_watch_rule_version_immutability_trigger() -> None:
    if _is_postgres():
        op.execute(
            "CREATE FUNCTION c3_reject_watch_rule_version_update() RETURNS trigger "
            "LANGUAGE plpgsql AS $$ BEGIN "
            "RAISE EXCEPTION 'watch_rule_versions are immutable' USING ERRCODE = '55000'; "
            "RETURN OLD; END; $$"
        )
        op.execute(
            "CREATE TRIGGER trg_watch_rule_versions_immutable "
            "BEFORE UPDATE ON watch_rule_versions FOR EACH ROW "
            "EXECUTE FUNCTION c3_reject_watch_rule_version_update()"
        )
        return
    op.execute(
        "CREATE TRIGGER trg_watch_rule_versions_immutable "
        "BEFORE UPDATE ON watch_rule_versions "
        "BEGIN SELECT RAISE(ABORT, 'watch_rule_versions are immutable'); END"
    )


def _drop_watch_rule_version_immutability_trigger() -> None:
    if _is_postgres():
        op.execute(
            "DROP TRIGGER IF EXISTS trg_watch_rule_versions_immutable "
            "ON watch_rule_versions"
        )
        op.execute("DROP FUNCTION IF EXISTS c3_reject_watch_rule_version_update()")
        return
    op.execute("DROP TRIGGER IF EXISTS trg_watch_rule_versions_immutable")


def _json_type():
    return sa.JSON(none_as_null=True).with_variant(
        postgresql.JSONB(none_as_null=True), "postgresql"
    )


def _uuid_type():
    return sa.Uuid(as_uuid=False)


def upgrade() -> None:
    op.create_table(
        "watch_rules",
        sa.Column("id", _uuid_type(), primary_key=True),
        sa.Column("tenant_id", sa.String(255), nullable=False),
        sa.Column("owner_user_id", sa.String(255), nullable=False),
        sa.Column("team_id_snapshot", sa.String(64), nullable=False),
        sa.Column("issuer_id", sa.String(36), nullable=True),
        sa.Column("portfolio_id", sa.String(36), nullable=True),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("signal_type", sa.String(32), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("paused", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("current_version", sa.Integer(), nullable=False),
        sa.Column("schedule_kind", sa.String(24), nullable=False),
        sa.Column("schedule_interval_seconds", sa.Integer(), nullable=True),
        sa.Column("next_evaluation_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("schedule_cursor", sa.String(512), nullable=True),
        sa.Column("claim_token", _uuid_type(), nullable=True),
        sa.Column("claim_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_evaluated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("claim_attempt_count", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("config_json", _json_type(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            _string_bounds(
                ("tenant_id", 1, 255, False),
                ("owner_user_id", 1, 255, False),
                ("team_id_snapshot", 1, 64, False),
                ("issuer_id", 1, 36, True),
                ("portfolio_id", 1, 36, True),
                ("name", 1, 160, False),
                ("signal_type", 1, 32, False),
                ("schedule_kind", 1, 24, False),
                ("schedule_cursor", 0, 512, True),
            ),
            name="ck_watch_rules_string_bounds",
        ),
        sa.CheckConstraint(
            f"signal_type IN ({_SIGNALS}) AND (signal_type <> 'news' OR enabled = false)",
            name="ck_watch_rules_signal_type",
        ),
        sa.CheckConstraint("current_version >= 1", name="ck_watch_rules_current_version"),
        sa.CheckConstraint(
            "schedule_kind IN ('event_driven','interval','edgar')",
            name="ck_watch_rules_schedule_kind",
        ),
        sa.CheckConstraint(
            "(schedule_kind = 'event_driven' AND schedule_interval_seconds IS NULL "
            "AND next_evaluation_at IS NULL AND schedule_cursor IS NULL "
            "AND claim_token IS NULL AND claim_expires_at IS NULL "
            "AND last_evaluated_at IS NULL AND claim_attempt_count = 0) OR "
            "(schedule_kind IN ('interval','edgar') "
            "AND schedule_interval_seconds BETWEEN 60 AND 86400 "
            "AND (enabled = false OR paused = true OR next_evaluation_at IS NOT NULL))",
            name="ck_watch_rules_schedule_state",
        ),
        sa.CheckConstraint(
            "(claim_token IS NULL AND claim_expires_at IS NULL) OR "
            "(claim_token IS NOT NULL AND claim_expires_at IS NOT NULL)",
            name="ck_watch_rules_claim_pair",
        ),
        sa.CheckConstraint(
            "claim_attempt_count BETWEEN 0 AND 5",
            name="ck_watch_rules_claim_attempt_count",
        ),
        sa.CheckConstraint(_json_object_check("config_json", 65536), name="ck_watch_rules_config_json"),
    )
    op.create_index("ix_watch_rules_tenant_owner", "watch_rules", ["tenant_id", "owner_user_id"])
    op.create_index("ix_watch_rules_tenant_team", "watch_rules", ["tenant_id", "team_id_snapshot"])
    op.create_index("ix_watch_rules_tenant_issuer", "watch_rules", ["tenant_id", "issuer_id"])
    op.create_index("ix_watch_rules_tenant_portfolio", "watch_rules", ["tenant_id", "portfolio_id"])
    op.create_index(
        "ix_watch_rules_due_claim",
        "watch_rules",
        ["next_evaluation_at", "claim_expires_at"],
        postgresql_where=sa.text(
            "enabled AND NOT paused AND schedule_kind IN ('interval','edgar')"
        ),
        sqlite_where=sa.text(
            "enabled AND NOT paused AND schedule_kind IN ('interval','edgar')"
        ),
    )

    op.create_table(
        "watch_rule_versions",
        sa.Column("id", _uuid_type(), primary_key=True),
        sa.Column(
            "watch_rule_id", _uuid_type(),
            sa.ForeignKey("watch_rules.id", ondelete="RESTRICT"), nullable=False,
        ),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("owner_user_id", sa.String(255), nullable=False),
        sa.Column("team_id_snapshot", sa.String(64), nullable=False),
        sa.Column("signal_type", sa.String(32), nullable=False),
        sa.Column("config_json", _json_type(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            _string_bounds(
                ("owner_user_id", 1, 255, False),
                ("team_id_snapshot", 1, 64, False),
                ("signal_type", 1, 32, False),
            ),
            name="ck_watch_rule_versions_string_bounds",
        ),
        sa.UniqueConstraint(
            "watch_rule_id", "version", name="uq_watch_rule_versions_rule_version"
        ),
        sa.CheckConstraint("version >= 1", name="ck_watch_rule_versions_version"),
        sa.CheckConstraint(
            f"signal_type IN ({_SIGNALS})", name="ck_watch_rule_versions_signal_type"
        ),
        sa.CheckConstraint(
            _json_object_check("config_json", 65536),
            name="ck_watch_rule_versions_config_json",
        ),
    )
    op.create_index(
        "ix_watch_rule_versions_rule_version",
        "watch_rule_versions",
        ["watch_rule_id", "version"],
    )
    _create_watch_rule_version_immutability_trigger()

    op.create_table(
        "watch_rule_evaluations",
        sa.Column("id", _uuid_type(), primary_key=True),
        sa.Column("tenant_id", sa.String(255), nullable=False),
        sa.Column("owner_user_id", sa.String(255), nullable=False),
        sa.Column("team_id_snapshot", sa.String(64), nullable=False),
        sa.Column("issuer_id", sa.String(36), nullable=True),
        sa.Column("portfolio_id", sa.String(36), nullable=True),
        sa.Column(
            "watch_rule_id", _uuid_type(),
            sa.ForeignKey("watch_rules.id", ondelete="RESTRICT"), nullable=False,
        ),
        sa.Column("rule_version", sa.Integer(), nullable=False),
        sa.Column("signal_type", sa.String(32), nullable=False),
        sa.Column("subject_scope_json", _json_type(), nullable=False),
        sa.Column("source_identity", sa.String(512), nullable=False),
        sa.Column("observation_key", sa.CHAR(64), nullable=False),
        sa.Column("outcome", sa.String(24), nullable=False),
        sa.Column("correlation_id", _uuid_type(), nullable=False),
        sa.Column("correlation_root_id", _uuid_type(), nullable=False),
        sa.Column("hop_count", sa.SmallInteger(), nullable=False),
        sa.Column("evaluated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("detail_json", _json_type(), nullable=False),
        sa.CheckConstraint(
            _string_bounds(
                ("tenant_id", 1, 255, False),
                ("owner_user_id", 1, 255, False),
                ("team_id_snapshot", 1, 64, False),
                ("issuer_id", 1, 36, True),
                ("portfolio_id", 1, 36, True),
                ("signal_type", 1, 32, False),
                ("source_identity", 1, 512, False),
                ("observation_key", 64, 64, False),
                ("outcome", 1, 24, False),
            ),
            name="ck_watch_rule_evaluations_string_bounds",
        ),
        sa.CheckConstraint(
            _observation_key_check(),
            name="ck_watch_rule_evaluations_observation_key",
        ),
        sa.UniqueConstraint(
            "tenant_id", "observation_key",
            name="uq_watch_rule_evaluations_tenant_observation",
        ),
        sa.ForeignKeyConstraint(
            ["watch_rule_id", "rule_version"],
            ["watch_rule_versions.watch_rule_id", "watch_rule_versions.version"],
            ondelete="RESTRICT",
            name="fk_watch_rule_evaluations_rule_version",
        ),
        sa.CheckConstraint(
            f"signal_type IN ({_SIGNALS}) AND signal_type <> 'news'",
            name="ck_watch_rule_evaluations_signal_type",
        ),
        sa.CheckConstraint(
            "outcome IN ('observed','matched','ignored','rejected')",
            name="ck_watch_rule_evaluations_outcome",
        ),
        sa.CheckConstraint(
            "hop_count BETWEEN 0 AND 3", name="ck_watch_rule_evaluations_hop_count"
        ),
        sa.CheckConstraint(
            _subject_scope_check(), name="ck_watch_rule_evaluations_subject_scope_json"
        ),
        sa.CheckConstraint(
            _json_object_check("detail_json", 65536),
            name="ck_watch_rule_evaluations_detail_json",
        ),
    )
    op.create_index(
        "ix_watch_rule_evaluations_rule_evaluated",
        "watch_rule_evaluations",
        ["watch_rule_id", "evaluated_at"],
    )
    op.create_index(
        "ix_watch_rule_evaluations_correlation_evaluated",
        "watch_rule_evaluations", ["correlation_root_id", "evaluated_at"],
    )
    op.create_index(
        "ix_watch_rule_evaluations_tenant_owner",
        "watch_rule_evaluations", ["tenant_id", "owner_user_id"],
    )
    op.create_index(
        "ix_watch_rule_evaluations_tenant_team",
        "watch_rule_evaluations", ["tenant_id", "team_id_snapshot"],
    )

    op.create_table(
        "alert_event_contexts",
        sa.Column("id", _uuid_type(), primary_key=True),
        sa.Column("tenant_id", sa.String(255), nullable=False),
        sa.Column("owner_user_id", sa.String(255), nullable=False),
        sa.Column("team_id_snapshot", sa.String(64), nullable=False),
        sa.Column("issuer_id", sa.String(36), nullable=True),
        sa.Column("portfolio_id", sa.String(36), nullable=True),
        sa.Column(
            "alert_event_id", sa.String(36),
            sa.ForeignKey("alert_events.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "watch_rule_evaluation_id", _uuid_type(),
            sa.ForeignKey("watch_rule_evaluations.id", ondelete="RESTRICT"), nullable=False,
        ),
        sa.Column(
            "watch_rule_id", _uuid_type(),
            sa.ForeignKey("watch_rules.id", ondelete="RESTRICT"), nullable=False,
        ),
        sa.Column("rule_version", sa.Integer(), nullable=False),
        sa.Column("signal_type", sa.String(32), nullable=False),
        sa.Column("correlation_root_id", _uuid_type(), nullable=False),
        sa.Column("hop_count", sa.SmallInteger(), nullable=False),
        sa.Column("context_json", _json_type(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            _string_bounds(
                ("tenant_id", 1, 255, False),
                ("owner_user_id", 1, 255, False),
                ("team_id_snapshot", 1, 64, False),
                ("issuer_id", 1, 36, True),
                ("portfolio_id", 1, 36, True),
                ("alert_event_id", 1, 36, False),
                ("signal_type", 1, 32, False),
            ),
            name="ck_alert_event_contexts_string_bounds",
        ),
        sa.UniqueConstraint("alert_event_id", name="uq_alert_event_contexts_alert_event"),
        sa.UniqueConstraint(
            "watch_rule_evaluation_id", name="uq_alert_event_contexts_evaluation"
        ),
        sa.ForeignKeyConstraint(
            ["watch_rule_id", "rule_version"],
            ["watch_rule_versions.watch_rule_id", "watch_rule_versions.version"],
            ondelete="RESTRICT",
            name="fk_alert_event_contexts_rule_version",
        ),
        sa.CheckConstraint(
            f"signal_type IN ({_SIGNALS}) AND signal_type <> 'news'",
            name="ck_alert_event_contexts_signal_type",
        ),
        sa.CheckConstraint(
            "hop_count BETWEEN 0 AND 3", name="ck_alert_event_contexts_hop_count"
        ),
        sa.CheckConstraint(
            _json_object_check("context_json", 65536),
            name="ck_alert_event_contexts_context_json",
        ),
    )
    op.create_index(
        "ix_alert_event_contexts_rule_created", "alert_event_contexts",
        ["watch_rule_id", "created_at"],
    )
    op.create_index(
        "ix_alert_event_contexts_tenant_owner", "alert_event_contexts",
        ["tenant_id", "owner_user_id"],
    )
    op.create_index(
        "ix_alert_event_contexts_tenant_team", "alert_event_contexts",
        ["tenant_id", "team_id_snapshot"],
    )

    op.create_table(
        "alert_delivery_intents",
        sa.Column("id", _uuid_type(), primary_key=True),
        sa.Column("tenant_id", sa.String(255), nullable=False),
        sa.Column("owner_user_id", sa.String(255), nullable=False),
        sa.Column("team_id_snapshot", sa.String(64), nullable=False),
        sa.Column("issuer_id", sa.String(36), nullable=True),
        sa.Column("portfolio_id", sa.String(36), nullable=True),
        sa.Column(
            "alert_event_id", sa.String(36),
            sa.ForeignKey("alert_events.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "alert_event_context_id", _uuid_type(),
            sa.ForeignKey("alert_event_contexts.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("channel", sa.String(24), nullable=False),
        sa.Column("destination_ref", sa.String(256), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("attempt_count", sa.SmallInteger(), nullable=False),
        sa.Column("max_attempts", sa.SmallInteger(), nullable=False),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("lease_token", _uuid_type(), nullable=True),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rendered_intent", _json_type(), nullable=True),
        sa.Column("not_sent_reason", sa.String(256), nullable=True),
        sa.Column("correlation_root_id", _uuid_type(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            _string_bounds(
                ("tenant_id", 1, 255, False),
                ("owner_user_id", 1, 255, False),
                ("team_id_snapshot", 1, 64, False),
                ("issuer_id", 1, 36, True),
                ("portfolio_id", 1, 36, True),
                ("alert_event_id", 1, 36, False),
                ("channel", 1, 24, False),
                ("destination_ref", 1, 256, False),
                ("status", 1, 24, False),
                ("not_sent_reason", 0, 256, True),
            ),
            name="ck_alert_delivery_intents_string_bounds",
        ),
        sa.UniqueConstraint(
            "alert_event_context_id", "channel", "destination_ref",
            name="uq_alert_delivery_intents_destination",
        ),
        sa.CheckConstraint(
            "channel IN ('in_app','email')", name="ck_alert_delivery_intents_channel"
        ),
        sa.CheckConstraint(
            "status IN ('pending','leased','rendered_intent','not_sent')",
            name="ck_alert_delivery_intents_status",
        ),
        sa.CheckConstraint(
            "max_attempts BETWEEN 1 AND 5 AND attempt_count BETWEEN 0 AND max_attempts",
            name="ck_alert_delivery_intents_attempts",
        ),
        sa.CheckConstraint(
            "(status = 'leased' AND lease_token IS NOT NULL "
            "AND lease_expires_at IS NOT NULL) OR "
            "(status <> 'leased' AND lease_token IS NULL AND lease_expires_at IS NULL)",
            name="ck_alert_delivery_intents_lease_pair",
        ),
        sa.CheckConstraint(
            "(status = 'rendered_intent' AND rendered_intent IS NOT NULL "
            "AND not_sent_reason IS NULL) OR "
            "(status = 'not_sent' AND rendered_intent IS NULL "
            "AND not_sent_reason IS NOT NULL) OR "
            "(status IN ('pending','leased') AND rendered_intent IS NULL "
            "AND not_sent_reason IS NULL)",
            name="ck_alert_delivery_intents_payload_state",
        ),
        sa.CheckConstraint(
            "rendered_intent IS NULL OR (" + _json_object_check("rendered_intent", 262144) + ")",
            name="ck_alert_delivery_intents_rendered_intent",
        ),
    )
    op.create_index(
        "ix_alert_delivery_intents_alert_event_id", "alert_delivery_intents", ["alert_event_id"]
    )
    op.create_index(
        "ix_alert_delivery_intents_status_available", "alert_delivery_intents",
        ["status", "available_at"],
    )
    op.create_index(
        "ix_alert_delivery_intents_lease_expires_at", "alert_delivery_intents",
        ["lease_expires_at"],
    )
    op.create_index(
        "ix_alert_delivery_intents_tenant_owner_created", "alert_delivery_intents",
        ["tenant_id", "owner_user_id", "created_at"],
    )
    op.create_index(
        "ix_alert_delivery_intents_tenant_team", "alert_delivery_intents",
        ["tenant_id", "team_id_snapshot"],
    )


def downgrade() -> None:
    _drop_watch_rule_version_immutability_trigger()

    # PostgreSQL can remove named foreign keys explicitly before dependent
    # indexes/tables. SQLite cannot ALTER DROP CONSTRAINT; reverse table order is
    # its equivalent safe path and never touches either legacy alert table.
    if _is_postgres():
        for table, constraint in (
            ("alert_delivery_intents", "alert_delivery_intents_alert_event_context_id_fkey"),
            ("alert_delivery_intents", "alert_delivery_intents_alert_event_id_fkey"),
            ("alert_event_contexts", "fk_alert_event_contexts_rule_version"),
            ("alert_event_contexts", "alert_event_contexts_watch_rule_id_fkey"),
            ("alert_event_contexts", "alert_event_contexts_watch_rule_evaluation_id_fkey"),
            ("alert_event_contexts", "alert_event_contexts_alert_event_id_fkey"),
            ("watch_rule_evaluations", "fk_watch_rule_evaluations_rule_version"),
            ("watch_rule_evaluations", "watch_rule_evaluations_watch_rule_id_fkey"),
            ("watch_rule_versions", "watch_rule_versions_watch_rule_id_fkey"),
        ):
            op.drop_constraint(constraint, table, type_="foreignkey")

    for name, table in (
        ("ix_alert_delivery_intents_tenant_team", "alert_delivery_intents"),
        ("ix_alert_delivery_intents_tenant_owner_created", "alert_delivery_intents"),
        ("ix_alert_delivery_intents_lease_expires_at", "alert_delivery_intents"),
        ("ix_alert_delivery_intents_status_available", "alert_delivery_intents"),
        ("ix_alert_delivery_intents_alert_event_id", "alert_delivery_intents"),
        ("ix_alert_event_contexts_tenant_team", "alert_event_contexts"),
        ("ix_alert_event_contexts_tenant_owner", "alert_event_contexts"),
        ("ix_alert_event_contexts_rule_created", "alert_event_contexts"),
        ("ix_watch_rule_evaluations_tenant_team", "watch_rule_evaluations"),
        ("ix_watch_rule_evaluations_tenant_owner", "watch_rule_evaluations"),
        ("ix_watch_rule_evaluations_correlation_evaluated", "watch_rule_evaluations"),
        ("ix_watch_rule_evaluations_rule_evaluated", "watch_rule_evaluations"),
        ("ix_watch_rule_versions_rule_version", "watch_rule_versions"),
        ("ix_watch_rules_due_claim", "watch_rules"),
        ("ix_watch_rules_tenant_portfolio", "watch_rules"),
        ("ix_watch_rules_tenant_issuer", "watch_rules"),
        ("ix_watch_rules_tenant_team", "watch_rules"),
        ("ix_watch_rules_tenant_owner", "watch_rules"),
    ):
        op.drop_index(name, table_name=table)

    op.drop_table("alert_delivery_intents")
    op.drop_table("alert_event_contexts")
    op.drop_table("watch_rule_evaluations")
    op.drop_table("watch_rule_versions")
    op.drop_table("watch_rules")
