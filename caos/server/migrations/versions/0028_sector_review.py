"""sector review substrate

Revision ID: 0028
Revises: 0027
Create Date: 2026-07-06
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0028"
down_revision: Union[str, None] = "0027"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sector_signals",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("sector", sa.String(length=128), nullable=False),
        sa.Column("issuer_id", sa.String(length=36), sa.ForeignKey("issuers.id"), nullable=True),
        sa.Column("issuer_name", sa.String(length=255), nullable=True),
        sa.Column("headline", sa.String(length=255), nullable=False),
        sa.Column("body_excerpt", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False),
        sa.Column("materiality_score", sa.Float(), nullable=False),
        sa.Column("source_type", sa.String(length=32), nullable=False),
        sa.Column("source_ref", sa.String(length=255), nullable=False),
        sa.Column("source_title", sa.String(length=255), nullable=False),
        sa.Column("source_url", sa.String(length=1024), nullable=True),
        sa.Column("source_tier", sa.String(length=32), nullable=False),
        sa.Column("dedup_hash", sa.String(length=64), nullable=False),
        sa.Column("signal_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("event_date", sa.String(length=32), nullable=True),
        sa.Column("provenance", sa.String(length=16), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("dedup_hash", name="uq_sector_signals_dedup_hash"),
    )
    op.create_index("ix_sector_signals_issuer_id", "sector_signals", ["issuer_id"])
    op.create_index("ix_sector_signals_sector_date", "sector_signals", ["sector", "signal_date"])
    op.create_index("ix_sector_signals_category_severity", "sector_signals", ["category", "severity"])

    op.create_table(
        "sector_review_runs",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("sector", sa.String(length=128), nullable=False),
        sa.Column("timeframe", sa.String(length=32), nullable=False),
        sa.Column("as_of", sa.DateTime(timezone=True), nullable=False),
        sa.Column("posture", sa.String(length=32), nullable=False),
        sa.Column("confidence", sa.JSON(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("input_signal_ids", sa.JSON(), nullable=False),
        sa.Column("analyst_id", sa.String(length=255), nullable=True),
        sa.Column("refresh_trigger", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("provenance", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_sector_review_runs_analyst_id", "sector_review_runs", ["analyst_id"])
    op.create_index("ix_sector_review_runs_sector_as_of", "sector_review_runs", ["sector", "as_of"])

    op.create_table(
        "analyst_sector_feeds",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("analyst_id", sa.String(length=255), nullable=False),
        sa.Column("sector", sa.String(length=128), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("notify_pref", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("analyst_id", "sector", name="uq_analyst_sector_feed"),
    )
    op.create_index("ix_analyst_sector_feeds_analyst_id", "analyst_sector_feeds", ["analyst_id"])


def downgrade() -> None:
    op.drop_index("ix_analyst_sector_feeds_analyst_id", "analyst_sector_feeds")
    op.drop_table("analyst_sector_feeds")

    op.drop_index("ix_sector_review_runs_sector_as_of", "sector_review_runs")
    op.drop_index("ix_sector_review_runs_analyst_id", "sector_review_runs")
    op.drop_table("sector_review_runs")

    op.drop_index("ix_sector_signals_category_severity", "sector_signals")
    op.drop_index("ix_sector_signals_sector_date", "sector_signals")
    op.drop_index("ix_sector_signals_issuer_id", "sector_signals")
    op.drop_table("sector_signals")
