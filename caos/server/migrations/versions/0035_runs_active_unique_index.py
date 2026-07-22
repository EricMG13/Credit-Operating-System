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
schema parity. Resolves any pre-existing duplicate active runs (keeping the
newest per issuer, failing the rest) before creating the index, so a deploy
with dirty data doesn't fail the upgrade.

Revision ID: 0035
Revises: 0034 (runs_status_created_idx — two independent, purely-additive
index migrations both forked from 0033 as "0034"; this one rebased to 0035
to linearize the chain, no content change)
Create Date: 2026-07-11
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0035"
down_revision: Union[str, None] = "0034"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_ACTIVE_PREDICATE = "status IN ('queued', 'running')"


def upgrade() -> None:
    # Resolve any pre-existing duplicate active runs first, else CREATE UNIQUE
    # INDEX fails against dirty data. Keep the most-recently-created queued/
    # running run per issuer (created_at, then id as a deterministic tiebreak
    # — created_at is NOT NULL as of migration 0027, so no NULL fallback is
    # needed here) and mark the rest failed — same posture as the boot-time
    # stranded-run sweep (run_executor.py). Window-function-free so it runs
    # on older SQLite too.
    op.execute(
        sa.text(
            """
            UPDATE runs SET status = 'failed',
                            error = 'superseded (run-dedup migration 0035)'
            WHERE status IN ('queued', 'running')
              AND EXISTS (
                  SELECT 1 FROM runs other
                  WHERE other.issuer_id = runs.issuer_id
                    AND other.status IN ('queued', 'running')
                    AND (other.created_at > runs.created_at
                         OR (other.created_at = runs.created_at AND other.id > runs.id))
              )
            """
        )
    )
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
