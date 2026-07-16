"""Enforce unique monotonic sector-review versions.

Revision ID: 0062
Revises: 0061
Create Date: 2026-07-16
"""

from __future__ import annotations

import json
from collections import defaultdict
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0062"
down_revision: Union[str, None] = "0061"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("sector_review_runs", schema=None) as batch_op:
        batch_op.add_column(sa.Column("version", sa.Integer(), nullable=True))

    bind = op.get_bind()
    rows = bind.execute(sa.text(
        "SELECT id, analyst_id, sector, payload, created_at "
        "FROM sector_review_runs ORDER BY analyst_id, sector, created_at, id"
    )).mappings().all()
    versions: dict[tuple[str | None, str], int] = defaultdict(int)
    for row in rows:
        key = (row["analyst_id"], row["sector"])
        versions[key] += 1
        version = versions[key]
        payload = row["payload"]
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except (TypeError, ValueError):
                payload = {}
        if not isinstance(payload, dict):
            payload = {}
        payload["version"] = version
        authority = payload.get("authority")
        if isinstance(authority, dict):
            authority["version_id"] = f"v{version}"
        bind.execute(
            sa.text(
                "UPDATE sector_review_runs "
                "SET version = :version, payload = :payload WHERE id = :id"
            ).bindparams(sa.bindparam("payload", type_=sa.JSON())),
            {"version": version, "payload": payload, "id": row["id"]},
        )

    with op.batch_alter_table("sector_review_runs", schema=None) as batch_op:
        batch_op.alter_column("version", existing_type=sa.Integer(), nullable=False)
        batch_op.create_unique_constraint(
            "uq_sector_review_analyst_sector_version",
            ["analyst_id", "sector", "version"],
        )


def downgrade() -> None:
    with op.batch_alter_table("sector_review_runs", schema=None) as batch_op:
        batch_op.drop_constraint(
            "uq_sector_review_analyst_sector_version", type_="unique"
        )
        batch_op.drop_column("version")
