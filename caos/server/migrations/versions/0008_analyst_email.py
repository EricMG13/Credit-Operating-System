"""analysts.email — bind a profile to its verified edge-proxy identity

Behind SSO the profile is keyed on the verified X-Forwarded-Email so a user can
only ever resolve to their own profile (impersonation closed). Null on a
proxy-less / local run (name-keyed). Unique via index (not an inline UNIQUE
column — SQLite can't ADD a UNIQUE column; a unique index allows multiple NULLs
on both SQLite and Postgres).

Revision ID: 0008
Revises: 0007
Create Date: 2026-06-22
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("analysts", sa.Column("email", sa.String(length=255), nullable=True))
    op.create_index("uq_analyst_email", "analysts", ["email"], unique=True)


def downgrade() -> None:
    op.drop_index("uq_analyst_email", table_name="analysts")
    op.drop_column("analysts", "email")
