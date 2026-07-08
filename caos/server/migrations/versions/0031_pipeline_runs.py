"""pipeline_runs — durable audit trail + shared prior for the autonomous cycle.

Each ``GET /api/autonomy/draft`` that acquires the cycle advisory lock writes one
row: the prior fingerprint snapshot, the current snapshot, the composed draft,
and the run summary. The next cycle reads the latest ``complete`` row's
``current_fingerprints`` as its prior (multi-worker shared prior). Additive — no
edits to existing tables; mirrors ``research_jobs`` (migration 0010).

Revision ID: 0031
Revises: fb2488db06e3 (vector_embeddings, the prior head)
Create Date: 2026-07-07
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0031"
down_revision: Union[str, None] = "fb2488db06e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "pipeline_runs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("kind", sa.String(length=32), nullable=False, server_default="autonomy-cycle"),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="complete"),
        sa.Column("prior_fingerprints", sa.JSON(), nullable=True),
        sa.Column("current_fingerprints", sa.JSON(), nullable=False),
        sa.Column("draft", sa.JSON(), nullable=False),
        sa.Column("summary", sa.JSON(), nullable=False),
        sa.Column("worker_id", sa.String(length=64), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_pipeline_runs_kind", "pipeline_runs", ["kind"])
    op.create_index("ix_pipeline_runs_created_at", "pipeline_runs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_pipeline_runs_created_at", table_name="pipeline_runs")
    op.drop_index("ix_pipeline_runs_kind", table_name="pipeline_runs")
    op.drop_table("pipeline_runs")
