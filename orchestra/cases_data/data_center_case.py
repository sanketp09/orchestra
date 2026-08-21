# Case Study 2 — DPR Construction Data Center Rescheduling
# Factual basis: DPR Construction deployment of ConstructivIQ procurement tracking on large data centers.

PROJECT_ID = "prj_data_center_dpr"

PROJECT = {
    "project_id": PROJECT_ID,
    "name": "Large-Scale DPR Data Center Phase 2",
    "description": "Large-scale data center construction requiring schedule acceleration and proactive material tracking.",
    "scenario_type": "proactive_procurement",
    "real_world_basis": "DPR Construction & ConstructivIQ Enterprise Procurement tracking (ENR Reporting)",
    "origin": "verified_public"
}

SOURCES = [
    {
        "source_id": "src_dpr_constructiviq",
        "project_id": PROJECT_ID,
        "title": "Procurement Planning and Tracking on Large Scale Data Center",
        "organization": "ConstructivIQ Case Study",
        "source_url": "https://constructiviq.com/procurement-planning-and-tracking-with-constructiviq-on-a-large-scale-data-center-project/",
        "source_type": "press_release",
        "source_tier": "tier_2",
        "origin": "verified_public"
    },
    {
        "source_id": "src_dpr_enr",
        "project_id": PROJECT_ID,
        "title": "DPR Deploys Constructiviq for Procurement Management",
        "organization": "Engineering News-Record (ENR)",
        "source_url": "https://www.enr.com/articles/60502-dpr-deploys-constructiviq-for-procurement-management",
        "source_type": "industry_article",
        "source_tier": "tier_1",
        "origin": "verified_public"
    }
]

VENDORS = [
    {
        "vendor_id": "vendor_apex",
        "name": "Apex Rebar Supply",
        "projects": [PROJECT_ID],
        "category": "Piping & Reinforcements",
        "origin": "synthetic_augmented"
    }
]

PROCUREMENT_ITEMS = [
    {
        "item_id": "item_dc_coolant_pipes",
        "project_id": PROJECT_ID,
        "description": "Insulated high-capacity cooling loop pipes and connections",
        "category": "Piping Loops",
        "criticality": "high",
        "lead_time_days": 60,
        "origin": "logically_derived"
    }
]

PURCHASE_ORDERS = [
    {
        "po_id": "po_dc_pipes_505",
        "project_id": PROJECT_ID,
        "vendor_id": "vendor_apex",
        "procurement_item_id": "item_dc_coolant_pipes",
        "issue_date": "2026-06-01",
        "original_delivery_date": "2026-10-10",
        "revised_delivery_date": "2026-09-10",
        "status": "accelerated",
        "value_range": "$500k - $1M",
        "origin": "synthetic_augmented"
    }
]

ENGINEERING_CHANGES = []

SCHEDULE_EVENTS = [
    {
        "event_id": "se_dc_resequencing",
        "project_id": PROJECT_ID,
        "event_date": "2026-07-15",
        "affected_work_package": "Cooling Loop Installation",
        "description": "Project schedule advanced. Phase 2 structural foundation completed early, moving the piping install window forward from Oct 12 to Sept 12.",
        "impact": "Requires cooling loop pipes to be delivered by Sept 10 instead of Oct 10 to avoid stand-down costs.",
        "origin": "synthetic_augmented"
    }
]

VENDOR_PERFORMANCES = [
    {
        "performance_id": "vp_apex_schedule_reliability",
        "vendor_id": "vendor_apex",
        "project_id": PROJECT_ID,
        "metric": "on_time_delivery_rate",
        "value": 0.92,
        "context": "Supplier historical data shows high reliability on standard lead times, but limited performance data exists for schedule accelerations greater than 20%.",
        "event_date": "2026-07-01",
        "origin": "synthetic_augmented"
    },
    {
        "performance_id": "vp_apex_capacity_limit",
        "vendor_id": "vendor_apex",
        "project_id": PROJECT_ID,
        "metric": "production_capacity_load",
        "value": 0.85,
        "context": "Apex shop capacity load is high (85%) during August due to pre-existing orders, presenting potential production bottleneck risks for PO-505 acceleration.",
        "event_date": "2026-07-20",
        "origin": "synthetic_augmented"
    }
]

CLAIMS = [
    {
        "claim_id": "claim_apex_timeline_acceleration",
        "project_id": PROJECT_ID,
        "vendor_id": "vendor_apex",
        "claim_text": "Apex Rebar and Piping asserts that they have secured raw steel billet stocks and rescheduled their production line to guarantee completion and delivery of PO-505 by the accelerated deadline of September 10.",
        "status": "unverified",
        "confidence": 0.6,
        "evidence_ids": ["ev_apex_email_commitment", "ev_apex_production_schedule"],
        "source_agent": "sentinel",
        "origin": "synthetic_augmented"
    }
]

EVIDENCE = [
    {
        "evidence_id": "ev_dpr_press_release",
        "project_id": PROJECT_ID,
        "vendor_id": "vendor_apex",
        "source_type": "report",
        "source_ref": "src_dpr_constructiviq",
        "extracted_text": "DPR Construction reports deployment of ConstructivIQ on large data centers to track material pipelines, facilitating project re-sequencing and advanced deliveries.",
        "origin": "verified_public",
        "metadata": {"title": "ConstructivIQ Press Release"}
    },
    {
        "evidence_id": "ev_apex_email_commitment",
        "project_id": PROJECT_ID,
        "vendor_id": "vendor_apex",
        "source_type": "report",
        "source_ref": "po_dc_pipes_505",
        "extracted_text": "Email from Apex Director of Operations (July 18): We have reviewed the accelerated requirement for PO-505-PIPES. We can commit to the advanced delivery date of September 10. Steel billets have been locked in.",
        "origin": "synthetic_augmented",
        "metadata": {
            "title": "Apex Email Commitment",
            "motivated_by": "DPR ConstructivIQ deployment proactive tracking"
        }
    },
    {
        "evidence_id": "ev_apex_production_schedule",
        "project_id": PROJECT_ID,
        "vendor_id": "vendor_apex",
        "source_type": "report",
        "source_ref": "po_dc_pipes_505",
        "extracted_text": "Apex Fabrication Master Schedule Rev 2 (July 20): PO-505-PIPES scheduled for extrusion extrusion starting August 5, finishing August 20. Shipping prep scheduled August 21-25. Arrival at project site estimated September 8.",
        "origin": "synthetic_augmented",
        "metadata": {
            "title": "Apex Internal Production Schedule",
            "motivated_by": "DPR ConstructivIQ deployment proactive tracking"
        }
    }
]
