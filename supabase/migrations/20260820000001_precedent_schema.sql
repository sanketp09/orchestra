-- ============================================================
-- PROCUREMENT AI — PRECEDENT MEMORY
-- ============================================================

-- Enable pgvector
create extension if not exists vector;

-- Table for historical cases
create table if not exists historical_cases (
    case_id uuid primary key default gen_random_uuid(),
    project_id text not null,
    vendor_id text,
    case_type text not null check (case_type in ('vendor_history', 'contract', 'dispute', 'general_case')),
    summary text not null,
    details jsonb default '{}'::jsonb,
    outcome text not null,
    embedding vector(384),
    created_at timestamptz default now()
);

-- Index for case_type
create index if not exists idx_historical_cases_type on historical_cases(case_type);

-- Cosine similarity search function
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
