"""Persist OKF typed key facts on the registry row.

Additive: one nullable JSON column on the ``okf_notes`` table added in 0069. No
legacy table is touched.

Why the registry rather than a new table: the facts are a denormalized projection
of one document's extraction, read as a unit by exactly one consumer (the CP-4C
marketed-vs-reported bridge). Storing them beside the document they came from
keeps the supersede semantics already built into ``okf_notes`` — replacing a
document replaces its facts in the same transaction, with no second lifecycle to
keep in sync.

Revision ID: 0070
Revises: 0069
Create Date: 2026-07-25
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0071"
down_revision: Union[str, None] = "0070"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "okf_notes",
        sa.Column("key_facts_json", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("okf_notes", "key_facts_json")
