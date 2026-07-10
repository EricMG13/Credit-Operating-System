"""Durable Deep Research: claim/lease columns on research_jobs.

Deep-research jobs ran as fire-and-forget in-process tasks even on Postgres, so a
redeploy / recycle swept every in-flight job to 'failed' and the analyst had to
resubmit (audit follow-up). A deep-research job is a pure function of its persisted
``brief`` (research_executor.run_deep_research(ResearchBrief(**brief))), so it is
re-executable — give it the same lease/re-claim treatment as runs (migration 0004):
a Postgres worker claims 'queued' and truly-orphaned 'running' jobs via
FOR UPDATE SKIP LOCKED and re-executes them, so a job survives a redeploy instead of
being lost. SQLite (dev, single-process) keeps the in-process executor + boot sweep.

Revision ID: 0022
Revises: 0021
Create Date: 2026-07-10
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0022"
down_revision: Union[str, None] = "0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("research_jobs", sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("research_jobs", sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "research_jobs",
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("research_jobs", sa.Column("worker_id", sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column("research_jobs", "worker_id")
    op.drop_column("research_jobs", "attempts")
    op.drop_column("research_jobs", "lease_expires_at")
    op.drop_column("research_jobs", "claimed_at")
