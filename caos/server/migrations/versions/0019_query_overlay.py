"""query_overlays — persisted model-overlay artifacts for the Query concept

Revision ID: 0019
Revises: 0018
Create Date: 2026-07-02
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0019"
down_revision: Union[str, None] = "0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "query_overlays",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("capability_id", sa.String(length=64), nullable=False, index=True),
        sa.Column("issuer_id", sa.String(length=36), nullable=True),
        sa.Column("graph_hash", sa.String(length=64), nullable=False, index=True),
        sa.Column("model", sa.String(length=128), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("analyst_id", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("query_overlays")
