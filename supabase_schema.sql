-- ============================================================
-- PROCUREMENT AI — SHARED SUPABASE FOUNDATION
-- Trustline + Sentinel
-- ============================================================

-- UUID generation
create extension if not exists pgcrypto;

-- ============================================================
-- 1. PROJECTS
-- ============================================================

create table if not exists projects (
    project_id text primary key,
    name text not null,
    description text,
    created_at timestamptz default now()
);

-- ============================================================
-- 2. VENDORS
-- ============================================================

create table if not exists vendors (
    vendor_id text primary key,
    name text not null,
    projects text[] default '{}',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- ============================================================
-- 3. TRUST PROFILES
-- ============================================================

create table if not exists trust_profiles (
    vendor_id text primary key references vendors(vendor_id) on delete cascade,

    schedule_reliability double precision default 0.5,
    commercial_reliability double precision default 0.5,
    claim_reliability double precision default 0.5,
    quality_reliability double precision default 0.5,
    financial_stability double precision default 0.5,

    overall_trust double precision default 0.5,

    last_updated timestamptz default now(),

    constraint trust_schedule_range
        check (schedule_reliability between 0 and 1),

    constraint trust_commercial_range
        check (commercial_reliability between 0 and 1),

    constraint trust_claim_range
        check (claim_reliability between 0 and 1),

    constraint trust_quality_range
        check (quality_reliability between 0 and 1),

    constraint trust_financial_range
        check (financial_stability between 0 and 1),

    constraint trust_overall_range
        check (overall_trust between 0 and 1)
);

-- ============================================================
-- 4. TRUST EVENTS
-- ============================================================

create table if not exists trust_events (
    event_id uuid primary key default gen_random_uuid(),

    vendor_id text not null references vendors(vendor_id) on delete cascade,

    project_id text references projects(project_id),

    source_event_id text,

    event_type text not null,

    verified boolean default false,

    external_cause boolean default false,

    impact_dimension text,

    impact_delta double precision,

    previous_score double precision,

    new_score double precision,

    source_agent text,

    evidence_ids text[] default '{}',

    receipt_id text,

    raw_context jsonb default '{}'::jsonb,

    created_at timestamptz default now()
);

-- Prevent duplicate processing of the same upstream event
create unique index if not exists
trust_events_vendor_source_event_unique
on trust_events(vendor_id, source_event_id)
where source_event_id is not null;

-- ============================================================
-- 5. EVIDENCE
-- ============================================================

create table if not exists evidence (
    evidence_id text primary key,

    project_id text references projects(project_id),

    vendor_id text references vendors(vendor_id),

    source_type text,
    source_name text,

    document_id text,

    content text,

    metadata jsonb default '{}'::jsonb,

    created_at timestamptz default now()
);

-- ============================================================
-- 6. CLAIMS
-- ============================================================

create table if not exists claims (
    claim_id text primary key,

    project_id text references projects(project_id),

    vendor_id text references vendors(vendor_id),

    claim_text text not null,

    status text default 'unverified',

    confidence double precision default 0.5,

    evidence_ids text[] default '{}',

    source_agent text,

    created_at timestamptz default now(),

    updated_at timestamptz default now()
);

-- ============================================================
-- 7. RECEIPTS
-- ============================================================

create table if not exists receipts (
    receipt_id text primary key,

    project_id text references projects(project_id),

    agent text,

    task_id text,

    capability text,

    evidence_ids text[] default '{}',

    summary text,

    metadata jsonb default '{}'::jsonb,

    created_at timestamptz default now()
);

-- ============================================================
-- 8. BELIEF EDGES
-- ============================================================

create table if not exists belief_edges (
    edge_id uuid primary key default gen_random_uuid(),

    project_id text references projects(project_id),

    subject_id text not null,

    subject_type text,

    predicate text not null,

    object_id text not null,

    object_type text,

    confidence double precision default 0.5,

    evidence_ids text[] default '{}',

    source_agent text,

    created_at timestamptz default now(),

    updated_at timestamptz default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_trust_events_vendor
on trust_events(vendor_id);

create index if not exists idx_trust_events_project
on trust_events(project_id);

create index if not exists idx_trust_events_dimension
on trust_events(impact_dimension);

create index if not exists idx_trust_events_created
on trust_events(created_at);

create index if not exists idx_evidence_vendor
on evidence(vendor_id);

create index if not exists idx_evidence_project
on evidence(project_id);

create index if not exists idx_claims_vendor
on claims(vendor_id);

create index if not exists idx_claims_project
on claims(project_id);

create index if not exists idx_belief_subject
on belief_edges(subject_id);

create index if not exists idx_belief_object
on belief_edges(object_id);

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


-- ============================================================
-- PROCUREMENT AI — ARBITER SCHEMA
-- ============================================================

-- Table for reconstructed timelines
create table if not exists timelines (
    timeline_id uuid primary key default gen_random_uuid(),
    project_id text references projects(project_id) on delete cascade,
    entity_ids text[] default '{}',
    events jsonb default '[]'::jsonb,
    evidence_refs text[] default '{}',
    confidence double precision default 1.0,
    source_agent text default 'arbiter',
    receipt_id text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Table for causation and responsibility results
create table if not exists causation_results (
    causation_result_id uuid primary key default gen_random_uuid(),
    project_id text references projects(project_id) on delete cascade,
    case_ref text,
    causes jsonb default '[]'::jsonb,
    responsibility jsonb default '{}'::jsonb,
    evidence_refs text[] default '{}',
    reasoning_summary text,
    confidence double precision default 1.0,
    receipt_id text,
    source_agent text default 'arbiter',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);


