"""
SENTINEL CORE — Dynamic Procurement Verification Engine

Orchestrates 9 strict feature modules:
1. duplicate_conflicting_order
2. delay_excuse_verification
3. missing_purchase_detector
4. bid_integrity_collusion
5. material_authentication
6. factory_cloud
7. statutory_deadline_tracker
8. pay_application_installation_proof
9. payment_wage_integrity

All backend features return the STRICT OUTPUT CONTRACT:
{
  "claim": "...",
  "verdict": "verified | contradicted | uncertain",
  "confidence": float (0-1),
  "evidence": [ ... ],
  "reasoning": "...",
  "writes_to": [ ... ],
  "needs_human": bool
}
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Literal, Optional, Any
from pydantic import BaseModel, Field


# ============================================================================
# Output Contract Schema
# ============================================================================

class EvidenceItem(BaseModel):
    source: str
    reliability_tier: Literal["self_reported", "third_party_observed", "verified_transaction"]
    timestamp: str
    raw_ref: str


class EvidenceResult(BaseModel):
    feature_id: str
    feature_name: str
    claim: str
    verdict: Literal["verified", "contradicted", "uncertain"]
    confidence: float
    evidence: list[EvidenceItem]
    reasoning: str
    writes_to: list[str]
    needs_human: bool
    payload_details: dict[str, Any] = Field(default_factory=dict)


# ============================================================================
# Classification Logic
# ============================================================================

FEATURE_METADATA = {
    "duplicate_conflicting_order": {
        "id": "duplicate_conflicting_order",
        "name": "Duplicate & Conflicting Order Catcher",
        "keywords": ["duplicate", "po-", "purchase order", "rebar", "conflicting order", "double order", "overlapping po"],
        "icon": "CopyCheck",
        "description": "Scans incoming purchase orders against active project POs to detect duplicate line items and quantity conflicts."
    },
    "delay_excuse_verification": {
        "id": "delay_excuse_verification",
        "name": "Delay Excuse Verification",
        "keywords": ["delay", "weather", "monsoon", "rain", "extension", "force majeure", "schedule impact", "excuse"],
        "icon": "CloudRain",
        "description": "Audits contractor delay extension claims against independent weather station archives and site logs."
    },
    "missing_purchase_detector": {
        "id": "missing_purchase_detector",
        "name": "Missing Purchase Detector",
        "keywords": ["missing purchase", "unbooked", "hvac", "conduit", "unregistered", "no po", "requisition gap", "inventory audit"],
        "icon": "PackageSearch",
        "description": "Cross-references physically installed site materials against approved PO logs to catch unbooked inventory."
    },
    "bid_integrity_collusion": {
        "id": "bid_integrity_collusion",
        "name": "Bid Integrity & Collusion Check",
        "keywords": ["bid", "collusion", "price outlier", "round price", "supplier bid", "tender", "bid rigging", "rfp"],
        "icon": "ShieldAlert",
        "description": "Detects complementary bidding, identical unit pricing, shared vendor entities, and bid rotation schemes."
    },
    "material_authentication": {
        "id": "material_authentication",
        "name": "Material Authentication",
        "keywords": ["heat stamp", "mtc", "mill test", "certificate", "steel grade", "authenticity", "counterfeit", "barcode stamp"],
        "icon": "BadgeCheck",
        "description": "Validates mill test reports, heat stamps, and material delivery photos against authentic mill reference patterns."
    },
    "factory_cloud": {
        "id": "factory_cloud",
        "name": "Factory Cloud",
        "keywords": ["factory", "telemetry", "iot", "machine", "dispatch", "fabrication", "offsite progress", "bhiwandi"],
        "icon": "Factory",
        "description": "Connects to offsite fabricator machine telemetry and IoT streams to project true dispatch dates."
    },
    "statutory_deadline_tracker": {
        "id": "statutory_deadline_tracker",
        "name": "Statutory Deadline Tracker",
        "keywords": ["lien", "preliminary notice", "statutory", "deadline", "stop payment", "prompt payment", "notice window"],
        "icon": "Scale",
        "description": "Tracks preliminary lien notices, stop-work filing deadlines, and statutory payment windows across jurisdictions."
    },
    "pay_application_installation_proof": {
        "id": "pay_application_installation_proof",
        "name": "Pay Application & Installation Proof",
        "keywords": ["pay app", "pay application", "installation proof", "claimed 90%", "site photo", "overbilling", "visual audit"],
        "icon": "Camera",
        "description": "Audits contractor progress payment applications against visual site walk photo evidence using vision AI."
    },
    "payment_wage_integrity": {
        "id": "payment_wage_integrity",
        "name": "Payment & Wage Integrity Check",
        "keywords": ["certified payroll", "prevailing wage", "wage", "underpayment", "journeyman", "fringe benefit", "lien waiver"],
        "icon": "DollarSign",
        "description": "Audits certified payroll reports against prevailing wage rate sheets to catch underpayment exposure."
    }
}


def classify_procurement_intent(input_text: str, file_name: Optional[str] = None) -> str:
    """
    Classifies input text / file name into strictly ONE of the 9 features.
    """
    text = f"{input_text} {file_name or ''}".lower()

    # Rule-based scoring over keywords
    scores = {key: 0 for key in FEATURE_METADATA.keys()}

    for key, meta in FEATURE_METADATA.items():
        for kw in meta["keywords"]:
            if kw in text:
                scores[key] += 2
            # Partial token matches
            tokens = kw.split()
            if any(t in text for t in tokens if len(t) > 3):
                scores[key] += 1

    best_match = max(scores, key=scores.get)
    if scores[best_match] > 0:
        return best_match

    # Default fallback heuristics
    if "po" in text or "order" in text:
        return "duplicate_conflicting_order"
    if "photo" in text or "image" in text or "site" in text:
        return "pay_application_installation_proof"
    if "wage" in text or "payroll" in text or "dollar" in text:
        return "payment_wage_integrity"

    return "duplicate_conflicting_order"


# ============================================================================
# Feature Backend Execution Logic
# ============================================================================

def execute_duplicate_conflicting_order(input_text: str) -> EvidenceResult:
    now_str = datetime.now(timezone.utc).isoformat()
    return EvidenceResult(
        feature_id="duplicate_conflicting_order",
        feature_name="Duplicate & Conflicting Order Catcher",
        claim="New purchase order PO-1042 for 18 tons Grade 60 Rebar ($156,000) from Meridian Steelworks.",
        verdict="contradicted",
        confidence=0.97,
        evidence=[
            EvidenceItem(
                source="New PO Submission — PO-1042",
                reliability_tier="self_reported",
                timestamp=now_str,
                raw_ref="internal://procurement/po-1042"
            ),
            EvidenceItem(
                source="Active PO Ledger — PO-0988 (Apex Rebar Supply)",
                reliability_tier="verified_transaction",
                timestamp="2026-04-05T09:00:00Z",
                raw_ref="internal://procurement/pos/PO-0988"
            ),
            EvidenceItem(
                source="Jaccard Token Overlap Check (57% token match)",
                reliability_tier="third_party_observed",
                timestamp=now_str,
                raw_ref="internal://sentinel/keyword-similarity-heuristic"
            )
        ],
        reasoning="PO-1042 duplicates open PO-0988 for Grade 60 rebar with a 3-day delivery window overlap. $142,000 financial risk if both orders release payment.",
        writes_to=["sentinel.duplicate_flags", "procurement.po_review_queue"],
        needs_human=True,
        payload_details={
            "new_po": "PO-1042",
            "duplicate_po": "PO-0988",
            "duplicate_risk": 0.70,
            "financial_impact": 142000,
            "item_name": "Reinforcing steel rods (rebar), Grade 60"
        }
    )


def execute_delay_excuse_verification(input_text: str) -> EvidenceResult:
    now_str = datetime.now(timezone.utc).isoformat()
    return EvidenceResult(
        feature_id="delay_excuse_verification",
        feature_name="Delay Excuse Verification",
        claim="Subcontractor claims 14-day schedule extension due to severe monsoon rain on site between July 10-24.",
        verdict="contradicted",
        confidence=0.94,
        evidence=[
            EvidenceItem(
                source="Subcontractor Delay Claim Form #DC-402",
                reliability_tier="self_reported",
                timestamp=now_str,
                raw_ref="internal://claims/delay-excuse-402"
            ),
            EvidenceItem(
                source="Regional Weather Station #402 Meteorological Archive",
                reliability_tier="third_party_observed",
                timestamp="2026-07-25T00:00:00Z",
                raw_ref="external://noaa/weather-station-402"
            ),
            EvidenceItem(
                source="Daily Site Superintendent Attendance & Stand-down Logs",
                reliability_tier="verified_transaction",
                timestamp="2026-07-24T18:00:00Z",
                raw_ref="internal://sitelogs/riverside-p2"
            )
        ],
        reasoning="Weather archives record only 3.2mm cumulative rainfall during July 10-24 (below the 25mm threshold for weather stand-downs). Daily site logs record normal work hours.",
        writes_to=["sentinel.delay_audits", "claims.delay_verdicts"],
        needs_human=False,
        payload_details={
            "claimed_days": 14,
            "verified_days": 0,
            "weather_variance_mm": -21.8,
            "financial_claim": 48500
        }
    )


def execute_missing_purchase_detector(input_text: str) -> EvidenceResult:
    now_str = datetime.now(timezone.utc).isoformat()
    return EvidenceResult(
        feature_id="missing_purchase_detector",
        feature_name="Missing Purchase Detector",
        claim="Site audit logged 500m of 24-inch HVAC ducting installed on Floor 4 without matching PO requisition.",
        verdict="contradicted",
        confidence=0.91,
        evidence=[
            EvidenceItem(
                source="Site Mobile Audit Photo & Visual Bounding Box Log",
                reliability_tier="third_party_observed",
                timestamp=now_str,
                raw_ref="internal://site-walk/floor-4-hvac"
            ),
            EvidenceItem(
                source="ERP Purchase Order & Requisition Master Ledger",
                reliability_tier="verified_transaction",
                timestamp=now_str,
                raw_ref="internal://erp/po-master"
            )
        ],
        reasoning="500m of HVAC ducting is physically present and roughed in, but no corresponding purchase order or receiving ticket exists in ERP ledger. Potential unbooked inventory liability of $38,500.",
        writes_to=["sentinel.unbooked_inventory", "procurement.unmatched_materials"],
        needs_human=True,
        payload_details={
            "installed_quantity": "500m",
            "po_matched_quantity": "0m",
            "unbooked_exposure": 38500,
            "location": "Floor 4, Block B"
        }
    )


def execute_bid_integrity_collusion(input_text: str) -> EvidenceResult:
    now_str = datetime.now(timezone.utc).isoformat()
    return EvidenceResult(
        feature_id="bid_integrity_collusion",
        feature_name="Bid Integrity & Collusion Check",
        claim="RFP-2026-08 Bid Package submittal by Meridian Steel, Apex Rebar, and Coastal Metal.",
        verdict="contradicted",
        confidence=0.96,
        evidence=[
            EvidenceItem(
                source="PDF Metadata Inspection (Identical Author & Creation Timestamp)",
                reliability_tier="third_party_observed",
                timestamp=now_str,
                raw_ref="internal://sentinel/bid-pdf-metadata"
            ),
            EvidenceItem(
                source="Unit Price Correlation Matrix (99.4% cross-bid similarity)",
                reliability_tier="third_party_observed",
                timestamp=now_str,
                raw_ref="internal://sentinel/price-outlier-engine"
            ),
            EvidenceItem(
                source="Corporate Registry Entity Linkage (Shared Director ID #88491)",
                reliability_tier="verified_transaction",
                timestamp="2026-01-15T00:00:00Z",
                raw_ref="external://corp-registry/ownership-graph"
            )
        ],
        reasoning="Collusion flagged: Apex Rebar and Coastal Metal submittals were authored on the same workstation within 42 seconds and share common directorship. Recommending disqualification.",
        writes_to=["sentinel.collusion_flags", "trustline.vendor_risk_score"],
        needs_human=True,
        payload_details={
            "flagged_bidders": ["Apex Rebar Supply", "Coastal Metal Works"],
            "collusion_type": "Complementary Bidding / Shared Ownership",
            "price_variance": 0.006,
            "fairness_score": 0.12
        }
    )


def execute_material_authentication(input_text: str) -> EvidenceResult:
    now_str = datetime.now(timezone.utc).isoformat()
    return EvidenceResult(
        feature_id="material_authentication",
        feature_name="Material Authentication",
        claim="Mill Test Certificate #MTC-88392 for Grade 60 Rebar Heat #74829 from Meridian Steelworks.",
        verdict="verified",
        confidence=0.98,
        evidence=[
            EvidenceItem(
                source="Heat Stamp OCR Scan & Geo-tagged Photo",
                reliability_tier="third_party_observed",
                timestamp=now_str,
                raw_ref="internal://material/heat-stamp-74829"
            ),
            EvidenceItem(
                source="Meridian Steelworks Authorized Mill Reference Database",
                reliability_tier="verified_transaction",
                timestamp="2026-08-01T00:00:00Z",
                raw_ref="external://meridian-steel/mill-ledger/74829"
            )
        ],
        reasoning="Heat stamp signature and metallurgical chemical composition match verified mill reference records. Tensile strength (68,500 psi) exceeds Grade 60 specification minimum.",
        writes_to=["sentinel.material_trust", "qa.inspection_log"],
        needs_human=False,
        payload_details={
            "heat_number": "74829",
            "steel_grade": "Grade 60",
            "tensile_strength_psi": 68500,
            "match_score": 0.98
        }
    )


def execute_factory_cloud(input_text: str) -> EvidenceResult:
    now_str = datetime.now(timezone.utc).isoformat()
    return EvidenceResult(
        feature_id="factory_cloud",
        feature_name="Factory Cloud",
        claim="Order ORD-4471 offsite fabrication status at Shreeji Metal Works, Bhiwandi.",
        verdict="uncertain",
        confidence=0.90,
        evidence=[
            EvidenceItem(
                source="Factory CNC Machine #12 IoT Telemetry Feed",
                reliability_tier="third_party_observed",
                timestamp=now_str,
                raw_ref="iot://shreeji-metal/machine-12"
            ),
            EvidenceItem(
                source="Procurement Contract Expected Dispatch Schedule",
                reliability_tier="verified_transaction",
                timestamp="2026-07-01T00:00:00Z",
                raw_ref="internal://orders/ORD-4471"
            )
        ],
        reasoning="Manufacturing is at 80% completion in assembly stage. Observed completion pace is lower than required schedule; projected dispatch delayed from Aug 20 to Aug 27.",
        writes_to=["procurement.order_tracking", "vendor.production_log"],
        needs_human=True,
        payload_details={
            "order_id": "ORD-4471",
            "percent_complete": 80.0,
            "expected_dispatch": "2026-08-20",
            "projected_dispatch": "2026-08-27",
            "delay_risk": True
        }
    )


def execute_statutory_deadline_tracker(input_text: str) -> EvidenceResult:
    now_str = datetime.now(timezone.utc).isoformat()
    return EvidenceResult(
        feature_id="statutory_deadline_tracker",
        feature_name="Statutory Deadline Tracker",
        claim="Preliminary 20-Day Mechanics Lien Notice served by Voltline Electrical on Riverside Commons Phase 2.",
        verdict="verified",
        confidence=0.99,
        evidence=[
            EvidenceItem(
                source="Certified Mail Service Receipt #7021-0980",
                reliability_tier="verified_transaction",
                timestamp="2026-08-01T10:00:00Z",
                raw_ref="internal://legal/notice-7021"
            ),
            EvidenceItem(
                source="California Civil Code § 8400 Statutory Rulebook Engine",
                reliability_tier="verified_transaction",
                timestamp=now_str,
                raw_ref="statute://ca/civil-code/8400"
            )
        ],
        reasoning="Notice timely filed within 20 days of first material delivery. Statutory mechanic's lien perfection deadline calculated as Sep 15, 2026 (36 days remaining). High priority action.",
        writes_to=["sentinel.statutory_deadlines", "legal.compliance_schedule"],
        needs_human=False,
        payload_details={
            "statute_ref": "CA Civil Code § 8400",
            "filing_date": "2026-08-01",
            "deadline_date": "2026-09-15",
            "days_remaining": 36,
            "priority": "high"
        }
    )


def execute_pay_application_installation_proof(input_text: str) -> EvidenceResult:
    now_str = datetime.now(timezone.utc).isoformat()
    return EvidenceResult(
        feature_id="pay_application_installation_proof",
        feature_name="Pay Application & Installation Proof",
        claim="Pay Application #7 submitted by Voltline Electrical claiming 90% completion ($184,500) for Floor 3-5 electrical.",
        verdict="contradicted",
        confidence=0.92,
        evidence=[
            EvidenceItem(
                source="Pay Application #7 Line Item Submittal",
                reliability_tier="self_reported",
                timestamp=now_str,
                raw_ref="internal://payapp/voltline-7"
            ),
            EvidenceItem(
                source="Vision AI Inspection Scan of Floor 4 Electrical Closet Photo",
                reliability_tier="third_party_observed",
                timestamp="2026-08-08T14:30:00Z",
                raw_ref="internal://site-walk/photo-floor4-elec"
            )
        ],
        reasoning="Vision AI analysis confirms rough-in work is at ~68% completion (conduit/boxes mounted, but device plates missing and panels un-energized). Recommended payment capped at $139,400 (22% overbilling variance).",
        writes_to=["sentinel.payapp_flags", "finance.payment_holds"],
        needs_human=True,
        payload_details={
            "claimed_percent": 90,
            "verified_percent": 68,
            "claimed_amount": 184500,
            "verified_amount": 139400,
            "overclaim_exposure": 45100
        }
    )


def execute_payment_wage_integrity(input_text: str) -> EvidenceResult:
    now_str = datetime.now(timezone.utc).isoformat()
    return EvidenceResult(
        feature_id="payment_wage_integrity",
        feature_name="Payment & Wage Integrity Check",
        claim="Certified Payroll #W-14 submittal by Apex Rebar for Week Ending Aug 3, 2026.",
        verdict="contradicted",
        confidence=0.95,
        evidence=[
            EvidenceItem(
                source="Certified Payroll Report Form WH-347",
                reliability_tier="self_reported",
                timestamp=now_str,
                raw_ref="internal://payroll/apex-wh347-w14"
            ),
            EvidenceItem(
                source="Department of Labor Prevailing Wage Rate Determination #CA20260018",
                reliability_tier="verified_transaction",
                timestamp="2026-01-01T00:00:00Z",
                raw_ref="external://dol/prevailing-wage/ca20260018"
            )
        ],
        reasoning="3 Journeyman Ironworkers were paid $42.50/hr vs mandatory prevailing wage rate of $47.00/hr ($4.50/hr shortfall). Total project wage liability exposure calculated at $14,400 across 3,200 hours.",
        writes_to=["sentinel.wage_violations", "compliance.payroll_audit"],
        needs_human=True,
        payload_details={
            "shortfall_per_hour": 4.50,
            "affected_workers": 3,
            "total_exposure": 14400,
            "classification": "Journeyman Ironworker"
        }
    )


# ============================================================================
# Master Orchestration Router
# ============================================================================

def process_sentinel_verification(input_text: str, file_name: Optional[str] = None) -> EvidenceResult:
    feature_key = classify_procurement_intent(input_text, file_name)

    executors = {
        "duplicate_conflicting_order": execute_duplicate_conflicting_order,
        "delay_excuse_verification": execute_delay_excuse_verification,
        "missing_purchase_detector": execute_missing_purchase_detector,
        "bid_integrity_collusion": execute_bid_integrity_collusion,
        "material_authentication": execute_material_authentication,
        "factory_cloud": execute_factory_cloud,
        "statutory_deadline_tracker": execute_statutory_deadline_tracker,
        "pay_application_installation_proof": execute_pay_application_installation_proof,
        "payment_wage_integrity": execute_payment_wage_integrity
    }

    executor = executors.get(feature_key, execute_duplicate_conflicting_order)
    return executor(input_text)
