"""Add analyst-scoped background-work notification events.

Revision ID: 0058
Revises: 0057
Create Date: 2026-07-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0058"
down_revision: Union[str, None] = "0057"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notification_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("analyst_id", sa.String(255), nullable=False),
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("subject_kind", sa.String(32), nullable=False),
        sa.Column("subject_id", sa.String(64), nullable=False),
        sa.Column("issuer_id", sa.String(36), nullable=True),
        sa.Column("title", sa.String(240), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("href", sa.String(600), nullable=True),
        sa.Column("idempotency_key", sa.String(180), nullable=False),
        sa.Column("seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "uq_notification_events_idempotency_key",
        "notification_events",
        ["idempotency_key"],
        unique=True,
    )
    op.create_index(
        "ix_notification_events_analyst_created",
        "notification_events",
        ["analyst_id", "created_at", "id"],
    )
    op.create_index(
        "ix_notification_events_issuer_id",
        "notification_events",
        ["issuer_id"],
    )


def downgrade() -> None:
    connection = op.get_bind()
    if connection.execute(sa.text("SELECT COUNT(*) FROM notification_events")).scalar_one():
        raise RuntimeError(
            "0058 downgrade refused: notification evidence exists; retain the "
            "additive schema and disable notification reads instead"
        )
    op.drop_index("ix_notification_events_issuer_id", table_name="notification_events")
    op.drop_index("ix_notification_events_analyst_created", table_name="notification_events")
    op.drop_index(
        "uq_notification_events_idempotency_key", table_name="notification_events"
    )
    op.drop_table("notification_events")
