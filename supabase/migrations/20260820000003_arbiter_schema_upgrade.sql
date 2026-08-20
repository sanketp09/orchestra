-- ============================================================
-- UPGRADE ARBITER SCHEMA
-- ============================================================

-- Drop old tables if they exist to avoid column name mismatch from previous attempt
drop table if exists causation_results cascade;
drop table if exists timelines cascade;

-- Recreate timelines table with the exact columns requested
create table timelines (
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

-- Recreate causation_results table with the exact columns requested
create table causation_results (
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
