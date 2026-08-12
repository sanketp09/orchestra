"""
GET  /trustline/vendor/{vendor_id}/sam-licensing-status
POST /trustline/vendor/{vendor_id}/sam-licensing-recheck

Deterministic — no LLM call anywhere in this file. There is no free text to
extract and no synthesis task; this is a compliance status lookup plus a
straightforward date-math computation (days until license expiry), both of
which are plain, deterministic operations.

*** MOCKED EXTERNAL CALL ***
`check_sam_gov_status()` below is a mock. In a real deployment this would call
the System for Award Management (SAM.gov) public Entity Information API
(https://open.gsa.gov/api/entity-api/) with the vendor's UEI/CAGE code,
authenticated with a SAM.gov API key, to retrieve live exclusion/eligibility
status. That real call is not made here — this function returns seeded,
clearly-labeled mock data so the rest of the system (state license status,
check history, expiry countdown) has something real to assemble from. Swap
this function's body for the actual `httpx` call to the Entity API when a key
is available.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


# ---------------------------------------------------------------------------
# Shared contracts
# ---------------------------------------------------------------------------

class EvidenceItem(BaseModel):
    source: str
    reliability_tier: Literal["self_reported", "third_party_observed", "verified_transaction"]
    timestamp: datetime
    raw_ref: str


class TrustBelief(BaseModel):
    entity_id: str
    dimension: str
    current_value: float
    previous_value: float
    confidence: float
    evidence: list[EvidenceItem]
    reasoning: str
    needs_human: bool


# ---------------------------------------------------------------------------
# Feature-specific response shapes
# ---------------------------------------------------------------------------

class CheckHistoryEntry(BaseModel):
    checked_at: datetime
    sam_status: Literal["active_eligible", "excluded", "expired_registration"]
    license_status: Literal["active", "expired", "suspended"]
    result: Literal["pass", "flag"]


class SamLicensingStatus(BaseModel):
    vendor_id: str
    vendor_name: str
    sam_status: Literal["active_eligible", "excluded", "expired_registration"]
    sam_status_label: str
    license_status: Literal["active", "expired", "suspended"]
    license_expires_on: date
    days_until_license_expiry: int
    last_verified_at: datetime
    check_history: list[CheckHistoryEntry]
    belief: TrustBelief


# ---------------------------------------------------------------------------
# Centralized demo data — same IDs/numbers used across all Trustline files
# ---------------------------------------------------------------------------

_VENDOR_NAMES = {
    "vendor_meridian_steel": "Meridian Steel Fabrication",
    "vendor_titan_fab": "Titan Fabricators",
    "vendor_coastal_bolt": "Coastal Bolt & Fastener",
}

# MOCK/SEEDED: per-vendor SAM.gov + state license baseline. Meridian is
# active/eligible with a license expiring in 45 days, per the brief.
_SAM_LICENSE_SEED: dict[str, dict] = {
    "vendor_meridian_steel": {
        "sam_status": "active_eligible",
        "license_status": "active",
        # 45 days out from "today" at import time, recomputed per request below.
        "license_days_out": 45,
    },
    "vendor_titan_fab": {
        "sam_status": "active_eligible",
        "license_status": "active",
        "license_days_out": 210,
    },
    "vendor_coastal_bolt": {
        "sam_status": "active_eligible",
        "license_status": "active",
        "license_days_out": 12,
    },
}

# MOCK/SEEDED: check history, most recent last. In-memory per-vendor store so
# a POST recheck can append to it during the demo session.
_CHECK_HISTORY: dict[str, list[CheckHistoryEntry]] = {
    "vendor_meridian_steel": [
        CheckHistoryEntry(
            checked_at=datetime.now(timezone.utc) - timedelta(days=21),
            sam_status="active_eligible",
            license_status="active",
            result="pass",
        ),
        CheckHistoryEntry(
            checked_at=datetime.now(timezone.utc) - timedelta(days=14),
            sam_status="active_eligible",
            license_status="active",
            result="pass",
        ),
        CheckHistoryEntry(
            checked_at=datetime.now(timezone.utc) - timedelta(days=7),
            sam_status="active_eligible",
            license_status="active",
            result="pass",
        ),
        CheckHistoryEntry(
            checked_at=datetime.now(timezone.utc) - timedelta(hours=6),
            sam_status="active_eligible",
            license_status="active",
            result="pass",
        ),
    ],
    "vendor_titan_fab": [
        CheckHistoryEntry(
            checked_at=datetime.now(timezone.utc) - timedelta(days=10),
            sam_status="active_eligible",
            license_status="active",
            result="pass",
        ),
    ],
    "vendor_coastal_bolt": [
        CheckHistoryEntry(
            checked_at=datetime.now(timezone.utc) - timedelta(days=5),
            sam_status="active_eligible",
            license_status="active",
            result="pass",
        ),
    ],
}

# License-expiry threshold below which a human should glance at renewal risk.
LICENSE_EXPIRY_NEEDS_HUMAN_DAYS = 30


# ---------------------------------------------------------------------------
# Mocked external call — see module docstring for what the real integration
# would look like (SAM.gov Entity Information API).
# ---------------------------------------------------------------------------

async def check_sam_gov_status(vendor_id: str) -> dict:
    """
    MOCK. Real implementation would call:
        GET https://api.sam.gov/entity-information/v3/entities
            ?ueiSAM={vendor_uei}&api_key={SAM_GOV_API_KEY}
    and parse `entityRegistration.registrationStatus` +
    `exclusionSummary.hasActiveExclusion` from the response.

    Here we just return the seeded status for the vendor.
    """
    seed = _SAM_LICENSE_SEED.get(vendor_id)
    if seed is None:
        return {"sam_status": "active_eligible", "license_status": "active", "license_days_out": 90}
    return seed


# ---------------------------------------------------------------------------
# Deterministic assembly
# ---------------------------------------------------------------------------

_STATUS_LABELS = {
    "active_eligible": "Active & Eligible",
    "excluded": "Excluded",
    "expired_registration": "Registration Expired",
}


def _build_status(vendor_id: str, seed: dict, history: list[CheckHistoryEntry]) -> SamLicensingStatus:
    now = datetime.now(timezone.utc)
    expires_on = (now + timedelta(days=seed["license_days_out"])).date()
    days_until_expiry = (expires_on - now.date()).days

    needs_human = (
        seed["sam_status"] != "active_eligible"
        or seed["license_status"] != "active"
        or days_until_expiry <= LICENSE_EXPIRY_NEEDS_HUMAN_DAYS
    )

    # Belief value: 1.0 = fully compliant/no risk, scaled down for expiry proximity.
    if seed["sam_status"] != "active_eligible" or seed["license_status"] != "active":
        current_value = 0.2
    elif days_until_expiry <= LICENSE_EXPIRY_NEEDS_HUMAN_DAYS:
        current_value = 0.65
    else:
        current_value = 0.95

    reasoning_bits = [
        f"SAM.gov status: {_STATUS_LABELS[seed['sam_status']]}.",
        f"State license: {seed['license_status']}, expiring in {days_until_expiry} days.",
    ]
    if days_until_expiry <= LICENSE_EXPIRY_NEEDS_HUMAN_DAYS:
        reasoning_bits.append(
            f"License renewal falls within the {LICENSE_EXPIRY_NEEDS_HUMAN_DAYS}-day watch window."
        )

    belief = TrustBelief(
        entity_id=vendor_id,
        dimension="regulatory_compliance",
        current_value=current_value,
        previous_value=0.95,
        confidence=0.92,
        evidence=[
            EvidenceItem(
                source="sam_gov_entity_api_mock",
                reliability_tier="third_party_observed",
                timestamp=now,
                raw_ref=f"sam_status={seed['sam_status']}",
            ),
            EvidenceItem(
                source="state_license_registry",
                reliability_tier="verified_transaction",
                timestamp=now,
                raw_ref=f"license_status={seed['license_status']},expires_on={expires_on.isoformat()}",
            ),
        ],
        reasoning=" ".join(reasoning_bits),
        needs_human=needs_human,
    )

    return SamLicensingStatus(
        vendor_id=vendor_id,
        vendor_name=_VENDOR_NAMES[vendor_id],
        sam_status=seed["sam_status"],
        sam_status_label=_STATUS_LABELS[seed["sam_status"]],
        license_status=seed["license_status"],
        license_expires_on=expires_on,
        days_until_license_expiry=days_until_expiry,
        last_verified_at=history[-1].checked_at if history else now,
        check_history=history,
        belief=belief,
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/trustline/vendor/{vendor_id}/sam-licensing-status", response_model=SamLicensingStatus)
async def get_sam_licensing_status(vendor_id: str) -> SamLicensingStatus:
    if vendor_id not in _VENDOR_NAMES:
        raise HTTPException(status_code=404, detail=f"No vendor found for '{vendor_id}'.")

    seed = await check_sam_gov_status(vendor_id)
    history = _CHECK_HISTORY.setdefault(vendor_id, [])
    return _build_status(vendor_id, seed, history)


@router.post("/trustline/vendor/{vendor_id}/sam-licensing-recheck", response_model=SamLicensingStatus)
async def recheck_sam_licensing_status(vendor_id: str) -> SamLicensingStatus:
    if vendor_id not in _VENDOR_NAMES:
        raise HTTPException(status_code=404, detail=f"No vendor found for '{vendor_id}'.")

    seed = await check_sam_gov_status(vendor_id)
    now = datetime.now(timezone.utc)

    result: Literal["pass", "flag"] = (
        "pass" if seed["sam_status"] == "active_eligible" and seed["license_status"] == "active" else "flag"
    )

    history = _CHECK_HISTORY.setdefault(vendor_id, [])
    history.append(
        CheckHistoryEntry(
            checked_at=now,
            sam_status=seed["sam_status"],
            license_status=seed["license_status"],
            result=result,
        )
    )
    # Keep history bounded for the demo.
    _CHECK_HISTORY[vendor_id] = history[-6:]

    return _build_status(vendor_id, seed, _CHECK_HISTORY[vendor_id])
