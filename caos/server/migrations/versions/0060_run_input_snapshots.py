"""Bind each issuer run to an immutable, authority-aware input corpus.

Revision ID: 0060
Revises: 0059
Create Date: 2026-07-16
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0060"
down_revision: Union[str, None] = "0059"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("runs", schema=None) as batch_op:
        batch_op.add_column(sa.Column("input_document_ids", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("input_manifest_ids", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("input_corpus_sha256", sa.String(64), nullable=True))
        batch_op.add_column(sa.Column("input_snapshot_state", sa.String(24), nullable=True))
    # Older builds persisted deterministic random vectors under a real provider
    # model name. They cannot be distinguished from genuine embeddings, so clear
    # them and rebuild only after an explicitly authorised, successful API call.
    op.execute(sa.text("DELETE FROM document_chunk_embeddings"))


def downgrade() -> None:
    with op.batch_alter_table("runs", schema=None) as batch_op:
        batch_op.drop_column("input_snapshot_state")
        batch_op.drop_column("input_corpus_sha256")
        batch_op.drop_column("input_manifest_ids")
        batch_op.drop_column("input_document_ids")
