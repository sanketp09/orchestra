"""
retrieval.py — similarity-search logic over historical_cases, kept separate
from the FastAPI route handlers in main.py.

All retrieval goes through pgvector cosine similarity via a Postgres RPC
function. Create this once in Supabase (SQL editor):

    create or replace function match_historical_cases(
      query_embedding vector(384),
      match_case_type text default null,
      match_count int default 5
    )
    returns table (
      case_id uuid,
      project_id text,
      vendor_id text,
      case_type text,
      summary text,
      details jsonb,
      outcome text,
      similarity float
    )
    language sql stable
    as $$
      select
        case_id, project_id, vendor_id, case_type, summary, details, outcome,
        1 - (embedding <=> query_embedding) as similarity
      from historical_cases
      where match_case_type is null or case_type = match_case_type
      order by embedding <=> query_embedding
      limit match_count;
    $$;

If that RPC isn't set up yet, `search_cases` will raise — the route handlers
catch that and return status="FAILED" per the general requirements.
"""

from common.embedding_client import embed
from common.supabase_client import get_client

SIMILARITY_THRESHOLD = 0.3


def search_cases(
    query_text: str,
    case_type: str | None = None,
    top_k: int = 5,
) -> list[dict]:
    """
    Embed `query_text` and return the top_k most similar historical_cases
    rows (optionally filtered to a single case_type), each with a
    `similarity` score in [0, 1] (cosine similarity via pgvector).

    Rows are returned ranked descending by similarity, already filtered to
    SIMILARITY_THRESHOLD by the caller if desired — this function itself
    returns everything the DB gives back so callers can decide how to
    interpret weak matches.
    """
    query_embedding = embed(query_text)
    client = get_client()

    result = client.rpc(
        "match_historical_cases",
        {
            "query_embedding": query_embedding,
            "match_case_type": case_type,
            "match_count": top_k,
        },
    ).execute()

    return result.data or []


def strong_matches(cases: list[dict], threshold: float = SIMILARITY_THRESHOLD) -> list[dict]:
    """Filter a list of scored cases down to those meeting the similarity threshold."""
    return [c for c in cases if c.get("similarity", 0) >= threshold]


def get_case_by_id(case_id: str) -> dict | None:
    """Direct lookup of a single historical_cases row by case_id."""
    client = get_client()
    result = (
        client.table("historical_cases")
        .select("*")
        .eq("case_id", case_id)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    return rows[0] if rows else None
