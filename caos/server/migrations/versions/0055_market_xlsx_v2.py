"""Analyst-owned immutable market workbook snapshots.

Revision ID: 0055
Revises: 0054
Create Date: 2026-07-14
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0055"
down_revision: Union[str, None] = "0054"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("documents", schema=None) as batch_op:
        batch_op.alter_column(
            "issuer_id", existing_type=sa.String(36), existing_nullable=False, nullable=True
        )
        batch_op.add_column(sa.Column("analyst_id", sa.String(255), nullable=True))
        batch_op.create_index("ix_documents_analyst_id", ["analyst_id"])

    with op.batch_alter_table("source_manifests", schema=None) as batch_op:
        batch_op.alter_column(
            "issuer_id", existing_type=sa.String(36), existing_nullable=False, nullable=True
        )

    with op.batch_alter_table("market_snapshots", schema=None) as batch_op:
        batch_op.add_column(sa.Column("analyst_id", sa.String(255), nullable=True))
        batch_op.add_column(sa.Column("document_id", sa.String(36), nullable=True))
        batch_op.add_column(sa.Column("source_manifest_id", sa.String(36), nullable=True))
        batch_op.add_column(
            sa.Column("import_mapping", sa.JSON(), nullable=False, server_default="{}")
        )
        batch_op.create_foreign_key(
            "fk_market_snapshots_document_id",
            "documents",
            ["document_id"],
            ["id"],
            ondelete="RESTRICT",
        )
        batch_op.create_foreign_key(
            "fk_market_snapshots_source_manifest_id",
            "source_manifests",
            ["source_manifest_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index("ix_market_snapshots_analyst_id", ["analyst_id"])
        batch_op.create_index(
            "ix_market_snapshots_analyst_created", ["analyst_id", "created_at"]
        )

    op.create_table(
        "market_import_issues",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "snapshot_id",
            sa.String(36),
            sa.ForeignKey("market_snapshots.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("severity", sa.String(16), nullable=False),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("message", sa.String(1024), nullable=False),
        sa.Column("row_number", sa.Integer(), nullable=True),
        sa.Column("column", sa.String(32), nullable=True),
        sa.Column("field", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_market_import_issues_snapshot_severity",
        "market_import_issues",
        ["snapshot_id", "severity"],
    )


def downgrade() -> None:
    """Allow schema rollback only before market-v2 evidence exists.

    Operational rollback is the feature flag and intentionally retains imported
    snapshots/audit. Dropping this additive schema after a live import would
    destroy authority fields, so fail closed instead of silently deleting them.
    """
    connection = op.get_bind()
    imported = connection.execute(
        sa.text("SELECT COUNT(*) FROM market_snapshots WHERE analyst_id IS NOT NULL")
    ).scalar_one()
    issues = connection.execute(sa.text("SELECT COUNT(*) FROM market_import_issues")).scalar_one()
    if imported or issues:
        raise RuntimeError(
            "0055 downgrade refused: disable CAOS_MARKET_XLSX_V2_ENABLED and retain imported market evidence"
        )

    op.drop_index(
        "ix_market_import_issues_snapshot_severity", table_name="market_import_issues"
    )
    op.drop_table("market_import_issues")

    with op.batch_alter_table("market_snapshots", schema=None) as batch_op:
        batch_op.drop_index("ix_market_snapshots_analyst_created")
        batch_op.drop_index("ix_market_snapshots_analyst_id")
        batch_op.drop_constraint(
            "fk_market_snapshots_source_manifest_id", type_="foreignkey"
        )
        batch_op.drop_constraint("fk_market_snapshots_document_id", type_="foreignkey")
        batch_op.drop_column("import_mapping")
        batch_op.drop_column("source_manifest_id")
        batch_op.drop_column("document_id")
        batch_op.drop_column("analyst_id")

    with op.batch_alter_table("source_manifests", schema=None) as batch_op:
        batch_op.alter_column(
            "issuer_id", existing_type=sa.String(36), existing_nullable=True, nullable=False
        )

    with op.batch_alter_table("documents", schema=None) as batch_op:
        batch_op.drop_index("ix_documents_analyst_id")
        batch_op.drop_column("analyst_id")
        batch_op.alter_column(
            "issuer_id", existing_type=sa.String(36), existing_nullable=True, nullable=False
        )
