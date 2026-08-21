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
def _get_model() -> CrossEncoder | None:
    # Loaded once at first use and cached - CrossEncoder load is slow, don't
    # repeat it per call.
    try:
        return CrossEncoder(MODEL_NAME)
    except Exception as e:
        print(f"[RAG Rerank] Warning: Could not load HuggingFace CrossEncoder model '{MODEL_NAME}' ({e}). Fallback active.")
        return None


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

    model = _get_model()
    if model is not None:
        try:
            pairs = [(query, c.text) for c in candidates]
            scores = model.predict(pairs)

            scored = [
                candidate.model_copy(update={"rerank_score": float(score)})
                for candidate, score in zip(candidates, scores)
            ]
            scored.sort(key=lambda c: c.rerank_score or 0.0, reverse=True)
            return scored
        except Exception as e:
            print(f"[RAG Rerank] Rerank prediction failed ({e}). Using word-overlap fallback scoring.")

    # Fallback to Jaccard similarity between query and candidate text
    query_words = set(query.lower().split())
    scored = []
    for candidate in candidates:
        cand_words = set(candidate.text.lower().split())
        intersection = query_words.intersection(cand_words)
        union = query_words.union(cand_words)
        jaccard = len(intersection) / len(union) if union else 0.0
        
        # Jaccard score range [0.0, 1.0]
        scored.append(candidate.model_copy(update={"rerank_score": float(jaccard)}))
        
    scored.sort(key=lambda c: c.rerank_score or 0.0, reverse=True)
    return scored
