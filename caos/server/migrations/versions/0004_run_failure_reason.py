"""runs.failure_reason — surface why a run failed (Phase-1 fault-finding)

A run that raises during execution is persisted as status='failed' with the
reason captured here, so a fault is inspectable via GET /api/runs/{id} rather
than vanishing on rollback.

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-15
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("runs", sa.Column("failure_reason", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("runs", "failure_reason")
