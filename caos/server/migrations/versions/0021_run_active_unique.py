"""Partial unique index: at most one active (queued|running) run per issuer.

The in-process ``_CREATE_RUN_LOCK`` in routes/runs.py only serializes the dedup
check within ONE process, so two app replicas (the Postgres deploy can scale) could
both pass the "is a run already active?" SELECT and create duplicate concurrent runs
for the same issuer — which then race on the issuer's headline metric_facts
(last-writer-wins on the committee number). A partial unique index makes the DB the
authority: it permits only one queued-or-running run per issuer regardless of how
many processes race, while still allowing a fresh run once the prior one is terminal
(complete|failed) — the predicate no longer matches those. create_run keeps the lock
as the fast path and now catches the IntegrityError as its 409.

Revision ID: 0021
Revises: 0020
Create Date: 2026-07-10
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0021"
down_revision: Union[str, None] = "0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Resolve any pre-existing duplicate active runs first, else the unique index
    # can't be created. Keep the most-recently-created queued/running run per issuer
    # (created_at, then id as a deterministic tiebreak) and mark the rest failed —
    # the same posture as the executor's stranded-run sweep. Window-function-free so
    # it runs on older SQLite as well as Postgres.
    op.execute(
        sa.text(
            """
            UPDATE runs SET status = 'failed',
                            error = 'superseded (run-dedup migration 0021)'
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
        "uq_runs_active_per_issuer",
        "runs",
        ["issuer_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('queued', 'running')"),
        sqlite_where=sa.text("status IN ('queued', 'running')"),
    )


def downgrade() -> None:
    op.drop_index("uq_runs_active_per_issuer", table_name="runs")
