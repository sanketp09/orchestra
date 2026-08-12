"""
Real text embedding calls for Feature 2's fuzzy duplicate matching. Cheap and
fast enough to call synchronously inline in the PO creation endpoint — no
reason to mock or batch this.
"""

from __future__ import annotations

import os

from openai import OpenAI

_MODEL = "text-embedding-3-small"  # 1536-dim, matches POLineItem.description_embedding
_EMBEDDING_DIM = 1536


def _client() -> OpenAI:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Embedding calls require a real API key."
        )
    return OpenAI(api_key=api_key)


def embed_text(text: str) -> list[float]:
    """
    Embed a single piece of text (typically a PO line item's item_name, or
    item_name + any free-text description) into a 1536-dim vector for
    pgvector cosine-similarity comparisons.

    Raises:
        ValueError: if `text` is empty/whitespace-only — there's nothing
            meaningful to embed and a silent zero-vector would poison
            similarity comparisons.
    """
    cleaned = text.strip()
    if not cleaned:
        raise ValueError("embed_text requires non-empty text")

    response = _client().embeddings.create(model=_MODEL, input=cleaned)
    embedding = response.data[0].embedding
    if len(embedding) != _EMBEDDING_DIM:
        raise ValueError(
            f"Expected {_EMBEDDING_DIM}-dim embedding, got {len(embedding)}. "
            f"Check that {_MODEL} is still the configured model."
        )
    return embedding
