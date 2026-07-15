"""Committee agenda preparation and IC Book decision linkage.

Revision ID: 0051
Revises: 0050
Create Date: 2026-07-13
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0051"
down_revision: Union[str, None] = "0050"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "committee_agenda_items",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("issuer_id", sa.String(36), sa.ForeignKey("issuers.id"), nullable=False),
        sa.Column("portfolio_id", sa.String(36), sa.ForeignKey("portfolios.id"), nullable=True),
        sa.Column("owner_id", sa.String(255), nullable=False),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=False),
        sa.Column("recommendation", sa.String(16), nullable=False),
        sa.Column("conviction", sa.Float(), nullable=True),
        sa.Column("thesis", sa.Text(), nullable=False),
        sa.Column("conditions", sa.JSON(), nullable=False),
        sa.Column("expiry", sa.Date(), nullable=True),
        sa.Column("run_id", sa.String(36), sa.ForeignKey("runs.id"), nullable=True),
        sa.Column(
            "report_version_id", sa.String(36),
            sa.ForeignKey("report_versions.id"), nullable=True,
        ),
        sa.Column(
            "context_id", sa.String(36),
            sa.ForeignKey("analysis_contexts.id"), nullable=True,
        ),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column(
            "finalized_decision_id", sa.String(36),
            sa.ForeignKey("decisions.id"), nullable=True,
        ),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("snapshot_sha256", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finalized_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("finalized_decision_id", name="uq_agenda_finalized_decision"),
    )
    op.create_index("ix_agenda_issuer_scheduled", "committee_agenda_items", ["issuer_id", "scheduled_for"])
    op.create_index("ix_agenda_portfolio_scheduled", "committee_agenda_items", ["portfolio_id", "scheduled_for"])
    op.create_index("ix_agenda_owner_status", "committee_agenda_items", ["owner_id", "status"])
    op.create_index("ix_agenda_status_scheduled", "committee_agenda_items", ["status", "scheduled_for"])
    op.create_index("ix_committee_agenda_items_run_id", "committee_agenda_items", ["run_id"])
    op.create_index(
        "ix_committee_agenda_items_report_version_id",
        "committee_agenda_items",
        ["report_version_id"],
    )
    op.create_index("ix_committee_agenda_items_context_id", "committee_agenda_items", ["context_id"])

    with op.batch_alter_table("decisions") as batch:
        batch.add_column(sa.Column("portfolio_id", sa.String(36), nullable=True))
        batch.add_column(sa.Column("agenda_item_id", sa.String(36), nullable=True))
        batch.add_column(sa.Column("report_version_id", sa.String(36), nullable=True))
        batch.create_foreign_key("fk_decisions_portfolio_id", "portfolios", ["portfolio_id"], ["id"])
        batch.create_foreign_key(
            "fk_decisions_agenda_item_id", "committee_agenda_items", ["agenda_item_id"], ["id"]
        )
        batch.create_foreign_key(
            "fk_decisions_report_version_id", "report_versions", ["report_version_id"], ["id"]
        )
        batch.create_unique_constraint("uq_decisions_agenda_item_id", ["agenda_item_id"])
        batch.create_index("ix_decisions_portfolio_id", ["portfolio_id"])
        batch.create_index("ix_decisions_report_version_id", ["report_version_id"])


def downgrade() -> None:
    with op.batch_alter_table("decisions") as batch:
        batch.drop_index("ix_decisions_report_version_id")
        batch.drop_index("ix_decisions_portfolio_id")
        batch.drop_constraint("uq_decisions_agenda_item_id", type_="unique")
        batch.drop_constraint("fk_decisions_report_version_id", type_="foreignkey")
        batch.drop_constraint("fk_decisions_agenda_item_id", type_="foreignkey")
        batch.drop_constraint("fk_decisions_portfolio_id", type_="foreignkey")
        batch.drop_column("report_version_id")
        batch.drop_column("agenda_item_id")
        batch.drop_column("portfolio_id")

    op.drop_index("ix_committee_agenda_items_context_id", table_name="committee_agenda_items")
    op.drop_index("ix_committee_agenda_items_report_version_id", table_name="committee_agenda_items")
    op.drop_index("ix_committee_agenda_items_run_id", table_name="committee_agenda_items")
    op.drop_index("ix_agenda_status_scheduled", table_name="committee_agenda_items")
    op.drop_index("ix_agenda_owner_status", table_name="committee_agenda_items")
    op.drop_index("ix_agenda_portfolio_scheduled", table_name="committee_agenda_items")
    op.drop_index("ix_agenda_issuer_scheduled", table_name="committee_agenda_items")
    op.drop_table("committee_agenda_items")
