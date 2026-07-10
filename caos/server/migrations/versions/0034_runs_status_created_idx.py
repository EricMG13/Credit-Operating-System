"""Composite index on runs(status, created_at) for the worker claim poll.

QueueWorker._claim_one filters on Run.status (+ lease/attempts) ORDER BY
created_at every poll tick (1s), and the portfolio/digest boards filter on
status='complete' — but runs carried only ix_runs_issuer_id, so the hottest
recurring query seq-scanned the append-only runs table and degraded with
history. Composite (status, created_at) serves both the claim poll's filter+
order and the status-filtered board scans.

Additive — index only, no table edits.

Revision ID: 0034
Revises: 0033 (issuer_research_reports, the prior head)
Create Date: 2026-07-10
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0034"
down_revision: Union[str, None] = "0033"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_runs_status_created_at", "runs", ["status", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_runs_status_created_at", "runs")
