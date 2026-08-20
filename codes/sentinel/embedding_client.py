"""
Shared local embedding client.

Wraps sentence-transformers/all-MiniLM-L6-v2 (384-dim output) so every
specialist service embeds text the same way, matching the
`embedding vector(384)` column used across Supabase tables.

No external embedding API is called from here on purpose - keep this fully
local so specialists don't take on an extra network dependency just to
embed text.
"""

from functools import lru_cache

_MODEL_NAME = "all-MiniLM-L6-v2"


@lru_cache(maxsize=1)
def _get_model():
    # Imported and loaded lazily (and cached) so importing this module - and
    # anything that transitively imports it - doesn't pay the
    # sentence-transformers/torch import and model-load cost until the first
    # embed() call.
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(_MODEL_NAME)


def embed(text: str) -> list[float]:
    """Embed a single string, returning a 384-dim float vector."""
    model = _get_model()
    vector = model.encode(text, normalize_embeddings=True)
    return vector.tolist()


def embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed many strings at once - cheaper than calling embed() in a loop."""
    if not texts:
        return []
    model = _get_model()
    vectors = model.encode(texts, normalize_embeddings=True)
    return vectors.tolist()
