"""
Generic hybrid search: embed the query, run a vector-similarity candidate
search and a full-text-search candidate search in parallel, merge them by
row id, and optionally rerank with a cross-encoder.

Table-parameterized so Sentinel (`evidence`) and Precedent
(`historical_cases`) call the same function with their own table/column
names. Requires the `rag_vector_search` / `rag_keyword_search` Postgres
functions from sql/hybrid_search_functions.sql to already be installed -
PostgREST's query builder can't express cosine-distance ordering or
ts_rank scoring on its own.
"""

from __future__ import annotations

from common.rag import embedding, rerank as rerank_module
from common.rag.models import RetrievalResult
from common.supabase_client import get_client


def _normalize(values: list[float]) -> list[float]:
    """Min-max normalize to [0, 1]. Flat/empty input maps to all zeros."""
    if not values:
        return []
    lo, hi = min(values), max(values)
    if hi - lo < 1e-12:
        return [0.0 for _ in values]
    return [(v - lo) / (hi - lo) for v in values]


def hybrid_search(
    table: str,
    text_column: str,
    query: str,
    project_id: str | None = None,
    extra_filters: dict | None = None,
    top_k_candidates: int = 20,
    top_k_final: int = 5,
    rerank: bool = True,
    id_column: str = "id",
    source_id_column: str = "source_id",
) -> list[RetrievalResult]:
    """
    Run hybrid (vector + keyword) search against `table` and return the top
    results, optionally reranked with a cross-encoder.

    Args:
        table: Target table name, e.g. "evidence" or "historical_cases".
        text_column: Name of the column holding chunk text on `table`,
            e.g. "extracted_text" or "summary".
        query: The natural-language search query.
        project_id: If given, restricts results to this project.
        extra_filters: Additional exact-match column filters, e.g.
            {"case_type": "vendor_history"}. Not mutated.
        top_k_candidates: How many candidates to pull from EACH of the
            vector and keyword searches before merging.
        top_k_final: How many results to return after merge (+ rerank).
        rerank: If True, score merged candidates with a cross-encoder and
            sort by rerank_score. If False, sort by a simple normalized
            vector_score + keyword_score combination instead.
        id_column: Row primary-key column name on `table`. Defaults to "id".
        source_id_column: Column on `table` storing the parent
            document/case id (set by ingestion.ingest). Defaults to
            "source_id".

    Returns:
        Up to `top_k_final` RetrievalResult, best match first.

    Raises:
        Exception: Any Supabase/RPC error propagates to the caller - this is
            a library, not an API, so the calling service's own error
            handling (per its build docs) is expected to catch this.
    """
    extra_filters = extra_filters or {}

    try:
        query_vector = embedding.embed(query, is_query=True)

        vector_rows = (
            get_client()
            .rpc(
                "rag_vector_search",
                {
                    "target_table": table,
                    "text_column": text_column,
                    "query_embedding": query_vector,
                    "filter_project_id": project_id,
                    "extra_filters": extra_filters,
                    "candidate_limit": top_k_candidates,
                    "id_column": id_column,
                    "source_id_column": source_id_column,
                },
            )
            .execute()
            .data
            or []
        )

        keyword_rows = (
            get_client()
            .rpc(
                "rag_keyword_search",
                {
                    "target_table": table,
                    "text_column": text_column,
                    "query_text": query,
                    "filter_project_id": project_id,
                    "extra_filters": extra_filters,
                    "candidate_limit": top_k_candidates,
                    "id_column": id_column,
                    "source_id_column": source_id_column,
                },
            )
            .execute()
            .data
            or []
        )
    except Exception as exc:  # noqa: BLE001 - re-raise with context, let caller handle it
        raise RuntimeError(
            f"hybrid_search() failed querying '{table}' for query={query!r}: {exc}"
        ) from exc

    merged = _merge_candidates(vector_rows, keyword_rows)
    if not merged:
        return []

    if rerank:
        results = rerank_module.rerank(query, merged)
    else:
        vec_norm = _normalize([r.vector_score for r in merged])
        kw_norm = _normalize([r.keyword_score for r in merged])
        combined = [v + k for v, k in zip(vec_norm, kw_norm)]
        results = [
            r.model_copy(update={"rerank_score": None})
            for r, _ in sorted(zip(merged, combined), key=lambda pair: pair[1], reverse=True)
        ]

    return results[:top_k_final]


def _merge_candidates(vector_rows: list[dict], keyword_rows: list[dict]) -> list[RetrievalResult]:
    """
    Union the two candidate sets by row_id, keeping both scores per row
    (0.0 for whichever search didn't surface that row).
    """
    by_id: dict[str, RetrievalResult] = {}

    for row in vector_rows:
        by_id[row["row_id"]] = RetrievalResult(
            chunk_id=row["row_id"],
            source_id=row["source_id"],
            text=row["chunk_text"],
            vector_score=float(row["score"]),
            keyword_score=0.0,
            rerank_score=None,
            metadata=row.get("metadata") or {},
        )

    for row in keyword_rows:
        existing = by_id.get(row["row_id"])
        if existing is not None:
            by_id[row["row_id"]] = existing.model_copy(
                update={"keyword_score": float(row["score"])}
            )
        else:
            by_id[row["row_id"]] = RetrievalResult(
                chunk_id=row["row_id"],
                source_id=row["source_id"],
                text=row["chunk_text"],
                vector_score=0.0,
                keyword_score=float(row["score"]),
                rerank_score=None,
                metadata=row.get("metadata") or {},
            )

    return list(by_id.values())
