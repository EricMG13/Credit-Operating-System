"""IC decisions and append-only votes.

Revision ID: 0044
Revises: 0043
Create Date: 2026-07-12
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0044"
down_revision: Union[str, None] = "0043"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "decisions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("issuer_id", sa.String(36), sa.ForeignKey("issuers.id"), nullable=False),
        sa.Column("run_id", sa.String(36), sa.ForeignKey("runs.id"), nullable=False),
        sa.Column("report_id", sa.String(64), nullable=True),
        sa.Column("action", sa.String(16), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("conditions", sa.JSON(), nullable=False),
        sa.Column("expiry", sa.Date(), nullable=True),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("snapshot_sha256", sa.String(64), nullable=False),
        sa.Column("created_by", sa.String(255), nullable=True),
        sa.Column("reopened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reopen_alert_key", sa.String(160), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_decisions_issuer_id", "decisions", ["issuer_id"])
    op.create_index("ix_decisions_run_id", "decisions", ["run_id"])
    op.create_index("ix_decisions_created_by", "decisions", ["created_by"])
    op.create_table(
        "decision_votes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("decision_id", sa.String(36), sa.ForeignKey("decisions.id"), nullable=False),
        sa.Column("member", sa.String(255), nullable=False),
        sa.Column("vote", sa.String(16), nullable=False),
        sa.Column("dissent_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("decision_id", "member", name="uq_decision_vote_member"),
    )
    op.create_index("ix_decision_votes_decision_id", "decision_votes", ["decision_id"])


def downgrade() -> None:
    op.drop_index("ix_decision_votes_decision_id", table_name="decision_votes")
    op.drop_table("decision_votes")
    op.drop_index("ix_decisions_created_by", table_name="decisions")
    op.drop_index("ix_decisions_run_id", table_name="decisions")
    op.drop_index("ix_decisions_issuer_id", table_name="decisions")
    op.drop_table("decisions")
