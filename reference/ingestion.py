"""
Generic ingest pipeline: raw text -> chunks -> embeddings -> stored rows.

Table-parameterized so both Sentinel (`evidence`) and Precedent
(`historical_cases`) can call the same function with their own table/column
names, instead of each maintaining its own ingestion code.

Column-naming assumption (documented, not hardcoded - override if your
schema differs): every chunk row stores which parent document it came from
in a `source_id` column, and its own row primary key in an `id` column. Both
`evidence` and `historical_cases` are expected to have these in addition to
their table-specific text/embedding/project_id/search_vector columns. If a
table uses different names for either of these, pass `source_id_column` /
`id_column` accordingly - nothing else in this module assumes a fixed name.
"""

from __future__ import annotations

import uuid

from common.rag import chunking, embedding
from common.supabase_client import get_client


def ingest(
    table: str,
    text_column: str,
    record_id: str,
    raw_text: str,
    project_id: str,
    extra_fields: dict | None = None,
    source_id_column: str = "source_id",
    id_column: str = "id",
    chunk_size: int = chunking.DEFAULT_CHUNK_SIZE,
    chunk_overlap: int = chunking.DEFAULT_CHUNK_OVERLAP,
) -> list[str]:
    """
    Chunk, embed, and store `raw_text` for one source document.

    Note: both `evidence` and `historical_cases` currently store one row per
    chunk, so this inserts directly into `table`. If a future table instead
    stores one row per document, this function would need to insert into a
    separate chunks table referencing `record_id` instead - not needed for
    the two current tables.

    Args:
        table: Target table name, e.g. "evidence" or "historical_cases".
        text_column: Name of the column holding chunk text on `table`,
            e.g. "extracted_text" or "summary".
        record_id: Identifier of the parent document/case these chunks
            belong to (e.g. the evidence_id or case_id of the source
            document). Stored on every created chunk row so results can be
            traced back to it later.
        raw_text: The full raw text to chunk and ingest.
        project_id: Project this text belongs to, for later metadata
            filtering.
        extra_fields: Any additional columns to set on every inserted row
            (e.g. {"vendor_id": ..., "case_type": ...}). Not mutated.
        source_id_column: Column on `table` that stores `record_id`.
            Defaults to "source_id" - override if your schema names it
            differently (e.g. "evidence_id").
        id_column: Column on `table` holding each row's own primary key.
            Defaults to "id".
        chunk_size / chunk_overlap: Passed through to chunking.chunk_text.

    Returns:
        The list of created row ids (values of `id_column`), one per chunk,
        in chunk order.

    Raises:
        Exception: Any Supabase error propagates to the caller - this is a
            library, not an API, so the calling service's own error handling
            (per its build docs) is expected to catch this.
    """
    extra_fields = extra_fields or {}

    chunks = chunking.chunk_text(raw_text, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    if not chunks:
        return []

    vectors = embedding.embed_batch(chunks, is_query=False)

    rows = []
    row_ids = []
    for chunk_str, vector in zip(chunks, vectors):
        row_id = str(uuid.uuid4())
        row_ids.append(row_id)
        rows.append(
            {
                id_column: row_id,
                text_column: chunk_str,
                "embedding": vector,
                "project_id": project_id,
                source_id_column: record_id,
                **extra_fields,
            }
        )

    try:
        get_client().table(table).insert(rows).execute()
    except Exception as exc:  # noqa: BLE001 - re-raise with context, let caller handle it
        raise RuntimeError(
            f"ingest() failed inserting {len(rows)} chunk row(s) into '{table}' "
            f"for record_id={record_id!r}: {exc}"
        ) from exc

    return row_ids
