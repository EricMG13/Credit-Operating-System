"""deals / deal_terms — Loan Compare documentation comparison store

A Deal is one financing snapshot (a column in the /compare grid); DealTerm is one
extracted covenant/term value (a cell), keyed by the engine/terms_catalog key so
the schema stays a tall EAV store (new terms need no migration). Each cell carries
its own evidence (lineage + confidence + chunk), mirroring metric_facts. See
docs/COMPARE_SCHEMA.md.

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-15
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "deals",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("issuer_id", sa.String(36), sa.ForeignKey("issuers.id"), nullable=False),
        sa.Column("run_id", sa.String(36), sa.ForeignKey("runs.id")),
        sa.Column("document_id", sa.String(36), sa.ForeignKey("documents.id")),
        sa.Column("label", sa.String(255), nullable=False),
        sa.Column("transaction_phase", sa.String(32)),
        sa.Column("launch_date", sa.String(32)),
        sa.Column("as_of_date", sa.String(32)),
        sa.Column("provenance", sa.String(16)),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_deals_issuer_id", "deals", ["issuer_id"])

    op.create_table(
        "deal_terms",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("deal_id", sa.String(36), sa.ForeignKey("deals.id"), nullable=False),
        sa.Column("term_key", sa.String(64), nullable=False),
        sa.Column("value_num", sa.Float),
        sa.Column("value_text", sa.Text),
        sa.Column("extraction_type", sa.String(32)),
        sa.Column("lineage_class", sa.String(32)),
        sa.Column("confidence", sa.String(32)),
        sa.Column("document_chunk_id", sa.String(36), sa.ForeignKey("document_chunks.id")),
        sa.Column("quote", sa.Text),
        sa.UniqueConstraint("deal_id", "term_key", name="uq_deal_term"),
    )
    op.create_index("ix_deal_terms_deal_id", "deal_terms", ["deal_id"])


def downgrade() -> None:
    op.drop_index("ix_deal_terms_deal_id", "deal_terms")
    op.drop_table("deal_terms")
    op.drop_index("ix_deals_issuer_id", "deals")
    op.drop_table("deals")
