"""
Atlas — Port & Shipping Intelligence
GET /atlas/shipment-status/{shipment_id}

Deterministic — no LLM. Seeds a multi-waypoint route for the shipment, a
congestion flag at the Port of Houston waypoint, and recomputes ETA and an
alternate-port reroute purely via arithmetic on seeded transit-time data.

Every Atlas signal (see WorldSignal below) exists to tie a world event back
to something specific and named in OUR data — this endpoint ties Port of
Houston congestion directly to Switchgear Shipment #4471, Meridian Steel
Fabrication, and the Austin Semiconductor Fab project, never a generic
"here's some market data" view.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from enum import Enum
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

router = APIRouter(prefix="/atlas", tags=["atlas"])


# ---------------------------------------------------------------------------
# Shared Atlas signal shape — every Atlas screen's world-event data extends this
# ---------------------------------------------------------------------------

class WorldSignal(BaseModel):
    signal_type: str  # e.g. "commodity_price", "port_congestion", "tariff_change"
    affected_entity_ids: list[str]  # which of OUR vendors/shipments/projects this touches
    severity: Literal["info", "watch", "action_needed"]
    summary: str
    detail: dict[str, Any]
    recommended_action: str | None
    detected_at: datetime


# ---------------------------------------------------------------------------
# Centralized demo data — reused/extended across every Atlas file
# ---------------------------------------------------------------------------

VENDOR_ID = "vendor_meridian_steel"
VENDOR_NAME = "Meridian Steel Fabrication"

PROJECT_ID = "project_austin_fab"
PROJECT_NAME = "Austin Semiconductor Fab"

SHIPMENT_ID = "shipment_4471"
SHIPMENT_LABEL = "Switchgear Shipment #4471"

# Seeded for other Atlas screens (e.g. commodity-price impact views) — not
# used directly by this endpoint, kept here so every Atlas file references
# the exact same numbers.
BUDGET_LINES_PROJECT_AUSTIN_FAB = {
    "structural_steel": {"label": "Structural Steel", "budgeted_usd": 2_100_000},
    "copper_wiring": {"label": "Copper Wiring", "budgeted_usd": 480_000},
}

# --- Route + transit-time seed data (days) ---
DEPARTURE_DATE = date(2026, 7, 20)  # left Port of Ulsan
FACTORY_READY_DATE = date(2026, 7, 18)  # shipped out of the fabrication facility

FACTORY_TO_DEPARTURE_PORT_DAYS = 2  # already elapsed by DEPARTURE_DATE
DEPARTURE_TO_HOUSTON_DAYS = 24  # ocean transit, Ulsan -> Port of Houston
HOUSTON_TO_SITE_DAYS = 3  # trucking, Port of Houston -> Austin site

BASE_TRANSIT_DAYS = DEPARTURE_TO_HOUSTON_DAYS + HOUSTON_TO_SITE_DAYS  # 27, from departure

# Alternate route via Port of Beaumont — avoids Houston port entirely.
DEPARTURE_TO_BEAUMONT_DAYS = 24  # same ocean leg length
BEAUMONT_TO_SITE_DAYS = 4  # slightly longer trucking distance than from Houston

# Congestion severity -> schedule delay (days). Simple deterministic lookup,
# no LLM.
CONGESTION_DELAY_DAYS: dict[str, int] = {"none": 0, "minor": 2, "moderate": 5, "severe": 10}

# Seeded real-world congestion state at Port of Houston.
SEEDED_CONGESTION_LEVEL = "moderate"
SEEDED_VESSELS_QUEUED = 14
SEEDED_AVG_BERTH_WAIT_DAYS = 4.5
CONGESTION_DETECTED_AT = datetime(2026, 8, 10, 9, 0, 0, tzinfo=timezone.utc)

TODAY = date(2026, 8, 12)


# ---------------------------------------------------------------------------
# Response schema
# ---------------------------------------------------------------------------

class WaypointStatus(str, Enum):
    COMPLETED = "completed"
    CURRENT = "current"
    UPCOMING = "upcoming"


class WaypointType(str, Enum):
    FACTORY = "factory"
    DEPARTURE_PORT = "departure_port"
    TRANSIT = "transit"
    ARRIVAL_PORT = "arrival_port"
    SITE = "site"


class Waypoint(BaseModel):
    id: str
    label: str
    type: WaypointType
    status: WaypointStatus
    date: date | None  # actual date if completed/current-anchored, projected ETA if upcoming
    progress_pct: float | None = None  # only set for the "current" waypoint
    has_congestion: bool = False


class RerouteOption(BaseModel):
    alternate_port: str
    alternate_total_transit_days: int
    time_savings_days: int
    recommended: bool


class ShipmentStatusResponse(BaseModel):
    shipment_id: str
    shipment_label: str
    vendor_id: str
    vendor_name: str
    project_id: str
    project_name: str
    waypoints: list[Waypoint]
    route_progress_pct: float
    original_eta: date
    current_eta: date
    delay_days: int
    congestion_signal: WorldSignal | None
    reroute_option: RerouteOption | None
    needs_human: bool
    reasoning: str


# ---------------------------------------------------------------------------
# Deterministic computation
# ---------------------------------------------------------------------------

def _build_shipment_status(shipment_id: str, simulate_congestion: bool | None) -> ShipmentStatusResponse:
    if shipment_id != SHIPMENT_ID:
        raise HTTPException(status_code=404, detail=f"Unknown shipment_id '{shipment_id}'")

    # simulate_congestion is a demo-only override so both UI states (alert vs.
    # "on track") can be exercised without waiting for real conditions to
    # change. None -> use the seeded real congestion level.
    if simulate_congestion is False:
        congestion_level = "none"
    else:
        congestion_level = SEEDED_CONGESTION_LEVEL

    delay_days = CONGESTION_DELAY_DAYS[congestion_level]
    has_congestion = delay_days > 0

    original_eta = DEPARTURE_DATE + timedelta(days=BASE_TRANSIT_DAYS)
    current_eta = original_eta + timedelta(days=delay_days)

    # --- Route progress (days-based proxy for distance) ---
    days_since_departure = (TODAY - DEPARTURE_DATE).days
    ocean_leg_progress_days = max(0, min(days_since_departure, DEPARTURE_TO_HOUSTON_DAYS))
    total_route_days = FACTORY_TO_DEPARTURE_PORT_DAYS + DEPARTURE_TO_HOUSTON_DAYS + HOUSTON_TO_SITE_DAYS
    elapsed_route_days = FACTORY_TO_DEPARTURE_PORT_DAYS + ocean_leg_progress_days
    route_progress_pct = round(100 * elapsed_route_days / total_route_days, 1)
    ocean_leg_pct = round(100 * ocean_leg_progress_days / DEPARTURE_TO_HOUSTON_DAYS, 1)

    waypoints = [
        Waypoint(
            id="factory", label="Ulsan Fabrication Facility", type=WaypointType.FACTORY,
            status=WaypointStatus.COMPLETED, date=FACTORY_READY_DATE,
        ),
        Waypoint(
            id="departure_port", label="Port of Ulsan", type=WaypointType.DEPARTURE_PORT,
            status=WaypointStatus.COMPLETED, date=DEPARTURE_DATE,
        ),
        Waypoint(
            id="transit", label="Pacific Ocean Transit", type=WaypointType.TRANSIT,
            status=WaypointStatus.CURRENT, date=None, progress_pct=ocean_leg_pct,
        ),
        Waypoint(
            id="arrival_port", label="Port of Houston", type=WaypointType.ARRIVAL_PORT,
            status=WaypointStatus.UPCOMING, date=current_eta - timedelta(days=HOUSTON_TO_SITE_DAYS),
            has_congestion=has_congestion,
        ),
        Waypoint(
            id="site", label=f"{PROJECT_NAME} Site", type=WaypointType.SITE,
            status=WaypointStatus.UPCOMING, date=current_eta,
        ),
    ]

    # --- Reroute arithmetic ---
    reroute_option: RerouteOption | None = None
    congestion_signal: WorldSignal | None = None

    if has_congestion:
        direct_total_with_congestion = BASE_TRANSIT_DAYS + delay_days
        alternate_total = DEPARTURE_TO_BEAUMONT_DAYS + BEAUMONT_TO_SITE_DAYS
        time_savings = direct_total_with_congestion - alternate_total

        reroute_option = RerouteOption(
            alternate_port="Port of Beaumont",
            alternate_total_transit_days=alternate_total,
            time_savings_days=time_savings,
            recommended=time_savings > 0,
        )

        recommended_action = (
            f"Reroute via {reroute_option.alternate_port} — saves {time_savings} days"
            if reroute_option.recommended
            else None
        )

        congestion_signal = WorldSignal(
            signal_type="port_congestion",
            affected_entity_ids=[SHIPMENT_ID, VENDOR_ID, PROJECT_ID],
            severity="action_needed" if reroute_option.recommended else "watch",
            summary=f"Port of Houston is experiencing {congestion_level} congestion, affecting {SHIPMENT_LABEL}.",
            detail={
                "congestion_level": congestion_level,
                "port": "Port of Houston",
                "delay_days": delay_days,
                "vessels_queued": SEEDED_VESSELS_QUEUED,
                "avg_berth_wait_days": SEEDED_AVG_BERTH_WAIT_DAYS,
            },
            recommended_action=recommended_action,
            detected_at=CONGESTION_DETECTED_AT,
        )

    needs_human = reroute_option is not None and reroute_option.recommended

    if not has_congestion:
        reasoning = (
            f"{SHIPMENT_LABEL} is on track — no congestion detected at Port of Houston. "
            f"Current ETA matches original ETA of {original_eta.isoformat()}."
        )
    elif needs_human:
        reasoning = (
            f"{congestion_level.capitalize()} congestion at Port of Houston adds {delay_days} days to "
            f"{SHIPMENT_LABEL}'s ETA (now {current_eta.isoformat()}, vs. original "
            f"{original_eta.isoformat()}). Rerouting via {reroute_option.alternate_port} would save "
            f"{reroute_option.time_savings_days} days — flagged for human review since redirecting an "
            f"in-transit shipment is a real decision, not something to auto-execute."
        )
    else:
        reasoning = (
            f"{congestion_level.capitalize()} congestion at Port of Houston adds {delay_days} days to "
            f"{SHIPMENT_LABEL}'s ETA. No alternate route currently offers a time savings, so no reroute "
            "is recommended."
        )

    return ShipmentStatusResponse(
        shipment_id=SHIPMENT_ID,
        shipment_label=SHIPMENT_LABEL,
        vendor_id=VENDOR_ID,
        vendor_name=VENDOR_NAME,
        project_id=PROJECT_ID,
        project_name=PROJECT_NAME,
        waypoints=waypoints,
        route_progress_pct=route_progress_pct,
        original_eta=original_eta,
        current_eta=current_eta,
        delay_days=delay_days,
        congestion_signal=congestion_signal,
        reroute_option=reroute_option,
        needs_human=needs_human,
        reasoning=reasoning,
    )


@router.get("/shipment-status/{shipment_id}", response_model=ShipmentStatusResponse)
def get_shipment_status(
    shipment_id: str,
    simulate_congestion: bool | None = Query(
        default=None,
        description="Demo-only override: force the congestion-alert or on-track state. "
        "Omit to use the seeded real congestion level.",
    ),
) -> ShipmentStatusResponse:
    return _build_shipment_status(shipment_id, simulate_congestion)
