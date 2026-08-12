"""
Trustline — Auto Package Split
POST /trustline/auto-package-split

Deterministic allocation logic: a vendor confirms it can only deliver a
fraction of an order, so the shortfall is greedily redistributed across
ranked backup vendors (by trust score, filtered to a plausible trade match)
up to each candidate's available capacity. No LLM involved — this is
allocation arithmetic, not reasoning about text.

Uses the same seeded demo vendor set shared across every Trustline endpoint
(same IDs, same numbers) so a request about `vendor_meridian_steel` here
agrees with every other Trustline screen.
"""

from __future__ import annotations

from datetime import date
from enum import Enum
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/trustline", tags=["trustline"])


# ---------------------------------------------------------------------------
# Shared belief model — same shape used by every Trustline endpoint,
# including Sentinel. Not all endpoints instantiate it (this one doesn't
# need to reason over evidence, it's pure allocation logic), but the shape
# is kept identical everywhere it IS used.
# ---------------------------------------------------------------------------

class EvidenceSource(str, Enum):
    VERIFIED_TRANSACTION = "verified_transaction"
    THIRD_PARTY_OBSERVED = "third_party_observed"
    SELF_REPORTED = "self_reported"
    PUBLIC_RECORD = "public_record"


class EvidenceItem(BaseModel):
    date: date
    description: str
    source: EvidenceSource


class TrustBelief(BaseModel):
    entity_id: str
    dimension: str
    current_value: float = Field(ge=0.0, le=1.0)
    previous_value: float = Field(ge=0.0, le=1.0)
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: list[EvidenceItem]
    reasoning: str
    needs_human: bool


# ---------------------------------------------------------------------------
# Seeded demo data — SAME vendor IDs/numbers used across every Trustline file
# ---------------------------------------------------------------------------

class VendorRecord(BaseModel):
    vendor_id: str
    name: str
    trade: str
    location: str
    trust_score: int  # 0-100, "today" value
    # Spare capacity currently available for redistributed orders this cycle.
    # Seeded deliberately low for Titan/Lonestar so the demo order's 80-unit
    # shortfall genuinely requires splitting across two backups rather than
    # one vendor silently absorbing all of it.
    available_capacity_units: int


VENDORS: dict[str, VendorRecord] = {
    "vendor_meridian_steel": VendorRecord(
        vendor_id="vendor_meridian_steel",
        name="Meridian Steel Fabrication",
        trade="Structural Steel",
        location="Houston, TX",
        trust_score=76,  # trajectory: 2023: 68 -> 2024: 74 -> 2025: 82 -> today: 76
        available_capacity_units=260,
    ),
    "vendor_titan_fab": VendorRecord(
        vendor_id="vendor_titan_fab",
        name="Titan Fabricators",
        trade="Structural Steel",
        location="Houston, TX",
        trust_score=88,
        available_capacity_units=50,
    ),
    "vendor_coastal_bolt": VendorRecord(
        vendor_id="vendor_coastal_bolt",
        name="Coastal Bolt & Fastener",
        trade="Fasteners & Hardware",  # different trade -> not a structural-steel backup
        location="Corpus Christi, TX",
        trust_score=54,  # flagged for financial distress elsewhere in Trustline
        available_capacity_units=90,
    ),
    # Additional backup vendor, scoped to this endpoint, to fill the "third
    # backup" slot referenced in the paired component demo. The three
    # centrally-shared vendors above don't include a second plausible
    # structural-steel backup, so this one is seeded here specifically.
    "vendor_lonestar_metal": VendorRecord(
        vendor_id="vendor_lonestar_metal",
        name="Lonestar Metal Works",
        trade="Structural Steel",
        location="San Antonio, TX",
        trust_score=79,
        available_capacity_units=30,
    ),
}

# Simplified schedule-delay heuristic — replace with a real lead-time/
# logistics model. Comment intentionally kept next to the constant.
DELAY_DAYS_PER_UNIT_SHORTFALL = 0.15
ORIGINAL_RISK_DAYS = 12  # matches the paired component demo's "Original risk: 12 days late"
RESIDUAL_COORDINATION_RISK_DAYS = 2  # small lag even when shortfall is fully covered


# ---------------------------------------------------------------------------
# Request / response schema
# ---------------------------------------------------------------------------

class FailedOrder(BaseModel):
    vendor_id: str
    item: str
    quantity: int = Field(gt=0)


class AutoPackageSplitRequest(BaseModel):
    failed_order: FailedOrder
    fulfilled_fraction: float = Field(
        default=0.60,
        ge=0.0,
        le=1.0,
        description="Fraction of the order quantity the original vendor can still deliver.",
    )


class SplitSegment(BaseModel):
    vendor_id: str
    vendor_name: str
    trust_score: int
    quantity: int
    fraction: float
    role: Literal["original_vendor", "backup"]


class ScheduleImpact(BaseModel):
    shortfall_quantity: int
    original_risk_days: int
    projected_risk_days: int
    days_saved: int
    model_note: str = (
        "Simplified heuristic model, not a full logistics/lead-time simulation. "
        "Fully-covered shortfalls still carry a small residual coordination-lag "
        "risk; any uncovered remainder is priced at "
        f"{DELAY_DAYS_PER_UNIT_SHORTFALL} days per unit."
    )


class AutoPackageSplitResponse(BaseModel):
    failed_order: FailedOrder
    segments: list[SplitSegment]
    schedule_impact: ScheduleImpact
    reasoning: str
    needs_human: bool


# ---------------------------------------------------------------------------
# Allocation logic
# ---------------------------------------------------------------------------

def _rank_backup_candidates(exclude_vendor_id: str, trade: str) -> list[VendorRecord]:
    """Rank eligible backup vendors by trust score, filtered to a plausible trade match."""
    candidates = [
        vendor
        for vendor in VENDORS.values()
        if vendor.vendor_id != exclude_vendor_id and vendor.trade == trade
    ]
    return sorted(candidates, key=lambda vendor: vendor.trust_score, reverse=True)


def _greedy_allocate(shortfall: int, candidates: list[VendorRecord]) -> list[SplitSegment]:
    """Fill the shortfall across ranked candidates, up to each one's available capacity."""
    segments: list[SplitSegment] = []
    remaining = shortfall
    for vendor in candidates:
        if remaining <= 0:
            break
        allocation = min(remaining, vendor.available_capacity_units)
        if allocation <= 0:
            continue
        segments.append(
            SplitSegment(
                vendor_id=vendor.vendor_id,
                vendor_name=vendor.name,
                trust_score=vendor.trust_score,
                quantity=allocation,
                fraction=0.0,  # filled in once the order total is known
                role="backup",
            )
        )
        remaining -= allocation
    return segments


@router.post("/auto-package-split", response_model=AutoPackageSplitResponse)
def auto_package_split(request: AutoPackageSplitRequest) -> AutoPackageSplitResponse:
    vendor = VENDORS.get(request.failed_order.vendor_id)
    if vendor is None:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown vendor_id '{request.failed_order.vendor_id}'",
        )

    total_qty = request.failed_order.quantity
    fulfilled_qty = round(total_qty * request.fulfilled_fraction)
    shortfall_qty = total_qty - fulfilled_qty

    original_segment = SplitSegment(
        vendor_id=vendor.vendor_id,
        vendor_name=vendor.name,
        trust_score=vendor.trust_score,
        quantity=fulfilled_qty,
        fraction=round(fulfilled_qty / total_qty, 4),
        role="original_vendor",
    )

    candidates = _rank_backup_candidates(exclude_vendor_id=vendor.vendor_id, trade=vendor.trade)
    backup_segments = _greedy_allocate(shortfall_qty, candidates)
    allocated_qty = sum(segment.quantity for segment in backup_segments)

    for segment in backup_segments:
        segment.fraction = round(segment.quantity / total_qty, 4)

    if allocated_qty < shortfall_qty:
        unallocated = shortfall_qty - allocated_qty
        needs_human = True
        reasoning = (
            f"{vendor.name} can only deliver {request.fulfilled_fraction:.0%} of the order. "
            f"Ranked backup capacity covers {allocated_qty} of {shortfall_qty} shortfall units; "
            f"{unallocated} units remain unallocated and need manual sourcing."
        )
        projected_risk_days = round(unallocated * DELAY_DAYS_PER_UNIT_SHORTFALL) + RESIDUAL_COORDINATION_RISK_DAYS
    else:
        needs_human = False
        backup_names = ", ".join(segment.vendor_name for segment in backup_segments)
        reasoning = (
            f"{vendor.name} can only deliver {request.fulfilled_fraction:.0%} of the order. "
            f"Shortfall of {shortfall_qty} units fully covered by ranked backup vendors "
            f"({backup_names}), ordered by trust score."
        )
        projected_risk_days = RESIDUAL_COORDINATION_RISK_DAYS

    schedule_impact = ScheduleImpact(
        shortfall_quantity=shortfall_qty,
        original_risk_days=ORIGINAL_RISK_DAYS,
        projected_risk_days=projected_risk_days,
        days_saved=ORIGINAL_RISK_DAYS - projected_risk_days,
    )

    return AutoPackageSplitResponse(
        failed_order=request.failed_order,
        segments=[original_segment, *backup_segments],
        schedule_impact=schedule_impact,
        reasoning=reasoning,
        needs_human=needs_human,
    )
