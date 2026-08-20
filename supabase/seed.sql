-- ============================================================
-- PROCUREMENT AI — SEED DATA FOR DEMOS
-- ============================================================

-- 1. SEED PROJECTS
insert into projects (project_id, name, description) values
('prj_riverside', 'Riverside Commons Phase 2', 'Multi-family residential development featuring three structures, concrete podiums, and offsite steel fabrication.')
on conflict (project_id) do nothing;

-- 2. SEED VENDORS
insert into vendors (vendor_id, name, projects) values
('vendor_apex', 'Apex Rebar Supply', '{"prj_riverside"}'),
('vendor_meridian', 'Meridian Steelworks', '{"prj_riverside"}'),
('vendor_voltline', 'Voltline Electrical', '{"prj_riverside"}'),
('V-001', 'Apex Rebar Supply', '{"prj_riverside"}'),
('V-002', 'Meridian Steelworks', '{"prj_riverside"}')
on conflict (vendor_id) do nothing;

-- 3. SEED TRUST PROFILES
insert into trust_profiles (vendor_id, schedule_reliability, commercial_reliability, claim_reliability, quality_reliability, financial_stability, overall_trust, last_updated) values
('vendor_apex', 0.72, 0.68, 0.55, 0.88, 0.80, 0.726, now()),
('V-001', 0.72, 0.68, 0.55, 0.88, 0.80, 0.726, now()),
('vendor_meridian', 0.94, 0.92, 0.95, 0.96, 0.90, 0.934, now()),
('V-002', 0.94, 0.92, 0.95, 0.96, 0.90, 0.934, now()),
('vendor_voltline', 0.81, 0.75, 0.62, 0.90, 0.85, 0.786, now())
on conflict (vendor_id) do update set
    schedule_reliability = excluded.schedule_reliability,
    commercial_reliability = excluded.commercial_reliability,
    claim_reliability = excluded.claim_reliability,
    quality_reliability = excluded.quality_reliability,
    financial_stability = excluded.financial_stability,
    overall_trust = excluded.overall_trust,
    last_updated = now();

-- 4. SEED TRUST EVENTS
insert into trust_events (event_id, vendor_id, project_id, source_event_id, event_type, verified, external_cause, impact_dimension, impact_delta, previous_score, new_score, source_agent, raw_context) values
('c8a41764-9b2f-410a-8bf8-d3680a6b74e1', 'vendor_apex', 'prj_riverside', 'evt_src_001', 'delay_claim', true, false, 'schedule_reliability', -0.08, 0.80, 0.72, 'sentinel', '{"reason": "Weather check confirmed rainfall of 3.2mm did not meet the 25mm weather extension threshold."}'::jsonb),
('d29bc35a-73d8-4f24-9b98-757021a8a25c', 'V-001', 'prj_riverside', 'evt_src_002', 'delay_claim', true, false, 'schedule_reliability', -0.08, 0.80, 0.72, 'sentinel', '{"reason": "Weather check confirmed rainfall of 3.2mm did not meet the 25mm weather extension threshold."}'::jsonb)
on conflict (event_id) do nothing;
