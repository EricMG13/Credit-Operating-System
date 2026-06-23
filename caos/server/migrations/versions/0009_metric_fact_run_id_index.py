"""metric_facts.run_id standalone index — run-scoped fact reads

The uq_fact unique constraint leads with issuer_id, so a query filtering by
run_id alone can't use it and scans the table. Add a standalone index for
run-scoped reads as fact volume grows. D8.

Revision ID: 0009
Revises: 0008
Create Date: 2026-06-23
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_metric_facts_run_id", "metric_facts", ["run_id"])


def downgrade() -> None:
    op.drop_index("ix_metric_facts_run_id", table_name="metric_facts")
