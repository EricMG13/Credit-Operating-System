"""Constrain analyst roles to the authorization vocabulary.

Revision ID: 0064
Revises: 0063
Create Date: 2026-07-19
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0064"
down_revision: Union[str, None] = "0063"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Normalize known legacy spellings and fail unknown values closed to viewer
    # before the constraint is installed.
    op.execute(
        sa.text(
            """UPDATE analysts
               SET role = CASE
                   WHEN lower(trim(role)) IN ('analyst', 'qa', 'admin')
                       THEN lower(trim(role))
                   WHEN lower(trim(role)) IN ('viewer', 'read-only', 'read_only', 'readonly')
                       THEN 'viewer'
                   ELSE 'viewer'
               END"""
        )
    )
    with op.batch_alter_table("analysts", schema=None) as batch_op:
        batch_op.create_check_constraint(
            "ck_analysts_role",
            "role IN ('analyst', 'viewer', 'qa', 'admin')",
        )


def downgrade() -> None:
    with op.batch_alter_table("analysts", schema=None) as batch_op:
        batch_op.drop_constraint("ck_analysts_role", type_="check")
