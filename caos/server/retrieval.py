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

import math
import re
from collections import Counter
from dataclasses import dataclass
from typing import List, Optional, Sequence, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import Document, DocumentChunk

_TOKEN_RE = re.compile(r"[a-z0-9]+")
_K1 = 1.5  # term-frequency saturation
_B = 0.75  # length normalisation


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


async def retrieve(db: AsyncSession, issuer_id: str, query: str, k: int = 5) -> List[Hit]:
    """BM25-rank an issuer's document chunks against ``query``."""
    rows = (
        await db.execute(
            select(DocumentChunk.id, DocumentChunk.text)
            .join(Document, Document.id == DocumentChunk.document_id)
            .where(Document.issuer_id == issuer_id)
        )
    ).all()
    corpus = [(r[0], r[1]) for r in rows]
    return bm25_rank(query, corpus, k=k)


async def build_issuer_index(db: AsyncSession, issuer_id: str) -> Bm25Index:
    """Fetch an issuer's document chunks and build the BM25 index once. The runner
    builds this at the start of a run and reuses it across every ``retrieve()``
    call, so the corpus is tokenized once rather than per call (P4-2)."""
    rows = (
        await db.execute(
            select(DocumentChunk.id, DocumentChunk.text)
            .join(Document, Document.id == DocumentChunk.document_id)
            .where(Document.issuer_id == issuer_id)
        )
    ).all()
    return build_index([(r[0], r[1]) for r in rows])


@dataclass(frozen=True)
class CorpusHit(Hit):
    """A BM25 hit attributed to its issuer and source document — for cross-issuer
    semantic query, where the same retrieval ranks chunks from many issuers."""

    issuer_id: str = ""
    doc: str = ""  # source file_name


async def retrieve_corpus(
    db: AsyncSession,
    query: str,
    k: int = 8,
    issuer_ids: Optional[Sequence[str]] = None,
) -> List[CorpusHit]:
    """BM25-rank document chunks across all issuers (or a subset), attributing
    each hit to the issuer + source document it came from."""
    stmt = (
        select(DocumentChunk.id, DocumentChunk.text, Document.issuer_id, Document.file_name)
        .join(Document, Document.id == DocumentChunk.document_id)
    )
    if issuer_ids:
        stmt = stmt.where(Document.issuer_id.in_(list(issuer_ids)))
    rows = (await db.execute(stmt)).all()
    meta = {r[0]: (r[2], r[3]) for r in rows}  # chunk_id -> (issuer_id, file_name)
    corpus = [(r[0], r[1]) for r in rows]
    return [
        CorpusHit(chunk_id=h.chunk_id, text=h.text, score=h.score,
                  issuer_id=meta[h.chunk_id][0], doc=meta[h.chunk_id][1])
        for h in bm25_rank(query, corpus, k=k)
    ]


async def retrieve_corpus_by_issuer(
    db: AsyncSession, query: str, issuer_ids: Sequence[str]
) -> dict[str, CorpusHit]:
    """The single best-matching chunk *per issuer* for ``query``, in one query +
    one BM25 pass. Replaces N per-issuer ``retrieve_corpus`` calls in the hybrid
    NL query (PERF-1: avoids the N+1 at portfolio scale)."""
    if not issuer_ids:
        return {}
    rows = (await db.execute(
        select(DocumentChunk.id, DocumentChunk.text, Document.issuer_id, Document.file_name)
        .join(Document, Document.id == DocumentChunk.document_id)
        .where(Document.issuer_id.in_(list(issuer_ids)))
    )).all()
    meta = {r[0]: (r[2], r[3]) for r in rows}
    corpus = [(r[0], r[1]) for r in rows]
    best: dict[str, CorpusHit] = {}
    for h in bm25_rank(query, corpus, k=len(corpus)):  # hits are best-first
        iid = meta[h.chunk_id][0]
        if iid not in best:  # first hit seen per issuer is its top chunk
            best[iid] = CorpusHit(chunk_id=h.chunk_id, text=h.text, score=h.score,
                                  issuer_id=iid, doc=meta[h.chunk_id][1])
    return best
