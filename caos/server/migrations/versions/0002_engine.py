"""analytical engine — runs, module_outputs, claims, evidence_items, qa_findings

Adds the Tier-1 engine tables (mapped to the canonical methodology schemas).

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-13
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "runs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("issuer_id", sa.String(36), sa.ForeignKey("issuers.id"), nullable=False),
        sa.Column("parent_run_id", sa.String(36), sa.ForeignKey("runs.id")),
        sa.Column("status", sa.String(16)),
        sa.Column("analyst_id", sa.String(255)),
        sa.Column("as_of_date", sa.String(32)),
        sa.Column("model_id", sa.String(64)),
        sa.Column("prompt_version", sa.String(32)),
        sa.Column("qa_status", sa.String(16)),
        sa.Column("committee_status", sa.String(32)),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_runs_issuer_id", "runs", ["issuer_id"])

    op.create_table(
        "module_outputs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("run_id", sa.String(36), sa.ForeignKey("runs.id"), nullable=False),
        sa.Column("module_id", sa.String(16), nullable=False),
        sa.Column("module_name", sa.String(128), nullable=False),
        sa.Column("owned_object", sa.String(128)),
        sa.Column("schema_family", sa.String(32)),
        sa.Column("runtime_output", sa.JSON()),
        sa.Column("confidence", sa.String(32)),
        sa.Column("qa_status", sa.String(16)),
        sa.Column("committee_status", sa.String(32)),
        sa.Column("validation_status", sa.String(16)),
        sa.Column("limitation_flags", sa.JSON()),
        sa.Column("downstream_consumers", sa.JSON()),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("run_id", "module_id", name="uq_run_module"),
    )
    op.create_index("ix_module_outputs_run_id", "module_outputs", ["run_id"])

    op.create_table(
        "claims",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("module_output_id", sa.String(36), sa.ForeignKey("module_outputs.id"), nullable=False),
        sa.Column("claim_id", sa.String(32), nullable=False),
        sa.Column("claim_text", sa.Text, nullable=False),
    )
    op.create_index("ix_claims_module_output_id", "claims", ["module_output_id"])

    op.create_table(
        "evidence_items",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("claim_pk", sa.String(36), sa.ForeignKey("claims.id"), nullable=False),
        sa.Column("evidence_id", sa.String(32), nullable=False),
        sa.Column("extraction_type", sa.String(32), nullable=False),
        sa.Column("lineage_class", sa.String(32), nullable=False),
        sa.Column("source_locator", sa.Text),
        sa.Column("document_chunk_id", sa.String(36), sa.ForeignKey("document_chunks.id")),
        sa.Column("confidence", sa.String(32)),
    )
    op.create_index("ix_evidence_items_claim_pk", "evidence_items", ["claim_pk"])

    op.create_table(
        "qa_findings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("run_id", sa.String(36), sa.ForeignKey("runs.id"), nullable=False),
        sa.Column("module_id", sa.String(16)),
        sa.Column("finding_id", sa.String(32), nullable=False),
        sa.Column("severity", sa.String(16), nullable=False),
        sa.Column("lane", sa.Integer),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("affected_claim_id", sa.String(32)),
        sa.Column("required_remediation", sa.Text),
    )
    op.create_index("ix_qa_findings_run_id", "qa_findings", ["run_id"])


def downgrade() -> None:
    op.drop_index("ix_qa_findings_run_id", "qa_findings")
    op.drop_table("qa_findings")
    op.drop_index("ix_evidence_items_claim_pk", "evidence_items")
    op.drop_table("evidence_items")
    op.drop_index("ix_claims_module_output_id", "claims")
    op.drop_table("claims")
    op.drop_index("ix_module_outputs_run_id", "module_outputs")
    op.drop_table("module_outputs")
    op.drop_index("ix_runs_issuer_id", "runs")
    op.drop_table("runs")
