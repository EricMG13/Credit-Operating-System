"""metric_facts — curated structured per-issuer metric store

Backs cross-issuer natural-language query (Approach A). Facts are either
projected from a completed run's module outputs (provenance="run", with a
citation) or seeded illustrative demo values (provenance="seed").

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-14
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "metric_facts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("issuer_id", sa.String(36), sa.ForeignKey("issuers.id"), nullable=False),
        sa.Column("run_id", sa.String(36), sa.ForeignKey("runs.id")),
        sa.Column("module_id", sa.String(16)),
        sa.Column("metric_key", sa.String(64), nullable=False),
        sa.Column("period", sa.String(64), nullable=False),
        sa.Column("value", sa.Float, nullable=False),
        sa.Column("unit", sa.String(16)),
        sa.Column("headline", sa.Boolean),
        sa.Column("qa_status", sa.String(16)),
        sa.Column("source_claim_id", sa.String(32)),
        sa.Column("source_evidence_id", sa.String(32)),
        sa.Column("document_chunk_id", sa.String(36), sa.ForeignKey("document_chunks.id")),
        sa.Column("provenance", sa.String(16)),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("issuer_id", "run_id", "metric_key", "period", name="uq_fact"),
    )
    op.create_index("ix_metric_facts_issuer_id", "metric_facts", ["issuer_id"])


def downgrade() -> None:
    op.drop_index("ix_metric_facts_issuer_id", "metric_facts")
    op.drop_table("metric_facts")
