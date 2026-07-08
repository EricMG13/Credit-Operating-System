import logging
from typing import List, Dict, Set, Optional, Sequence, TypeVar
import tiktoken
from sqlalchemy import select

from config import get_settings
from database import DocumentChunk, DocumentChunkEmbedding
from retrieval import Hit, cosine_similarity

H = TypeVar("H", bound=Hit)

logger = logging.getLogger("caos.packer")


def get_token_count(text: str, encoding) -> int:
    try:
        return len(encoding.encode(text))
    except Exception:
        # Fallback word count approximation
        return len(text.split())


async def pack_context(  # noqa: C901
    db,
    hits: Sequence[H],
    query_vector: Optional[List[float]],
    token_budget: int = 6000,
    lambda_mmr: float = 0.5,
    max_chunks_per_doc: int = 3,
) -> List[H]:
    """Packs retrieved hits into a token-budgeted context using MMR and diversity constraints.
    
    If query_vector and chunk vectors are available, uses vector cosine similarity for MMR.
    Otherwise, falls back to lexical token-set overlap (Jaccard similarity).
    """
    if not hits:
        return []

    settings = get_settings()
    model = settings.embedding_model

    try:
        encoding = tiktoken.get_encoding("cl100k_base")
    except Exception:
        encoding = None

    # 1. Fetch metadata (document associations) and vectors
    chunk_ids = [h.chunk_id for h in hits]
    
    # Query document info for each chunk
    doc_stmt = (
        select(DocumentChunk.id, DocumentChunk.document_id)
        .where(DocumentChunk.id.in_(chunk_ids))
    )
    doc_rows = (await db.execute(doc_stmt)).all()
    chunk_to_doc = {r[0]: r[1] for r in doc_rows}

    # Query vectors
    vectors = {}
    if query_vector:
        vector_stmt = (
            select(DocumentChunk.id, DocumentChunkEmbedding.vector)
            .join(DocumentChunkEmbedding, DocumentChunkEmbedding.chunk_hash == DocumentChunk.chunk_hash)
            .where(
                DocumentChunk.id.in_(chunk_ids),
                DocumentChunkEmbedding.model == model
            )
        )
        vec_rows = (await db.execute(vector_stmt)).all()
        vectors = {r[0]: r[1] for r in vec_rows}

    # Calculate token counts
    token_counts = {h.chunk_id: get_token_count(h.text, encoding) for h in hits}

    # 2. Run MMR selection loop
    selected: List[H] = []
    selected_ids: Set[str] = set()
    doc_counts: Dict[str, int] = {}
    total_tokens = 0

    # Build candidates list
    candidates = list(hits)

    # For lexical fallback, precompute word sets
    word_sets = {}
    if not vectors:
        for h in hits:
            word_sets[h.chunk_id] = set(h.text.lower().split())

    while candidates and total_tokens < token_budget:
        best_score = -9999.0
        best_cand = None

        for cand in candidates:
            # Enforce source diversity quota (cap chunks per document)
            doc_id = chunk_to_doc.get(cand.chunk_id)
            if doc_id and doc_counts.get(doc_id, 0) >= max_chunks_per_doc:
                continue

            # Calculate Relevance Sim_1
            # If we have RRF score or similarity score, use it as relevance base
            relevance = cand.score

            # Calculate Redundancy Sim_2
            redundancy = 0.0
            if selected:
                if vectors and cand.chunk_id in vectors:
                    v_cand = vectors[cand.chunk_id]
                    similarities = []
                    for sel in selected:
                        if sel.chunk_id in vectors:
                            similarities.append(cosine_similarity(v_cand, vectors[sel.chunk_id]))
                    redundancy = max(similarities) if similarities else 0.0
                else:
                    # Jaccard overlap fallback
                    s_cand = word_sets.get(cand.chunk_id, set())
                    similarities = []
                    for sel in selected:
                        s_sel = word_sets.get(sel.chunk_id, set())
                        union_len = len(s_cand.union(s_sel))
                        jaccard = len(s_cand.intersection(s_sel)) / union_len if union_len else 0.0
                        similarities.append(jaccard)
                    redundancy = max(similarities) if similarities else 0.0

            # MMR formula
            mmr_score = lambda_mmr * relevance - (1 - lambda_mmr) * redundancy

            if mmr_score > best_score:
                best_score = mmr_score
                best_cand = cand

        if not best_cand:
            # No more candidates meet diversity constraints
            break

        # Check token budget
        cand_tokens = token_counts.get(best_cand.chunk_id, 0)
        if total_tokens + cand_tokens <= token_budget:
            selected.append(best_cand)
            selected_ids.add(best_cand.chunk_id)
            doc_id = chunk_to_doc.get(best_cand.chunk_id)
            if doc_id:
                doc_counts[doc_id] = doc_counts.get(doc_id, 0) + 1
            total_tokens += cand_tokens
        
        # Remove from candidates
        candidates.remove(best_cand)

    logger.info("Packed %d chunks into %d tokens (budget %d)", len(selected), total_tokens, token_budget)
    return selected
