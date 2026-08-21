# Case Study 3 — TSMC Arizona Semiconductor Fab Expansion
# Factual basis: TSMC Corporate Announcements, US Department of Commerce CHIPS Act Documentation, and NOAA Phoenix heat warnings.

PROJECT_ID = "prj_tsmc_arizona_fab"

PROJECT = {
    "project_id": PROJECT_ID,
    "name": "TSMC Arizona Fab 21 Expansion Phase 2",
    "description": "Establishment and commissioning of cleanroom infrastructure and ultra-pure gas delivery piping for Fab 21 in Phoenix, Arizona, facing HVAC footprint engineering expansions, specialized piping logistics heat advisories, and supplier comparison.",
    "scenario_type": "multi_constraint_replanning",
    "real_world_basis": "TSMC Corporate Press Releases, CHIPS Act Award Announcements ($6.6B grant + $5B loans), and NOAA Extreme Heat Advisories.",
    "origin": "verified_public"
}

SOURCES = [
    {
        "source_id": "src_tsmc_chips_award",
        "project_id": PROJECT_ID,
        "title": "TSMC and U.S. Commerce Department Sign Non-Binding PMT for Up to $6.6 Billion under CHIPS Act",
        "organization": "TSMC / U.S. Department of Commerce",
        "source_url": "https://www.tsmc.com/english/news-events/news-detail?id=3112",
        "source_type": "press_release",
        "source_tier": "tier_1",
        "origin": "verified_public"
    },
    {
        "source_id": "src_noaa_maricopa_heat",
        "project_id": PROJECT_ID,
        "title": "NOAA NWS Extreme Heat Advisory for Maricopa County & Southwest Regions",
        "organization": "National Oceanic and Administration (NOAA) / National Weather Service",
        "source_url": "https://www.weather.gov/psr/",
        "source_type": "weather_advisory",
        "source_tier": "tier_1",
        "origin": "verified_public"
    }
]

VENDORS = [
    {
        "vendor_id": "vendor_phoenix_hvac_solutions",
        "name": "Phoenix HVAC Solutions Inc.",
        "projects": [PROJECT_ID],
        "category": "Cleanroom Ventilation & Ducting",
        "origin": "synthetic_augmented"
    },
    {
        "vendor_id": "vendor_apex_semicon_valves",
        "name": "Apex Semicon Valves & Fittings",
        "projects": [PROJECT_ID],
        "category": "Specialized Gas Systems & Valves",
        "origin": "synthetic_augmented"
    },
    {
        "vendor_id": "vendor_microflow_systems",
        "name": "MicroFlow Gas Systems Ltd",
        "projects": [PROJECT_ID],
        "category": "Specialized Gas Systems & Valves",
        "origin": "synthetic_augmented"
    }
]

PROCUREMENT_ITEMS = [
    {
        "item_id": "item_cleanroom_air_handlers",
        "project_id": PROJECT_ID,
        "description": "Ultra-pure cleanroom air handling units (AHU) with HEPA filtration grids and pure airflow regulators.",
        "category": "HVAC Cleanroom Systems",
        "criticality": "high",
        "lead_time_days": 120,
        "origin": "synthetic_augmented"
    },
    {
        "item_id": "item_specialized_gas_piping",
        "project_id": PROJECT_ID,
        "description": "316L ultra-high purity (UHP) stainless steel coaxial delivery piping for toxic process gases.",
        "category": "Specialized Gas Systems",
        "criticality": "high",
        "lead_time_days": 90,
        "origin": "synthetic_augmented"
    }
]

PURCHASE_ORDERS = [
    {
        "po_id": "po_cleanroom_handlers_701",
        "project_id": PROJECT_ID,
        "vendor_id": "vendor_phoenix_hvac_solutions",
        "procurement_item_id": "item_cleanroom_air_handlers",
        "issue_date": "2026-02-01",
        "original_delivery_date": "2026-06-01",
        "revised_delivery_date": "2026-06-25",
        "status": "delayed",
        "value_range": "$2M - $5M",
        "origin": "synthetic_augmented"
    },
    {
        "po_id": "po_gas_piping_802",
        "project_id": PROJECT_ID,
        "vendor_id": "vendor_microflow_systems",
        "procurement_item_id": "item_specialized_gas_piping",
        "issue_date": "2026-03-01",
        "original_delivery_date": "2026-06-01",
        "revised_delivery_date": "2026-06-15",
        "status": "delayed",
        "value_range": "$500k - $1M",
        "origin": "synthetic_augmented"
    }
]

ENGINEERING_CHANGES = [
    {
        "change_id": "ec_cleanroom_hvac_expansion",
        "project_id": PROJECT_ID,
        "affected_entity": "item_cleanroom_air_handlers",
        "revision_date": "2026-03-10",
        "description": "Engineering change EC-99: Expansion of Fab 21 Phase 2 cleanroom footprint by 15% to support additional lithography tool bays, requiring increased AHU air flow capacity.",
        "impact": "Increases the required air handler units from 10 to 12. Current PO 701 only covers 10 units, leading to future shortage risk.",
        "origin": "synthetic_augmented"
    }
]

SCHEDULE_EVENTS = [
    {
        "event_id": "se_tool_install_milestone",
        "project_id": PROJECT_ID,
        "event_date": "2026-07-01",
        "affected_work_package": "Lithography Tool Installation",
        "description": "Milestone MS-03: Arrival and installation of first ASML EUV lithography tool. Requires cleanroom environmental controls (HVAC) to be fully certified and operational.",
        "impact": "Any HVAC system delay beyond June 15 will slide the Lithography Tool installation date, incurring $250k daily delay exposure from specialized vendor stand-by fees.",
        "origin": "synthetic_augmented"
    },
    {
        "event_id": "se_extreme_heat_wave",
        "project_id": PROJECT_ID,
        "event_date": "2026-06-01",
        "affected_work_package": "Specialized Gas Piping Installation",
        "description": "Severe heat wave advisory in Phoenix, restricting heavy freight logistics hours to prevent pavement degradation during peak daytime temperatures.",
        "impact": "Delays overland shipment routing of specialized gas piping from Houston logistics hub by 14 days.",
        "origin": "synthetic_augmented"
    }
]

VENDOR_PERFORMANCES = [
    {
        "performance_id": "vp_phoenix_hvac_quality",
        "vendor_id": "vendor_phoenix_hvac_solutions",
        "project_id": PROJECT_ID,
        "metric": "quality_incident_rate",
        "value": 0.15,
        "context": "Incumbent HVAC supplier historical performance shows recurring quality defects in HEPA filter frame welding, requiring 15-20 days of on-site rework.",
        "event_date": "2026-02-15",
        "origin": "synthetic_augmented"
    },
    {
        "performance_id": "vp_microflow_delivery_slippage",
        "vendor_id": "vendor_microflow_systems",
        "project_id": PROJECT_ID,
        "metric": "delivery_delay_days",
        "value": 14.0,
        "context": "Emerging supplier MicroFlow experiences delivery slippage under high-demand constraints due to raw component shortages.",
        "event_date": "2026-03-15",
        "origin": "synthetic_augmented"
    }
]

CLAIMS = [
    {
        "claim_id": "claim_phoenix_hvac_extension",
        "project_id": PROJECT_ID,
        "vendor_id": "vendor_phoenix_hvac_solutions",
        "claim_text": "Phoenix HVAC Solutions asserts that cleanroom HVAC delivery delays are entirely due to the footprint expansion drawing revisions and they require a 25-day extension of time.",
        "status": "unverified",
        "confidence": 0.5,
        "evidence_ids": ["ev_ec_revision_notice", "ev_welding_audit_report"],
        "source_agent": "sentinel",
        "origin": "synthetic_augmented"
    }
]

EVIDENCE = [
    {
        "evidence_id": "ev_chips_funding_doc",
        "project_id": PROJECT_ID,
        "vendor_id": "vendor_phoenix_hvac_solutions",
        "source_type": "report",
        "source_ref": "src_tsmc_chips_award",
        "extracted_text": "TSMC Arizona will receive up to $6.6 billion in direct funding under the CHIPS and Science Act. The project represents a total investment of over $65 billion, constructing three advanced fabs in Phoenix, Arizona, with the first fab commencing production in early 2025 using 4nm process technology.",
        "origin": "verified_public",
        "metadata": {"title": "CHIPS Act Funding Summary"}
    },
    {
        "evidence_id": "ev_extreme_heat_logistics",
        "project_id": PROJECT_ID,
        "vendor_id": "vendor_microflow_systems",
        "source_type": "report",
        "source_ref": "src_noaa_maricopa_heat",
        "extracted_text": "NWS advisory (June 10): Extreme heat warnings issued for the Phoenix metropolitan area, with temperatures exceeding 115°F (46°C). Heavy freight transport restrictions apply to high-load vehicles between 12:00 PM and 6:00 PM to protect road surfaces.",
        "origin": "verified_public",
        "metadata": {"title": "NOAA Extreme Heat Advisory"}
    },
    {
        "evidence_id": "ev_ec_revision_notice",
        "project_id": PROJECT_ID,
        "vendor_id": "vendor_phoenix_hvac_solutions",
        "source_type": "report",
        "source_ref": "ec_cleanroom_hvac_expansion",
        "extracted_text": "Project Directive EC-99 (March 10): Footprint redesign finalized. Additional 15% HEPA coverage is required for lithography tool bays. Construction team directs HVAC contractor to adapt capacity specs.",
        "origin": "synthetic_augmented",
        "metadata": {
            "title": "Cleanroom Footprint Redesign Directive",
            "motivated_by": "Engineering cleanroom footprint updates"
        }
    },
    {
        "evidence_id": "ev_welding_audit_report",
        "project_id": PROJECT_ID,
        "vendor_id": "vendor_phoenix_hvac_solutions",
        "source_type": "report",
        "source_ref": "claim_phoenix_hvac_extension",
        "extracted_text": "On-site quality audit (April 20): Welds on Phoenix HVAC HEPA grid frames failed structural leak tests. On-site correction and re-testing are required, which typically adds 15 days of delay to ductwork installation.",
        "origin": "synthetic_augmented",
        "metadata": {
            "title": "HEPA Grid Welding Audit Report",
            "motivated_by": "On-site quality inspection"
        }
    },
    {
        "evidence_id": "ev_microflow_raw_material_delay",
        "project_id": PROJECT_ID,
        "vendor_id": "vendor_microflow_systems",
        "source_type": "report",
        "source_ref": "po_gas_piping_802",
        "extracted_text": "Factory memo (March 15): Supply chain raw component shortages for specialized 316L UHP steel piping valves have forced a 14-day production slippage at MicroFlow facilities.",
        "origin": "synthetic_augmented",
        "metadata": {
            "title": "MicroFlow Factory Supply Chain Memo",
            "motivated_by": "MicroFlow capacity constraints"
        }
    }
]
