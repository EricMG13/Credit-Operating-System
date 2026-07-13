"""Persist shared, cited analysis insight versions.

Revision ID: 0049
Revises: 0048
Create Date: 2026-07-13
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0049"
down_revision: Union[str, None] = "0048"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "analysis_insights",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("analyst_id", sa.String(255), nullable=False),
        sa.Column("context_id", sa.String(36), sa.ForeignKey("analysis_contexts.id"), nullable=False),
        sa.Column("surface", sa.String(32), nullable=False),
        sa.Column("kind", sa.String(64), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("subject_refs", sa.JSON(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("claims", sa.JSON(), nullable=False),
        sa.Column("recommended_actions", sa.JSON(), nullable=False),
        sa.Column("missing_dependencies", sa.JSON(), nullable=False),
        sa.Column("authority", sa.JSON(), nullable=False),
        sa.Column("source_fingerprint", sa.String(64), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("model", sa.String(128), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ratified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("lease_owner", sa.String(64), nullable=True),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint(
            "analyst_id", "context_id", "surface", "kind", "source_fingerprint", "version",
            name="uq_analysis_insight_generation",
        ),
    )
    op.create_index("ix_analysis_insights_analyst_id", "analysis_insights", ["analyst_id"])
    op.create_index("ix_analysis_insights_source_fingerprint", "analysis_insights", ["source_fingerprint"])
    op.create_index(
        "ix_analysis_insights_context_generated", "analysis_insights", ["context_id", "generated_at"]
    )
    op.create_index(
        "ix_analysis_insights_analyst_status", "analysis_insights", ["analyst_id", "status"]
    )


def downgrade() -> None:
    op.drop_index("ix_analysis_insights_analyst_status", table_name="analysis_insights")
    op.drop_index("ix_analysis_insights_context_generated", table_name="analysis_insights")
    op.drop_index("ix_analysis_insights_source_fingerprint", table_name="analysis_insights")
    op.drop_index("ix_analysis_insights_analyst_id", table_name="analysis_insights")
    op.drop_table("analysis_insights")
