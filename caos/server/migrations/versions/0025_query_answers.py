"""query_answers — persisted grounded AI answers for typed Query questions (Q2/D2)

Retrieval-grounded prose written beside the deterministic walk; kept sentences
cite real chunks and state only grounded figures. Cached by
``(question_hash, data_fingerprint)`` so a repeat question over an unchanged
corpus is free.

Revision ID: 0025
Revises: 0024
Create Date: 2026-07-04
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0025"
down_revision: Union[str, None] = "0024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "query_answers",
        sa.Column("id", sa.String(length=36), primary_key=True),
        # NOT NULL where the model column is non-Optional (payload, created_at) so
        # these tables are drift-free under `alembic check`.
        sa.Column("question_hash", sa.String(length=64), nullable=False, index=True),
        sa.Column("data_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("model", sa.String(length=128), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("analyst_id", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("query_answers")
