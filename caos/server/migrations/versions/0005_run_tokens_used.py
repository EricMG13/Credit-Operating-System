"""runs.tokens_used — per-run LLM token accounting

The runner installs a per-run token budget (engine/budget.py); the total spent is
recorded here so cost is observable and the budget enforceable.

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-15
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("runs", sa.Column("tokens_used", sa.Integer(), nullable=True, server_default="0"))


def downgrade() -> None:
    op.drop_column("runs", "tokens_used")
