"""
Ingestion pipeline for /ingest_document:

    upload -> evidence-files bucket
    extract text (pypdf for .pdf, unstructured for everything else)
    chunk (~500 tokens per chunk)
    embed each chunk
    insert one `evidence` row per chunk

This is plumbing, not one of the six registered capabilities - it has no
AgentTask/AgentResult contract of its own.
"""

import io
import uuid
from pathlib import Path

from fastapi import UploadFile
from supabase import Client

from common.embedding_client import embed_batch

BUCKET = "evidence-files"

# Rough token-to-word ratio for English text; good enough for chunk sizing,
# no need for a real tokenizer here.
WORDS_PER_CHUNK = 375  # ~500 tokens
CHUNK_OVERLAP_WORDS = 50


def _extract_text(filename: str, raw_bytes: bytes) -> str:
    # pypdf and unstructured are imported lazily here (not at module level)
    # so importing sentinel.ingestion - and anything that transitively
    # imports it, like main.py - doesn't pay their import cost until a
    # document is actually ingested.
    suffix = Path(filename).suffix.lower()

    if suffix == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(raw_bytes))
        return "\n\n".join(page.extract_text() or "" for page in reader.pages)

    # unstructured handles docx, txt, html, images-with-text, etc. via a
    # single entry point, which is why it's the fallback for everything
    # that isn't a plain PDF.
    from unstructured.partition.auto import partition

    elements = partition(file=io.BytesIO(raw_bytes), file_filename=filename)
    return "\n\n".join(el.text for el in elements if getattr(el, "text", None))


def _chunk_text(text: str, words_per_chunk: int = WORDS_PER_CHUNK,
                 overlap: int = CHUNK_OVERLAP_WORDS) -> list[str]:
    words = text.split()
    if not words:
        return []

    chunks = []
    start = 0
    step = max(words_per_chunk - overlap, 1)
    while start < len(words):
        chunk_words = words[start : start + words_per_chunk]
        chunks.append(" ".join(chunk_words))
        start += step
    return chunks


async def ingest_document(
    supabase: Client, project_id: str, file: UploadFile
) -> list[str]:
    """
    Runs the full ingestion pipeline for one uploaded file.
    Returns the list of created evidence_ids.
    """
    raw_bytes = await file.read()
    filename = file.filename or f"upload-{uuid.uuid4()}"

    # 1. Upload the raw file to storage, keyed by project + a fresh uuid so
    #    re-uploads of the same filename never collide.
    storage_path = f"{project_id}/{uuid.uuid4()}-{filename}"
    supabase.storage.from_(BUCKET).upload(
        storage_path,
        raw_bytes,
        {"content-type": file.content_type or "application/octet-stream"},
    )

    # 2. Extract text.
    text = _extract_text(filename, raw_bytes)
    if not text.strip():
        raise ValueError(f"no extractable text found in {filename}")

    # 3. Chunk.
    chunks = _chunk_text(text)
    if not chunks:
        raise ValueError(f"chunking produced no chunks for {filename}")

    # 4. Embed all chunks together (cheaper than one call per chunk).
    embeddings = embed_batch(chunks)

    # 5. Insert one evidence row per chunk, all pointing at the same
    #    storage path (source_ref) since they came from the same file.
    source_type = Path(filename).suffix.lstrip(".").lower() or "unknown"
    rows = [
        {
            "project_id": project_id,
            "source_type": source_type,
            "source_ref": storage_path,
            "extracted_text": chunk_text,
            "embedding": embedding,
        }
        for chunk_text, embedding in zip(chunks, embeddings)
    ]

    resp = supabase.table("evidence").insert(rows).execute()
    return [row["evidence_id"] for row in resp.data]
