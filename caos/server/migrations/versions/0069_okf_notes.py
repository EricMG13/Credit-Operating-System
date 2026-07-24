"""Add the okf_notes registry for inbound OKF source documents.

Strictly additive: one new table, no column/index/constraint change to any legacy
table (``documents``, ``document_chunks``, ``document_chunk_embeddings``,
``evidence_items``, ``metric_facts``, run tables). ``document_id``/``issuer_id``
are soft references with no ForeignKey, matching the existing
``DocumentChunkEmbedding`` / ``LineageEdge`` / ``AnalystQaFlag`` precedents — the
registry is an audit row that must outlive a superseded document.

Revision ID: 0069
Revises: 0068
Create Date: 2026-07-24
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0069"
down_revision: Union[str, None] = "0068"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "okf_notes",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("document_id", sa.String(length=36), nullable=False),  # SOFT ref — no FK
        sa.Column("issuer_id", sa.String(length=36), nullable=False),
        sa.Column("note_path", sa.String(length=1024), nullable=False),
        sa.Column("note_title", sa.String(length=512), nullable=True),
        sa.Column("doc_type", sa.String(length=64), nullable=True),
        sa.Column("source", sa.String(length=64), nullable=True),
        sa.Column("report_date", sa.String(length=32), nullable=True),
        sa.Column("fiscal_period", sa.String(length=64), nullable=True),
        sa.Column(
            "extraction_status",
            sa.String(length=16),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "contains_source_text",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("content_sha256", sa.String(length=64), nullable=True),
        sa.Column("okf_version", sa.String(length=32), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("document_id", name="uq_okf_notes_document_id"),
        sa.UniqueConstraint("note_path", name="uq_okf_notes_note_path"),
    )
    op.create_index("ix_okf_notes_issuer_id", "okf_notes", ["issuer_id"])


def downgrade() -> None:
    op.drop_index("ix_okf_notes_issuer_id", table_name="okf_notes")
    op.drop_table("okf_notes")
