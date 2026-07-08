"""analyst_watchlists — per-analyst coverage watchlist for the Desk Brief.

Each row is one issuer an analyst has pinned for a scoped (personalized) Desk
Brief. When an analyst's rows are non-empty, ``engine.queryinsights`` builds a
per-analyst evidence pack (deltas/findings scoped to these issuers) and keys the
cached ``QueryInsight`` by ``analyst_id``. Empty → falls back to the book-level
brief. Additive — no edits to existing tables; mirrors ``analyst_sector_feeds``
(migration 0028) + ``saved_models``.

Revision ID: 0032
Revises: 0031 (pipeline_runs, the prior head)
Create Date: 2026-07-07
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0032"
down_revision: Union[str, None] = "0031"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "analyst_watchlists",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("analyst_id", sa.String(length=255), nullable=False),
        sa.Column("issuer_id", sa.String(length=36), nullable=False),
        sa.Column("added_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("analyst_id", "issuer_id", name="uq_analyst_watchlist"),
        sa.ForeignKeyConstraint(["issuer_id"], ["issuers.id"]),
    )
    op.create_index("ix_analyst_watchlists_analyst_id", "analyst_watchlists", ["analyst_id"])
    op.create_index("ix_analyst_watchlists_issuer_id", "analyst_watchlists", ["issuer_id"])


def downgrade() -> None:
    op.drop_index("ix_analyst_watchlists_issuer_id", table_name="analyst_watchlists")
    op.drop_index("ix_analyst_watchlists_analyst_id", table_name="analyst_watchlists")
    op.drop_table("analyst_watchlists")
