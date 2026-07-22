"""Widen C3 rendered-JSON CHECK envelopes without changing wire limits.

Revision ID: 0067
Revises: 0066
Create Date: 2026-07-21
"""

from __future__ import annotations

from collections import defaultdict
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import context, op


revision: str = "0067"
down_revision: Union[str, None] = "0066"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_JSON_CHECKS = (
    ("watch_rules", "ck_watch_rules_config_json", "config_json", 65536, False),
    (
        "watch_rule_versions",
        "ck_watch_rule_versions_config_json",
        "config_json",
        65536,
        False,
    ),
    (
        "watch_rule_evaluations",
        "ck_watch_rule_evaluations_subject_scope_json",
        "subject_scope_json",
        65536,
        False,
    ),
    (
        "watch_rule_evaluations",
        "ck_watch_rule_evaluations_detail_json",
        "detail_json",
        65536,
        False,
    ),
    (
        "alert_event_contexts",
        "ck_alert_event_contexts_context_json",
        "context_json",
        65536,
        False,
    ),
    (
        "alert_delivery_intents",
        "ck_alert_delivery_intents_rendered_intent",
        "rendered_intent",
        262144,
        True,
    ),
)


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def _storage_maximum(maximum: int, *, widened: bool) -> int:
    if not widened:
        return maximum
    return maximum * (64 if _is_postgres() else 4)


def _json_object_check(
    column: str,
    maximum: int,
    *,
    widened: bool,
    subject_scope: bool = False,
) -> str:
    storage_maximum = _storage_maximum(maximum, widened=widened)
    if _is_postgres():
        check = (
            f"jsonb_typeof({column}) = 'object' "
            f"AND octet_length(CAST({column} AS text)) <= {storage_maximum}"
        )
        if subject_scope:
            check += (
                f" AND {column} ?& ARRAY['tenant_id','issuer_id','portfolio_id'] "
                f"AND ({column} - ARRAY['tenant_id','issuer_id','portfolio_id']) = '{{}}'::jsonb "
                f"AND jsonb_typeof({column} -> 'tenant_id') = 'string' "
                f"AND octet_length({column} ->> 'tenant_id') BETWEEN 1 AND 255 "
                f"AND (jsonb_typeof({column} -> 'issuer_id') = 'null' "
                f"OR (jsonb_typeof({column} -> 'issuer_id') = 'string' "
                f"AND octet_length({column} ->> 'issuer_id') BETWEEN 1 AND 36)) "
                f"AND (jsonb_typeof({column} -> 'portfolio_id') = 'null' "
                f"OR (jsonb_typeof({column} -> 'portfolio_id') = 'string' "
                f"AND octet_length({column} ->> 'portfolio_id') BETWEEN 1 AND 36))"
            )
        return check

    check = (
        f"json_valid({column}) AND json_type({column}) = 'object' "
        f"AND length(CAST({column} AS BLOB)) <= {storage_maximum}"
    )
    if subject_scope:
        check += (
            f" AND json_remove({column}, '$.tenant_id', '$.issuer_id', "
            f"'$.portfolio_id') = '{{}}' "
            f"AND json_type({column}, '$.tenant_id') = 'text' "
            f"AND length(CAST(json_extract({column}, '$.tenant_id') AS BLOB)) "
            f"BETWEEN 1 AND 255 "
            f"AND json_type({column}, '$.issuer_id') IS NOT NULL "
            f"AND json_type({column}, '$.issuer_id') IN ('null','text') "
            f"AND (json_type({column}, '$.issuer_id') = 'null' OR "
            f"length(CAST(json_extract({column}, '$.issuer_id') AS BLOB)) "
            f"BETWEEN 1 AND 36) "
            f"AND json_type({column}, '$.portfolio_id') IS NOT NULL "
            f"AND json_type({column}, '$.portfolio_id') IN ('null','text') "
            f"AND (json_type({column}, '$.portfolio_id') = 'null' OR "
            f"length(CAST(json_extract({column}, '$.portfolio_id') AS BLOB)) "
            f"BETWEEN 1 AND 36)"
        )
    return check


def _replace_table_checks(
    table: str,
    checks: list[tuple[str, str, int, bool]],
    *,
    widened: bool,
) -> None:
    with op.batch_alter_table(table, schema=None) as batch_op:
        for name, column, maximum, nullable in checks:
            check = _json_object_check(
                column,
                maximum,
                widened=widened,
                subject_scope=(column == "subject_scope_json"),
            )
            if nullable:
                check = f"{column} IS NULL OR ({check})"
            batch_op.drop_constraint(name, type_="check")
            batch_op.create_check_constraint(name, check)


def _restore_sqlite_immutability_trigger() -> None:
    op.execute(
        "CREATE TRIGGER IF NOT EXISTS trg_watch_rule_versions_immutable "
        "BEFORE UPDATE ON watch_rule_versions "
        "BEGIN SELECT RAISE(ABORT, 'watch_rule_versions are immutable'); END"
    )


def _replace_checks(*, widened: bool) -> None:
    checks_by_table: dict[str, list[tuple[str, str, int, bool]]] = defaultdict(list)
    for table, name, column, maximum, nullable in _JSON_CHECKS:
        checks_by_table[table].append((name, column, maximum, nullable))

    sqlite = not _is_postgres()
    for table, checks in checks_by_table.items():
        if not sqlite or table != "watch_rule_versions":
            _replace_table_checks(table, checks, widened=widened)
            continue
        op.execute(
            "DROP TRIGGER IF EXISTS trg_watch_rule_versions_immutable"
        )
        try:
            _replace_table_checks(table, checks, widened=widened)
        finally:
            _restore_sqlite_immutability_trigger()


def _preflight_downgrade() -> None:
    if context.is_offline_mode():
        raise RuntimeError(
            "0067 cannot downgrade in offline mode: the stored-JSON safety "
            "preflight requires a live database connection"
        )
    bind = op.get_bind()
    postgres = bind.dialect.name == "postgresql"
    for table, _name, column, maximum, _nullable in _JSON_CHECKS:
        size = (
            f"octet_length(CAST({column} AS text))"
            if postgres
            else f"length(CAST({column} AS BLOB))"
        )
        incompatible_count = bind.execute(
            sa.text(
                f"SELECT COUNT(*) FROM {table} "
                f"WHERE {column} IS NOT NULL AND {size} > :maximum"
            ),
            {"maximum": maximum},
        ).scalar_one()
        if incompatible_count:
            raise RuntimeError(
                "0067 cannot downgrade: "
                f"{table}.{column} contains stored JSON larger than the 0066 "
                f"maximum of {maximum} bytes; reduce the data before retrying"
            )


def upgrade() -> None:
    _replace_checks(widened=True)


def downgrade() -> None:
    _preflight_downgrade()
    _replace_checks(widened=False)
