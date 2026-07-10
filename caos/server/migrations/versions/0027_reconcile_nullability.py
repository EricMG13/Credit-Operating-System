"""reconcile column nullability with the ORM models

The 2.0 models declare non-Optional ``Mapped[...]`` columns (NOT NULL by
contract), but earlier migrations omitted ``nullable=False`` on every column
backed by a Python ``default=`` — so the DB permitted NULLs the models forbid.
``alembic check`` flagged the drift (~35 columns across 11 tables). This sets
NOT NULL to match, so a raw INSERT / bulk-copy / any path bypassing the
Python-side ``default=`` can no longer persist a NULL that later crashes a reader.

Wrapped in ``batch_alter_table`` because SQLite (dev) has no direct
``ALTER COLUMN SET NOT NULL`` — batch rebuilds the table; Postgres (prod) applies
a direct ALTER. ``render_as_batch`` is on in env.py. Must run while the columns
hold no NULLs: SET NOT NULL errors on a pre-existing NULL (ORM defaults mean
there won't be one, but confirm on any live DB before upgrading).

Regenerated against the current model set at head 0026 (autogenerate) — the
earlier reconcile attempt (commit 316decc8, revision 0023) was orphaned and
predated the 0024/0025/0026 tables; that revision id shipped as an unrelated
``issuers.created_by`` column instead. The ``analysts.email`` bare ``unique=True``
drift is fixed model-side (a named ``Index`` matching migration 0008), so it is
not in this op set.

Revision ID: 0027
Revises: 0026
Create Date: 2026-07-05
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import sqlite

revision: str = "0027"
down_revision: Union[str, None] = "0026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("analysts", schema=None) as batch_op:
        batch_op.alter_column("created_at", existing_type=sa.DATETIME(), nullable=False)

    with op.batch_alter_table("documents", schema=None) as batch_op:
        batch_op.alter_column("chunk_count", existing_type=sa.INTEGER(), nullable=False,
                              existing_server_default=sa.text("'0'"))
        batch_op.alter_column("uploaded_at", existing_type=sa.DATETIME(), nullable=False)

    with op.batch_alter_table("evidence_items", schema=None) as batch_op:
        batch_op.alter_column("confidence", existing_type=sa.VARCHAR(length=32), nullable=False)

    with op.batch_alter_table("issuers", schema=None) as batch_op:
        batch_op.alter_column("created_at", existing_type=sa.DATETIME(), nullable=False)

    with op.batch_alter_table("metric_facts", schema=None) as batch_op:
        batch_op.alter_column("unit", existing_type=sa.VARCHAR(length=16), nullable=False)
        batch_op.alter_column("headline", existing_type=sa.BOOLEAN(), nullable=False)
        batch_op.alter_column("qa_status", existing_type=sa.VARCHAR(length=16), nullable=False)
        batch_op.alter_column("provenance", existing_type=sa.VARCHAR(length=16), nullable=False)
        batch_op.alter_column("created_at", existing_type=sa.DATETIME(), nullable=False)

    with op.batch_alter_table("module_outputs", schema=None) as batch_op:
        batch_op.alter_column("schema_family", existing_type=sa.VARCHAR(length=32), nullable=False)
        batch_op.alter_column("runtime_output", existing_type=sqlite.JSON(), nullable=False)
        batch_op.alter_column("confidence", existing_type=sa.VARCHAR(length=32), nullable=False)
        batch_op.alter_column("qa_status", existing_type=sa.VARCHAR(length=16), nullable=False)
        batch_op.alter_column("committee_status", existing_type=sa.VARCHAR(length=32), nullable=False)
        batch_op.alter_column("validation_status", existing_type=sa.VARCHAR(length=16), nullable=False)
        batch_op.alter_column("limitation_flags", existing_type=sqlite.JSON(), nullable=False)
        batch_op.alter_column("downstream_consumers", existing_type=sqlite.JSON(), nullable=False)
        batch_op.alter_column("created_at", existing_type=sa.DATETIME(), nullable=False)

    with op.batch_alter_table("qa_flags", schema=None) as batch_op:
        batch_op.alter_column("created_at", existing_type=sa.DATETIME(), nullable=False)

    with op.batch_alter_table("query_accepted_links", schema=None) as batch_op:
        batch_op.alter_column("rationale", existing_type=sa.TEXT(), nullable=False)
        batch_op.alter_column("chunk_ids", existing_type=sqlite.JSON(), nullable=False)
        batch_op.alter_column("confidence", existing_type=sa.VARCHAR(length=16), nullable=False)
        batch_op.alter_column("model", existing_type=sa.VARCHAR(length=128), nullable=False)
        batch_op.alter_column("created_at", existing_type=sa.DATETIME(), nullable=False)

    with op.batch_alter_table("query_overlays", schema=None) as batch_op:
        batch_op.alter_column("payload", existing_type=sqlite.JSON(), nullable=False)
        batch_op.alter_column("created_at", existing_type=sa.DATETIME(), nullable=False)

    with op.batch_alter_table("research_jobs", schema=None) as batch_op:
        batch_op.alter_column("brief", existing_type=sqlite.JSON(), nullable=False)
        batch_op.alter_column("sources", existing_type=sqlite.JSON(), nullable=False)
        batch_op.alter_column("created_at", existing_type=sa.DATETIME(), nullable=False)

    with op.batch_alter_table("runs", schema=None) as batch_op:
        batch_op.alter_column("status", existing_type=sa.VARCHAR(length=16), nullable=False)
        batch_op.alter_column("qa_status", existing_type=sa.VARCHAR(length=16), nullable=False)
        batch_op.alter_column("committee_status", existing_type=sa.VARCHAR(length=32), nullable=False)
        batch_op.alter_column("tokens_used", existing_type=sa.INTEGER(), nullable=False,
                              existing_server_default=sa.text("'0'"))
        batch_op.alter_column("created_at", existing_type=sa.DATETIME(), nullable=False)


def downgrade() -> None:
    with op.batch_alter_table("runs", schema=None) as batch_op:
        batch_op.alter_column("created_at", existing_type=sa.DATETIME(), nullable=True)
        batch_op.alter_column("tokens_used", existing_type=sa.INTEGER(), nullable=True,
                              existing_server_default=sa.text("'0'"))
        batch_op.alter_column("committee_status", existing_type=sa.VARCHAR(length=32), nullable=True)
        batch_op.alter_column("qa_status", existing_type=sa.VARCHAR(length=16), nullable=True)
        batch_op.alter_column("status", existing_type=sa.VARCHAR(length=16), nullable=True)

    with op.batch_alter_table("research_jobs", schema=None) as batch_op:
        batch_op.alter_column("created_at", existing_type=sa.DATETIME(), nullable=True)
        batch_op.alter_column("sources", existing_type=sqlite.JSON(), nullable=True)
        batch_op.alter_column("brief", existing_type=sqlite.JSON(), nullable=True)

    with op.batch_alter_table("query_overlays", schema=None) as batch_op:
        batch_op.alter_column("created_at", existing_type=sa.DATETIME(), nullable=True)
        batch_op.alter_column("payload", existing_type=sqlite.JSON(), nullable=True)

    with op.batch_alter_table("query_accepted_links", schema=None) as batch_op:
        batch_op.alter_column("created_at", existing_type=sa.DATETIME(), nullable=True)
        batch_op.alter_column("model", existing_type=sa.VARCHAR(length=128), nullable=True)
        batch_op.alter_column("confidence", existing_type=sa.VARCHAR(length=16), nullable=True)
        batch_op.alter_column("chunk_ids", existing_type=sqlite.JSON(), nullable=True)
        batch_op.alter_column("rationale", existing_type=sa.TEXT(), nullable=True)

    with op.batch_alter_table("qa_flags", schema=None) as batch_op:
        batch_op.alter_column("created_at", existing_type=sa.DATETIME(), nullable=True)

    with op.batch_alter_table("module_outputs", schema=None) as batch_op:
        batch_op.alter_column("created_at", existing_type=sa.DATETIME(), nullable=True)
        batch_op.alter_column("downstream_consumers", existing_type=sqlite.JSON(), nullable=True)
        batch_op.alter_column("limitation_flags", existing_type=sqlite.JSON(), nullable=True)
        batch_op.alter_column("validation_status", existing_type=sa.VARCHAR(length=16), nullable=True)
        batch_op.alter_column("committee_status", existing_type=sa.VARCHAR(length=32), nullable=True)
        batch_op.alter_column("qa_status", existing_type=sa.VARCHAR(length=16), nullable=True)
        batch_op.alter_column("confidence", existing_type=sa.VARCHAR(length=32), nullable=True)
        batch_op.alter_column("runtime_output", existing_type=sqlite.JSON(), nullable=True)
        batch_op.alter_column("schema_family", existing_type=sa.VARCHAR(length=32), nullable=True)

    with op.batch_alter_table("metric_facts", schema=None) as batch_op:
        batch_op.alter_column("created_at", existing_type=sa.DATETIME(), nullable=True)
        batch_op.alter_column("provenance", existing_type=sa.VARCHAR(length=16), nullable=True)
        batch_op.alter_column("qa_status", existing_type=sa.VARCHAR(length=16), nullable=True)
        batch_op.alter_column("headline", existing_type=sa.BOOLEAN(), nullable=True)
        batch_op.alter_column("unit", existing_type=sa.VARCHAR(length=16), nullable=True)

    with op.batch_alter_table("issuers", schema=None) as batch_op:
        batch_op.alter_column("created_at", existing_type=sa.DATETIME(), nullable=True)

    with op.batch_alter_table("evidence_items", schema=None) as batch_op:
        batch_op.alter_column("confidence", existing_type=sa.VARCHAR(length=32), nullable=True)

    with op.batch_alter_table("documents", schema=None) as batch_op:
        batch_op.alter_column("uploaded_at", existing_type=sa.DATETIME(), nullable=True)
        batch_op.alter_column("chunk_count", existing_type=sa.INTEGER(), nullable=True,
                              existing_server_default=sa.text("'0'"))

    with op.batch_alter_table("analysts", schema=None) as batch_op:
        batch_op.alter_column("created_at", existing_type=sa.DATETIME(), nullable=True)
