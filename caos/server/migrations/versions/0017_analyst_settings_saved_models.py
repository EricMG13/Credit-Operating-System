"""analyst profile fields and saved models

Revision ID: 0017
Revises: 0016
Create Date: 2026-06-28
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("analysts", sa.Column("coverage_area", sa.String(length=64), nullable=True))
    op.add_column("analysts", sa.Column("location", sa.String(length=16), nullable=True))
    op.add_column("analysts", sa.Column("recovery_word_hashes", sa.JSON(), nullable=False, server_default="[]"))
    op.add_column("analysts", sa.Column("recovery_hints", sa.JSON(), nullable=False, server_default="[]"))
    op.add_column("analysts", sa.Column("settings", sa.JSON(), nullable=False, server_default="{}"))
    op.create_table(
        "saved_models",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("issuer_id", sa.String(length=36), nullable=False),
        sa.Column("analyst_id", sa.String(length=255), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["issuer_id"], ["issuers.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("issuer_id", "analyst_id", name="uq_saved_model_issuer_analyst"),
    )
    op.create_index(op.f("ix_saved_models_issuer_id"), "saved_models", ["issuer_id"], unique=False)
    op.create_index(op.f("ix_saved_models_analyst_id"), "saved_models", ["analyst_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_saved_models_analyst_id"), table_name="saved_models")
    op.drop_index(op.f("ix_saved_models_issuer_id"), table_name="saved_models")
    op.drop_table("saved_models")
    op.drop_column("analysts", "settings")
    op.drop_column("analysts", "recovery_hints")
    op.drop_column("analysts", "recovery_word_hashes")
    op.drop_column("analysts", "location")
    op.drop_column("analysts", "coverage_area")
