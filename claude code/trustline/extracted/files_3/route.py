"""
Trustline — EMR & Safety Trend Watch
GET /trustline/vendor/{vendor_id}/safety-trend

Pure deterministic — no LLM. Seeds a short EMR history and one OSHA
recordable incident for the vendor, then computes a composite safety score
via a simplified weighted formula (NOT a real actuarial calculation — see
the comment above the formula).

Uses the same seeded demo vendor set shared across every Trustline endpoint
(same IDs, same numbers) so results agree across all ten features.
"""

from __future__ import annotations

from datetime import date
from enum import Enum

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/trustline", tags=["trustline"])


# ---------------------------------------------------------------------------
# Shared belief model — same shape used by every Trustline endpoint
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
    previous_value: float
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


VENDORS: dict[str, VendorRecord] = {
    "vendor_meridian_steel": VendorRecord(
        vendor_id="vendor_meridian_steel",
        name="Meridian Steel Fabrication",
        trade="Structural Steel",
        location="Houston, TX",
    ),
    "vendor_titan_fab": VendorRecord(
        vendor_id="vendor_titan_fab",
        name="Titan Fabricators",
        trade="Structural Steel",
        location="Houston, TX",
    ),
    "vendor_coastal_bolt": VendorRecord(
        vendor_id="vendor_coastal_bolt",
        name="Coastal Bolt & Fastener",
        trade="Fasteners & Hardware",
        location="Corpus Christi, TX",
    ),
}

INDUSTRY_AVG_EMR = 1.00

# EMR history seeded only for Meridian Steel — the only vendor this demo's
# safety narrative ("something just happened") is built around. A real
# implementation would source this per-vendor from an EMR feed.
EMR_HISTORY_BY_VENDOR: dict[str, list[tuple[str, float]]] = {
    "vendor_meridian_steel": [
        ("Q1 2025", 0.94),
        ("Q2 2025", 0.99),
        ("Q3 2025", 1.03),
        ("Q4 2025", 1.08),  # matches central dataset's "EMR at 1.08"
    ],
}

# (period_label, months_ago, recordable_count) — matches central dataset's
# "one OSHA recordable incident 8 months ago".
OSHA_HISTORY_BY_VENDOR: dict[str, list[tuple[str, int, int]]] = {
    "vendor_meridian_steel": [
        ("Q1 2025", 11, 0),
        ("Q2 2025", 8, 1),
        ("Q3 2025", 5, 0),
        ("Q4 2025", 2, 0),
    ],
}

MERIDIAN_EVIDENCE: list[EvidenceItem] = [
    EvidenceItem(
        date=date(2025, 6, 30),
        description="EMR at 1.08 vs. industry average of 1.00",
        source=EvidenceSource.THIRD_PARTY_OBSERVED,
    ),
    EvidenceItem(
        date=date(2025, 4, 15),
        description="OSHA recordable incident logged",
        source=EvidenceSource.PUBLIC_RECORD,
    ),
]


# ---------------------------------------------------------------------------
# Composite safety score — SIMPLIFIED MODEL, not a real actuarial calculation.
#
#   penalty_emr      = EMR_PENALTY_MULTIPLIER * max(0, current_emr - 1.0)
#   penalty_incident  = INCIDENT_PENALTY_MAX * max(0, (LOOKBACK - months_ago) / LOOKBACK)
#   safety_score      = clamp(100 - penalty_emr - penalty_incident, 0, 100)
#
# EMR above 1.0 costs points proportionally to how far above benchmark it is.
# A recordable incident costs the most the month it happens and decays
# linearly to zero penalty once it's INCIDENT_LOOKBACK_MONTHS old.
# ---------------------------------------------------------------------------

EMR_PENALTY_MULTIPLIER = 40
INCIDENT_LOOKBACK_MONTHS = 24
INCIDENT_PENALTY_MAX = 25

WORSENING_TREND_NEEDS_HUMAN_INCIDENT_WINDOW_MONTHS = 12


def _compute_safety_score(current_emr: float, months_since_last_incident: int | None) -> float:
    emr_penalty = EMR_PENALTY_MULTIPLIER * max(0.0, current_emr - 1.0)

    if months_since_last_incident is None:
        incident_penalty = 0.0
    else:
        incident_penalty = INCIDENT_PENALTY_MAX * max(
            0.0,
            (INCIDENT_LOOKBACK_MONTHS - months_since_last_incident) / INCIDENT_LOOKBACK_MONTHS,
        )

    return round(max(0.0, min(100.0, 100 - emr_penalty - incident_penalty)), 1)


# ---------------------------------------------------------------------------
# Response schema
# ---------------------------------------------------------------------------

class EmrPoint(BaseModel):
    period: str
    emr: float
    benchmark: float = INDUSTRY_AVG_EMR


class OshaPoint(BaseModel):
    period: str
    months_ago: int
    recordable_incidents: int


class SafetyTrendResponse(BaseModel):
    vendor_id: str
    vendor_name: str
    emr_history: list[EmrPoint]
    current_emr: float
    industry_avg_emr: float
    emr_trend_worsening: bool
    osha_history: list[OshaPoint]
    months_since_last_incident: int | None
    safety_score: float
    reasoning: str
    needs_human: bool
    model_note: str = (
        "safety_score is a simplified weighted heuristic (EMR-above-benchmark penalty + "
        "incident-recency penalty), not a real actuarial or insurance-grade calculation."
    )


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get("/vendor/{vendor_id}/safety-trend", response_model=SafetyTrendResponse)
def get_safety_trend(vendor_id: str) -> SafetyTrendResponse:
    vendor = VENDORS.get(vendor_id)
    if vendor is None:
        raise HTTPException(status_code=404, detail=f"Unknown vendor_id '{vendor_id}'")

    emr_raw = EMR_HISTORY_BY_VENDOR.get(vendor_id)
    osha_raw = OSHA_HISTORY_BY_VENDOR.get(vendor_id)

    if not emr_raw:
        raise HTTPException(status_code=404, detail=f"No EMR history seeded for '{vendor_id}'")

    emr_history = [EmrPoint(period=period, emr=value) for period, value in emr_raw]
    current_emr = emr_history[-1].emr
    emr_trend_worsening = len(emr_history) >= 2 and emr_history[-1].emr > emr_history[-2].emr

    osha_history = [
        OshaPoint(period=period, months_ago=months_ago, recordable_incidents=count)
        for period, months_ago, count in (osha_raw or [])
    ]
    incident_months = [point.months_ago for point in osha_history if point.recordable_incidents > 0]
    months_since_last_incident = min(incident_months) if incident_months else None

    safety_score = _compute_safety_score(current_emr, months_since_last_incident)

    incident_recent = (
        months_since_last_incident is not None
        and months_since_last_incident < WORSENING_TREND_NEEDS_HUMAN_INCIDENT_WINDOW_MONTHS
    )
    needs_human = emr_trend_worsening and incident_recent

    if needs_human:
        reasoning = (
            f"{vendor.name}'s EMR has risen to {current_emr:.2f} against a {INDUSTRY_AVG_EMR:.2f} "
            f"benchmark, and a recordable incident occurred {months_since_last_incident} months ago "
            "— both the trend and a recent incident are true, so this is flagged for human review."
        )
    elif emr_trend_worsening:
        reasoning = (
            f"{vendor.name}'s EMR is trending up ({current_emr:.2f} vs. {INDUSTRY_AVG_EMR:.2f} "
            "benchmark), but the last recordable incident is old enough that this doesn't need "
            "human review on its own."
        )
    else:
        reasoning = f"{vendor.name}'s EMR trend is not worsening; no human review needed."

    return SafetyTrendResponse(
        vendor_id=vendor.vendor_id,
        vendor_name=vendor.name,
        emr_history=emr_history,
        current_emr=current_emr,
        industry_avg_emr=INDUSTRY_AVG_EMR,
        emr_trend_worsening=emr_trend_worsening,
        osha_history=osha_history,
        months_since_last_incident=months_since_last_incident,
        safety_score=safety_score,
        reasoning=reasoning,
        needs_human=needs_human,
    )
