"""
Atlas — Currency & Exchange Rate Exposure
GET /atlas/currency-exposure/{shipment_id}

Design notes:
- LIVE data: current KRW/USD rate, the booking-date KRW/USD rate, and the
  full daily rate time series between booking and today are all real calls
  to Frankfurter (api.frankfurter.dev) — free, keyless, ECB reference
  rates, the same provider class as Sentinel/Atlas's other real-API calls.
  Frankfurter's historical archive goes back to 1999, so unlike the "seed
  if unavailable" fallback the brief allows for, we don't need it here —
  both the booking-date rate AND the trend line are genuinely fetched.
- SEEDED (clearly marked below): the shipment's PO amount in KRW and its
  booking date. A real system would pull these from the PO record.
- needs_human is a real computed boolean: True whenever the cost delta
  since booking exceeds a stated 3% threshold, in either direction.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Literal, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

FRANKFURTER_BASE = "https://api.frankfurter.dev/v1"
DELTA_THRESHOLD_PCT = 3.0  # meaningful-exposure threshold that drives needs_human


# ---------------------------------------------------------------------------
# Shared Atlas signal shape
# ---------------------------------------------------------------------------

class WorldSignal(BaseModel):
    signal_type: str
    affected_entity_ids: list[str]
    severity: Literal["info", "watch", "action_needed"]
    summary: str
    detail: dict
    recommended_action: Optional[str] = None
    detected_at: datetime


# ---------------------------------------------------------------------------
# Route-specific extension
# ---------------------------------------------------------------------------

class RatePoint(BaseModel):
    date: str
    krw_per_usd: float


class CurrencyExposureResult(WorldSignal):
    shipment_id: str
    shipment_name: str
    vendor_id: str
    vendor_name: str
    project_id: str
    project_name: str
    budget_line: str
    budget_line_amount_usd: float
    po_amount_krw: float
    booking_date: str
    booking_rate_krw_per_usd: float
    current_rate_krw_per_usd: float
    original_usd_value: float
    current_usd_value: float
    delta_usd: float
    delta_pct: float
    needs_human: bool
    rate_trend: list[RatePoint]


# ---------------------------------------------------------------------------
# SEEDED / MOCK REFERENCE DATA — the PO itself. Rates are NOT seeded; they
# come from the live calls below.
# ---------------------------------------------------------------------------

SHIPMENTS = {
    "shipment_4471": {
        "name": "Switchgear Shipment #4471",
        "vendor_id": "vendor_meridian_steel",
        "vendor_name": "Meridian Steel Fabrication",
        "project_id": "project_austin_fab",
        "project_name": "Austin Semiconductor Fab",
        "po_amount_krw": 246_000_000.0,   # seeded — the PO's face value in KRW
        "booking_date": date(2026, 6, 15),  # seeded — when the PO was priced
        "budget_line": "structural_steel",
        "budget_line_amount_usd": 2_100_000.0,  # from the centralized Atlas budget data
    }
}


# ---------------------------------------------------------------------------
# Live Frankfurter (ECB) calls
# ---------------------------------------------------------------------------

async def _fetch_rate(client: httpx.AsyncClient, on_date: str) -> float:
    """on_date is 'latest' or an ISO date string. Returns KRW per 1 USD."""
    url = f"{FRANKFURTER_BASE}/{on_date}"
    response = await client.get(url, params={"base": "USD", "symbols": "KRW"})
    response.raise_for_status()
    payload = response.json()
    rate = payload.get("rates", {}).get("KRW")
    if rate is None:
        raise ValueError(f"No KRW rate returned for {on_date}: {payload}")
    return float(rate)


async def _fetch_rate_series(client: httpx.AsyncClient, start: date, end: date) -> list[RatePoint]:
    url = f"{FRANKFURTER_BASE}/{start.isoformat()}..{end.isoformat()}"
    response = await client.get(url, params={"base": "USD", "symbols": "KRW"})
    response.raise_for_status()
    payload = response.json()
    rates = payload.get("rates", {})
    points = [RatePoint(date=d, krw_per_usd=float(v["KRW"])) for d, v in sorted(rates.items()) if "KRW" in v]
    return points


# ---------------------------------------------------------------------------
# Deterministic calculation
# ---------------------------------------------------------------------------

def _recommended_action(delta_pct: float, delta_usd: float, shipment_name: str, budget_line: str) -> tuple[Literal["info", "watch", "action_needed"], Optional[str]]:
    if delta_pct >= DELTA_THRESHOLD_PCT:
        return (
            "action_needed",
            f"Consider locking this rate for remaining payment milestones on {shipment_name} — "
            f"KRW/USD drift has added ${delta_usd:,.0f} to the {budget_line.replace('_', ' ')} budget line since booking.",
        )
    if delta_pct <= -DELTA_THRESHOLD_PCT:
        return (
            "watch",
            f"KRW/USD movement has favored the buyer on {shipment_name}, reducing the USD cost by "
            f"${abs(delta_usd):,.0f} since booking — no action needed, but this could reverse before final payment.",
        )
    return "info", None


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.get("/atlas/currency-exposure/{shipment_id}", response_model=CurrencyExposureResult)
async def currency_exposure(shipment_id: str) -> CurrencyExposureResult:
    shipment = SHIPMENTS.get(shipment_id)
    if shipment is None:
        raise HTTPException(status_code=404, detail=f"Unknown shipment_id: {shipment_id}")

    today = date.today()
    booking_date: date = shipment["booking_date"]

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            current_rate = await _fetch_rate(client, "latest")
            booking_rate = await _fetch_rate(client, booking_date.isoformat())
            rate_trend = await _fetch_rate_series(client, booking_date, today)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Frankfurter exchange-rate request failed: {exc}")

    po_amount_krw = shipment["po_amount_krw"]
    original_usd_value = round(po_amount_krw / booking_rate, 2)
    current_usd_value = round(po_amount_krw / current_rate, 2)
    delta_usd = round(current_usd_value - original_usd_value, 2)
    delta_pct = round(delta_usd / original_usd_value * 100, 2)
    needs_human = abs(delta_pct) >= DELTA_THRESHOLD_PCT

    severity, recommended_action = _recommended_action(delta_pct, delta_usd, shipment["name"], shipment["budget_line"])

    summary = (
        f"{shipment['name']} — priced at ${original_usd_value:,.0f} at booking, now ${current_usd_value:,.0f} "
        f"at today's rate ({delta_pct:+.1f}%)."
    )

    return CurrencyExposureResult(
        signal_type="currency_exposure",
        affected_entity_ids=[shipment_id, shipment["vendor_id"], shipment["project_id"]],
        severity=severity,
        summary=summary,
        detail={
            "currency_pair": "KRW/USD",
            "rate_source": "Frankfurter (ECB reference rates)",
            "threshold_pct": DELTA_THRESHOLD_PCT,
        },
        recommended_action=recommended_action,
        detected_at=datetime.now(timezone.utc),
        shipment_id=shipment_id,
        shipment_name=shipment["name"],
        vendor_id=shipment["vendor_id"],
        vendor_name=shipment["vendor_name"],
        project_id=shipment["project_id"],
        project_name=shipment["project_name"],
        budget_line=shipment["budget_line"],
        budget_line_amount_usd=shipment["budget_line_amount_usd"],
        po_amount_krw=po_amount_krw,
        booking_date=booking_date.isoformat(),
        booking_rate_krw_per_usd=booking_rate,
        current_rate_krw_per_usd=current_rate,
        original_usd_value=original_usd_value,
        current_usd_value=current_usd_value,
        delta_usd=delta_usd,
        delta_pct=delta_pct,
        needs_human=needs_human,
        rate_trend=rate_trend,
    )
