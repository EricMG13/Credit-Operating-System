"""Dependency-light retrieval result types shared by retrieval and reranking."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Hit:
    chunk_id: str
    text: str
    score: float


@dataclass(frozen=True)
class CorpusHit(Hit):
    """A retrieval hit attributed to its issuer and source document."""

    issuer_id: str = ""
    doc: str = ""
