"""query_insights — persisted proactive AI Desk Brief for the Query concept (Q1)

The insights lane builds a deterministic evidence pack, has the model write cited
cards over it, and persists the validated survivors. ``data_fingerprint`` keys
freshness so an unchanged book is never regenerated (≤1 LLM call / 24h).

Revision ID: 0024
Revises: 0023
Create Date: 2026-07-04
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0024"
down_revision: Union[str, None] = "0023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "query_insights",
        sa.Column("id", sa.String(length=36), primary_key=True),
        # NOT NULL where the model column is non-Optional (payload, generated_at) so
        # these tables are drift-free under `alembic check` — they don't reproduce
        # the pre-existing query_overlays nullability drift.
        sa.Column("data_fingerprint", sa.String(length=64), nullable=False, index=True),
        sa.Column("model", sa.String(length=128), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("analyst_id", sa.String(length=255), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("query_insights")
