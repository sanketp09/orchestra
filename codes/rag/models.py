"""Shared data models for the RAG library."""

from __future__ import annotations

from pydantic import BaseModel, Field


class Chunk(BaseModel):
    """A single embedded chunk of source text, ready to be stored."""

    chunk_id: str
    source_id: str  # the parent evidence_id or case_id
    text: str
    embedding: list[float]
    metadata: dict = Field(default_factory=dict)


class RetrievalResult(BaseModel):
    """One row returned by hybrid_search, with both raw and reranked scores."""

    chunk_id: str
    source_id: str
    text: str
    vector_score: float
    keyword_score: float
    rerank_score: float | None = None
    metadata: dict = Field(default_factory=dict)
