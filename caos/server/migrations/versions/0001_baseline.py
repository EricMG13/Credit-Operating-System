"""baseline — issuers, documents, document_chunks

Represents the pre-engine schema (including the figi / run_mode columns that
were previously bolted on by ad-hoc ALTERs). Existing databases that already
hold these tables are stamped at this revision rather than re-created.

Revision ID: 0001
Revises:
Create Date: 2026-06-13
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "issuers",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("ticker", sa.String(32)),
        sa.Column("industry", sa.String(128)),
        sa.Column("country", sa.String(128)),
        sa.Column("figi", sa.String(32)),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "documents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("issuer_id", sa.String(36), sa.ForeignKey("issuers.id"), nullable=False),
        sa.Column("doc_type", sa.String(64), nullable=False),
        sa.Column("run_mode", sa.String(16)),
        sa.Column("file_name", sa.String(512), nullable=False),
        sa.Column("storage_key", sa.String(1024), nullable=False),
        sa.Column("fiscal_period", sa.String(64)),
        sa.Column("chunk_count", sa.Integer, server_default="0"),
        sa.Column("uploaded_by", sa.String(255)),
        sa.Column("uploaded_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_documents_issuer_id", "documents", ["issuer_id"])
    op.create_table(
        "document_chunks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("document_id", sa.String(36), sa.ForeignKey("documents.id"), nullable=False),
        sa.Column("seq", sa.Integer, nullable=False),
        sa.Column("text", sa.Text, nullable=False),
    )
    op.create_index("ix_document_chunks_document_id", "document_chunks", ["document_id"])


def downgrade() -> None:
    op.drop_index("ix_document_chunks_document_id", "document_chunks")
    op.drop_table("document_chunks")
    op.drop_index("ix_documents_issuer_id", "documents")
    op.drop_table("documents")
    op.drop_table("issuers")
