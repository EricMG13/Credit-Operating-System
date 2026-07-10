"""fts and ledgers

Revision ID: 0029
Revises: 0028
Create Date: 2026-07-06
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import TSVECTOR

revision: str = "0029"
down_revision: Union[str, None] = "0028"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    dialect_name = op.get_bind().dialect.name

    # Add chunk_hash column
    op.add_column("document_chunks", sa.Column("chunk_hash", sa.String(length=64), nullable=True))
    op.create_index("ix_document_chunks_chunk_hash", "document_chunks", ["chunk_hash"])

    # Add tsv column conditionally based on dialect
    if dialect_name == "postgresql":
        op.add_column(
            "document_chunks",
            sa.Column(
                "tsv",
                TSVECTOR,
                sa.Computed("to_tsvector('english', text)", persisted=True),
                nullable=True,
            )
        )
        op.create_index(
            "ix_document_chunks_tsv",
            "document_chunks",
            ["tsv"],
            postgresql_using="gin",
        )
    else:
        op.add_column(
            "document_chunks",
            sa.Column(
                "tsv",
                sa.Text(),
                nullable=True,
            )
        )
        op.create_index("ix_document_chunks_tsv", "document_chunks", ["tsv"])

    # 2. llm_call_records table
    op.create_table(
        "llm_call_records",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("run_id", sa.String(length=36), nullable=True),
        sa.Column("lane", sa.String(length=64), nullable=False),
        sa.Column("model", sa.String(length=128), nullable=False),
        sa.Column("prompt_hash", sa.String(length=64), nullable=False),
        sa.Column("prompt_tokens", sa.Integer(), nullable=True),
        sa.Column("completion_tokens", sa.Integer(), nullable=True),
        sa.Column("cost", sa.Float(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("kept_count", sa.Integer(), nullable=True),
        sa.Column("dropped_count", sa.Integer(), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_llm_call_records_run_id", "llm_call_records", ["run_id"])
    op.create_index("ix_llm_call_records_lane", "llm_call_records", ["lane"])

    # 3. lineage_edges table
    op.create_table(
        "lineage_edges",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("artifact_id", sa.String(length=128), nullable=False),
        sa.Column("parent_id", sa.String(length=128), nullable=False),
        sa.Column("transform", sa.String(length=64), nullable=False),
        sa.Column("transform_version", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_lineage_edges_artifact_id", "lineage_edges", ["artifact_id"])
    op.create_index("ix_lineage_edges_parent_id", "lineage_edges", ["parent_id"])


def downgrade() -> None:
    op.drop_index("ix_lineage_edges_parent_id", "lineage_edges")
    op.drop_index("ix_lineage_edges_artifact_id", "lineage_edges")
    op.drop_table("lineage_edges")

    op.drop_index("ix_llm_call_records_lane", "llm_call_records")
    op.drop_index("ix_llm_call_records_run_id", "llm_call_records")
    op.drop_table("llm_call_records")

    op.drop_index("ix_document_chunks_tsv", "document_chunks")
    op.drop_column("document_chunks", "tsv")

    op.drop_index("ix_document_chunks_chunk_hash", "document_chunks")
    op.drop_column("document_chunks", "chunk_hash")
