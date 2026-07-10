"""Optional multi-team tenancy: team_id on issuers and analysts.

The platform is a single shared coverage desk by design — every authenticated
analyst sees every issuer/run/portfolio (SECURITY.md §2), safe because the edge SSO
admits ONE Google Workspace domain (one team). routes/runs.py notes that if the
trust model ever widens to more than one team, per-caller authorization MUST be
added. This adds the mechanism: a nullable ``team_id`` on issuers (the tenancy
anchor — runs/documents/metric_facts/portfolio all key off issuer_id) and on
analysts (the caller's team). NULL team_id = shared/global (visible to every team,
e.g. the reference demo issuer). Enforcement is gated by ``CAOS_TENANCY_ENABLED``
(config, default off), so on the single-team default this column is inert and every
existing behaviour is unchanged.

Revision ID: 0036
Revises: 0035
Create Date: 2026-07-10
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0036"
down_revision: Union[str, None] = "0035"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("issuers", sa.Column("team_id", sa.String(length=64), nullable=True))
    op.add_column("analysts", sa.Column("team_id", sa.String(length=64), nullable=True))
    op.create_index("ix_issuers_team_id", "issuers", ["team_id"])
    op.create_index("ix_analysts_team_id", "analysts", ["team_id"])


def downgrade() -> None:
    op.drop_index("ix_analysts_team_id", table_name="analysts")
    op.drop_index("ix_issuers_team_id", table_name="issuers")
    op.drop_column("analysts", "team_id")
    op.drop_column("issuers", "team_id")
