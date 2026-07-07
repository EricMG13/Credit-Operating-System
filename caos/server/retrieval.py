"""BM25 retrieval over an issuer's ingested document_chunks.

The ingestion path already chunks every uploaded document into
``document_chunks`` ([ingest.py]), but until now nothing queried them — issuer
chat was grounded only on context the client passed in. This module scores
those chunks against a free-text query so module synthesis can ground claims in
real source text and link each evidence item back to the chunk it came from.

Self-contained pure-Python BM25 (Okapi) — no extra dependency, and the scoring
core (``bm25_rank``) is database-free so it unit-tests in isolation. A later
phase can swap the corpus fetch for a vector index (e.g. pgvector in the existing
Postgres — free/self-hostable, no new infra) behind the same interface.
"""

from __future__ import annotations

import asyncio
import math
import re
from collections import Counter
from dataclasses import dataclass
from typing import List, Optional, Sequence, Tuple
from sqlalchemy import select, func, desc, and_
from sqlalchemy.ext.asyncio import AsyncSession

from database import Document, DocumentChunk, engine, DocumentChunkEmbedding
from config import get_settings

_TOKEN_RE = re.compile(r"[a-z0-9]+")
_K1 = 1.5  # term-frequency saturation
_B = 0.75  # length normalisation
# ponytail: cap the cross-issuer BM25 fetch so an unfiltered corpus query can't
# load every chunk of every issuer into Python. Sized well above the Phase-1
# universe (~15 issuers) so ranking is unaffected today; swap for pgvector/ts_rank
# (scoring in Postgres) if the corpus ever outgrows this.
_CORPUS_SCAN_CAP = 5000


def tokenize(text: str) -> List[str]:
    return _TOKEN_RE.findall(text.lower())


@dataclass(frozen=True)
class Hit:
    chunk_id: str
    text: str
    score: float


@dataclass(frozen=True)
class Bm25Index:
    """A BM25 index over a fixed corpus — built once, ranked many times.

    Within a run the issuer's chunks are static, so building the index once and
    reusing it across the run's many ``retrieve()`` calls (per module + per claim)
    avoids re-tokenizing the whole corpus on every call (P4-2).
    """

    docs: List[Tuple[str, "Counter[str]", int, str]]  # (chunk_id, term-freqs, len, text)
    n: int
    avgdl: float
    df: "Counter[str]"  # document frequency per term


def build_index(corpus: Sequence[Tuple[str, str]]) -> Bm25Index:
    """Tokenize + count a ``(chunk_id, text)`` corpus into a reusable BM25 index."""
    docs: List[Tuple[str, Counter, int, str]] = []
    df: Counter[str] = Counter()
    total_len = 0
    for cid, text in corpus:
        toks = tokenize(text)
        tf = Counter(toks)
        docs.append((cid, tf, len(toks) or 1, text))
        df.update(tf.keys())  # each distinct term counts once toward document freq
        total_len += len(toks)
    n = len(docs)
    return Bm25Index(docs=docs, n=n, avgdl=(total_len / n) if n else 0.0, df=df)


def rank_with_index(index: Bm25Index, query: str, k: int = 5) -> List[Hit]:
    """Okapi BM25-rank ``query`` against a prebuilt index — pure scoring, no corpus
    tokenization. At most ``k`` hits with a positive score, best first."""
    q_terms = tokenize(query)
    if not q_terms or index.n == 0:
        return []
    q_set = set(q_terms)
    # log(1 + …) keeps idf strictly positive, so any query-term match scores > 0.
    idf = {t: math.log(1 + (index.n - index.df[t] + 0.5) / (index.df[t] + 0.5)) for t in q_set}
    hits: List[Hit] = []
    for cid, tf, dl, text in index.docs:
        score = 0.0
        for t in q_set:
            f = tf.get(t, 0)
            if not f:
                continue
            score += idf[t] * (f * (_K1 + 1)) / (f + _K1 * (1 - _B + _B * dl / index.avgdl))
        if score > 0:
            hits.append(Hit(chunk_id=cid, text=text, score=score))
    hits.sort(key=lambda h: h.score, reverse=True)
    return hits[:k]


def bm25_rank(query: str, corpus: Sequence[Tuple[str, str]], k: int = 5) -> List[Hit]:
    """One-shot BM25: build an index from ``corpus`` and rank ``query`` against it.
    Kept for single-query callers; in-run code builds the index once and reuses it."""
    return rank_with_index(build_index(corpus), query, k=k)


def cosine_similarity(v1: list[float], v2: list[float]) -> float:
    """Calculates the cosine similarity between two vectors."""
    dot = sum(x * y for x, y in zip(v1, v2))
    norm1 = math.sqrt(sum(x*x for x in v1))
    norm2 = math.sqrt(sum(x*x for x in v2))
    if not norm1 or not norm2:
        return 0.0
    return dot / (norm1 * norm2)


def python_vector_search(query_vector: list[float], chunk_rows: list, k: int) -> list[Tuple[str, str, str, str, float]]:
    """Calculates cosine similarity in Python for SQLite database off-thread."""
    results = []
    for chunk_id, text, issuer_id, file_name, vector_data in chunk_rows:
        if not vector_data:
            continue
        sim = cosine_similarity(query_vector, vector_data)
        results.append((chunk_id, text, issuer_id, file_name, sim))
    results.sort(key=lambda x: x[4], reverse=True)
    return results[:k]


def rrf_fusion(bm25_hits: list[Hit], vector_hits: list[Hit], limit: int = 5, k_rrf: int = 60) -> list[Hit]:
    """Combines lexical and vector retrieval scores using Reciprocal Rank Fusion (RRF)."""
    scores = {}
    meta = {}
    
    for rank, hit in enumerate(bm25_hits, start=1):
        scores[hit.chunk_id] = scores.get(hit.chunk_id, 0.0) + (1.0 / (k_rrf + rank))
        meta[hit.chunk_id] = hit
        
    for rank, hit in enumerate(vector_hits, start=1):
        scores[hit.chunk_id] = scores.get(hit.chunk_id, 0.0) + (1.0 / (k_rrf + rank))
        if hit.chunk_id not in meta:
            meta[hit.chunk_id] = hit
            
    sorted_cids = sorted(scores.keys(), key=lambda cid: scores[cid], reverse=True)
    
    fused = []
    for cid in sorted_cids[:limit]:
        orig_hit = meta[cid]
        if hasattr(orig_hit, "issuer_id"):
            fused.append(CorpusHit(
                chunk_id=cid,
                text=orig_hit.text,
                score=scores[cid],
                issuer_id=orig_hit.issuer_id,
                doc=orig_hit.doc
            ))
        else:
            fused.append(Hit(
                chunk_id=cid,
                text=orig_hit.text,
                score=scores[cid]
            ))
    return fused


async def retrieve(db: AsyncSession, issuer_id: str, query: str, k: int = 5) -> List[Hit]:
    """Hybrid (BM25 + Semantic Vector) retrieval for an issuer's document chunks against ``query``."""
    # 1. BM25 Search
    if engine.dialect.name == "postgresql":
        stmt = (
            select(
                DocumentChunk.id,
                DocumentChunk.text,
                func.ts_rank_cd(DocumentChunk.tsv, func.websearch_to_tsquery("english", query)).label("score")
            )
            .join(Document, Document.id == DocumentChunk.document_id)
            .where(
                Document.issuer_id == issuer_id,
                DocumentChunk.tsv.op("@@")(func.websearch_to_tsquery("english", query))
            )
            .order_by(desc("score"))
            .limit(k * 2)
        )
        rows = (await db.execute(stmt)).all()
        bm25_hits = [Hit(chunk_id=r[0], text=r[1], score=float(r[2])) for r in rows]
    else:
        rows = (
            await db.execute(
                select(DocumentChunk.id, DocumentChunk.text)
                .join(Document, Document.id == DocumentChunk.document_id)
                .where(Document.issuer_id == issuer_id)
                .limit(_CORPUS_SCAN_CAP)
            )
        ).all()
        corpus = [(r[0], r[1]) for r in rows]
        bm25_hits = await asyncio.to_thread(bm25_rank, query, corpus, k * 2)

    # 2. Vector Search
    settings = get_settings()
    if not settings.gemini_api_key:
        return bm25_hits[:k]

    model = settings.embedding_model
    from engine.embeddings import get_embeddings
    query_vectors = await get_embeddings([query])
    query_vector = query_vectors[0] if query_vectors else None

    if not query_vector:
        return bm25_hits[:k]

    if engine.dialect.name == "postgresql":
        stmt = (
            select(
                DocumentChunk.id,
                DocumentChunk.text,
                (1.0 - DocumentChunkEmbedding.vector.cosine_distance(query_vector)).label("score")
            )
            .join(Document, Document.id == DocumentChunk.document_id)
            .join(DocumentChunkEmbedding, DocumentChunkEmbedding.chunk_hash == DocumentChunk.chunk_hash)
            .where(
                Document.issuer_id == issuer_id,
                DocumentChunkEmbedding.model == model
            )
            .order_by(desc("score"))
            .limit(k * 2)
        )
        rows = (await db.execute(stmt)).all()
        vector_hits = [Hit(chunk_id=r[0], text=r[1], score=float(r[2])) for r in rows]
    else:
        stmt = (
            select(
                DocumentChunk.id,
                DocumentChunk.text,
                Document.issuer_id,
                Document.file_name,
                DocumentChunkEmbedding.vector
            )
            .join(Document, Document.id == DocumentChunk.document_id)
            .join(DocumentChunkEmbedding, DocumentChunkEmbedding.chunk_hash == DocumentChunk.chunk_hash)
            .where(
                Document.issuer_id == issuer_id,
                DocumentChunkEmbedding.model == model
            )
            .limit(_CORPUS_SCAN_CAP)
        )
        rows = (await db.execute(stmt)).all()
        python_hits = await asyncio.to_thread(python_vector_search, query_vector, rows, k * 2)
        vector_hits = [Hit(chunk_id=r[0], text=r[1], score=r[4]) for r in python_hits]

    # 3. RRF Fusion
    return rrf_fusion(bm25_hits, vector_hits, limit=k)


async def build_issuer_index(db: AsyncSession, issuer_id: str) -> Bm25Index:
    """Fetch an issuer's document chunks and build the BM25 index once. The runner
    builds this at the start of a run and reuses it across every ``retrieve()``
    call, so the corpus is tokenized once rather than per call (P4-2)."""
    rows = (
        await db.execute(
            select(DocumentChunk.id, DocumentChunk.text)
            .join(Document, Document.id == DocumentChunk.document_id)
            .where(Document.issuer_id == issuer_id)
            .limit(_CORPUS_SCAN_CAP)
        )
    ).all()
    return await asyncio.to_thread(build_index, [(r[0], r[1]) for r in rows])


@dataclass(frozen=True)
class CorpusHit(Hit):
    """A BM25/Vector hit attributed to its issuer and source document — for cross-issuer
    semantic query, where the same retrieval ranks chunks from many issuers."""

    issuer_id: str = ""
    doc: str = ""  # source file_name


async def retrieve_corpus(
    db: AsyncSession,
    query: str,
    k: int = 8,
    issuer_ids: Optional[Sequence[str]] = None,
) -> List[CorpusHit]:
    """Hybrid (BM25 + Semantic Vector) cross-issuer search with RRF fusion."""
    # 1. BM25 Search
    if engine.dialect.name == "postgresql":
        stmt = (
            select(
                DocumentChunk.id,
                DocumentChunk.text,
                Document.issuer_id,
                Document.file_name,
                func.ts_rank_cd(DocumentChunk.tsv, func.websearch_to_tsquery("english", query)).label("score")
            )
            .join(Document, Document.id == DocumentChunk.document_id)
            .where(DocumentChunk.tsv.op("@@")(func.websearch_to_tsquery("english", query)))
        )
        if issuer_ids:
            stmt = stmt.where(Document.issuer_id.in_(list(issuer_ids)))
        stmt = stmt.order_by(desc("score")).limit(k * 2)
        rows = (await db.execute(stmt)).all()
        bm25_hits = [
            CorpusHit(chunk_id=r[0], text=r[1], score=float(r[4]), issuer_id=r[2], doc=r[3])
            for r in rows
        ]
    else:
        stmt = (
            select(DocumentChunk.id, DocumentChunk.text, Document.issuer_id, Document.file_name)
            .join(Document, Document.id == DocumentChunk.document_id)
        )
        if issuer_ids:
            stmt = stmt.where(Document.issuer_id.in_(list(issuer_ids)))
        stmt = stmt.limit(_CORPUS_SCAN_CAP)
        rows = (await db.execute(stmt)).all()
        meta = {r[0]: (r[2], r[3]) for r in rows}
        corpus = [(r[0], r[1]) for r in rows]
        hits = await asyncio.to_thread(bm25_rank, query, corpus, k * 2)
        bm25_hits = [
            CorpusHit(chunk_id=h.chunk_id, text=h.text, score=h.score,
                      issuer_id=meta[h.chunk_id][0], doc=meta[h.chunk_id][1])
            for h in hits
        ]

    # 2. Vector Search
    settings = get_settings()
    if not settings.gemini_api_key:
        return bm25_hits[:k]

    model = settings.embedding_model
    from engine.embeddings import get_embeddings
    query_vectors = await get_embeddings([query])
    query_vector = query_vectors[0] if query_vectors else None

    if not query_vector:
        return bm25_hits[:k]

    if engine.dialect.name == "postgresql":
        stmt = (
            select(
                DocumentChunk.id,
                DocumentChunk.text,
                Document.issuer_id,
                Document.file_name,
                (1.0 - DocumentChunkEmbedding.vector.cosine_distance(query_vector)).label("score")
            )
            .join(Document, Document.id == DocumentChunk.document_id)
            .join(DocumentChunkEmbedding, DocumentChunkEmbedding.chunk_hash == DocumentChunk.chunk_hash)
            .where(DocumentChunkEmbedding.model == model)
        )
        if issuer_ids:
            stmt = stmt.where(Document.issuer_id.in_(list(issuer_ids)))
        stmt = stmt.order_by(desc("score")).limit(k * 2)
        rows = (await db.execute(stmt)).all()
        vector_hits = [
            CorpusHit(chunk_id=r[0], text=r[1], score=float(r[4]), issuer_id=r[2], doc=r[3])
            for r in rows
        ]
    else:
        stmt = (
            select(
                DocumentChunk.id,
                DocumentChunk.text,
                Document.issuer_id,
                Document.file_name,
                DocumentChunkEmbedding.vector
            )
            .join(Document, Document.id == DocumentChunk.document_id)
            .join(DocumentChunkEmbedding, DocumentChunkEmbedding.chunk_hash == DocumentChunk.chunk_hash)
            .where(DocumentChunkEmbedding.model == model)
        )
        if issuer_ids:
            stmt = stmt.where(Document.issuer_id.in_(list(issuer_ids)))
        stmt = stmt.limit(_CORPUS_SCAN_CAP)
        rows = (await db.execute(stmt)).all()
        python_hits = await asyncio.to_thread(python_vector_search, query_vector, rows, k * 2)
        vector_hits = [
            CorpusHit(chunk_id=r[0], text=r[1], score=r[4], issuer_id=r[2], doc=r[3])
            for r in python_hits
        ]

    # 3. RRF Fusion
    return rrf_fusion(bm25_hits, vector_hits, limit=k)


async def retrieve_corpus_by_issuer(
    db: AsyncSession, query: str, issuer_ids: Sequence[str]
) -> dict[str, CorpusHit]:
    """Hybrid (BM25 + Semantic Vector) single best-matching chunk per issuer with RRF fusion."""
    if not issuer_ids:
        return {}

    # 1. BM25 Search
    if engine.dialect.name == "postgresql":
        stmt = (
            select(
                DocumentChunk.id,
                DocumentChunk.text,
                Document.issuer_id,
                Document.file_name,
                func.ts_rank_cd(DocumentChunk.tsv, func.websearch_to_tsquery("english", query)).label("score")
            )
            .distinct(Document.issuer_id)
            .join(Document, Document.id == DocumentChunk.document_id)
            .where(
                Document.issuer_id.in_(list(issuer_ids)),
                DocumentChunk.tsv.op("@@")(func.websearch_to_tsquery("english", query))
            )
            .order_by(Document.issuer_id, desc("score"))
        )
        rows = (await db.execute(stmt)).all()
        bm25_best = {
            r[2]: CorpusHit(chunk_id=r[0], text=r[1], score=float(r[4]), issuer_id=r[2], doc=r[3])
            for r in rows
        }
    else:
        rows = (await db.execute(
            select(DocumentChunk.id, DocumentChunk.text, Document.issuer_id, Document.file_name)
            .join(Document, Document.id == DocumentChunk.document_id)
            .where(Document.issuer_id.in_(list(issuer_ids)))
            .limit(_CORPUS_SCAN_CAP)
        )).all()
        meta = {r[0]: (r[2], r[3]) for r in rows}
        corpus = [(r[0], r[1]) for r in rows]
        hits = await asyncio.to_thread(bm25_rank, query, corpus, len(corpus))
        bm25_best: dict[str, CorpusHit] = {}
        for h in hits:
            iid = meta[h.chunk_id][0]
            if iid not in bm25_best:
                bm25_best[iid] = CorpusHit(chunk_id=h.chunk_id, text=h.text, score=h.score,
                                          issuer_id=iid, doc=meta[h.chunk_id][1])

    # 2. Vector Search
    settings = get_settings()
    if not settings.gemini_api_key:
        return bm25_best

    model = settings.embedding_model
    from engine.embeddings import get_embeddings
    query_vectors = await get_embeddings([query])
    query_vector = query_vectors[0] if query_vectors else None

    if not query_vector:
        return bm25_best

    if engine.dialect.name == "postgresql":
        stmt = (
            select(
                DocumentChunk.id,
                DocumentChunk.text,
                Document.issuer_id,
                Document.file_name,
                (1.0 - DocumentChunkEmbedding.vector.cosine_distance(query_vector)).label("score")
            )
            .distinct(Document.issuer_id)
            .join(Document, Document.id == DocumentChunk.document_id)
            .join(DocumentChunkEmbedding, DocumentChunkEmbedding.chunk_hash == DocumentChunk.chunk_hash)
            .where(
                Document.issuer_id.in_(list(issuer_ids)),
                DocumentChunkEmbedding.model == model
            )
            .order_by(Document.issuer_id, desc("score"))
        )
        rows = (await db.execute(stmt)).all()
        vector_best = {
            r[2]: CorpusHit(chunk_id=r[0], text=r[1], score=float(r[4]), issuer_id=r[2], doc=r[3])
            for r in rows
        }
    else:
        stmt = (
            select(
                DocumentChunk.id,
                DocumentChunk.text,
                Document.issuer_id,
                Document.file_name,
                DocumentChunkEmbedding.vector
            )
            .join(Document, Document.id == DocumentChunk.document_id)
            .join(DocumentChunkEmbedding, DocumentChunkEmbedding.chunk_hash == DocumentChunk.chunk_hash)
            .where(
                Document.issuer_id.in_(list(issuer_ids)),
                DocumentChunkEmbedding.model == model
            )
            .limit(_CORPUS_SCAN_CAP)
        )
        rows = (await db.execute(stmt)).all()
        python_hits = await asyncio.to_thread(python_vector_search, query_vector, rows, len(rows))
        vector_best: dict[str, CorpusHit] = {}
        for r in python_hits:
            iid = r[2]
            if iid not in vector_best:
                vector_best[iid] = CorpusHit(chunk_id=r[0], text=r[1], score=r[4],
                                             issuer_id=iid, doc=r[3])

    # 3. Per-Issuer RRF Fusion
    fused_best: dict[str, CorpusHit] = {}
    all_iids = set(bm25_best.keys()).union(vector_best.keys())
    for iid in all_iids:
        b_hits = [bm25_best[iid]] if iid in bm25_best else []
        v_hits = [vector_best[iid]] if iid in vector_best else []
        fused = rrf_fusion(b_hits, v_hits, limit=1)
        if fused:
            fused_best[iid] = fused[0]
            
    return fused_best
