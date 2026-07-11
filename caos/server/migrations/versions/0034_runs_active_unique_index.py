"""runs: partial unique index on (issuer_id) WHERE status IN ('queued','running')

Audit finding #4 (2026-07-11): the active-run dedup in routes/runs.py create_run
is enforced purely at the application layer (_CREATE_RUN_LOCK, an asyncio.Lock,
plus a SELECT check) with no database-level backstop — a per-process lock can't
coordinate a race across multiple app replicas. The run EXECUTOR's Postgres path
(run_executor.QueueWorker, FOR UPDATE SKIP LOCKED) is already multi-worker-safe;
this index closes the matching gap on run CREATION, so two replicas racing a
POST /runs for the same issuer can't both insert an active row — the loser's
INSERT violates this constraint instead of silently creating a duplicate run
that then races on the issuer's headline metric_facts.

Portable (both dialects support a partial/filtered unique index) — no reason to
scope this to Postgres only; enforcing it in the SQLite dev/test path too keeps
schema parity. Additive — no edits to existing tables.

Revision ID: 0034
Revises: 0033 (issuer_research_reports, the prior head)
Create Date: 2026-07-11
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0034"
down_revision: Union[str, None] = "0033"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_ACTIVE_PREDICATE = "status IN ('queued', 'running')"


def upgrade() -> None:
    op.create_index(
        "uq_runs_issuer_active",
        "runs",
        ["issuer_id"],
        unique=True,
        postgresql_where=sa.text(_ACTIVE_PREDICATE),
        sqlite_where=sa.text(_ACTIVE_PREDICATE),
    )


def downgrade() -> None:
    op.drop_index("uq_runs_issuer_active", table_name="runs")
