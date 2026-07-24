"""Add documents.content_sha256 + a partial unique index for content-identity dedupe.

Purely additive: a new nullable column plus a new partial unique index. No
existing column, constraint, or index is touched.

Root cause (audit finding): documents has no unique constraint of any kind, so
re-uploading/re-vaulting byte-identical content creates a second Document row
with a fresh id and fresh chunk ids. Embedding-layer chunk_hash dedupe
(ix_chunk_embeddings_lookup) already prevents redundant embedding cost, but
retrieval.rrf_fusion keys results by chunk_id — a fresh UUID per copy — so the
same paragraph can be returned and cited as two independent sources in a memo.

The index is partial, not a plain unique constraint, for these reasons:
  - issuer_id is nullable (analyst-owned documents, e.g. market-price
    workbooks, carry issuer_id=NULL); a plain unique index would still let
    those rows collide de facto since SQL treats NULL <> NULL in a unique
    index anyway, but scoping explicitly to status='active' keeps the intent
    self-documenting.
  - status='active' so a withdrawn document doesn't permanently block a
    future re-upload of the same content after withdrawal.
  - content_sha256 IS NOT NULL so rows from paths that don't populate the
    column (pre-migration history, any future path that legitimately can't
    compute it) never spuriously collide with each other.
  - chunk_count > 0 so a document that failed to parse/chunk (0 chunks — it
    was never in document_chunks, so it can never be double-cited by
    retrieval.rrf_fusion in the first place) doesn't permanently trap a
    later re-upload of the same bytes behind a stale, empty copy. Confirmed
    by test_api.py::test_upload_with_text_has_no_warning, which re-uploads
    byte-identical content that previously produced 0 chunks and expects a
    fresh, successful parse to actually run.

Both dialects support a partial/filtered unique index (see migration 0035's
uq_runs_issuer_active and 0066's ix_watch_rules_due_claim for the established
precedent of op.create_index(..., postgresql_where=..., sqlite_where=...)) —
this migration follows the same portable pattern rather than dialect-specific
raw DDL.

Revision ID: 0069
Revises: 0068
Create Date: 2026-07-23
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0069"
down_revision: Union[str, None] = "0068"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_ACTIVE_HASHED_PREDICATE = (
    "status = 'active' AND content_sha256 IS NOT NULL AND chunk_count > 0"
)


def upgrade() -> None:
    with op.batch_alter_table("documents", schema=None) as batch_op:
        batch_op.add_column(sa.Column("content_sha256", sa.String(64), nullable=True))
    # Outside batch mode: SQLite's batch_alter_table already committed the
    # rebuilt table above (matches 0066's ix_watch_rules_due_claim, added the
    # same way right after its owning table's batch block).
    op.create_index(
        "uq_documents_issuer_content_hash_active",
        "documents",
        ["issuer_id", "content_sha256"],
        unique=True,
        postgresql_where=sa.text(_ACTIVE_HASHED_PREDICATE),
        sqlite_where=sa.text(_ACTIVE_HASHED_PREDICATE),
    )
    # Plain lookup index backing the ORM's mapped_column(index=True) — the
    # partial unique index above only covers active/hashed rows, so this one
    # gives withdrawn/duplicate rows a fast content_sha256 lookup path too.
    op.create_index(
        "ix_documents_content_sha256", "documents", ["content_sha256"],
    )


def downgrade() -> None:
    # Nullable additive column + index, never backfilled with data that would
    # be lost on drop — no safety preflight needed (contrast 0068, which
    # guards a downgrade that could silently drop durable idempotency
    # records).
    op.drop_index("ix_documents_content_sha256", table_name="documents")
    op.drop_index("uq_documents_issuer_content_hash_active", table_name="documents")
    with op.batch_alter_table("documents", schema=None) as batch_op:
        batch_op.drop_column("content_sha256")
