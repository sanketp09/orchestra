"""
Wraps BAAI/bge-small-en-v1.5 (via sentence-transformers) for embedding text
into the 384-dim vectors stored in `evidence.embedding` /
`historical_cases.embedding`.

bge models recommend prefixing *queries* (not documents) with an instruction
string for best retrieval performance - that's what `is_query` controls.
"""

from __future__ import annotations

from functools import lru_cache

from sentence_transformers import SentenceTransformer

MODEL_NAME = "BAAI/bge-small-en-v1.5"

# bge-recommended instruction prefix for search queries. Do NOT apply this to
# documents being ingested - only to queries at retrieval time.
QUERY_PREFIX = "Represent this sentence for searching relevant passages: "


@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    # Loaded once and cached - this is a slow model load, don't repeat it per call.
    return SentenceTransformer(MODEL_NAME)


def embed(text: str, is_query: bool = False) -> list[float]:
    """
    Embed a single string into a 384-dim vector.

    Args:
        text: The text to embed.
        is_query: Set True when embedding a search query (applies the bge
            query-instruction prefix). Leave False when embedding a document
            chunk for ingestion.

    Returns:
        A 384-length list of floats.
    """
    return embed_batch([text], is_query=is_query)[0]


def embed_batch(texts: list[str], is_query: bool = False) -> list[list[float]]:
    """
    Embed multiple strings in a single batched model call.

    Prefer this over calling `embed` in a loop - ingestion embeds many
    chunks at once and batching is significantly faster than embedding
    one-at-a-time.

    Args:
        texts: The texts to embed.
        is_query: Set True when embedding search queries (applies the bge
            query-instruction prefix to every text in the batch). Leave
            False when embedding document chunks for ingestion.

    Returns:
        A list of 384-length float vectors, one per input text, in order.
    """
    if not texts:
        return []

    inputs = [QUERY_PREFIX + t for t in texts] if is_query else list(texts)
    vectors = _get_model().encode(inputs, batch_size=32, convert_to_numpy=True)
    return [v.tolist() for v in vectors]
