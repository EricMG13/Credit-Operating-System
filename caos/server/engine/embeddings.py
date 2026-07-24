import hashlib
import struct
import math
import random
import logging
from typing import List
from datetime import datetime, timezone
import uuid
from sqlalchemy import select, insert

from config import get_settings
from database import Document, DocumentChunk, DocumentChunkEmbedding

logger = logging.getLogger("caos.embeddings")


def get_mock_embedding(text: str, dim: int = 768) -> List[float]:
    """Generates a deterministic, normalized unit vector for mock testing."""
    h = hashlib.sha256(text.encode("utf-8")).digest()
    seed = struct.unpack(">I", h[:4])[0]
    rng = random.Random(seed)
    # Generate a normalized unit vector
    vec = [rng.gauss(0, 1) for _ in range(dim)]
    norm = math.sqrt(sum(x*x for x in vec))
    return [x / (norm or 1.0) for x in vec]


async def get_embeddings(texts: List[str]) -> List[List[float]]:
    """Batch-embed texts using the configured supported Gemini model.

    Missing egress consent/key, provider failure, or malformed output yields no
    vectors. Mock vectors remain available to unit tests but are never persisted
    under a real provider model name.
    """
    if not texts:
        return []

    settings = get_settings()
    if not settings.caos_document_egress_enabled or not settings.gemini_api_key:
        return []

    try:
        from google.genai import types

        from engine.gemini import get_client
        client = get_client()
        # google-genai Client.aio.models.embed_content returns ContentEmbedding objects
        response = await client.aio.models.embed_content(
            model=settings.embedding_model,
            # Embedding 2 aggregates a bare list into one vector. Explicit
            # Content objects preserve the one-input/one-vector contract.
            contents=[
                types.Content(parts=[types.Part.from_text(text=text)])
                for text in texts
            ],
            config=types.EmbedContentConfig(
                output_dimensionality=settings.embedding_dim,
            ),
        )
        if response and hasattr(response, "embeddings"):
            vectors = [list(embedding.values) for embedding in response.embeddings]
            if (
                len(vectors) == len(texts)
                and all(len(vector) == settings.embedding_dim for vector in vectors)
                and all(math.isfinite(value) for vector in vectors for value in vector)
            ):
                return vectors
            logger.error("Embedding response shape was invalid; refusing to persist it.")
        else:
            logger.warning("Empty embeddings response from Gemini; no vectors persisted.")
    except Exception:
        logger.exception("Failed to fetch embeddings from Gemini; no vectors persisted.")

    return []


async def embed_chunks_for_document(db, document_id: str) -> int:
    """Generates and stores embeddings for all chunks of a document that lack them."""
    settings = get_settings()
    if not settings.caos_document_egress_enabled or not settings.gemini_api_key:
        return 0
    document = await db.get(Document, document_id)
    if document is None or document.doc_type == "analyst-memo":
        return 0
    model = settings.embedding_model

    # Fetch all chunks for this document
    stmt = select(DocumentChunk).where(DocumentChunk.document_id == document_id)
    chunks = (await db.execute(stmt)).scalars().all()
    if not chunks:
        return 0

    # Fetch existing embeddings for these chunk hashes and model
    hashes = [c.chunk_hash for c in chunks if c.chunk_hash]
    if not hashes:
        return 0

    existing_stmt = select(DocumentChunkEmbedding.chunk_hash).where(
        DocumentChunkEmbedding.model == model,
        DocumentChunkEmbedding.chunk_hash.in_(hashes)
    )
    existing_hashes = set((await db.execute(existing_stmt)).scalars().all())

    # Filter out chunks that are already embedded
    to_embed = [c for c in chunks if c.chunk_hash not in existing_hashes]
    if not to_embed:
        return 0

    # Dedup by chunk_hash within this batch: a document with repeated boilerplate
    # text (e.g. a governing-law clause repeated verbatim) produces multiple
    # DocumentChunk rows that share the same chunk_hash (see warmup_embeddings_task's
    # dedup below). Embedding is keyed by (model, chunk_hash) (unique index
    # ix_chunk_embeddings_lookup), so inserting duplicates within one batch trips
    # the unique index and loses the WHOLE document's embeddings, not just the dupes.
    seen: set[str] = set()
    deduped = []
    for c in to_embed:
        if c.chunk_hash in seen:
            continue
        seen.add(c.chunk_hash)
        deduped.append(c)
    to_embed = deduped

    logger.info("Embedding %d chunks for document %s", len(to_embed), document_id)

    # Batch process in sizes of 100
    batch_size = 100
    inserted_count = 0
    for i in range(0, len(to_embed), batch_size):
        batch = to_embed[i : i + batch_size]
        texts = [c.text for c in batch]
        
        # Generate embeddings
        vectors = await get_embeddings(texts)
        if len(vectors) != len(batch):
            logger.warning("Embedding batch failed closed; %d chunks remain unembedded.", len(batch))
            continue
        
        embed_dicts = []
        for chunk, vector in zip(batch, vectors):
            embed_dicts.append({
                "id": str(uuid.uuid4()),
                "chunk_hash": chunk.chunk_hash,
                "model": model,
                "vector": vector,
                "created_at": datetime.now(timezone.utc),
            })
        
        if embed_dicts:
            await db.execute(insert(DocumentChunkEmbedding), embed_dicts)
            inserted_count += len(embed_dicts)
            
    await db.flush()
    return inserted_count


async def warmup_embeddings_task(db) -> int:
    """Scans all DocumentChunks and embeds any that lack embeddings for the active model."""
    settings = get_settings()
    if not settings.caos_document_egress_enabled or not settings.gemini_api_key:
        return 0
    model = settings.embedding_model

    # Subquery of all embedded chunk hashes for active model
    embedded_stmt = select(DocumentChunkEmbedding.chunk_hash).where(DocumentChunkEmbedding.model == model)
    
    # Select chunks where chunk_hash is not in the embedded list
    stmt = select(DocumentChunk).join(
        Document, Document.id == DocumentChunk.document_id
    ).where(
        DocumentChunk.chunk_hash.is_not(None),
        ~DocumentChunk.chunk_hash.in_(embedded_stmt),
        Document.doc_type != "analyst-memo",
    )
    rows = (await db.execute(stmt)).scalars().all()
    if not rows:
        return 0
    # Dedup by chunk_hash: a memo linking N issuers creates N DocumentChunk rows
    # that share the same text → same chunk_hash (engine/memochunks.py). Embedding
    # is keyed by (model, chunk_hash) (unique index ix_chunk_embeddings_lookup), so
    # inserting N copies would trip the constraint. Keep one chunk per hash; the
    # shared embedding covers every document_chunk row via the chunk_hash join.
    seen: set[str] = set()
    to_embed = []
    for c in rows:
        if c.chunk_hash in seen:
            continue
        seen.add(c.chunk_hash)
        to_embed.append(c)

    logger.info("Startup warmup: found %d un-embedded chunks to process.", len(to_embed))

    # Batch process in sizes of 100
    batch_size = 100
    inserted_count = 0
    for i in range(0, len(to_embed), batch_size):
        batch = to_embed[i : i + batch_size]
        texts = [c.text for c in batch]
        
        vectors = await get_embeddings(texts)
        if len(vectors) != len(batch):
            logger.warning("Embedding warmup batch failed closed; no mock vectors inserted.")
            continue
        
        embed_dicts = []
        for chunk, vector in zip(batch, vectors):
            embed_dicts.append({
                "id": str(uuid.uuid4()),
                "chunk_hash": chunk.chunk_hash,
                "model": model,
                "vector": vector,
                "created_at": datetime.now(timezone.utc),
            })
            
        if embed_dicts:
            await db.execute(insert(DocumentChunkEmbedding), embed_dicts)
            inserted_count += len(embed_dicts)
            
    await db.commit()
    logger.info("Startup warmup: completed embedding %d chunks.", inserted_count)
    return inserted_count
