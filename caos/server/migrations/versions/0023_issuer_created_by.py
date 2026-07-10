"""issuers.created_by — attribution for analyst-created issuers + manual ratings

Records which analyst created an issuer row (name, manual agency ratings, sponsor)
so a wrong or tampered manual rating is attributable to a person, not merely
visible in the transport access log. Additive + nullable: existing rows and seed
issuers stay NULL. Mirrors Run.analyst_id (String(255) to hold either a profile
UUID or a proxy email identity). SEAM4-4.

Revision ID: 0023
Revises: 0022
Create Date: 2026-07-04
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0023"
down_revision: Union[str, None] = "0022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("issuers", sa.Column("created_by", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("issuers", "created_by")
