"""
GET /precedent/warranty-tracker?project_id=

Pure deterministic date math — no LLM anywhere in this file. This is meant to
be the simplest file in the Precedent system, mirroring the same spirit and
priority-level logic as Sentinel's Statutory Deadline Tracker: seed a list of
tracked items with known dates, compute days_remaining, and bucket into a
priority_level using the same threshold scheme, for visual/logical
consistency across the two features.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

router = APIRouter()


# ---------------------------------------------------------------------------
# Shared evidence contract (same shape used across Sentinel / Trustline / Compass)
# ---------------------------------------------------------------------------

class EvidenceItem(BaseModel):
    source: str
    reliability_tier: Literal["self_reported", "third_party_observed", "verified_transaction"]
    timestamp: datetime
    raw_ref: str


# ---------------------------------------------------------------------------
# Precedent shared record shape
# ---------------------------------------------------------------------------

class PrecedentRecord(BaseModel):
    decision_id: str
    situation_type: str  # e.g. "vendor_qualification_override", "clause_negotiation"
    entity_id: str  # vendor or project this concerns
    decision_made: str
    confidence_at_time: float
    dissenting_view: Optional[str]
    outcome: Optional[Literal["pending", "confirmed_good", "confirmed_bad"]]
    evidence: list[EvidenceItem]
    reasoning: str
    needs_human: bool


PriorityLevel = Literal["critical", "high", "medium", "low"]


class WarrantyRecord(PrecedentRecord):
    equipment_name: str
    install_date: date
    warranty_period_months: int
    warranty_end_date: date
    next_service_due: Optional[date]
    days_remaining: int
    priority_level: PriorityLevel
    service_due_soon: bool
    manufacturer_ref: str


class WarrantyTrackerResponse(BaseModel):
    project_id: str
    project_name: str
    total_tracked: int
    critical_count: int
    warranties: list[WarrantyRecord]


# ---------------------------------------------------------------------------
# Priority thresholds — same scheme as Sentinel's Statutory Deadline Tracker,
# reused here for logical/visual consistency across both countdown features.
# ---------------------------------------------------------------------------

PRIORITY_THRESHOLDS_DAYS: dict[PriorityLevel, int] = {
    "critical": 30,
    "high": 90,
    "medium": 180,
    # anything beyond "medium"'s threshold falls through to "low"
}

# A required-service date is flagged as "soon" within this many days.
SERVICE_DUE_SOON_DAYS = 30


def _priority_for_days_remaining(days_remaining: int) -> PriorityLevel:
    if days_remaining <= PRIORITY_THRESHOLDS_DAYS["critical"]:
        return "critical"
    if days_remaining <= PRIORITY_THRESHOLDS_DAYS["high"]:
        return "high"
    if days_remaining <= PRIORITY_THRESHOLDS_DAYS["medium"]:
        return "medium"
    return "low"


# ---------------------------------------------------------------------------
# Centralized ORCHESTRA demo data — Austin Semiconductor Fab equipment warranties
# ---------------------------------------------------------------------------

_PROJECT_NAMES = {
    "project_austin_fab": "Austin Semiconductor Fab",
}

_TODAY = datetime.now(timezone.utc).date()

# MOCK/SEEDED: (equipment_name, install_date, warranty_period_months, next_service_due, manufacturer_ref)
# A realistic mix of urgency levels, per the brief.
_WARRANTY_SEED: list[dict] = [
    {
        "decision_id": "war_004",
        "equipment_name": "UPS System — UPS-Main-1",
        "install_date": date(2025, 8, 28),
        "warranty_period_months": 12,
        "next_service_due": _TODAY + timedelta(days=9),
        "manufacturer_ref": "Eaton MFG-UPS1-WTY-77410",
        "situation_type": "equipment_warranty_tracking",
        "entity_id": "vendor_titan_fab",
        "decision_made": "Installed UPS-Main-1 under standard 12-month warranty.",
        "confidence_at_time": 0.92,
        "dissenting_view": None,
        "outcome": "confirmed_good",
    },
    {
        "decision_id": "war_005",
        "equipment_name": "Chiller Plant — CH-1",
        "install_date": date(2022, 3, 21),
        "warranty_period_months": 24,
        "next_service_due": None,
        "manufacturer_ref": "York MFG-CH1-WTY-30187",
        "situation_type": "equipment_warranty_tracking",
        "entity_id": "vendor_meridian_steel",
        "decision_made": "Installed CH-1 under standard 24-month warranty (expired).",
        "confidence_at_time": 0.88,
        "dissenting_view": None,
        "outcome": "confirmed_good",
    },
    {
        "decision_id": "war_001",
        "equipment_name": "Cleanroom Air Handling Unit — AHU-3",
        "install_date": date(2024, 10, 5),
        "warranty_period_months": 24,
        "next_service_due": _TODAY + timedelta(days=22),
        "manufacturer_ref": "Trane MFG-AHU-3-WTY-88213",
        "situation_type": "equipment_warranty_tracking",
        "entity_id": "vendor_titan_fab",
        "decision_made": "Installed AHU-3 under Titan Fabricators' standard 24-month warranty package.",
        "confidence_at_time": 0.9,
        "dissenting_view": None,
        "outcome": "confirmed_good",
    },
    {
        "decision_id": "war_003",
        "equipment_name": "Process Cooling Water Pumps — PCW-2A/2B",
        "install_date": date(2023, 11, 10),
        "warranty_period_months": 36,
        "next_service_due": _TODAY + timedelta(days=140),
        "manufacturer_ref": "Grundfos MFG-PCW2-WTY-11029",
        "situation_type": "equipment_warranty_tracking",
        "entity_id": "vendor_coastal_bolt",
        "decision_made": "Installed PCW-2A/2B under a 36-month extended warranty add-on.",
        "confidence_at_time": 0.8,
        "dissenting_view": "Field engineer flagged the extended warranty add-on as unnecessary cost at the time.",
        "outcome": "pending",
    },
    {
        "decision_id": "war_002",
        "equipment_name": "Backup Diesel Generator — GEN-1",
        "install_date": date(2025, 7, 7),
        "warranty_period_months": 18,
        "next_service_due": _TODAY + timedelta(days=250),
        "manufacturer_ref": "Cummins MFG-GEN1-WTY-40567",
        "situation_type": "equipment_warranty_tracking",
        "entity_id": "vendor_meridian_steel",
        "decision_made": "Installed GEN-1 under standard 18-month manufacturer warranty.",
        "confidence_at_time": 0.85,
        "dissenting_view": None,
        "outcome": "confirmed_good",
    },
    {
        "decision_id": "war_006",
        "equipment_name": "Gas Detection System — GDS-Fab2",
        "install_date": date(2025, 5, 10),
        "warranty_period_months": 24,
        "next_service_due": _TODAY + timedelta(days=310),
        "manufacturer_ref": "Honeywell MFG-GDS2-WTY-55932",
        "situation_type": "equipment_warranty_tracking",
        "entity_id": "vendor_coastal_bolt",
        "decision_made": "Installed GDS-Fab2 under standard 24-month warranty.",
        "confidence_at_time": 0.87,
        "dissenting_view": None,
        "outcome": "pending",
    },
]


# ---------------------------------------------------------------------------
# Deterministic assembly
# ---------------------------------------------------------------------------

def _build_warranty_record(seed: dict) -> WarrantyRecord:
    install_date: date = seed["install_date"]
    warranty_end_date = install_date + timedelta(days=seed["warranty_period_months"] * 30)
    days_remaining = (warranty_end_date - _TODAY).days
    priority_level = _priority_for_days_remaining(days_remaining)

    next_service_due: Optional[date] = seed["next_service_due"]
    service_due_soon = bool(
        next_service_due is not None and (next_service_due - _TODAY).days <= SERVICE_DUE_SOON_DAYS
    )

    needs_human = priority_level in ("critical", "high") or service_due_soon

    reasoning = (
        f"{seed['equipment_name']} warranty (installed {install_date.isoformat()}, "
        f"{seed['warranty_period_months']}-month term) has {days_remaining} days remaining, "
        f"placing it in the '{priority_level}' priority tier."
    )
    if service_due_soon and next_service_due is not None:
        reasoning += f" A required service is also due by {next_service_due.isoformat()}."

    evidence = [
        EvidenceItem(
            source="manufacturer_warranty_record",
            reliability_tier="verified_transaction",
            timestamp=datetime.combine(install_date, datetime.min.time(), tzinfo=timezone.utc),
            raw_ref=f"{seed['manufacturer_ref']} — install {install_date.isoformat()}, "
            f"{seed['warranty_period_months']}mo term",
        )
    ]

    return WarrantyRecord(
        decision_id=seed["decision_id"],
        situation_type=seed["situation_type"],
        entity_id=seed["entity_id"],
        decision_made=seed["decision_made"],
        confidence_at_time=seed["confidence_at_time"],
        dissenting_view=seed["dissenting_view"],
        outcome=seed["outcome"],
        evidence=evidence,
        reasoning=reasoning,
        needs_human=needs_human,
        equipment_name=seed["equipment_name"],
        install_date=install_date,
        warranty_period_months=seed["warranty_period_months"],
        warranty_end_date=warranty_end_date,
        next_service_due=next_service_due,
        days_remaining=days_remaining,
        priority_level=priority_level,
        service_due_soon=service_due_soon,
        manufacturer_ref=seed["manufacturer_ref"],
    )


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.get("/precedent/warranty-tracker", response_model=WarrantyTrackerResponse)
async def get_warranty_tracker(project_id: str = Query(default="project_austin_fab")) -> WarrantyTrackerResponse:
    records = [_build_warranty_record(seed) for seed in _WARRANTY_SEED]

    priority_rank = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    records.sort(key=lambda r: (priority_rank[r.priority_level], r.days_remaining))

    return WarrantyTrackerResponse(
        project_id=project_id,
        project_name=_PROJECT_NAMES.get(project_id, project_id),
        total_tracked=len(records),
        critical_count=sum(1 for r in records if r.priority_level == "critical"),
        warranties=records,
    )
