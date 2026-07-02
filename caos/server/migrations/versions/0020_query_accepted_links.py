"""query_accepted_links — analyst-ratified model-proposed issuer links (Query phase 3)

Revision ID: 0020
Revises: 0019
Create Date: 2026-07-02
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0020"
down_revision: Union[str, None] = "0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "query_accepted_links",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("issuer_a", sa.String(length=36), sa.ForeignKey("issuers.id"), nullable=False, index=True),
        sa.Column("issuer_b", sa.String(length=36), sa.ForeignKey("issuers.id"), nullable=False, index=True),
        sa.Column("capability_id", sa.String(length=64), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=True),
        sa.Column("chunk_ids", sa.JSON(), nullable=True),
        sa.Column("confidence", sa.String(length=16), nullable=True),
        sa.Column("model", sa.String(length=128), nullable=True),
        sa.Column("analyst_id", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("issuer_a", "issuer_b", name="uq_accepted_link_pair"),
    )


def downgrade() -> None:
    op.drop_table("query_accepted_links")
