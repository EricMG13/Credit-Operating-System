"""analysts — self-registered named analyst profiles

Backs the in-app code-gated login (routes/auth.py). The profile id is stamped on
Run.analyst_id so every run is attributed; the name drives the initials badge.

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-22
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "analysts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_analyst_name"),
    )


def downgrade() -> None:
    op.drop_table("analysts")
