"""Add context concurrency and durable run idempotency.

Revision ID: 0061
Revises: 0060
Create Date: 2026-07-16
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0061"
down_revision: Union[str, None] = "0060"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("analysis_contexts", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("revision", sa.Integer(), nullable=False, server_default="1")
        )
    with op.batch_alter_table("runs", schema=None) as batch_op:
        batch_op.add_column(sa.Column("idempotency_key", sa.String(128), nullable=True))
        batch_op.add_column(
            sa.Column("idempotency_request_hash", sa.String(64), nullable=True)
        )
        batch_op.create_index(
            "uq_runs_analyst_idempotency",
            ["analyst_id", "idempotency_key"],
            unique=True,
        )
    with op.batch_alter_table("documents", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("status", sa.String(16), nullable=False, server_default="active")
        )
        batch_op.add_column(sa.Column("withdrawn_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("withdrawn_by", sa.String(255), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("documents", schema=None) as batch_op:
        batch_op.drop_column("withdrawn_by")
        batch_op.drop_column("withdrawn_at")
        batch_op.drop_column("status")
    with op.batch_alter_table("runs", schema=None) as batch_op:
        batch_op.drop_index("uq_runs_analyst_idempotency")
        batch_op.drop_column("idempotency_request_hash")
        batch_op.drop_column("idempotency_key")
    with op.batch_alter_table("analysis_contexts", schema=None) as batch_op:
        batch_op.drop_column("revision")
