"""portfolios — managed CLO books: holdings positions + constraint definitions.

A portfolio is built from an uploaded holdings file; exposure + compliance are
COMPUTED from positions (engine/portfolio.py), so nothing derived is stored. Also
adds runs.portfolio_id (soft ref) so CP-3C evaluates an issuer against the book.

NOT NULL exactly where the model column is non-Optional (drift-free under
`alembic check`, per 0023).

Revision ID: 0026
Revises: 0025
Create Date: 2026-07-05
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0026"
down_revision: Union[str, None] = "0025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "portfolios",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("as_of_date", sa.String(length=32), nullable=True),
        sa.Column("mandate", sa.JSON(), nullable=False),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "portfolio_positions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("portfolio_id", sa.String(length=36), sa.ForeignKey("portfolios.id"), nullable=False),
        sa.Column("issuer_id", sa.String(length=36), sa.ForeignKey("issuers.id"), nullable=True),
        sa.Column("borrower_name", sa.String(length=255), nullable=False),
        sa.Column("ticker", sa.String(length=32), nullable=True),
        sa.Column("figi", sa.String(length=32), nullable=True),
        sa.Column("loan_name", sa.String(length=255), nullable=True),
        sa.Column("sector", sa.String(length=128), nullable=True),
        sa.Column("sub_sector", sa.String(length=128), nullable=True),
        sa.Column("ranking", sa.String(length=64), nullable=True),
        sa.Column("rating_moody", sa.String(length=16), nullable=True),
        sa.Column("rating_sp", sa.String(length=16), nullable=True),
        sa.Column("par_usd", sa.Float(), nullable=False),
        sa.Column("facility_musd", sa.Float(), nullable=True),
        sa.Column("margin_bps", sa.Float(), nullable=True),
        sa.Column("maturity", sa.String(length=32), nullable=True),
        sa.Column("price", sa.Float(), nullable=True),
        sa.Column("ytm", sa.Float(), nullable=True),
        sa.Column("dm", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_portfolio_positions_portfolio_id", "portfolio_positions", ["portfolio_id"])
    op.create_index("ix_portfolio_positions_issuer_id", "portfolio_positions", ["issuer_id"])
    op.create_table(
        "portfolio_constraints",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("portfolio_id", sa.String(length=36), sa.ForeignKey("portfolios.id"), nullable=False),
        sa.Column("code", sa.String(length=16), nullable=True),
        sa.Column("category", sa.String(length=64), nullable=True),
        sa.Column("parameter", sa.String(length=255), nullable=True),
        sa.Column("limit_text", sa.String(length=128), nullable=True),
        sa.Column("limit_value", sa.Float(), nullable=True),
        sa.Column("limit_unit", sa.String(length=32), nullable=True),
        sa.Column("limit_op", sa.String(length=8), nullable=True),
        sa.Column("breach_type", sa.String(length=16), nullable=True),
        sa.Column("source_document", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_portfolio_constraints_portfolio_id", "portfolio_constraints", ["portfolio_id"])
    # Soft ref (no FK) — a plain nullable column on the existing runs table.
    op.add_column("runs", sa.Column("portfolio_id", sa.String(length=36), nullable=True))


def downgrade() -> None:
    op.drop_column("runs", "portfolio_id")
    op.drop_index("ix_portfolio_constraints_portfolio_id", "portfolio_constraints")
    op.drop_table("portfolio_constraints")
    op.drop_index("ix_portfolio_positions_issuer_id", "portfolio_positions")
    op.drop_index("ix_portfolio_positions_portfolio_id", "portfolio_positions")
    op.drop_table("portfolio_positions")
    op.drop_table("portfolios")
