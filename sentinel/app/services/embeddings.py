"""
Text embedding via Google Gemini text-embedding-004 (free tier).
Free quota: 1,500 requests/day, no credit card required.
Produces 768-dim vectors — matches POLineItem.description_embedding column.

Get your free key at: https://aistudio.google.com/app/apikey
"""

from __future__ import annotations

import os

import google.generativeai as genai

_MODEL        = "models/text-embedding-004"  # free, 768-dim
_EMBEDDING_DIM = 768


def _configure() -> None:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. "
            "Get a free key at https://aistudio.google.com/app/apikey"
        )
    genai.configure(api_key=api_key)


def embed_text(text: str) -> list[float]:
    """
    Embed a single piece of text into a 768-dim vector for pgvector
    cosine-similarity duplicate matching.

    Raises:
        ValueError: if text is empty — a zero-vector would poison similarity scores.
        RuntimeError: if GEMINI_API_KEY is not set.
    """
    cleaned = text.strip()
    if not cleaned:
        raise ValueError("embed_text requires non-empty text")

    _configure()

    result = genai.embed_content(
        model=_MODEL,
        content=cleaned,
        task_type="SEMANTIC_SIMILARITY",  # optimises the vector for similarity search
    )
    embedding: list[float] = result["embedding"]

    if len(embedding) != _EMBEDDING_DIM:
        raise ValueError(
            f"Expected {_EMBEDDING_DIM}-dim embedding from {_MODEL}, "
            f"got {len(embedding)}. Model may have changed."
        )
    return embedding
