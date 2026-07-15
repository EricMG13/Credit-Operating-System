"""Add analyst-scoped, idempotent lineage v2 metadata.

Revision ID: 0052
Revises: 0051
Create Date: 2026-07-13
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0052"
down_revision: Union[str, None] = "0051"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("lineage_edges") as batch:
        batch.add_column(sa.Column("context_id", sa.String(36), nullable=True))
        batch.add_column(sa.Column("analyst_id", sa.String(255), nullable=True))
        batch.add_column(sa.Column("artifact_kind", sa.String(32), nullable=True))
        batch.add_column(sa.Column("artifact_version", sa.String(64), nullable=True))
        batch.add_column(sa.Column("parent_kind", sa.String(32), nullable=True))
        batch.add_column(sa.Column("parent_version", sa.String(64), nullable=True))
        batch.add_column(sa.Column("v2_idempotency_key", sa.String(64), nullable=True))
        batch.create_foreign_key(
            "fk_lineage_edges_context_id", "analysis_contexts", ["context_id"], ["id"],
            ondelete="CASCADE",
        )
        batch.create_unique_constraint(
            "uq_lineage_edges_v2_idempotency_key", ["v2_idempotency_key"]
        )
        batch.create_index("ix_lineage_edges_analyst_id", ["analyst_id"])
        batch.create_index(
            "ix_lineage_edges_context_created", ["context_id", "created_at"]
        )


def downgrade() -> None:
    with op.batch_alter_table("lineage_edges") as batch:
        batch.drop_index("ix_lineage_edges_context_created")
        batch.drop_index("ix_lineage_edges_analyst_id")
        batch.drop_constraint("uq_lineage_edges_v2_idempotency_key", type_="unique")
        batch.drop_constraint("fk_lineage_edges_context_id", type_="foreignkey")
        batch.drop_column("v2_idempotency_key")
        batch.drop_column("parent_version")
        batch.drop_column("parent_kind")
        batch.drop_column("artifact_version")
        batch.drop_column("artifact_kind")
        batch.drop_column("analyst_id")
        batch.drop_column("context_id")
