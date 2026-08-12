"""
Trustline — Hidden Ownership Detector
GET /trustline/vendor/{vendor_id}/ownership-check

Design notes:
- No LLM call anywhere in this file. Entity matching is exact-string and
  difflib fuzzy-ratio comparison across a seeded registrations table —
  string comparison is exactly the kind of deterministic logic that should
  never be handed to a model.
- TrustBelief is the shared belief shape every Trustline endpoint reads/
  writes (duplicated inline here per the single-file-per-feature
  convention; in the real system it lives in a shared trustline/models.py).
- Seeded data below is the CENTRALIZED Trustline demo dataset plus a
  registrations table built specifically for this endpoint, with one
  genuine match seeded in (Meridian Steel Fabrication / MSF Holdings LLC
  sharing a registered agent) so the network diagram has something real.
"""

from __future__ import annotations

import difflib
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


# ---------------------------------------------------------------------------
# Shared evidence / belief shapes (same EvidenceItem shape as Sentinel)
# ---------------------------------------------------------------------------

class EvidenceItem(BaseModel):
    source: str
    reliability_tier: Literal["self_reported", "third_party_observed", "verified_transaction"]
    timestamp: datetime
    raw_ref: str


class TrustBelief(BaseModel):
    entity_id: str
    dimension: str          # e.g. "schedule_reliability", "financial_stability"
    current_value: float    # 0-1
    previous_value: float
    confidence: float
    evidence: list[EvidenceItem]
    reasoning: str
    needs_human: bool


# ---------------------------------------------------------------------------
# Route-specific extension
# ---------------------------------------------------------------------------

class ConnectedEntity(BaseModel):
    entity_name: str
    shared_field: Literal["registered_agent", "registered_officer", "registered_address"]
    shared_value: str
    match_type: Literal["exact", "fuzzy"]
    match_ratio: float


class OwnershipCheckResult(TrustBelief):
    vendor_name: str
    connected_entities: list[ConnectedEntity]


# ---------------------------------------------------------------------------
# SEEDED / MOCK REFERENCE DATA
# Centralized Trustline demo vendors, plus a registrations table built for
# this endpoint. One genuine connection is seeded on purpose: Meridian
# Steel Fabrication and a fictional "MSF Holdings LLC" share a registered
# agent exactly, and a near-identical registered officer name (fuzzy
# match) — everyone else in the table is deliberately unconnected.
# ---------------------------------------------------------------------------

VENDOR_NAMES: dict[str, str] = {
    "vendor_meridian_steel": "Meridian Steel Fabrication",
    "vendor_titan_fab": "Titan Fabricators",
    "vendor_coastal_bolt": "Coastal Bolt & Fastener",
}

VENDOR_REGISTRATIONS: dict[str, dict] = {
    "vendor_meridian_steel": {
        "name": "Meridian Steel Fabrication",
        "registered_address": "4820 Market St, Suite 210, Houston, TX 77002",
        "registered_officer": "Daniel R. Voss",
        "registered_agent": "Sterling Corporate Services LLC",
    },
    "vendor_msf_holdings": {
        "name": "MSF Holdings LLC",
        "registered_address": "4820 Market St, Suite 340, Houston, TX 77002",
        "registered_officer": "Daniel Voss",
        "registered_agent": "Sterling Corporate Services LLC",
    },
    "vendor_titan_fab": {
        "name": "Titan Fabricators",
        "registered_address": "1150 Refinery Rd, Baytown, TX 77520",
        "registered_officer": "Carla Jimenez",
        "registered_agent": "Gulf Coast Registered Agents Inc.",
    },
    "vendor_coastal_bolt": {
        "name": "Coastal Bolt & Fastener",
        "registered_address": "902 Harborview Dr, Galveston, TX 77550",
        "registered_officer": "Owen Blake",
        "registered_agent": "Island Registered Agent Co.",
    },
    "vendor_gulftex_fab": {
        "name": "Gulftex Fabrication Group",
        "registered_address": "6600 Industrial Blvd, Houston, TX 77029",
        "registered_officer": "Priya Nair",
        "registered_agent": "Texas Statutory Agents LLC",
    },
}

FIELDS_CHECKED: list[str] = ["registered_agent", "registered_officer", "registered_address"]
FUZZY_MATCH_THRESHOLD = 0.85  # difflib ratio above which two strings count as "the same"


# ---------------------------------------------------------------------------
# Deterministic matching logic
# ---------------------------------------------------------------------------

def _compare(a: str, b: str) -> tuple[bool, str, float]:
    """Returns (is_match, match_type, ratio). Exact match first, then fuzzy."""
    a_norm, b_norm = a.strip().lower(), b.strip().lower()
    if a_norm == b_norm:
        return True, "exact", 1.0
    ratio = difflib.SequenceMatcher(None, a_norm, b_norm).ratio()
    return ratio >= FUZZY_MATCH_THRESHOLD, "fuzzy", round(ratio, 2)


def _find_connections(vendor_id: str) -> list[ConnectedEntity]:
    subject = VENDOR_REGISTRATIONS[vendor_id]
    connections: list[ConnectedEntity] = []

    for other_id, other in VENDOR_REGISTRATIONS.items():
        if other_id == vendor_id:
            continue
        for field in FIELDS_CHECKED:
            is_match, match_type, ratio = _compare(subject[field], other[field])
            if is_match:
                connections.append(
                    ConnectedEntity(
                        entity_name=other["name"],
                        shared_field=field,  # type: ignore[arg-type]
                        shared_value=other[field],
                        match_type=match_type,  # type: ignore[arg-type]
                        match_ratio=ratio,
                    )
                )
    return connections


def _confidence_for(connections: list[ConnectedEntity]) -> float:
    """Deterministic: no connections -> high confidence in a clean result.
    With connections, confidence tracks the average match ratio — an exact
    match on a registered agent is stronger evidence than a borderline
    fuzzy hit on an address."""
    if not connections:
        return 0.95
    avg_ratio = sum(c.match_ratio for c in connections) / len(connections)
    return round(avg_ratio, 2)


def _reasoning_for(vendor_name: str, connections: list[ConnectedEntity]) -> str:
    if not connections:
        return (
            f"No shared registered agent, officer, or address found between {vendor_name} "
            f"and any other entity in the registrations table."
        )
    parts = [
        f"{c.entity_name} shares {c.shared_field.replace('_', ' ')} "
        f"({'exact match' if c.match_type == 'exact' else f'{int(c.match_ratio * 100)}% fuzzy match'}: \"{c.shared_value}\")"
        for c in connections
    ]
    return f"{vendor_name} has {len(connections)} matched field(s) with related entities: " + "; ".join(parts) + "."


def _evidence_for(vendor_id: str, connections: list[ConnectedEntity]) -> list[EvidenceItem]:
    now = datetime.now(timezone.utc)
    items = [
        EvidenceItem(
            source="secretary_of_state_registrations",
            reliability_tier="verified_transaction",
            timestamp=now,
            raw_ref=f"registrations_table:{vendor_id}",
        )
    ]
    for c in connections:
        items.append(
            EvidenceItem(
                source="secretary_of_state_registrations",
                reliability_tier="verified_transaction",
                timestamp=now,
                raw_ref=f"{c.shared_field}={c.shared_value}",
            )
        )
    return items


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.get("/trustline/vendor/{vendor_id}/ownership-check", response_model=OwnershipCheckResult)
def ownership_check(vendor_id: str) -> OwnershipCheckResult:
    if vendor_id not in VENDOR_REGISTRATIONS:
        raise HTTPException(status_code=404, detail=f"Unknown vendor_id: {vendor_id}")

    vendor_name = VENDOR_REGISTRATIONS[vendor_id]["name"]
    connections = _find_connections(vendor_id)
    needs_human = len(connections) > 0  # any match at all routes to human review

    return OwnershipCheckResult(
        entity_id=vendor_id,
        dimension="ownership_transparency",
        current_value=round(1.0 - 0.25 * len(connections), 2) if connections else 1.0,
        previous_value=1.0,
        confidence=_confidence_for(connections),
        evidence=_evidence_for(vendor_id, connections),
        reasoning=_reasoning_for(vendor_name, connections),
        needs_human=needs_human,
        vendor_name=vendor_name,
        connected_entities=connections,
    )
