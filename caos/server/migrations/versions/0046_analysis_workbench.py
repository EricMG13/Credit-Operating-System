"""Shared analysis contexts, findings, taxonomy and versioned route runs.

Revision ID: 0046
Revises: 0045
Create Date: 2026-07-13
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0046"
down_revision: Union[str, None] = "0045"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sector_taxonomy",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("label", sa.String(128), nullable=False, unique=True),
        sa.Column("aliases", sa.JSON(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "analysis_contexts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("analyst_id", sa.String(255), nullable=False),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("sector_id", sa.String(64), sa.ForeignKey("sector_taxonomy.id"), nullable=True),
        sa.Column("sub_segments", sa.JSON(), nullable=False),
        sa.Column("issuer_ids", sa.JSON(), nullable=False),
        sa.Column("instrument_ids", sa.JSON(), nullable=False),
        sa.Column("portfolio_scope", sa.String(128), nullable=True),
        sa.Column("as_of", sa.Date(), nullable=True),
        sa.Column("sector_review_run_id", sa.String(64), nullable=True),
        sa.Column("rv_snapshot_id", sa.String(36), nullable=True),
        sa.Column("rv_run_id", sa.String(36), nullable=True),
        sa.Column("query_session_id", sa.String(36), nullable=True),
        sa.Column("filters", sa.JSON(), nullable=False),
        sa.Column("selected", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_analysis_contexts_analyst_id", "analysis_contexts", ["analyst_id"])
    op.create_index(
        "ix_analysis_contexts_analyst_updated", "analysis_contexts", ["analyst_id", "updated_at"]
    )
    op.create_table(
        "analysis_findings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("analyst_id", sa.String(255), nullable=False),
        sa.Column("context_id", sa.String(36), sa.ForeignKey("analysis_contexts.id"), nullable=False),
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("title", sa.String(240), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("source_surface", sa.String(32), nullable=False),
        sa.Column("source_run_id", sa.String(64), nullable=True),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("evidence", sa.JSON(), nullable=False),
        sa.Column("authority", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_analysis_findings_analyst_id", "analysis_findings", ["analyst_id"])
    op.create_index("ix_analysis_findings_context_created", "analysis_findings", ["context_id", "created_at"])
    op.create_index("ix_analysis_findings_analyst_status", "analysis_findings", ["analyst_id", "status"])
    op.create_table(
        "analysis_query_runs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("analyst_id", sa.String(255), nullable=False),
        sa.Column("context_id", sa.String(36), sa.ForeignKey("analysis_contexts.id"), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("selected_lane", sa.String(24), nullable=False),
        sa.Column("method_override", sa.String(64), nullable=True),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("result", sa.JSON(), nullable=False),
        sa.Column("authority", sa.JSON(), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_analysis_query_runs_analyst_id", "analysis_query_runs", ["analyst_id"])
    op.create_index("ix_analysis_query_runs_context_created", "analysis_query_runs", ["context_id", "created_at"])
    op.create_table(
        "market_snapshots",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("as_of", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source_label", sa.String(160), nullable=False),
        sa.Column("origin", sa.String(24), nullable=False),
        sa.Column("method", sa.String(32), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("payload_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "market_instruments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("snapshot_id", sa.String(36), sa.ForeignKey("market_snapshots.id"), nullable=False),
        sa.Column("instrument_key", sa.String(160), nullable=False),
        sa.Column("figi", sa.String(32), nullable=True),
        sa.Column("issuer_id", sa.String(36), sa.ForeignKey("issuers.id"), nullable=True),
        sa.Column("borrower", sa.String(255), nullable=False),
        sa.Column("sector_id", sa.String(64), sa.ForeignKey("sector_taxonomy.id"), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("snapshot_id", "instrument_key", name="uq_market_snapshot_instrument"),
    )
    op.create_index("ix_market_instruments_snapshot_figi", "market_instruments", ["snapshot_id", "figi"])
    op.create_table(
        "rv_screen_runs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("analyst_id", sa.String(255), nullable=False),
        sa.Column("context_id", sa.String(36), sa.ForeignKey("analysis_contexts.id"), nullable=False),
        sa.Column("snapshot_id", sa.String(36), sa.ForeignKey("market_snapshots.id"), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("filters", sa.JSON(), nullable=False),
        sa.Column("result", sa.JSON(), nullable=False),
        sa.Column("authority", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_rv_screen_runs_analyst_id", "rv_screen_runs", ["analyst_id"])
    op.create_index("ix_rv_screen_runs_context_created", "rv_screen_runs", ["context_id", "created_at"])
    op.create_table(
        "rv_candidates",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("run_id", sa.String(36), sa.ForeignKey("rv_screen_runs.id"), nullable=False),
        sa.Column("instrument_id", sa.String(36), sa.ForeignKey("market_instruments.id"), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column("classification", sa.String(24), nullable=False),
        sa.Column("missing_gates", sa.JSON(), nullable=False),
        sa.Column("pitch", sa.JSON(), nullable=False),
        sa.Column("evidence", sa.JSON(), nullable=False),
        sa.Column("portfolio_impact", sa.JSON(), nullable=False),
        sa.Column("analyst_override", sa.JSON(), nullable=True),
        sa.Column("ratified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("run_id", "instrument_id", name="uq_rv_run_instrument"),
    )
    op.create_index("ix_rv_candidates_run_classification", "rv_candidates", ["run_id", "classification"])
    op.create_table(
        "sector_review_ratifications",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("review_run_id", sa.String(64), sa.ForeignKey("sector_review_runs.id"), nullable=False),
        sa.Column("analyst_id", sa.String(255), nullable=False),
        sa.Column("section_id", sa.String(64), nullable=False),
        sa.Column("decision", sa.String(24), nullable=False),
        sa.Column("override_text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "review_run_id", "analyst_id", "section_id", name="uq_sector_review_ratification"
        ),
    )
    op.create_index(
        "ix_sector_review_ratifications_analyst_id", "sector_review_ratifications", ["analyst_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_sector_review_ratifications_analyst_id", table_name="sector_review_ratifications")
    op.drop_table("sector_review_ratifications")
    op.drop_index("ix_rv_candidates_run_classification", table_name="rv_candidates")
    op.drop_table("rv_candidates")
    op.drop_index("ix_rv_screen_runs_context_created", table_name="rv_screen_runs")
    op.drop_index("ix_rv_screen_runs_analyst_id", table_name="rv_screen_runs")
    op.drop_table("rv_screen_runs")
    op.drop_index("ix_market_instruments_snapshot_figi", table_name="market_instruments")
    op.drop_table("market_instruments")
    op.drop_table("market_snapshots")
    op.drop_index("ix_analysis_query_runs_context_created", table_name="analysis_query_runs")
    op.drop_index("ix_analysis_query_runs_analyst_id", table_name="analysis_query_runs")
    op.drop_table("analysis_query_runs")
    op.drop_index("ix_analysis_findings_analyst_status", table_name="analysis_findings")
    op.drop_index("ix_analysis_findings_context_created", table_name="analysis_findings")
    op.drop_index("ix_analysis_findings_analyst_id", table_name="analysis_findings")
    op.drop_table("analysis_findings")
    op.drop_index("ix_analysis_contexts_analyst_updated", table_name="analysis_contexts")
    op.drop_index("ix_analysis_contexts_analyst_id", table_name="analysis_contexts")
    op.drop_table("analysis_contexts")
    op.drop_table("sector_taxonomy")
