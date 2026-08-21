"""
Reranks retrieval candidates with a cross-encoder for higher precision than
vector/keyword search alone can give.
"""

from __future__ import annotations

from functools import lru_cache

from sentence_transformers import CrossEncoder

from common.rag.models import RetrievalResult

MODEL_NAME = "cross-encoder/ms-marco-MiniLM-L-6-v2"


@lru_cache(maxsize=1)
def _get_model() -> CrossEncoder:
    # Loaded once at first use and cached - CrossEncoder load is slow, don't
    # repeat it per call.
    return CrossEncoder(MODEL_NAME)


def rerank(query: str, candidates: list[RetrievalResult]) -> list[RetrievalResult]:
    """
    Score each (query, candidate.text) pair with a cross-encoder and return
    the candidates sorted descending by the new rerank_score.

    Args:
        query: The original search query text (not the embedded vector).
        candidates: Retrieval candidates to score. Not mutated in place -
            new RetrievalResult objects are returned with rerank_score set.

    Returns:
        A new list of RetrievalResult, same length as `candidates`, sorted
        descending by rerank_score.
    """
    if not candidates:
        return []

    pairs = [(query, c.text) for c in candidates]
    scores = _get_model().predict(pairs)

    scored = [
        candidate.model_copy(update={"rerank_score": float(score)})
        for candidate, score in zip(candidates, scores)
    ]
    scored.sort(key=lambda c: c.rerank_score, reverse=True)
    return scored
