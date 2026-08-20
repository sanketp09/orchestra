"""
Stand-in for the shared `common/embedding_client.py`.

Local sentence-transformers model only — no external embedding API calls,
per the project's constraint. If this already exists in your monorepo,
delete this file; Precedent only needs `embed(text: str) -> list[float]`.
"""

from functools import lru_cache

from sentence_transformers import SentenceTransformer

_MODEL_NAME = "all-MiniLM-L6-v2"  # 384-dim, matches historical_cases.embedding


@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    return SentenceTransformer(_MODEL_NAME)


def embed(text: str) -> list[float]:
    model = _get_model()
    vector = model.encode(text, normalize_embeddings=True)
    return vector.tolist()
