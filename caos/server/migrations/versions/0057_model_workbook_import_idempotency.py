"""Add deterministic idempotency to model workbook commits.

Revision ID: 0057
Revises: 0056
Create Date: 2026-07-14
"""

from __future__ import annotations

import hashlib
import json
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0057"
down_revision: Union[str, None] = "0056"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _require_online(operation: str) -> None:
    """This revision must inspect live rows before changing their schema."""

    if op.get_context().as_sql:
        raise RuntimeError(
            f"0057 {operation} is online-only: deterministic fingerprint backfill "
            "and model-v2 evidence preflight require a live database connection"
        )


def _v2_evidence_count(connection: sa.Connection) -> int:
    """Count every 0056-owned evidence shape before destructive downgrade."""

    private_rows = connection.execute(sa.text("""
        SELECT
            (SELECT COUNT(*) FROM model_drafts_v2)
          + (SELECT COUNT(*) FROM model_override_events)
          + (SELECT COUNT(*) FROM model_workbook_imports)
    """)).scalar_one()
    checkpoint_rows = connection.execute(sa.text("""
        SELECT COUNT(*)
        FROM model_checkpoints
        WHERE engine_version IS NOT NULL
           OR source_fingerprint IS NOT NULL
           OR input_fingerprint IS NOT NULL
           OR calculation_hash IS NOT NULL
           OR draft_revision IS NOT NULL
    """)).scalar_one()
    report_rows = connection.execute(sa.text("""
        SELECT COUNT(*)
        FROM report_versions
        WHERE model_engine_version IS NOT NULL
           OR model_source_fingerprint IS NOT NULL
           OR model_input_fingerprint IS NOT NULL
           OR model_calculation_hash IS NOT NULL
           OR model_draft_revision IS NOT NULL
    """)).scalar_one()
    return int(private_rows) + int(checkpoint_rows) + int(report_rows)


def _fingerprint(row: sa.RowMapping) -> str:
    mapping = row["mapping"] or {}
    if isinstance(mapping, str):
        try:
            mapping = json.loads(mapping)
        except json.JSONDecodeError:
            mapping = {"legacy_raw": mapping}
    payload = json.dumps(
        {
            "analyst_id": row["analyst_id"],
            "issuer_id": row["issuer_id"],
            "workbook_sha256": row["workbook_sha256"],
            "mapping": mapping,
            # A committed import advances the draft exactly once. Including its base
            # revision preserves retry idempotency without preventing a later,
            # intentional re-import of the same workbook.
            "expected_revision": max(0, int(row["committed_revision"]) - 1),
        },
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def upgrade() -> None:
    _require_online("upgrade")
    with op.batch_alter_table("model_workbook_imports", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("import_fingerprint", sa.String(64), nullable=True)
        )
    connection = op.get_bind()
    rows = (
        connection.execute(
            sa.text(
                "SELECT id, analyst_id, issuer_id, workbook_sha256, mapping, committed_revision "
                "FROM model_workbook_imports ORDER BY id"
            )
        )
        .mappings()
        .all()
    )
    seen: set[str] = set()
    for row in rows:
        fingerprint = _fingerprint(row)
        # A legacy duplicate remains distinct while preserving deterministic
        # replay behavior for all new commits.
        if fingerprint in seen:
            fingerprint = hashlib.sha256(
                f"{fingerprint}:{row['id']}".encode()
            ).hexdigest()
        seen.add(fingerprint)
        connection.execute(
            sa.text(
                "UPDATE model_workbook_imports SET import_fingerprint = :fingerprint "
                "WHERE id = :id"
            ),
            {"fingerprint": fingerprint, "id": row["id"]},
        )
    with op.batch_alter_table("model_workbook_imports", schema=None) as batch_op:
        batch_op.alter_column(
            "import_fingerprint",
            existing_type=sa.String(64),
            nullable=False,
        )
        batch_op.create_index(
            "uq_model_workbook_imports_fingerprint",
            ["import_fingerprint"],
            unique=True,
        )


def downgrade() -> None:
    _require_online("downgrade")
    connection = op.get_bind()
    # Run the complete 0056 evidence preflight before the first DDL statement.
    # This is essential on SQLite, where batch DDL cannot be assumed to roll
    # back if the following 0056 downgrade refuses its own evidence check.
    if _v2_evidence_count(connection):
        raise RuntimeError(
            "0057 downgrade refused: model-v2 evidence exists; disable the "
            "feature flag and retain the additive schema"
        )
    with op.batch_alter_table("model_workbook_imports", schema=None) as batch_op:
        batch_op.drop_index("uq_model_workbook_imports_fingerprint")
        batch_op.drop_column("import_fingerprint")
