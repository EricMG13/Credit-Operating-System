"""create analyst_links table

Revision ID: 0016
Revises: 0015
Create Date: 2026-06-28
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "analyst_links",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("source_note", sa.String(length=255), nullable=False),
        sa.Column("target_issuer_id", sa.String(length=36), nullable=False),
        sa.Column("excerpt", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["target_issuer_id"], ["issuers.id"]),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_index(
        op.f("ix_analyst_links_target_issuer_id"),
        "analyst_links",
        ["target_issuer_id"],
        unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_analyst_links_target_issuer_id"), table_name="analyst_links")
    op.drop_table("analyst_links")
