"""Alert states — ack/assign for the Watchtower alert inbox (Command + Monitor).

No prior mechanism records acknowledgement or assignment for an autonomy-draft
alert. `alert_key` is deterministic from the draft (run_id:issuer_id:kind:metric)
and cycle-scoped ON PURPOSE: the Sentinel is change-driven, so a re-fired
anomaly in a LATER cycle is a genuinely new event and should correctly reset to
open rather than silently inherit a stale ack. Plain strings (no FK) — same
audit-record shape as AnalystQaFlag, not run state.

Revision ID: 0039
Revises: 0038
Create Date: 2026-07-12
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0039"
down_revision: Union[str, None] = "0038"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "alert_states",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("alert_key", sa.String(length=160), nullable=False),
        sa.Column("state", sa.String(length=16), nullable=False),
        sa.Column("assignee", sa.String(length=120), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("analyst_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("uq_alert_states_alert_key", "alert_states", ["alert_key"], unique=True)


def downgrade() -> None:
    op.drop_index("uq_alert_states_alert_key", table_name="alert_states")
    op.drop_table("alert_states")
