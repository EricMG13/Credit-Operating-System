"""research_jobs.progress — live progress for the polled running state

Deep Research runs multi-minute; the client polls GET /api/research/{id}. This
adds a nullable JSON column the executor updates per continuation turn with the
REAL running counts ({"sources": n, "searches": m}) so the running UI can show
sources actually accumulating rather than a fabricated ticker. Null until the
first turn reports, and on demo/instant completions.

Revision ID: 0021
Revises: 0020
Create Date: 2026-07-02
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0021"
down_revision: Union[str, None] = "0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("research_jobs", sa.Column("progress", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("research_jobs", "progress")
