"""Alert resolution — a real terminal state for the Watchtower loop.

alert_states previously topped out at "ack"; there was no way to mark an
alert as actually resolved, so the loop's own doc comment admitted the
honest gap ("Ack/assigned", never "Resolved"). Adds the two columns a real
resolution needs: `resolved_at` (server-stamped, never client-supplied — a
resolution can't be backdated) and `resolution_note`. The state lattice
itself (open < ack < resolved, fail-closed against regression) is enforced
in the route layer, not the schema — no CHECK constraint needed since the
existing `state` column was never constrained at the DB level either.

Revision ID: 0043
Revises: 0042
Create Date: 2026-07-12
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0043"
down_revision: Union[str, None] = "0042"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("alert_states", schema=None) as batch_op:
        batch_op.add_column(sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("resolution_note", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("alert_states", schema=None) as batch_op:
        batch_op.drop_column("resolution_note")
        batch_op.drop_column("resolved_at")
