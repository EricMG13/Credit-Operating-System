"""Enforce normalized issuer-name uniqueness within each tenancy scope.

Revision ID: 0059
Revises: 0058
Create Date: 2026-07-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0059"
down_revision: Union[str, None] = "0058"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _preflight_existing_names(connection: sa.Connection) -> None:
    seen: set[tuple[str, str]] = set()
    for row in connection.execute(
        sa.text("SELECT id, name, team_id FROM issuers ORDER BY id")
    ).mappings():
        display_name = str(row["name"]).strip()
        if not display_name:
            raise RuntimeError(
                "0059 upgrade refused: an issuer has a blank normalized name; "
                "repair it before retrying the migration"
            )
        identity = (str(row["team_id"] or ""), display_name.casefold())
        if identity in seen:
            raise RuntimeError(
                "0059 upgrade refused: duplicate normalized issuer name "
                f"{identity[1]!r} exists in scope {identity[0]!r}; "
                "merge the duplicate coverage rows before retrying"
            )
        seen.add(identity)


def upgrade() -> None:
    connection = op.get_bind()
    _preflight_existing_names(connection)
    with op.batch_alter_table("issuers", schema=None) as batch_op:
        batch_op.add_column(sa.Column("normalized_name", sa.String(768), nullable=True))
        batch_op.add_column(sa.Column("uniqueness_scope", sa.String(64), nullable=True))
    rows = connection.execute(
        sa.text("SELECT id, name, team_id FROM issuers ORDER BY id")
    ).mappings().all()
    if rows:
        connection.execute(
            sa.text("""
                UPDATE issuers
                SET name = :name,
                    normalized_name = :normalized_name,
                    uniqueness_scope = :uniqueness_scope
                WHERE id = :id
            """),
            [
                {
                    "id": row["id"],
                    "name": str(row["name"]).strip(),
                    "normalized_name": str(row["name"]).strip().casefold(),
                    "uniqueness_scope": str(row["team_id"] or ""),
                }
                for row in rows
            ],
        )
    with op.batch_alter_table("issuers", schema=None) as batch_op:
        batch_op.alter_column(
            "normalized_name", existing_type=sa.String(768), nullable=False
        )
        batch_op.alter_column(
            "uniqueness_scope", existing_type=sa.String(64), nullable=False
        )
        batch_op.create_unique_constraint(
            "uq_issuers_scope_normalized_name",
            ["uniqueness_scope", "normalized_name"],
        )


def downgrade() -> None:
    with op.batch_alter_table("issuers", schema=None) as batch_op:
        batch_op.drop_constraint("uq_issuers_scope_normalized_name", type_="unique")
        batch_op.drop_column("uniqueness_scope")
        batch_op.drop_column("normalized_name")
