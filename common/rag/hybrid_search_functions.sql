-- Generic hybrid-search support functions for common/rag/retrieval.py.
--
-- Run this ONCE in the Supabase SQL editor (same place you ran the index
-- migration in RAG_01_SETUP.md). PostgREST's query builder can't express
-- "order by cosine distance" or ts_rank scoring directly, so retrieval.py
-- calls these two RPC functions instead of the table query builder.
--
-- Both functions are table-parameterized (via dynamic SQL) so they work
-- against `evidence`, `historical_cases`, or any future table with the same
-- shape: an `embedding vector(384)` column, a `search_vector tsvector`
-- generated column, a `project_id` column, and (by convention - override
-- via id_column/source_id_column if yours differ) an `id` primary key and a
-- `source_id` column tying chunk rows back to their parent document.
--
-- extra_filters is a flat jsonb object of exact-match column=value filters,
-- e.g. '{"case_type": "vendor_history"}'::jsonb.

create or replace function rag_vector_search(
  target_table text,
  text_column text,
  query_embedding vector(384),
  filter_project_id text default null,
  extra_filters jsonb default '{}'::jsonb,
  candidate_limit int default 20,
  id_column text default 'id',
  source_id_column text default 'source_id'
)
returns table (
  row_id text,
  source_id text,
  chunk_text text,
  score float8,
  metadata jsonb
)
language plpgsql
as $$
declare
  filter_clause text := '';
  key text;
  val text;
  sql text;
begin
  if filter_project_id is not null then
    filter_clause := filter_clause || format(' and project_id = %L', filter_project_id);
  end if;

  for key, val in select * from jsonb_each_text(extra_filters) loop
    filter_clause := filter_clause || format(' and %I = %L', key, val);
  end loop;

  sql := format(
    $f$
      select
        (%I)::text as row_id,
        (%I)::text as source_id,
        (%I)::text as chunk_text,
        1 - (embedding <=> %L::vector(384)) as score,
        to_jsonb(t) - %L - 'embedding' - 'search_vector' as metadata
      from %I t
      where embedding is not null %s
      order by embedding <=> %L::vector(384)
      limit %L
    $f$,
    id_column, source_id_column, text_column,
    query_embedding,
    text_column,
    target_table,
    filter_clause,
    query_embedding,
    candidate_limit
  );

  return query execute sql;
end;
$$;

create or replace function rag_keyword_search(
  target_table text,
  text_column text,
  query_text text,
  filter_project_id text default null,
  extra_filters jsonb default '{}'::jsonb,
  candidate_limit int default 20,
  id_column text default 'id',
  source_id_column text default 'source_id'
)
returns table (
  row_id text,
  source_id text,
  chunk_text text,
  score float8,
  metadata jsonb
)
language plpgsql
as $$
declare
  filter_clause text := '';
  key text;
  val text;
  sql text;
begin
  if filter_project_id is not null then
    filter_clause := filter_clause || format(' and project_id = %L', filter_project_id);
  end if;

  for key, val in select * from jsonb_each_text(extra_filters) loop
    filter_clause := filter_clause || format(' and %I = %L', key, val);
  end loop;

  sql := format(
    $f$
      select
        (%I)::text as row_id,
        (%I)::text as source_id,
        (%I)::text as chunk_text,
        ts_rank(search_vector, plainto_tsquery('english', %L))::float8 as score,
        to_jsonb(t) - %L - 'embedding' - 'search_vector' as metadata
      from %I t
      where search_vector @@ plainto_tsquery('english', %L) %s
      order by score desc
      limit %L
    $f$,
    id_column, source_id_column, text_column,
    query_text,
    text_column,
    target_table,
    query_text,
    filter_clause,
    candidate_limit
  );

  return query execute sql;
end;
$$;

-- The service-role key used by common/supabase_client.py already bypasses
-- RLS and can call SECURITY INVOKER functions by default; these grants are
-- here for completeness in case your project's default privileges differ.
grant execute on function rag_vector_search to service_role;
grant execute on function rag_keyword_search to service_role;
