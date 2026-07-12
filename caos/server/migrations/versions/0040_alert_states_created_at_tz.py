"""Fix alert_states.created_at to be timezone-aware.

Migration 0039 created the column as a naive `DateTime()`, but the ORM model
(AlertState in database.py) declares `DateTime(timezone=True)` like every
other timestamp column in this codebase. Invisible on SQLite (no tz-aware
column type there), but on Postgres it lands as `TIMESTAMP WITHOUT TIME ZONE`
and `alembic check` flags real drift. Reinterpret existing naive values as UTC
rather than shifting them.

Revision ID: 0040
Revises: 0039
Create Date: 2026-07-12
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0040"
down_revision: Union[str, None] = "0039"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            "ALTER TABLE alert_states "
            "ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE "
            "USING created_at AT TIME ZONE 'UTC'"
        )
    else:
        with op.batch_alter_table("alert_states", schema=None) as batch_op:
            batch_op.alter_column("created_at", existing_type=sa.DateTime(), type_=sa.DateTime(timezone=True))


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            "ALTER TABLE alert_states "
            "ALTER COLUMN created_at TYPE TIMESTAMP WITHOUT TIME ZONE "
            "USING created_at AT TIME ZONE 'UTC'"
        )
    else:
        with op.batch_alter_table("alert_states", schema=None) as batch_op:
            batch_op.alter_column("created_at", existing_type=sa.DateTime(timezone=True), type_=sa.DateTime())
