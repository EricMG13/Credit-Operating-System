"""Add analyst opinion, governed exception, and research figure storage.

Revision ID: 0063
Revises: 0062
Create Date: 2026-07-17
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0063"
down_revision: Union[str, None] = "0062"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "analyst_opinion_versions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("analyst_id", sa.String(255), nullable=False),
        sa.Column("issuer_id", sa.String(36), sa.ForeignKey("issuers.id"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("stance", sa.String(16), nullable=False),
        sa.Column("conviction", sa.Float(), nullable=True),
        sa.Column("rationale_md", sa.Text(), nullable=False),
        sa.Column("evidence_state", sa.String(16), nullable=False),
        sa.Column("unresolved_items", sa.JSON(), nullable=False),
        sa.Column("thesis_version_id", sa.String(36), sa.ForeignKey("thesis_versions.id"), nullable=True),
        sa.Column("source_run_id", sa.String(36), sa.ForeignKey("runs.id"), nullable=True),
        sa.Column("context_id", sa.String(36), sa.ForeignKey("analysis_contexts.id"), nullable=True),
        sa.Column("analyst_link_ids", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("analyst_id", "issuer_id", "version", name="uq_analyst_opinion_issuer_version"),
    )
    op.create_index("ix_analyst_opinion_versions_analyst_id", "analyst_opinion_versions", ["analyst_id"])
    op.create_index("ix_analyst_opinion_versions_issuer_id", "analyst_opinion_versions", ["issuer_id"])
    op.create_index("ix_analyst_opinion_versions_thesis_version_id", "analyst_opinion_versions", ["thesis_version_id"])
    op.create_index("ix_analyst_opinion_versions_source_run_id", "analyst_opinion_versions", ["source_run_id"])
    op.create_index("ix_analyst_opinion_versions_context_id", "analyst_opinion_versions", ["context_id"])
    op.create_index("ix_analyst_opinion_issuer_created", "analyst_opinion_versions", ["issuer_id", "created_at"])
    op.create_index("ix_analyst_opinion_analyst_issuer", "analyst_opinion_versions", ["analyst_id", "issuer_id"])

    with op.batch_alter_table("committee_agenda_items", schema=None) as batch_op:
        batch_op.add_column(sa.Column("analyst_opinion_version_id", sa.String(36), nullable=True))
        batch_op.create_foreign_key(
            "fk_agenda_analyst_opinion_version",
            "analyst_opinion_versions",
            ["analyst_opinion_version_id"],
            ["id"],
        )
        batch_op.create_index(
            "ix_committee_agenda_items_analyst_opinion_version_id",
            ["analyst_opinion_version_id"],
        )

    op.create_table(
        "committee_evidence_exceptions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("agenda_item_id", sa.String(36), sa.ForeignKey("committee_agenda_items.id"), nullable=False),
        sa.Column("run_id", sa.String(36), sa.ForeignKey("runs.id"), nullable=False),
        sa.Column("basis_sha256", sa.String(64), nullable=False),
        sa.Column("failure_codes", sa.JSON(), nullable=False),
        sa.Column("finding_ids", sa.JSON(), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=False),
        sa.Column("mitigants", sa.JSON(), nullable=False),
        sa.Column("expires_at", sa.Date(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("requested_by", sa.String(255), nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reviewed_by", sa.String(255), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("revoked_by", sa.String(255), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=False),
    )
    op.create_index("ix_committee_evidence_exceptions_agenda_item_id", "committee_evidence_exceptions", ["agenda_item_id"])
    op.create_index("ix_committee_evidence_exceptions_run_id", "committee_evidence_exceptions", ["run_id"])
    op.create_index("ix_committee_evidence_exceptions_requested_by", "committee_evidence_exceptions", ["requested_by"])
    op.create_index("ix_committee_evidence_exceptions_reviewed_by", "committee_evidence_exceptions", ["reviewed_by"])
    op.create_index("ix_committee_evidence_exceptions_revoked_by", "committee_evidence_exceptions", ["revoked_by"])
    op.create_index("ix_committee_exception_agenda_requested", "committee_evidence_exceptions", ["agenda_item_id", "requested_at"])
    op.create_index("ix_committee_exception_status_expiry", "committee_evidence_exceptions", ["status", "expires_at"])

    with op.batch_alter_table("research_jobs", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("figures", sa.JSON(), nullable=False, server_default=sa.text("'[]'"))
        )


def downgrade() -> None:
    with op.batch_alter_table("research_jobs", schema=None) as batch_op:
        batch_op.drop_column("figures")

    op.drop_index("ix_committee_exception_status_expiry", table_name="committee_evidence_exceptions")
    op.drop_index("ix_committee_exception_agenda_requested", table_name="committee_evidence_exceptions")
    op.drop_index("ix_committee_evidence_exceptions_revoked_by", table_name="committee_evidence_exceptions")
    op.drop_index("ix_committee_evidence_exceptions_reviewed_by", table_name="committee_evidence_exceptions")
    op.drop_index("ix_committee_evidence_exceptions_requested_by", table_name="committee_evidence_exceptions")
    op.drop_index("ix_committee_evidence_exceptions_run_id", table_name="committee_evidence_exceptions")
    op.drop_index("ix_committee_evidence_exceptions_agenda_item_id", table_name="committee_evidence_exceptions")
    op.drop_table("committee_evidence_exceptions")

    with op.batch_alter_table("committee_agenda_items", schema=None) as batch_op:
        batch_op.drop_index("ix_committee_agenda_items_analyst_opinion_version_id")
        batch_op.drop_constraint("fk_agenda_analyst_opinion_version", type_="foreignkey")
        batch_op.drop_column("analyst_opinion_version_id")

    op.drop_index("ix_analyst_opinion_analyst_issuer", table_name="analyst_opinion_versions")
    op.drop_index("ix_analyst_opinion_issuer_created", table_name="analyst_opinion_versions")
    op.drop_index("ix_analyst_opinion_versions_context_id", table_name="analyst_opinion_versions")
    op.drop_index("ix_analyst_opinion_versions_source_run_id", table_name="analyst_opinion_versions")
    op.drop_index("ix_analyst_opinion_versions_thesis_version_id", table_name="analyst_opinion_versions")
    op.drop_index("ix_analyst_opinion_versions_issuer_id", table_name="analyst_opinion_versions")
    op.drop_index("ix_analyst_opinion_versions_analyst_id", table_name="analyst_opinion_versions")
    op.drop_table("analyst_opinion_versions")
