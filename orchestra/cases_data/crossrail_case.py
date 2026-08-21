# Case Study 1 — Crossrail Track & Key Systems Delivery Investigation
# Factual basis: UK National Audit Office (NAO) Report: Completing Crossrail (2019).

PROJECT_ID = "prj_crossrail_tunnel_systems"

PROJECT = {
    "project_id": PROJECT_ID,
    "name": "Crossrail Tunnel Track & Systems Delivery",
    "description": "Installation of track, overhead lines, and other key systems in the Crossrail tunnels, experiencing early design/procurement delays and later access issues at Paddington and Bond Street station work.",
    "scenario_type": "failure_investigation",
    "real_world_basis": "UK National Audit Office (NAO) Report: Completing Crossrail (2019)",
    "origin": "verified_public"
}

SOURCES = [
    {
        "source_id": "src_nao_2019",
        "project_id": PROJECT_ID,
        "title": "Completing Crossrail - National Audit Office Report",
        "organization": "UK National Audit Office (NAO)",
        "source_url": "https://www.nao.org.uk/reports/completing-crossrail/",
        "source_type": "audit_report",
        "source_tier": "tier_1",
        "origin": "verified_public"
    }
]

VENDORS = [
    {
        "vendor_id": "vendor_railtech_infrastructure",
        "name": "RailTech Infrastructure Ltd",
        "projects": [PROJECT_ID],
        "category": "Railway Track and Systems Installation",
        "origin": "synthetic_augmented"
    }
]

PROCUREMENT_ITEMS = [
    {
        "item_id": "item_tunnel_power_cables",
        "project_id": PROJECT_ID,
        "description": "High-voltage overhead line catenary power cables for tunnel system power transmission.",
        "category": "Overhead Line Systems",
        "criticality": "high",
        "lead_time_days": 90,
        "origin": "synthetic_augmented"
    }
]

PURCHASE_ORDERS = [
    {
        "po_id": "po_tunnel_systems_303",
        "project_id": PROJECT_ID,
        "vendor_id": "vendor_railtech_infrastructure",
        "procurement_item_id": "item_tunnel_power_cables",
        "issue_date": "2026-01-10",
        "original_delivery_date": "2026-05-15",
        "revised_delivery_date": "2026-07-20",
        "status": "delayed",
        "value_range": "$1M - $5M",
        "origin": "synthetic_augmented"
    }
]

ENGINEERING_CHANGES = [
    {
        "change_id": "ec_tunnel_cable_brackets",
        "project_id": PROJECT_ID,
        "affected_entity": "item_tunnel_power_cables",
        "revision_date": "2026-03-01",
        "description": "Revision to catenary cable ceiling bracket anchor bolts and load specification to accommodate tunnel curvature changes.",
        "impact": "Caused design drawing rework and delayed overhead line procurement activity.",
        "origin": "synthetic_augmented"
    }
]

SCHEDULE_EVENTS = [
    {
        "event_id": "se_station_access_delay",
        "project_id": PROJECT_ID,
        "event_date": "2026-06-01",
        "affected_work_package": "Overhead Line Catenary Installation",
        "description": "Delayed Paddington and Bond Street station structural works completion, blocking track and catenary installation access windows.",
        "impact": "Forced track installers to change their proposed sequential installation approach, causing productivity issues and schedule slippage.",
        "origin": "synthetic_augmented"
    }
]

VENDOR_PERFORMANCES = [
    {
        "performance_id": "vp_railtech_procurement_delay",
        "vendor_id": "vendor_railtech_infrastructure",
        "project_id": PROJECT_ID,
        "metric": "procurement_activities_delay",
        "value": 25.0,
        "context": "Contractor deferred procurement activities and delayed design submission for overhead line systems by 25 days early in delivery.",
        "event_date": "2026-02-15",
        "origin": "synthetic_augmented"
    }
]

CLAIMS = [
    {
        "claim_id": "claim_railtech_access_extension",
        "project_id": PROJECT_ID,
        "vendor_id": "vendor_railtech_infrastructure",
        "claim_text": "RailTech Infrastructure asserts that they are entitled to a 60-day extension of time and compensation for disrupted sequencing and productivity loss due to station access constraints at Paddington and Bond Street.",
        "status": "unverified",
        "confidence": 0.5,
        "evidence_ids": ["ev_access_delay_notice", "ev_reproposed_sequencing_plan"],
        "source_agent": "sentinel",
        "origin": "synthetic_augmented"
    }
]

EVIDENCE = [
    {
        "evidence_id": "ev_nao_c1_contract",
        "project_id": PROJECT_ID,
        "vendor_id": "vendor_railtech_infrastructure",
        "source_type": "report",
        "source_ref": "src_nao_2019",
        "extracted_text": "The contract covered installation of track, overhead lines, and other key tunnel systems. The contract experienced delays from early in delivery due to deferred procurement activities and delayed design work.",
        "origin": "verified_public",
        "metadata": {"title": "Completing Crossrail - NAO Report Section 2.1"}
    },
    {
        "evidence_id": "ev_nao_c1_access",
        "project_id": PROJECT_ID,
        "vendor_id": "vendor_railtech_infrastructure",
        "source_type": "report",
        "source_ref": "src_nao_2019",
        "extracted_text": "Later delays were associated with access issues resulting from delays to station work at multiple sites, including Paddington and Bond Street, which required significant changes to the contractor's proposed installation approach.",
        "origin": "verified_public",
        "metadata": {"title": "Completing Crossrail - NAO Report Section 2.5"}
    },
    {
        "evidence_id": "ev_nao_c1_productivity",
        "project_id": PROJECT_ID,
        "vendor_id": "vendor_railtech_infrastructure",
        "source_type": "report",
        "source_ref": "src_nao_2019",
        "extracted_text": "Access constraints and productivity issues contributed to continuing schedule slippage in track and systems delivery.",
        "origin": "verified_public",
        "metadata": {"title": "Completing Crossrail - NAO Report Section 2.8"}
    },
    {
        "evidence_id": "ev_access_delay_notice",
        "project_id": PROJECT_ID,
        "vendor_id": "vendor_railtech_infrastructure",
        "source_type": "report",
        "source_ref": "se_station_access_delay",
        "extracted_text": "Official correspondence (June 2): Site access to Paddington tunnel portals is suspended until August 15 due to station ventilation shaft safety works.",
        "origin": "synthetic_augmented",
        "metadata": {
            "title": "Paddington Portal Site Access Suspension Notice",
            "motivated_by": "NAO reported station access delays at Paddington"
        }
    },
    {
        "evidence_id": "ev_reproposed_sequencing_plan",
        "project_id": PROJECT_ID,
        "vendor_id": "vendor_railtech_infrastructure",
        "source_type": "report",
        "source_ref": "se_station_access_delay",
        "extracted_text": "RailTech Reproposed Installation Sequence v3: Due to Bond Street and Paddington access blockages, installation crews must re-mobilize to intermediate shafts, disrupting logical line progression and reducing productivity by 30%.",
        "origin": "synthetic_augmented",
        "metadata": {
            "title": "RailTech Reproposed Installation Sequence",
            "motivated_by": "NAO reported changes to contractor proposed installation approach"
        }
    },
    {
        "evidence_id": "ev_internal_schedule_audit",
        "project_id": PROJECT_ID,
        "vendor_id": "vendor_railtech_infrastructure",
        "source_type": "report",
        "source_ref": "po_tunnel_systems_303",
        "extracted_text": "Internal Audit Log (April 3): Overhead line cable drawing submission was delayed by 35 days past baseline due to designer resource constraints, causing cable procurement to miss the fabrication window.",
        "origin": "synthetic_augmented",
        "metadata": {
            "title": "Internal Schedule Audit Report",
            "motivated_by": "NAO reported early delays due to deferred procurement and design work"
        }
    }
]
