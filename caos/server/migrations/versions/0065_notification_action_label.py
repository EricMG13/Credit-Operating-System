"""Add producer-owned notification action labels.

Revision ID: 0065
Revises: 0064
Create Date: 2026-07-19
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0065"
down_revision: Union[str, None] = "0064"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "notification_events",
        sa.Column("action_label", sa.String(120), nullable=True),
    )


def downgrade() -> None:
    connection = op.get_bind()
    populated = connection.execute(
        sa.text(
            "SELECT COUNT(*) FROM notification_events "
            "WHERE action_label IS NOT NULL"
        )
    ).scalar_one()
    if populated:
        raise RuntimeError(
            "0065 downgrade refused: producer-owned notification labels exist; "
            "retain the additive schema and ignore the optional field instead"
        )
    with op.batch_alter_table("notification_events", schema=None) as batch_op:
        batch_op.drop_column("action_label")
