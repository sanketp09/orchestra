"""
Retrieval helpers: pgvector similarity search over `evidence`, plus simple
lookups for claims and evidence by id. Keeps main.py/logic.py free of raw
Supabase query building.
"""

from supabase import Client

from common.embedding_client import embed

TOP_K_DEFAULT = 5


def get_claim_text(supabase: Client, claim_id: str) -> str:
    """Fetch the stored text for a claim_id. Raises if not found."""
    resp = (
        supabase.table("claims")
        .select("text")
        .eq("claim_id", claim_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise ValueError(f"claim_id {claim_id} not found")
    return resp.data["text"]


def get_claim(supabase: Client, claim_id: str) -> dict:
    resp = (
        supabase.table("claims")
        .select("*")
        .eq("claim_id", claim_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise ValueError(f"claim_id {claim_id} not found")
    return resp.data


def resolve_claim_text(supabase: Client, claim_id: str | None, claim_text: str | None) -> str:
    """Every endpoint accepts claim_id OR claim_text - this resolves to text."""
    if claim_text:
        return claim_text
    if claim_id:
        return get_claim_text(supabase, claim_id)
    raise ValueError("one of claim_id or claim_text is required")


def get_evidence_by_refs(supabase: Client, evidence_refs: list[str]) -> list[dict]:
    """Fetch evidence rows (with extracted_text) for a list of evidence_ids."""
    if not evidence_refs:
        return []
    resp = (
        supabase.table("evidence")
        .select("evidence_id, source_type, source_ref, extracted_text")
        .in_("evidence_id", evidence_refs)
        .execute()
    )
    return resp.data or []


def find_relevant_evidence(
    supabase: Client,
    project_id: str,
    query_text: str,
    top_k: int = TOP_K_DEFAULT,
) -> list[dict]:
    """
    Embed `query_text` and return the top_k most similar evidence chunks for
    this project, via pgvector cosine similarity.

    Expects a Postgres function `match_evidence(query_embedding, match_count,
    filter_project_id)` exposed via RPC - see the SQL below. Doing the
    similarity search in the DB (rather than pulling all rows and comparing
    client-side) is what makes this cheap at scale.

        create or replace function match_evidence(
          query_embedding vector(384),
          match_count int,
          filter_project_id text
        )
        returns table (
          evidence_id uuid,
          source_type text,
          source_ref text,
          extracted_text text,
          similarity float
        )
        language sql stable
        as $$
          select evidence_id, source_type, source_ref, extracted_text,
                 1 - (embedding <=> query_embedding) as similarity
          from evidence
          where project_id = filter_project_id
          order by embedding <=> query_embedding
          limit match_count;
        $$;
    """
    query_embedding = embed(query_text)
    resp = supabase.rpc(
        "match_evidence",
        {
            "query_embedding": query_embedding,
            "match_count": top_k,
            "filter_project_id": project_id,
        },
    ).execute()
    return resp.data or []
