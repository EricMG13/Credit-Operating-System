"""issuers.rating_* — agency credit ratings (S&P / Moody's / Fitch)

Agency ratings are a fundamental issuer attribute on a credit desk but there is no
free ratings feed (no-paid-services), so they are analyst-entered rather than
ingested. Three nullable short strings (e.g. "B+", "B2", "BB-"); NULL = not rated
/ no rating on file. Surfaced in the issuer profile header.

Revision ID: 0014
Revises: 0013
Create Date: 2026-06-27
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("issuers", sa.Column("rating_sp", sa.String(length=16), nullable=True))
    op.add_column("issuers", sa.Column("rating_moody", sa.String(length=16), nullable=True))
    op.add_column("issuers", sa.Column("rating_fitch", sa.String(length=16), nullable=True))


def downgrade() -> None:
    op.drop_column("issuers", "rating_fitch")
    op.drop_column("issuers", "rating_moody")
    op.drop_column("issuers", "rating_sp")
