"""Add scoped durable idempotency to watch-rule creation.

Revision ID: 0068
Revises: 0067
Create Date: 2026-07-22
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import context, op


revision: str = "0068"
down_revision: Union[str, None] = "0067"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def _idempotency_check() -> str:
    if _is_postgres():
        return (
            "(create_idempotency_key IS NULL AND create_request_sha256 IS NULL) OR "
            "(create_idempotency_key IS NOT NULL "
            "AND create_request_sha256 IS NOT NULL "
            "AND create_idempotency_key ~ '^[A-Za-z0-9._:-]{1,128}$' "
            "AND create_request_sha256 ~ '^[0-9a-f]{64}$')"
        )
    return (
        "(create_idempotency_key IS NULL AND create_request_sha256 IS NULL) OR "
        "(create_idempotency_key IS NOT NULL "
        "AND create_request_sha256 IS NOT NULL "
        "AND length(CAST(create_idempotency_key AS BLOB)) BETWEEN 1 AND 128 "
        "AND instr(create_idempotency_key, char(0)) = 0 "
        "AND create_idempotency_key NOT GLOB '*[^A-Za-z0-9._:-]*' "
        "AND length(CAST(create_request_sha256 AS BLOB)) = 64 "
        "AND instr(create_request_sha256, char(0)) = 0 "
        "AND create_request_sha256 NOT GLOB '*[^0-9a-f]*')"
    )


def _preflight_downgrade() -> None:
    if context.is_offline_mode():
        raise RuntimeError(
            "0068 cannot downgrade in offline mode: the durable-idempotency "
            "safety preflight requires a live database connection"
        )
    populated = op.get_bind().execute(
        sa.text(
            "SELECT COUNT(*) FROM watch_rules "
            "WHERE create_idempotency_key IS NOT NULL "
            "OR create_request_sha256 IS NOT NULL"
        )
    ).scalar_one()
    if populated:
        raise RuntimeError(
            "0068 cannot downgrade: watch_rules contains durable create "
            "idempotency records; retain 0068 or explicitly clear those "
            "records before retrying"
        )


def upgrade() -> None:
    with op.batch_alter_table("watch_rules", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("create_idempotency_key", sa.String(128), nullable=True)
        )
        batch_op.add_column(
            sa.Column("create_request_sha256", sa.String(64), nullable=True)
        )
        batch_op.create_check_constraint(
            "ck_watch_rules_create_idempotency", _idempotency_check()
        )
        batch_op.create_unique_constraint(
            "uq_watch_rules_create_idempotency",
            ["tenant_id", "owner_user_id", "create_idempotency_key"],
        )


def downgrade() -> None:
    _preflight_downgrade()
    with op.batch_alter_table("watch_rules", schema=None) as batch_op:
        batch_op.drop_constraint(
            "uq_watch_rules_create_idempotency", type_="unique"
        )
        batch_op.drop_constraint(
            "ck_watch_rules_create_idempotency", type_="check"
        )
        batch_op.drop_column("create_request_sha256")
        batch_op.drop_column("create_idempotency_key")
