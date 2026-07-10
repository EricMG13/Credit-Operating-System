"""qa_flags — analyst-raised QA flags from the Deep-Dive output register

Wires the previously-inert "FLAG TO QA · CP-5" button: an analyst escalation is
now a recorded audit row. A separate table from qa_findings on purpose — engine
findings gate runs (CP-5 abort, 409 committee export), and an analyst flag must
never trip those gates.

Revision ID: 0022
Revises: 0021
Create Date: 2026-07-03
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0022"
down_revision: Union[str, None] = "0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "qa_flags",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("issuer_id", sa.String(36), nullable=True),
        sa.Column("run_id", sa.String(36), nullable=True),
        sa.Column("module_id", sa.String(16), nullable=False),
        sa.Column("step_ref", sa.String(120), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("analyst_id", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_qa_flags_issuer_id", "qa_flags", ["issuer_id"])
    op.create_index("ix_qa_flags_run_id", "qa_flags", ["run_id"])
    op.create_index("ix_qa_flags_module_id", "qa_flags", ["module_id"])
    op.create_index("ix_qa_flags_analyst_id", "qa_flags", ["analyst_id"])


def downgrade() -> None:
    op.drop_index("ix_qa_flags_analyst_id", table_name="qa_flags")
    op.drop_index("ix_qa_flags_module_id", table_name="qa_flags")
    op.drop_index("ix_qa_flags_run_id", table_name="qa_flags")
    op.drop_index("ix_qa_flags_issuer_id", table_name="qa_flags")
    op.drop_table("qa_flags")
