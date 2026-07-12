"""Boot-sweep lease column for pipeline fire-and-forget executor.

The pipeline executor sweeps ``status='running'`` rows on boot. Without a lease
gate, a rolling multi-replica redeploy could let one replica mark another
replica's still-live job as failed. ``issuer_research_reports`` already received
the richer report queue claim/lease columns in migration 0038; this migration
only adds the remaining pipeline lease column.

Revision ID: 0039
Revises: 0038
Create Date: 2026-07-12
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0039"
down_revision: Union[str, None] = "0038"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("pipeline_runs") as batch:
        batch.add_column(sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("pipeline_runs") as batch:
        batch.drop_column("lease_expires_at")
