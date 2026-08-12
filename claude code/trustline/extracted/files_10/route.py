"""
TRUSTLINE — Supplier Capability Graph
GET /trustline/capability-search?capabilities=cnc,clean_room,night_shift

Design:
  - Purely deterministic: a plain set-intersection match against a seeded
    VENDOR_CAPABILITIES table, no LLM anywhere in this endpoint.
  - Every vendor's trust score comes from the same centralized demo dataset
    used across the other Trustline endpoints, so vendor_meridian_steel here
    reports the same trust score as on the other screens.
  - This endpoint is a search/listing rather than a single-entity belief
    update, so it does not return a TrustBelief itself — but it shares the
    same EvidenceItem shape, and the response still carries confidence /
    reasoning / needs_human for consistency with the rest of Trustline.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel

router = APIRouter()

# --------------------------------------------------------------------------
# Shared base models (same shape used across all Trustline endpoints)
# --------------------------------------------------------------------------


class EvidenceItem(BaseModel):
    source: str
    reliability_tier: Literal["self_reported", "third_party_observed", "verified_transaction"]
    timestamp: datetime
    raw_ref: str


class TrustBelief(BaseModel):
    entity_id: str
    dimension: str  # e.g. "schedule_reliability", "financial_stability"
    current_value: float  # 0-1
    previous_value: float
    confidence: float
    evidence: list[EvidenceItem]
    reasoning: str
    needs_human: bool


# --------------------------------------------------------------------------
# Response models
# --------------------------------------------------------------------------


class VendorCapabilityMatch(BaseModel):
    vendor_id: str
    name: str
    trade: str
    location: str
    trust_score: float
    matched_capabilities: list[str]
    all_capabilities: list[str]


class CapabilitySearchResult(BaseModel):
    requested_capabilities: list[str]
    results: list[VendorCapabilityMatch]
    evidence: list[EvidenceItem]
    confidence: float
    reasoning: str
    needs_human: bool


# --------------------------------------------------------------------------
# Thresholds — named constants, not magic numbers buried in logic
# --------------------------------------------------------------------------

NEEDS_HUMAN_ZERO_RESULTS = True  # a zero-match search needs a human to broaden/redefine it

RELIABILITY_WEIGHT = {
    "self_reported": 0.5,
    "third_party_observed": 0.75,
    "verified_transaction": 1.0,
}


# --------------------------------------------------------------------------
# Centralized seeded demo data (same IDs/numbers across all Trustline files)
# --------------------------------------------------------------------------


class VendorMeta(BaseModel):
    vendor_id: str
    name: str
    trade: str
    location: str
    trust_score: float


VENDOR_META: dict[str, VendorMeta] = {
    "vendor_meridian_steel": VendorMeta(
        vendor_id="vendor_meridian_steel",
        name="Meridian Steel Fabrication",
        trade="Structural Steel",
        location="Houston, TX",
        trust_score=76.0,  # matches central trust trajectory: today's value
    ),
    "vendor_titan_fab": VendorMeta(
        vendor_id="vendor_titan_fab",
        name="Titan Fabricators",
        trade="Structural Steel",
        location="Baytown, TX",
        trust_score=88.0,
    ),
    "vendor_coastal_bolt": VendorMeta(
        vendor_id="vendor_coastal_bolt",
        name="Coastal Bolt & Fastener",
        trade="Fasteners",
        location="Corpus Christi, TX",
        trust_score=54.0,
    ),
    "vendor_ironclad_weld": VendorMeta(
        vendor_id="vendor_ironclad_weld",
        name="Ironclad Weld Works",
        trade="Welding & Fabrication",
        location="Pasadena, TX",
        trust_score=71.0,
    ),
    "vendor_precision_cnc": VendorMeta(
        vendor_id="vendor_precision_cnc",
        name="Precision CNC Solutions",
        trade="Precision Machining",
        location="Sugar Land, TX",
        trust_score=91.0,
    ),
    "vendor_gulf_coast_machining": VendorMeta(
        vendor_id="vendor_gulf_coast_machining",
        name="Gulf Coast Machining",
        trade="Precision Machining",
        location="Texas City, TX",
        trust_score=65.0,
    ),
}

VENDOR_CAPABILITIES: dict[str, set[str]] = {
    "vendor_meridian_steel": {"cnc", "welding_certified", "aws_d1_1", "iso_9001", "nde_testing"},
    "vendor_titan_fab": {
        "cnc",
        "clean_room",
        "night_shift",
        "welding_certified",
        "aws_d1_1",
        "iso_9001",
        "on_site_qc",
    },
    "vendor_coastal_bolt": {"night_shift", "expedited_shipping"},
    "vendor_ironclad_weld": {"welding_certified", "aws_d1_1", "night_shift", "nde_testing"},
    "vendor_precision_cnc": {"cnc", "clean_room", "iso_9001", "on_site_qc", "expedited_shipping"},
    "vendor_gulf_coast_machining": {"cnc", "night_shift", "nde_testing"},
}


# --------------------------------------------------------------------------
# Deterministic matching (plain Python set intersection, no LLM)
# --------------------------------------------------------------------------


def _parse_capabilities(raw: str) -> list[str]:
    return [c.strip().lower() for c in raw.split(",") if c.strip()]


def find_matching_vendors(requested: list[str]) -> list[VendorCapabilityMatch]:
    requested_set = set(requested)
    matches: list[VendorCapabilityMatch] = []

    for vendor_id, caps in VENDOR_CAPABILITIES.items():
        # Empty request = no filter, every vendor matches with nothing "matched".
        if requested_set and not requested_set.issubset(caps):
            continue
        meta = VENDOR_META[vendor_id]
        matches.append(
            VendorCapabilityMatch(
                vendor_id=vendor_id,
                name=meta.name,
                trade=meta.trade,
                location=meta.location,
                trust_score=meta.trust_score,
                matched_capabilities=sorted(requested_set & caps),
                all_capabilities=sorted(caps),
            )
        )

    # Deterministic ordering: highest trust first, then name for stable ties.
    matches.sort(key=lambda m: (-m.trust_score, m.name))
    return matches


def compute_confidence(evidence: list[EvidenceItem]) -> float:
    if not evidence:
        return 0.0
    weights = [RELIABILITY_WEIGHT[e.reliability_tier] for e in evidence]
    return round(sum(weights) / len(weights), 2)


def build_reasoning(requested: list[str], results: list[VendorCapabilityMatch]) -> str:
    if not requested:
        return f"No capability filter applied — returning all {len(results)} seeded vendors."
    if not results:
        return (
            f"No seeded vendor holds every requested capability "
            f"({', '.join(requested)}). Consider dropping one filter."
        )
    top = results[0]
    return (
        f"{len(results)} vendor(s) hold all {len(requested)} requested capabilities "
        f"({', '.join(requested)}). Highest-trust match is {top.name} at {top.trust_score:.0f}."
    )


# --------------------------------------------------------------------------
# Route
# --------------------------------------------------------------------------


@router.get("/trustline/capability-search", response_model=CapabilitySearchResult)
async def capability_search(
    capabilities: str = Query(default="", description="Comma-separated capability ids, e.g. cnc,clean_room,night_shift"),
) -> CapabilitySearchResult:
    now = datetime.utcnow()
    requested = _parse_capabilities(capabilities)

    results = find_matching_vendors(requested)
    needs_human = len(results) == 0 and NEEDS_HUMAN_ZERO_RESULTS

    evidence = [
        EvidenceItem(
            source="supplier_capability_registry.vendor_capabilities",
            reliability_tier="self_reported",
            timestamp=now,
            raw_ref=f"set_intersection(requested={requested}, vendors_checked={len(VENDOR_CAPABILITIES)})",
        ),
        EvidenceItem(
            source="trustline_trust_scores.central_dataset",
            reliability_tier="verified_transaction",
            timestamp=now,
            raw_ref=f"trust_score_lookup(vendor_ids={sorted(VENDOR_META.keys())})",
        ),
    ]

    return CapabilitySearchResult(
        requested_capabilities=requested,
        results=results,
        evidence=evidence,
        confidence=compute_confidence(evidence),
        reasoning=build_reasoning(requested, results),
        needs_human=needs_human,
    )
