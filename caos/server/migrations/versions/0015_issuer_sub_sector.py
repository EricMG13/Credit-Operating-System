"""issuers.sub_sector

Revision ID: 0015
Revises: 0014
Create Date: 2026-06-27
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("issuers", sa.Column("sub_sector", sa.String(length=128), nullable=True))


def downgrade() -> None:
    op.drop_column("issuers", "sub_sector")
