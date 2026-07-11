"""Boot-sweep lease columns for the report + pipeline fire-and-forget executors.

research_report_executor.py and engine/pipeline_executor.py each sweep every
status='running' row to 'failed' unconditionally on boot — sound for one replica,
but a rolling multi-replica redeploy means one replica's boot sweep would kill
another replica's still-live job. Adds the same lease-expiry gate
run_executor.py's QueueWorker already uses for `runs` (migration 0004):
lease_expires_at lets a boot sweep tell "provably dead" from "still running
somewhere". worker_id is audit trail only (pipeline_runs already has it).

research_jobs is NOT touched here: migration 0036_research_job_lease already gave
it the full four-column claim/lease treatment (its jobs are re-claimable — a pure
function of the persisted brief), which supersedes the boot-sweep-only lease this
migration originally planned for it.

No claimed_at/attempts: nothing re-claims or retries a lease-expired row in these
two systems (unlike QueueWorker) — a lease-expired row goes straight to
'failed', once, exactly like today's unconditional sweep. See
.agent-reviews/redteam.md (RT-2026-07-11-02) for the full reasoning.

Additive — nullable columns only, no table edits.

Revision ID: 0038
Revises: 0037
Create Date: 2026-07-11
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0038"
down_revision: Union[str, None] = "0037"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("issuer_research_reports") as batch:
        batch.add_column(sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("worker_id", sa.String(length=64), nullable=True))
    with op.batch_alter_table("pipeline_runs") as batch:
        batch.add_column(sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("pipeline_runs") as batch:
        batch.drop_column("lease_expires_at")
    with op.batch_alter_table("issuer_research_reports") as batch:
        batch.drop_column("worker_id")
        batch.drop_column("lease_expires_at")
