"""metric_facts.basis — reported vs adjusted EBITDA basis

EDGAR-derived leverage/EBITDA is on a reported GAAP basis; seed/LLM values are
covenant-adjusted. Tagging the basis lets the cross-issuer query avoid ranking
them against each other as if equivalent, and surface a caveat when they mix.

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-15
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("metric_facts", sa.Column("basis", sa.String(24), nullable=True))


def downgrade() -> None:
    op.drop_column("metric_facts", "basis")
