"""Portfolio Lab tenancy anchor and immutable deterministic stress runs.

Revision ID: 0050
Revises: 0049
Create Date: 2026-07-13
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0050"
down_revision: Union[str, None] = "0049"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "analysts",
        sa.Column(
            "role", sa.String(32), nullable=False, server_default="analyst"
        ),
    )
    op.add_column("portfolios", sa.Column("team_id", sa.String(128), nullable=True))
    op.create_index("ix_portfolios_team_id", "portfolios", ["team_id"])
    op.create_table(
        "portfolio_stress_runs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "portfolio_id", sa.String(36), sa.ForeignKey("portfolios.id"), nullable=False
        ),
        sa.Column("created_by", sa.String(255), nullable=False),
        sa.Column("label", sa.String(160), nullable=False),
        sa.Column("inputs", sa.JSON(), nullable=False),
        sa.Column("output", sa.JSON(), nullable=False),
        sa.Column("source_fingerprint", sa.String(64), nullable=False),
        sa.Column("authority", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_portfolio_stress_runs_portfolio_created",
        "portfolio_stress_runs",
        ["portfolio_id", "created_at"],
    )
    op.create_index(
        "ix_portfolio_stress_runs_created_by",
        "portfolio_stress_runs",
        ["created_by"],
    )
    op.create_index(
        "ix_portfolio_stress_runs_source_fingerprint",
        "portfolio_stress_runs",
        ["source_fingerprint"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_portfolio_stress_runs_source_fingerprint",
        table_name="portfolio_stress_runs",
    )
    op.drop_index(
        "ix_portfolio_stress_runs_created_by", table_name="portfolio_stress_runs"
    )
    op.drop_index(
        "ix_portfolio_stress_runs_portfolio_created",
        table_name="portfolio_stress_runs",
    )
    op.drop_table("portfolio_stress_runs")
    op.drop_index("ix_portfolios_team_id", table_name="portfolios")
    op.drop_column("portfolios", "team_id")
    op.drop_column("analysts", "role")
