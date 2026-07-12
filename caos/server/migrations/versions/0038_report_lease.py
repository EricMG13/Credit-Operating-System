"""Durable Issuer Research Report: claim/lease columns on issuer_research_reports.

Research report synthesis ran as a fire-and-forget in-process task even on
Postgres, so a redeploy / recycle swept every in-flight report to 'failed' and
the analyst had to resubmit — the same gap ResearchJob had before migration
0036. A report is a pure function of its (run_id, issuer_id, digest), so it is
re-executable — give it the same lease/re-claim treatment as runs (migration
0004) and research jobs (migration 0036): a Postgres worker claims 'queued' and
truly-orphaned 'running' rows via FOR UPDATE SKIP LOCKED and re-executes them,
so a report survives a single worker's death instead of being lost. SQLite
(dev, single-process) keeps the in-process executor + boot sweep.

Revision ID: 0038
Revises: 0037
Create Date: 2026-07-12
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0038"
down_revision: Union[str, None] = "0037"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("issuer_research_reports", sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("issuer_research_reports", sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "issuer_research_reports",
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("issuer_research_reports", sa.Column("worker_id", sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column("issuer_research_reports", "worker_id")
    op.drop_column("issuer_research_reports", "attempts")
    op.drop_column("issuer_research_reports", "lease_expires_at")
    op.drop_column("issuer_research_reports", "claimed_at")
