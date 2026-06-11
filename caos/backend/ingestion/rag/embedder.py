"""
Embedding generation for RAG chunks.
Uses sentence-transformers locally in dev; swap for Cohere/OpenAI in prod.
The embedding dimension must match the pgvector column.

Current model: all-MiniLM-L6-v2 (384-dim) — matches `vector(384)` in init.sql.
If you switch to a larger model (e.g. all-mpnet-base-v2 / 768-dim,
Cohere v3 / 1024-dim, OpenAI 3-large / 3072-dim), you MUST also alter the
`document_chunks.embedding` column to the new dimension via Alembic.
"""

from __future__ import annotations

import anyio
import structlog
from sentence_transformers import SentenceTransformer

logger = structlog.get_logger()

_model: SentenceTransformer | None = None
MODEL_NAME = "all-MiniLM-L6-v2"  # 384-dim; switch to all-mpnet-base-v2 for 768-dim


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        logger.info("Loading embedding model", model=MODEL_NAME)
        _model = SentenceTransformer(MODEL_NAME)
    return _model


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """
    Embed a batch of texts.
    Returns a list of float vectors (one per input text).

    NOTE: For production, replace with:
      - Cohere embed-english-v3.0 (1024-dim, better financial domain)
      - OpenAI text-embedding-3-large (3072-dim, reducible)
    Adjust pgvector column dimension accordingly.

    `model.encode` is CPU-bound and synchronous, so it is run in a worker
    thread to avoid blocking the async event loop.
    """
    model = _get_model()

    def _encode() -> list[list[float]]:
        embeddings = model.encode(texts, show_progress_bar=False, normalize_embeddings=True)
        return embeddings.tolist()

    return await anyio.to_thread.run_sync(_encode)
