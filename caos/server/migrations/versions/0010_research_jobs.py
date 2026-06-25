"""research_jobs — durable Deep Research jobs (M-3)

Deep research moved from a synchronous request-held LLM call to a persisted
background job the client polls, so a dropped connection no longer loses the run
(audit M-3). This table holds the brief, the produced report + sources, and the
job status the client polls.

Revision ID: 0010
Revises: 0009
Create Date: 2026-06-24
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "research_jobs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="running"),
        sa.Column("analyst_id", sa.String(255), nullable=True),
        sa.Column("brief", sa.JSON(), nullable=True),
        sa.Column("report", sa.Text(), nullable=True),
        sa.Column("sources", sa.JSON(), nullable=True),
        sa.Column("demo", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("truncated", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_research_jobs_analyst_id", "research_jobs", ["analyst_id"])


def downgrade() -> None:
    op.drop_index("ix_research_jobs_analyst_id", table_name="research_jobs")
    op.drop_table("research_jobs")
