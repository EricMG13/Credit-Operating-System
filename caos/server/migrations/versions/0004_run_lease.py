"""run lease columns for async execution

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-15
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("runs") as batch:
        batch.add_column(sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"))
        batch.add_column(sa.Column("worker_id", sa.String(length=64), nullable=True))
        batch.add_column(sa.Column("error", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("runs") as batch:
        for col in ("error", "worker_id", "attempts", "lease_expires_at", "claimed_at"):
            batch.drop_column(col)
