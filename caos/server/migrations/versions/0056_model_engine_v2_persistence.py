"""Add Model Engine v2 drafts, override audit, and workbook import ledger.

Revision ID: 0056
Revises: 0055
Create Date: 2026-07-14

The legacy ``saved_models`` table remains intact as the feature-flag rollback
path.  V2 rows are additive and analyst-owned; checkpoints gain nullable
fingerprints so legacy snapshots remain readable without fabricated authority.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0056"
down_revision: Union[str, None] = "0055"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "model_drafts_v2",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("issuer_id", sa.String(36), sa.ForeignKey("issuers.id"), nullable=False),
        sa.Column("analyst_id", sa.String(255), nullable=False),
        sa.Column(
            "context_id",
            sa.String(36),
            sa.ForeignKey("analysis_contexts.id"),
            nullable=True,
        ),
        sa.Column("source_run_id", sa.String(64), sa.ForeignKey("runs.id"), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("calculation", sa.JSON(), nullable=False),
        sa.Column("source_fingerprint", sa.String(64), nullable=False),
        sa.Column("input_fingerprint", sa.String(64), nullable=False),
        sa.Column("engine_version", sa.String(32), nullable=False),
        sa.Column("calculation_hash", sa.String(64), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "issuer_id", "analyst_id", name="uq_model_draft_v2_issuer_analyst"
        ),
    )
    op.create_index("ix_model_drafts_v2_issuer_id", "model_drafts_v2", ["issuer_id"])
    op.create_index("ix_model_drafts_v2_analyst_id", "model_drafts_v2", ["analyst_id"])
    op.create_index("ix_model_drafts_v2_context_id", "model_drafts_v2", ["context_id"])
    op.create_index(
        "ix_model_drafts_v2_source_run_id", "model_drafts_v2", ["source_run_id"]
    )
    op.create_index(
        "ix_model_drafts_v2_analyst_updated",
        "model_drafts_v2",
        ["analyst_id", "updated_at"],
    )

    op.create_table(
        "model_override_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "draft_id",
            sa.String(36),
            sa.ForeignKey("model_drafts_v2.id"),
            nullable=False,
        ),
        sa.Column("issuer_id", sa.String(36), sa.ForeignKey("issuers.id"), nullable=False),
        sa.Column("analyst_id", sa.String(255), nullable=False),
        sa.Column("action", sa.String(24), nullable=False),
        sa.Column("node_id", sa.String(300), nullable=False),
        sa.Column("value_type", sa.String(16), nullable=False),
        sa.Column("before_value", sa.JSON(), nullable=True),
        sa.Column("after_value", sa.JSON(), nullable=True),
        sa.Column("original_formula", sa.Text(), nullable=True),
        sa.Column("original_value", sa.JSON(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("scope", sa.String(64), nullable=False),
        sa.Column("source", sa.String(240), nullable=True),
        sa.Column("actor_id", sa.String(255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column(
            "inverse_event_id",
            sa.String(36),
            sa.ForeignKey("model_override_events.id"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_model_override_events_draft_id", "model_override_events", ["draft_id"]
    )
    op.create_index(
        "ix_model_override_events_issuer_id", "model_override_events", ["issuer_id"]
    )
    op.create_index(
        "ix_model_override_events_analyst_id", "model_override_events", ["analyst_id"]
    )
    op.create_index(
        "ix_model_override_events_draft_revision",
        "model_override_events",
        ["draft_id", "revision"],
    )
    op.create_index(
        "ix_model_override_events_analyst_created",
        "model_override_events",
        ["analyst_id", "created_at"],
    )

    with op.batch_alter_table("model_checkpoints", schema=None) as batch_op:
        batch_op.add_column(sa.Column("engine_version", sa.String(32), nullable=True))
        batch_op.add_column(sa.Column("source_fingerprint", sa.String(64), nullable=True))
        batch_op.add_column(sa.Column("input_fingerprint", sa.String(64), nullable=True))
        batch_op.add_column(sa.Column("calculation_hash", sa.String(64), nullable=True))
        batch_op.add_column(sa.Column("draft_revision", sa.Integer(), nullable=True))

    with op.batch_alter_table("report_versions", schema=None) as batch_op:
        batch_op.add_column(sa.Column("model_engine_version", sa.String(32), nullable=True))
        batch_op.add_column(sa.Column("model_source_fingerprint", sa.String(64), nullable=True))
        batch_op.add_column(sa.Column("model_input_fingerprint", sa.String(64), nullable=True))
        batch_op.add_column(sa.Column("model_calculation_hash", sa.String(64), nullable=True))
        batch_op.add_column(sa.Column("model_draft_revision", sa.Integer(), nullable=True))

    op.create_table(
        "model_workbook_imports",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("analyst_id", sa.String(255), nullable=False),
        sa.Column("issuer_id", sa.String(36), sa.ForeignKey("issuers.id"), nullable=False),
        sa.Column(
            "draft_id",
            sa.String(36),
            sa.ForeignKey("model_drafts_v2.id"),
            nullable=False,
        ),
        sa.Column(
            "document_id", sa.String(36), sa.ForeignKey("documents.id"), nullable=False
        ),
        sa.Column(
            "source_manifest_id",
            sa.String(36),
            sa.ForeignKey("source_manifests.id"),
            nullable=False,
        ),
        sa.Column("workbook_sha256", sa.String(64), nullable=False),
        sa.Column("mapping", sa.JSON(), nullable=False),
        sa.Column("issues", sa.JSON(), nullable=False),
        sa.Column("committed_revision", sa.Integer(), nullable=False),
        sa.Column("calculation_hash", sa.String(64), nullable=False),
        sa.Column("committed_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_model_workbook_imports_analyst_id", "model_workbook_imports", ["analyst_id"]
    )
    op.create_index(
        "ix_model_workbook_imports_issuer_id", "model_workbook_imports", ["issuer_id"]
    )
    op.create_index(
        "ix_model_workbook_imports_draft_id", "model_workbook_imports", ["draft_id"]
    )
    op.create_index(
        "ix_model_workbook_imports_document_id", "model_workbook_imports", ["document_id"]
    )
    op.create_index(
        "ix_model_workbook_imports_source_manifest_id",
        "model_workbook_imports",
        ["source_manifest_id"],
    )
    op.create_index(
        "ix_model_workbook_imports_workbook_sha256",
        "model_workbook_imports",
        ["workbook_sha256"],
    )
    op.create_index(
        "ix_model_workbook_imports_analyst_committed",
        "model_workbook_imports",
        ["analyst_id", "committed_at"],
    )
    op.create_index(
        "ix_model_workbook_imports_draft_revision",
        "model_workbook_imports",
        ["draft_id", "committed_revision"],
    )


def downgrade() -> None:
    """Drop only an empty V2 schema; feature flags are the live rollback path."""
    connection = op.get_bind()
    private_rows = connection.execute(sa.text("""
        SELECT
            (SELECT COUNT(*) FROM model_drafts_v2)
          + (SELECT COUNT(*) FROM model_override_events)
          + (SELECT COUNT(*) FROM model_workbook_imports)
    """)).scalar_one()
    checkpoint_rows = connection.execute(sa.text("""
        SELECT COUNT(*)
        FROM model_checkpoints
        WHERE engine_version IS NOT NULL
           OR source_fingerprint IS NOT NULL
           OR input_fingerprint IS NOT NULL
           OR calculation_hash IS NOT NULL
           OR draft_revision IS NOT NULL
    """)).scalar_one()
    report_rows = connection.execute(sa.text("""
        SELECT COUNT(*)
        FROM report_versions
        WHERE model_engine_version IS NOT NULL
           OR model_source_fingerprint IS NOT NULL
           OR model_input_fingerprint IS NOT NULL
           OR model_calculation_hash IS NOT NULL
           OR model_draft_revision IS NOT NULL
    """)).scalar_one()
    if private_rows or checkpoint_rows or report_rows:
        raise RuntimeError(
            "0056 downgrade refused: disable CAOS_MODEL_ENGINE_V2_ENABLED and retain model-v2 evidence"
        )

    op.drop_index(
        "ix_model_workbook_imports_draft_revision", table_name="model_workbook_imports"
    )
    op.drop_index(
        "ix_model_workbook_imports_analyst_committed", table_name="model_workbook_imports"
    )
    op.drop_index(
        "ix_model_workbook_imports_workbook_sha256", table_name="model_workbook_imports"
    )
    op.drop_index(
        "ix_model_workbook_imports_source_manifest_id", table_name="model_workbook_imports"
    )
    op.drop_index(
        "ix_model_workbook_imports_document_id", table_name="model_workbook_imports"
    )
    op.drop_index("ix_model_workbook_imports_draft_id", table_name="model_workbook_imports")
    op.drop_index("ix_model_workbook_imports_issuer_id", table_name="model_workbook_imports")
    op.drop_index("ix_model_workbook_imports_analyst_id", table_name="model_workbook_imports")
    op.drop_table("model_workbook_imports")

    with op.batch_alter_table("report_versions", schema=None) as batch_op:
        batch_op.drop_column("model_draft_revision")
        batch_op.drop_column("model_calculation_hash")
        batch_op.drop_column("model_input_fingerprint")
        batch_op.drop_column("model_source_fingerprint")
        batch_op.drop_column("model_engine_version")

    with op.batch_alter_table("model_checkpoints", schema=None) as batch_op:
        batch_op.drop_column("draft_revision")
        batch_op.drop_column("calculation_hash")
        batch_op.drop_column("input_fingerprint")
        batch_op.drop_column("source_fingerprint")
        batch_op.drop_column("engine_version")

    op.drop_index(
        "ix_model_override_events_analyst_created", table_name="model_override_events"
    )
    op.drop_index(
        "ix_model_override_events_draft_revision", table_name="model_override_events"
    )
    op.drop_index("ix_model_override_events_analyst_id", table_name="model_override_events")
    op.drop_index("ix_model_override_events_issuer_id", table_name="model_override_events")
    op.drop_index("ix_model_override_events_draft_id", table_name="model_override_events")
    op.drop_table("model_override_events")

    op.drop_index("ix_model_drafts_v2_analyst_updated", table_name="model_drafts_v2")
    op.drop_index("ix_model_drafts_v2_source_run_id", table_name="model_drafts_v2")
    op.drop_index("ix_model_drafts_v2_context_id", table_name="model_drafts_v2")
    op.drop_index("ix_model_drafts_v2_analyst_id", table_name="model_drafts_v2")
    op.drop_index("ix_model_drafts_v2_issuer_id", table_name="model_drafts_v2")
    op.drop_table("model_drafts_v2")
