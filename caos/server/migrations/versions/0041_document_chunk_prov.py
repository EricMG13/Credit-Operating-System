"""D1: document_chunks.prov — chunk-level extraction provenance.

Every chunk today is implicitly "extracted with confidence" (markitdown or
pypdf's real text layer). A chunk pulled off a scanned/image page via OCR is
lower-fidelity (misreads, layout loss) and CP-5/analysts need to be able to
discount it accordingly — nothing distinguished the two before this. NULL =
native text extraction (the overwhelming majority, unchanged meaning);
``"ocr"`` = ocrmypdf/Tesseract recognition, the one lane that's discountable.

Revision ID: 0041
Revises: 0040
Create Date: 2026-07-12
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0041"
down_revision: Union[str, None] = "0040"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("document_chunks", sa.Column("prov", sa.String(length=16), nullable=True))


def downgrade() -> None:
    op.drop_column("document_chunks", "prov")
