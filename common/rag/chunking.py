"""Splits raw text into overlapping chunks suitable for embedding."""

from __future__ import annotations

try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    HAS_LANGCHAIN_SPLITTER = True
except Exception:
    HAS_LANGCHAIN_SPLITTER = False

# Defaults tuned for ~500-token chunks of English procurement/contract text.
# These are character counts, not tokens - RecursiveCharacterTextSplitter
# splits on characters, so the numbers run a bit higher than the token target.
DEFAULT_CHUNK_SIZE = 500
DEFAULT_CHUNK_OVERLAP = 75


def chunk_text(
    text: str,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> list[str]:
    """
    Split `text` into overlapping chunks.

    Args:
        text: The raw document/passage text to split.
        chunk_size: Max characters per chunk.
        chunk_overlap: Characters shared between consecutive chunks, so
            context isn't lost at chunk boundaries.

    Returns:
        A list of chunk strings, in original order. Empty/whitespace-only
        input returns an empty list.
    """
    if not text or not text.strip():
        return []

    if HAS_LANGCHAIN_SPLITTER:
        try:
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
                length_function=len,
            )
            return splitter.split_text(text)
        except Exception:
            pass

    # Pure Python chunking fallback
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - chunk_overlap
        if start >= len(text):
            break
    return chunks
