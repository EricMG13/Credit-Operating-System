"""decision_records — the IC Decision Record (C8, expansion 4.1)

Append-only per-issuer record: recommendation, conviction, thesis sentence,
committee date, decision, dissent, link to the run/report it was based on.
No update/delete route — a revised view is a new row, not an edit.

Revision ID: 0043
Revises: 0042
Create Date: 2026-07-12
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0043"
down_revision: Union[str, None] = "0042"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "decision_records",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("issuer_id", sa.String(36), sa.ForeignKey("issuers.id"), nullable=False),
        sa.Column("run_id", sa.String(36), sa.ForeignKey("runs.id"), nullable=True),
        sa.Column("report_id", sa.String(36), sa.ForeignKey("issuer_research_reports.id"), nullable=True),
        sa.Column("recommendation", sa.String(16), nullable=False),
        sa.Column("conviction", sa.String(16), nullable=False),
        sa.Column("thesis", sa.Text(), nullable=False),
        sa.Column("committee_date", sa.Date(), nullable=False),
        sa.Column("decision", sa.String(16), nullable=False),
        sa.Column("dissent", sa.Text(), nullable=True),
        sa.Column("analyst_id", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_decision_records_issuer_id", "decision_records", ["issuer_id"])
    op.create_index("ix_decision_records_run_id", "decision_records", ["run_id"])
    op.create_index("ix_decision_records_report_id", "decision_records", ["report_id"])
    op.create_index("ix_decision_records_analyst_id", "decision_records", ["analyst_id"])
    op.create_index("ix_decision_records_created_at", "decision_records", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_decision_records_created_at", table_name="decision_records")
    op.drop_index("ix_decision_records_analyst_id", table_name="decision_records")
    op.drop_index("ix_decision_records_report_id", table_name="decision_records")
    op.drop_index("ix_decision_records_run_id", table_name="decision_records")
    op.drop_index("ix_decision_records_issuer_id", table_name="decision_records")
    op.drop_table("decision_records")
