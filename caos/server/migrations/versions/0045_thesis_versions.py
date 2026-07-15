"""Versioned thesis memory and predictions.

Revision ID: 0045
Revises: 0044
Create Date: 2026-07-12
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0045"
down_revision: Union[str, None] = "0044"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "thesis_versions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("issuer_id", sa.String(36), sa.ForeignKey("issuers.id"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("thesis_md", sa.Text(), nullable=False),
        sa.Column("trigger", sa.String(24), nullable=False),
        sa.Column("linked_decision_id", sa.String(36), sa.ForeignKey("decisions.id"), nullable=True),
        sa.Column("linked_alert_key", sa.String(160), nullable=True),
        sa.Column("created_by", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("issuer_id", "version", name="uq_thesis_issuer_version"),
    )
    op.create_index("ix_thesis_versions_issuer_id", "thesis_versions", ["issuer_id"])
    op.create_index("ix_thesis_versions_linked_decision_id", "thesis_versions", ["linked_decision_id"])
    op.create_index("ix_thesis_versions_created_by", "thesis_versions", ["created_by"])
    op.create_table(
        "thesis_predictions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("thesis_version_id", sa.String(36), sa.ForeignKey("thesis_versions.id"), nullable=False),
        sa.Column("metric", sa.String(120), nullable=False),
        sa.Column("horizon", sa.Date(), nullable=False),
        sa.Column("predicted", sa.Float(), nullable=False),
        sa.Column("realized", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_thesis_predictions_thesis_version_id", "thesis_predictions", ["thesis_version_id"])


def downgrade() -> None:
    op.drop_index("ix_thesis_predictions_thesis_version_id", table_name="thesis_predictions")
    op.drop_table("thesis_predictions")
    op.drop_index("ix_thesis_versions_created_by", table_name="thesis_versions")
    op.drop_index("ix_thesis_versions_linked_decision_id", table_name="thesis_versions")
    op.drop_index("ix_thesis_versions_issuer_id", table_name="thesis_versions")
    op.drop_table("thesis_versions")
