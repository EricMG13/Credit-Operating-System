"""analysts.token_version — per-analyst session-revocation epoch

Signed into the caos_analyst cookie at mint; a logout bumps the row's version so
every existing token for that analyst stops validating (identity.get_identity
compares token vs row on each request). server_default "0" so existing rows — and
in-flight legacy tokens that carry no version — line up at 0 until the first
logout.

Revision ID: 0011
Revises: 0010
Create Date: 2026-06-25
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "analysts",
        sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("analysts", "token_version")
