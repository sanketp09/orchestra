-- ============================================================================
-- Supabase Migration: 001_trustline_hardening.sql
-- Purpose: Adds idempotency (source_event_id) and first-class project tracking (project_id)
-- ============================================================================

-- 1. Add source_event_id and project_id columns to trust_events table if not present
ALTER TABLE trust_events 
ADD COLUMN IF NOT EXISTS source_event_id TEXT,
ADD COLUMN IF NOT EXISTS project_id TEXT;

-- 2. Create unique index for vendor_id + source_event_id to enforce database-level idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_trust_events_vendor_source_event_unique 
ON trust_events (vendor_id, source_event_id) 
WHERE source_event_id IS NOT NULL;

-- 3. Create index on project_id for fast project-level vendor history queries
CREATE INDEX IF NOT EXISTS idx_trust_events_project_id 
ON trust_events (project_id);

-- 4. Comment on columns for schema documentation
COMMENT ON COLUMN trust_events.source_event_id IS 'Unique identifier from source agent/system to prevent duplicate trust event processing';
COMMENT ON COLUMN trust_events.project_id IS 'Top-level project reference identifier for project-specific vendor reliability tracking';
