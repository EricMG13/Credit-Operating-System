"""runs.model_mode — analyst-selected model mode per run

The runner installs the analyst's TEST/LITE/BALANCED/MAX mode (engine/presets.py)
for a run's LLM lanes. It is persisted here so a run executing in the background
worker — including across a re-claim, which runs outside the creating request —
applies the same tier the request chose. NULL = the default mode.

Revision ID: 0013
Revises: 0012
Create Date: 2026-06-26
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("runs", sa.Column("model_mode", sa.String(length=16), nullable=True))


def downgrade() -> None:
    op.drop_column("runs", "model_mode")
