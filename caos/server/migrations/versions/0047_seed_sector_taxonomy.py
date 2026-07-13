"""Seed the canonical sector taxonomy as migration-owned reference data.

Revision ID: 0047
Revises: 0046
Create Date: 2026-07-13
"""
from datetime import datetime, timezone
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0047"
down_revision: Union[str, None] = "0046"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_ROWS = [
    ("automotive", "Automotive", ["auto", "autos"]),
    ("business-services", "Business Services", ["services", "b2b services"]),
    ("chemicals", "Chemicals", ["chemical"]),
    ("consumer", "Consumer", ["consumer products", "retail", "consumer discretionary", "consumer staples"]),
    ("energy", "Energy", ["oil and gas", "o&g"]),
    ("financials", "Financials", ["financial services", "fig"]),
    ("food-beverage", "Food & Beverage", ["food and beverage", "f&b"]),
    ("gaming-leisure", "Gaming & Leisure", ["gaming", "leisure", "entertainment"]),
    ("healthcare", "Healthcare", ["health care"]),
    ("industrials", "Industrials", ["industrial"]),
    ("media", "Media", ["media and entertainment", "communication services"]),
    ("materials", "Materials", ["basic materials"]),
    ("metals-mining", "Metals & Mining", ["metals and mining", "mining"]),
    ("packaging", "Packaging", ["containers and packaging"]),
    ("real-estate", "Real Estate", ["property"]),
    ("software", "Software", ["technology", "tech", "information technology", "it services", "technology hardware"]),
    ("telecom", "Telecom", ["telecommunications", "telecoms", "cable telecom"]),
    ("transportation", "Transportation", ["transport", "logistics"]),
    ("utilities", "Utilities", ["utility"]),
]


def upgrade() -> None:
    table = sa.table(
        "sector_taxonomy",
        sa.column("id", sa.String),
        sa.column("label", sa.String),
        sa.column("aliases", sa.JSON),
        sa.column("active", sa.Boolean),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    now = datetime.now(timezone.utc)
    op.bulk_insert(table, [{
        "id": sector_id,
        "label": label,
        "aliases": aliases,
        "active": True,
        "created_at": now,
        "updated_at": now,
    } for sector_id, label, aliases in _ROWS])


def downgrade() -> None:
    table = sa.table("sector_taxonomy", sa.column("id", sa.String))
    op.execute(table.delete().where(table.c.id.in_([row[0] for row in _ROWS])))
