"""Add source-aware freshness metadata and issuer reporting profiles.

Revision ID: 0053
Revises: 0052
Create Date: 2026-07-14
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0053"
down_revision: Union[str, None] = "0052"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("issuers") as batch:
        batch.add_column(sa.Column("ratings_observed_at", sa.DateTime(timezone=True), nullable=True))
    with op.batch_alter_table("documents") as batch:
        batch.add_column(sa.Column("source_kind", sa.String(32), nullable=True))
        batch.add_column(sa.Column("effective_period_end", sa.Date(), nullable=True))
        batch.add_column(sa.Column("source_published_at", sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        "issuer_reporting_profiles",
        sa.Column("issuer_id", sa.String(36), nullable=False),
        sa.Column("cadence", sa.String(16), nullable=False, server_default="unknown"),
        sa.Column("fiscal_year_end_month", sa.Integer(), nullable=True),
        sa.Column("fiscal_year_end_day", sa.Integer(), nullable=True),
        sa.Column("reporting_lag_days", sa.Integer(), nullable=True),
        sa.Column("grace_days", sa.Integer(), nullable=False, server_default="7"),
        sa.Column("authority", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("updated_by", sa.String(255), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["issuer_id"], ["issuers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("issuer_id"),
    )


def downgrade() -> None:
    op.drop_table("issuer_reporting_profiles")
    with op.batch_alter_table("documents") as batch:
        batch.drop_column("source_published_at")
        batch.drop_column("effective_period_end")
        batch.drop_column("source_kind")
    with op.batch_alter_table("issuers") as batch:
        batch.drop_column("ratings_observed_at")
