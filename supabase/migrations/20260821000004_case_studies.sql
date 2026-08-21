-- ============================================================
-- ORCHESTRA PROCURMENT AI — CASE STUDIES SCHEMA MIGRATION
-- ============================================================

-- 1. UPGRADE EXISTING TABLES FOR PROVENANCE & SENTINEL COMPATIBILITY
-- Upgrade projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS scenario_type text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS real_world_basis text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS origin text;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS chk_projects_origin;
ALTER TABLE projects ADD CONSTRAINT chk_projects_origin CHECK (origin IN ('verified_public', 'logically_derived', 'synthetic_augmented'));

-- Upgrade vendors
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS origin text;
ALTER TABLE vendors DROP CONSTRAINT IF EXISTS chk_vendors_origin;
ALTER TABLE vendors ADD CONSTRAINT chk_vendors_origin CHECK (origin IN ('verified_public', 'logically_derived', 'synthetic_augmented'));

-- Upgrade claims
ALTER TABLE claims ADD COLUMN IF NOT EXISTS origin text;
ALTER TABLE claims DROP CONSTRAINT IF EXISTS chk_claims_origin;
ALTER TABLE claims ADD CONSTRAINT chk_claims_origin CHECK (origin IN ('verified_public', 'logically_derived', 'synthetic_augmented'));

-- Upgrade evidence (add source_ref, extracted_text, pgvector embedding, and origin)
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS source_ref text;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS extracted_text text;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS embedding vector(384);
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS origin text;
ALTER TABLE evidence DROP CONSTRAINT IF EXISTS chk_evidence_origin;
ALTER TABLE evidence ADD CONSTRAINT chk_evidence_origin CHECK (origin IN ('verified_public', 'logically_derived', 'synthetic_augmented'));


-- 2. CREATE NEW OPERATIONAL CONCEPT TABLES
-- Sources Table (provenance logs for verified_public items)
CREATE TABLE IF NOT EXISTS sources (
    source_id text PRIMARY KEY,
    project_id text REFERENCES projects(project_id) ON DELETE CASCADE,
    title text NOT NULL,
    organization text,
    source_url text,
    source_type text,
    source_tier text,
    origin text NOT NULL DEFAULT 'verified_public' CHECK (origin IN ('verified_public', 'logically_derived', 'synthetic_augmented'))
);

-- Procurement Items Table
CREATE TABLE IF NOT EXISTS procurement_items (
    item_id text PRIMARY KEY,
    project_id text REFERENCES projects(project_id) ON DELETE CASCADE,
    description text NOT NULL,
    category text,
    criticality text,
    lead_time_days integer,
    origin text NOT NULL DEFAULT 'synthetic_augmented' CHECK (origin IN ('verified_public', 'logically_derived', 'synthetic_augmented'))
);

-- Purchase Orders Table
CREATE TABLE IF NOT EXISTS purchase_orders (
    po_id text PRIMARY KEY,
    project_id text REFERENCES projects(project_id) ON DELETE CASCADE,
    vendor_id text REFERENCES vendors(vendor_id) ON DELETE CASCADE,
    procurement_item_id text REFERENCES procurement_items(item_id) ON DELETE CASCADE,
    issue_date date NOT NULL,
    original_delivery_date date NOT NULL,
    revised_delivery_date date,
    status text NOT NULL,
    value_range text,
    origin text NOT NULL DEFAULT 'synthetic_augmented' CHECK (origin IN ('verified_public', 'logically_derived', 'synthetic_augmented'))
);

-- Engineering Changes Table
CREATE TABLE IF NOT EXISTS engineering_changes (
    change_id text PRIMARY KEY,
    project_id text REFERENCES projects(project_id) ON DELETE CASCADE,
    affected_entity text NOT NULL,
    revision_date date NOT NULL,
    description text NOT NULL,
    impact text,
    origin text NOT NULL DEFAULT 'synthetic_augmented' CHECK (origin IN ('verified_public', 'logically_derived', 'synthetic_augmented'))
);

-- Schedule Events Table
CREATE TABLE IF NOT EXISTS schedule_events (
    event_id text PRIMARY KEY,
    project_id text REFERENCES projects(project_id) ON DELETE CASCADE,
    event_date date NOT NULL,
    affected_work_package text NOT NULL,
    description text NOT NULL,
    impact text,
    origin text NOT NULL DEFAULT 'synthetic_augmented' CHECK (origin IN ('verified_public', 'logically_derived', 'synthetic_augmented'))
);

-- Vendor Performances Table (Historical Trustline context)
CREATE TABLE IF NOT EXISTS vendor_performances (
    performance_id text PRIMARY KEY,
    vendor_id text REFERENCES vendors(vendor_id) ON DELETE CASCADE,
    project_id text REFERENCES projects(project_id) ON DELETE CASCADE,
    metric text NOT NULL,
    value double precision NOT NULL,
    context text,
    event_date date NOT NULL,
    origin text NOT NULL DEFAULT 'synthetic_augmented' CHECK (origin IN ('verified_public', 'logically_derived', 'synthetic_augmented'))
);
