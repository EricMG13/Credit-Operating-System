"""issuer_research_reports — synthesized bank-research-style credit summary.

Each row is one AI-synthesized Research Report for an issuer+run pair. The report
is a house artifact (not analyst-scoped): any analyst viewing the same issuer+run
sees the same report. Cached per (issuer_id, run_id); a new complete run does NOT
auto-regenerate (cost control) — the UI surfaces a stale banner.

Synthesis is a durable background job (mirrors research_jobs + research_executor.py):
POST persists this row and enqueues a background task; the client polls GET.

Additive — no edits to existing tables.

Revision ID: 0033
Revises: 0032 (analyst_watchlists, the prior head)
Create Date: 2026-07-07
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0033"
down_revision: Union[str, None] = "0032"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "issuer_research_reports",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("issuer_id", sa.String(length=36), nullable=False),
        sa.Column("run_id", sa.String(length=36), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="running"),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("markdown", sa.Text(), nullable=True),
        sa.Column("validation", sa.JSON(), nullable=True),
        sa.Column("digest", sa.JSON(), nullable=True),
        sa.Column("prompt_version", sa.String(length=32), nullable=True),
        sa.Column("model_id", sa.String(length=64), nullable=True),
        sa.Column("tokens_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("demo", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("truncated", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("analyst_id", sa.String(length=255), nullable=True),
        sa.Column("progress", sa.JSON(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("issuer_id", "run_id", name="uq_issuer_run_report"),
        sa.ForeignKeyConstraint(["issuer_id"], ["issuers.id"]),
        sa.ForeignKeyConstraint(["run_id"], ["runs.id"]),
    )
    op.create_index("ix_issuer_research_reports_issuer_id", "issuer_research_reports", ["issuer_id"])
    op.create_index("ix_issuer_research_reports_run_id", "issuer_research_reports", ["run_id"])


def downgrade() -> None:
    op.drop_index("ix_issuer_research_reports_run_id", table_name="issuer_research_reports")
    op.drop_index("ix_issuer_research_reports_issuer_id", table_name="issuer_research_reports")
    op.drop_table("issuer_research_reports")