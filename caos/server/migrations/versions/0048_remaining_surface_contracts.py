"""Remaining-surface context, version and authority contracts.

Revision ID: 0048
Revises: 0047
Create Date: 2026-07-13
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0048"
down_revision: Union[str, None] = "0047"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("analysts", sa.Column("settings_revision", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("analysis_contexts", sa.Column("artifacts", sa.JSON(), nullable=False, server_default="{}"))
    op.add_column("analysis_contexts", sa.Column("surface_state", sa.JSON(), nullable=False, server_default="{}"))
    with op.batch_alter_table("research_jobs", schema=None) as batch_op:
        batch_op.add_column(sa.Column("context_id", sa.String(36), nullable=True))
        batch_op.add_column(sa.Column("authority", sa.JSON(), nullable=False, server_default="{}"))
        batch_op.create_foreign_key(
            "fk_research_jobs_context", "analysis_contexts", ["context_id"], ["id"]
        )
        batch_op.create_index("ix_research_jobs_context_id", ["context_id"])

    op.create_table(
        "source_manifests",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("analyst_id", sa.String(255), nullable=False),
        sa.Column("issuer_id", sa.String(36), sa.ForeignKey("issuers.id"), nullable=False),
        sa.Column("origin", sa.String(24), nullable=False),
        sa.Column("method", sa.String(32), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("files", sa.JSON(), nullable=False),
        sa.Column("authority", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_source_manifests_analyst_id", "source_manifests", ["analyst_id"])
    op.create_index("ix_source_manifests_issuer_id", "source_manifests", ["issuer_id"])
    op.create_index("ix_source_manifests_analyst_created", "source_manifests", ["analyst_id", "created_at"])

    op.create_table(
        "model_checkpoints",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("issuer_id", sa.String(36), sa.ForeignKey("issuers.id"), nullable=False),
        sa.Column("analyst_id", sa.String(255), nullable=False),
        sa.Column("context_id", sa.String(36), sa.ForeignKey("analysis_contexts.id"), nullable=False),
        sa.Column("issuer_run_id", sa.String(64), sa.ForeignKey("runs.id"), nullable=True),
        sa.Column("parent_checkpoint_id", sa.String(36), sa.ForeignKey("model_checkpoints.id"), nullable=True),
        sa.Column("label", sa.String(160), nullable=False),
        sa.Column("payload_hash", sa.String(64), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("authority", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_model_checkpoints_issuer_id", "model_checkpoints", ["issuer_id"])
    op.create_index("ix_model_checkpoints_analyst_id", "model_checkpoints", ["analyst_id"])
    op.create_index("ix_model_checkpoints_analyst_issuer_created", "model_checkpoints", ["analyst_id", "issuer_id", "created_at"])

    op.create_table(
        "report_drafts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("context_id", sa.String(36), sa.ForeignKey("analysis_contexts.id"), nullable=False),
        sa.Column("analyst_id", sa.String(255), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("context_id", "analyst_id", name="uq_report_draft_context_analyst"),
    )
    op.create_index("ix_report_drafts_context_id", "report_drafts", ["context_id"])
    op.create_index("ix_report_drafts_analyst_id", "report_drafts", ["analyst_id"])

    op.create_table(
        "report_versions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("context_id", sa.String(36), sa.ForeignKey("analysis_contexts.id"), nullable=False),
        sa.Column("analyst_id", sa.String(255), nullable=False),
        sa.Column("run_id", sa.String(64), sa.ForeignKey("runs.id"), nullable=False),
        sa.Column("model_checkpoint_id", sa.String(36), sa.ForeignKey("model_checkpoints.id"), nullable=False),
        sa.Column("thesis_version_id", sa.String(36), sa.ForeignKey("thesis_versions.id"), nullable=True),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("document_sha256", sa.String(64), nullable=False),
        sa.Column("authority", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_report_versions_analyst_id", "report_versions", ["analyst_id"])
    op.create_index("ix_report_versions_context_created", "report_versions", ["context_id", "created_at"])

    op.create_table(
        "alert_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("alert_key", sa.String(160), nullable=False),
        sa.Column("context_id", sa.String(36), sa.ForeignKey("analysis_contexts.id"), nullable=True),
        sa.Column("issuer_id", sa.String(36), sa.ForeignKey("issuers.id"), nullable=True),
        sa.Column("run_id", sa.String(64), sa.ForeignKey("runs.id"), nullable=True),
        sa.Column("kind", sa.String(64), nullable=False),
        sa.Column("title", sa.String(240), nullable=False),
        sa.Column("impact", sa.Text(), nullable=False),
        sa.Column("evidence", sa.JSON(), nullable=False),
        sa.Column("authority", sa.JSON(), nullable=False),
        sa.Column("created_by", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("uq_alert_events_alert_key", "alert_events", ["alert_key"], unique=True)
    op.create_index("ix_alert_events_context_id", "alert_events", ["context_id"])
    op.create_index("ix_alert_events_issuer_id", "alert_events", ["issuer_id"])
    op.create_index("ix_alert_events_run_id", "alert_events", ["run_id"])


def downgrade() -> None:
    op.drop_index("ix_alert_events_run_id", table_name="alert_events")
    op.drop_index("ix_alert_events_issuer_id", table_name="alert_events")
    op.drop_index("ix_alert_events_context_id", table_name="alert_events")
    op.drop_index("uq_alert_events_alert_key", table_name="alert_events")
    op.drop_table("alert_events")
    op.drop_index("ix_report_versions_context_created", table_name="report_versions")
    op.drop_index("ix_report_versions_analyst_id", table_name="report_versions")
    op.drop_table("report_versions")
    op.drop_index("ix_report_drafts_analyst_id", table_name="report_drafts")
    op.drop_index("ix_report_drafts_context_id", table_name="report_drafts")
    op.drop_table("report_drafts")
    op.drop_index("ix_model_checkpoints_analyst_issuer_created", table_name="model_checkpoints")
    op.drop_index("ix_model_checkpoints_analyst_id", table_name="model_checkpoints")
    op.drop_index("ix_model_checkpoints_issuer_id", table_name="model_checkpoints")
    op.drop_table("model_checkpoints")
    op.drop_index("ix_source_manifests_analyst_created", table_name="source_manifests")
    op.drop_index("ix_source_manifests_issuer_id", table_name="source_manifests")
    op.drop_index("ix_source_manifests_analyst_id", table_name="source_manifests")
    op.drop_table("source_manifests")
    with op.batch_alter_table("research_jobs", schema=None) as batch_op:
        batch_op.drop_index("ix_research_jobs_context_id")
        batch_op.drop_constraint("fk_research_jobs_context", type_="foreignkey")
        batch_op.drop_column("authority")
        batch_op.drop_column("context_id")
    op.drop_column("analysis_contexts", "surface_state")
    op.drop_column("analysis_contexts", "artifacts")
    op.drop_column("analysts", "settings_revision")
