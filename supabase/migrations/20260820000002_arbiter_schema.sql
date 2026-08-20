-- ============================================================
-- PROCUREMENT AI — ARBITER SCHEMA
-- ============================================================

-- Table for reconstructed timelines
create table if not exists timelines (
    timeline_id uuid primary key default gen_random_uuid(),
    project_id text references projects(project_id) on delete cascade,
    entity_ids text[] default '{}',
    events jsonb default '[]'::jsonb,
    created_at timestamptz default now()
);

-- Table for causation and responsibility results
create table if not exists causation_results (
    result_id uuid primary key default gen_random_uuid(),
    project_id text references projects(project_id) on delete cascade,
    case_ref text,
    causes jsonb default '[]'::jsonb,
    responsibility jsonb default '[]'::jsonb,
    evidence_refs text[] default '{}',
    reasoning_summary text,
    created_at timestamptz default now()
);
