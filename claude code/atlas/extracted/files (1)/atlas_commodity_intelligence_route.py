"""
GET /atlas/commodity-intelligence?project_id=

*** DATA SOURCE NOTE ***
A live commodity price feed (e.g. LME structural steel futures, COMEX copper) would be the
correct source here. This environment's outbound network is restricted to an explicit
domain allowlist (package registries, GitHub, api.anthropic.com) that does not include any
commodity/market-data provider, so a real call cannot be made or tested from here. Rather
than fake a network call, `_generate_price_history()` below is an honestly-labeled seeded
generator: a smooth deterministic curve (linear drift + gentle sine wobble), not random
noise, so the same 30-day trend renders identically on every request. Swap it for a real
`httpx` call to a provider like https://metals-api.com or an LME data feed when one is
available — the return shape (`date`, `price`) is already what the rest of this file
expects.

Everything downstream of the price history is deterministic, plain-Python comparison and
arithmetic — no LLM anywhere in this file, since there's no free text to extract and no
synthesis task, only threshold comparisons and dollar math.
"""

from __future__ import annotations

import math
from datetime import date, datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


# ---------------------------------------------------------------------------
# Shared Atlas signal contract
# ---------------------------------------------------------------------------

class WorldSignal(BaseModel):
    signal_type: str  # e.g. "commodity_price", "port_congestion", "tariff_change"
    affected_entity_ids: list[str]  # which of the user's vendors/shipments/projects this touches
    severity: Literal["info", "watch", "action_needed"]
    summary: str
    detail: dict
    recommended_action: Optional[str]
    detected_at: datetime


# ---------------------------------------------------------------------------
# Commodity-specific response shapes
# ---------------------------------------------------------------------------

Recommendation = Literal["lock", "hold"]


class PricePoint(BaseModel):
    date: date
    price: float


class CommodityTrack(BaseModel):
    commodity: str
    unit: str
    project_id: str
    project_name: str
    budgeted_usd: float
    budgeted_quantity: float
    threshold_price_per_unit: float  # price at which the budget line is fully consumed
    current_price: float
    price_history: list[PricePoint]  # 30 days, oldest -> newest
    pct_of_threshold: float  # current_price / threshold_price_per_unit
    trend_pct_5d: float  # signed % change over the last 5 days
    distance_to_threshold_pct: float  # signed room remaining before threshold (negative = already over)
    recommendation: Recommendation
    recommendation_reason: str
    estimated_cost_of_waiting_usd: Optional[float]  # None when recommendation is "hold"
    signal: WorldSignal


class CommodityIntelligenceResponse(BaseModel):
    project_id: str
    project_name: str
    structural_steel: CommodityTrack
    copper_wiring: CommodityTrack


# ---------------------------------------------------------------------------
# Centralized ORCHESTRA / Atlas demo data
# ---------------------------------------------------------------------------

_PROJECT_NAMES = {"project_austin_fab": "Austin Semiconductor Fab"}

_NOW = datetime.now(timezone.utc)
_TODAY = _NOW.date()

# MOCK/SEEDED: budget lines for project_austin_fab, plus the assumed committed
# quantity for each (used to derive a per-unit threshold price from the
# dollar budget). Quantities are the "how much we plan to buy" figures a real
# procurement system would already have on file.
_BUDGET_LINES = {
    "structural_steel": {
        "commodity": "Structural Steel",
        "unit": "per ton",
        "budgeted_usd": 2_100_000.0,
        "budgeted_quantity": 700.0,  # tons
        "entity_ids": ["project_austin_fab", "vendor_meridian_steel", "shipment_switchgear_4471"],
    },
    "copper_wiring": {
        "commodity": "Copper Wiring",
        "unit": "per lb",
        "budgeted_usd": 480_000.0,
        "budgeted_quantity": 40_000.0,  # lbs
        "entity_ids": ["project_austin_fab"],
    },
}

# Recommend "lock" when current price is within this fraction of the
# per-unit threshold AND the 5-day trend is positive.
LOCK_THRESHOLD_PROXIMITY_PCT = 0.10  # within 10% of threshold
LOCK_TREND_WINDOW_DAYS = 5


# ---------------------------------------------------------------------------
# Seeded price history generator — see module docstring for why this is
# simulated rather than a live feed.
# ---------------------------------------------------------------------------

def _generate_price_history(end_price: float, day5_price: float, days: int = 30) -> list[PricePoint]:
    """
    Builds a smooth, deterministic 30-day price path ending at `end_price`,
    with the price 5 days before the end pinned to `day5_price` (so the
    5-day trend used for the lock/hold recommendation is exact and
    reproducible).

    Shape: a mild drift over the first `days - LOCK_TREND_WINDOW_DAYS` days
    (commodities don't sit perfectly flat), then whatever slope actually
    connects day5_price -> end_price over the final window — which is where
    the real story (a sharp recent move, up or down) shows up. A small sine
    wobble is layered on for a plausible, non-robotic-looking curve — not
    random noise.
    """
    points: list[PricePoint] = []
    early_days = days - LOCK_TREND_WINDOW_DAYS
    # Mild drift into day5_price over the early window — roughly 1.5% of
    # day5_price, in the opposite direction of the final-window move, so the
    # recent slope reads as a distinct change rather than a continuation.
    drift = day5_price * 0.015 * (1 if end_price >= day5_price else -1)
    start_price = day5_price - drift

    for i in range(days):
        day_offset = days - 1 - i  # days before "today", counting down to 0
        d = _TODAY - timedelta(days=day_offset)

        if day_offset <= LOCK_TREND_WINDOW_DAYS:
            frac = (LOCK_TREND_WINDOW_DAYS - day_offset) / LOCK_TREND_WINDOW_DAYS
            base = day5_price + (end_price - day5_price) * frac
        else:
            frac = (early_days - (day_offset - LOCK_TREND_WINDOW_DAYS)) / max(1, early_days)
            frac = min(1.0, max(0.0, frac))
            base = start_price + (day5_price - start_price) * frac

        wobble = math.sin(i * 0.6) * (end_price * 0.004)
        points.append(PricePoint(date=d, price=round(base + wobble, 2)))

    # Ensure the final point is exactly end_price for a clean chart terminus.
    points[-1] = PricePoint(date=_TODAY, price=round(end_price, 2))
    return points


# ---------------------------------------------------------------------------
# Deterministic comparison — threshold distance, trend, lock/hold rule
# ---------------------------------------------------------------------------

def _build_track(key: str, current_price: float, day5_price: float) -> CommodityTrack:
    line = _BUDGET_LINES[key]
    project_id = "project_austin_fab"
    threshold_price = line["budgeted_usd"] / line["budgeted_quantity"]

    history = _generate_price_history(end_price=current_price, day5_price=day5_price)

    pct_of_threshold = current_price / threshold_price
    trend_pct_5d = (current_price - day5_price) / day5_price
    distance_to_threshold_pct = (threshold_price - current_price) / threshold_price

    within_proximity = pct_of_threshold >= (1 - LOCK_THRESHOLD_PROXIMITY_PCT)
    trending_up = trend_pct_5d > 0

    if within_proximity and trending_up:
        recommendation: Recommendation = "lock"
        recommendation_reason = (
            f"Price is within {LOCK_THRESHOLD_PROXIMITY_PCT*100:.0f}% of the budget threshold "
            f"and has risen {trend_pct_5d*100:.1f}% over the last {LOCK_TREND_WINDOW_DAYS} days."
        )
        # Extrapolating the observed 5-day trend forward is the illustrative
        # "further rise" scenario used to size the cost of waiting.
        estimated_cost_of_waiting = round(line["budgeted_usd"] * trend_pct_5d, 2) if trend_pct_5d > 0 else None
    else:
        recommendation = "hold"
        if not within_proximity:
            recommendation_reason = (
                f"Price sits {distance_to_threshold_pct*100:.1f}% below the budget threshold — "
                "still comfortable room before this budget line is at risk."
            )
        else:
            recommendation_reason = "Price is near the threshold but trending flat or down — no urgency to lock yet."
        estimated_cost_of_waiting = None

    severity: Literal["info", "watch", "action_needed"] = (
        "action_needed" if recommendation == "lock" else ("watch" if pct_of_threshold >= 0.8 else "info")
    )

    signal = WorldSignal(
        signal_type="commodity_price",
        affected_entity_ids=line["entity_ids"],
        severity=severity,
        summary=f"{line['commodity']} is trading at ${current_price:,.2f} {line['unit']}, "
        f"{pct_of_threshold*100:.0f}% of the ${threshold_price:,.2f} {line['unit']} threshold for "
        f"{_PROJECT_NAMES[project_id]}'s ${line['budgeted_usd']:,.0f} budget line.",
        detail={
            "current_price": current_price,
            "threshold_price": round(threshold_price, 2),
            "trend_pct_5d": round(trend_pct_5d, 4),
        },
        recommended_action=recommendation_reason if recommendation == "lock" else None,
        detected_at=_NOW,
    )

    return CommodityTrack(
        commodity=line["commodity"],
        unit=line["unit"],
        project_id=project_id,
        project_name=_PROJECT_NAMES[project_id],
        budgeted_usd=line["budgeted_usd"],
        budgeted_quantity=line["budgeted_quantity"],
        threshold_price_per_unit=round(threshold_price, 2),
        current_price=current_price,
        price_history=history,
        pct_of_threshold=round(pct_of_threshold, 4),
        trend_pct_5d=round(trend_pct_5d, 4),
        distance_to_threshold_pct=round(distance_to_threshold_pct, 4),
        recommendation=recommendation,
        recommendation_reason=recommendation_reason,
        estimated_cost_of_waiting_usd=estimated_cost_of_waiting,
        signal=signal,
    )


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.get("/atlas/commodity-intelligence", response_model=CommodityIntelligenceResponse)
async def get_commodity_intelligence(
    project_id: str = "project_austin_fab",
) -> CommodityIntelligenceResponse:
    if project_id not in _PROJECT_NAMES:
        raise HTTPException(status_code=404, detail=f"No project found for '{project_id}'.")

    # Seeded so structural steel sits at 98% of its threshold with a +6.0%
    # 5-day trend (triggers "lock"), while copper sits at 85% of threshold
    # with a flat/slightly-down trend (stays "hold").
    structural_steel = _build_track("structural_steel", current_price=2940.00, day5_price=2773.58)
    copper_wiring = _build_track("copper_wiring", current_price=10.20, day5_price=10.35)

    return CommodityIntelligenceResponse(
        project_id=project_id,
        project_name=_PROJECT_NAMES[project_id],
        structural_steel=structural_steel,
        copper_wiring=copper_wiring,
    )
