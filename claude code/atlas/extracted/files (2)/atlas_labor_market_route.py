"""
GET /atlas/labor-market?region=austin_tx&trade=electrician

Pure deterministic trend analysis — no LLM anywhere in this file. There's no
free text to extract and no synthesis task, only a linear-regression slope
calculation and threshold comparisons over a seeded wage/availability table.

*** DATA SOURCE NOTE ***
A real deployment would pull this from a labor-market data provider (e.g.
BLS regional wage data, a staffing-agency availability index). This
environment's outbound network is restricted to a fixed allowlist that
doesn't include any labor-market data source, so `LABOR_MARKET_TRENDS` below
is a clearly-labeled seeded table, not a live feed.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
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
# Labor-market-specific response shapes
# ---------------------------------------------------------------------------

class MonthlyLaborPoint(BaseModel):
    month: str  # "2026-02"
    avg_wage: float  # USD/hour
    availability_index: float  # 0-100, higher = more available labor


class TradeTrend(BaseModel):
    trade: str
    region: str
    history: list[MonthlyLaborPoint]
    wage_trend_pct: float  # signed % change, first month -> last month
    availability_trend_pct: float  # signed % change, first month -> last month
    wage_slope_per_month: float  # linear regression slope, USD/hour per month
    availability_slope_per_month: float  # linear regression slope, index points per month
    risk_score: float  # wage_trend_pct - availability_trend_pct; higher = more staffing risk
    staffing_risk: bool


class LaborMarketResponse(BaseModel):
    region: str
    primary_trade: TradeTrend
    project_id: str
    project_name: str
    affected_entity_ids: list[str]
    staffing_risk_assessment: Optional[str]  # plain-language, only set when staffing_risk is True
    comparable_trades: list[TradeTrend]  # ranked by risk_score, descending, excludes primary_trade
    signal: WorldSignal


# ---------------------------------------------------------------------------
# Centralized ORCHESTRA / Atlas demo data
# ---------------------------------------------------------------------------

_PROJECT_NAMES = {"project_austin_fab": "Austin Semiconductor Fab"}
_NOW = datetime.now(timezone.utc)

# MOCK/SEEDED: (region, trade, month, avg_wage, availability_index).
# Electrician and HVAC technician both show wages rising while availability
# falls, in the Austin, TX region — the "wages up, availability down" story
# the hero chart is built to surface. Plumber, ironworker, and general
# laborer are seeded flatter, as a contrast set for the comparable-trades
# ranking.
LABOR_MARKET_TRENDS: list[dict] = [
    # Electrician — primary trade, strong signal
    {"region": "austin_tx", "trade": "electrician", "month": "2026-02", "avg_wage": 34.00, "availability_index": 82},
    {"region": "austin_tx", "trade": "electrician", "month": "2026-03", "avg_wage": 34.80, "availability_index": 78},
    {"region": "austin_tx", "trade": "electrician", "month": "2026-04", "avg_wage": 35.90, "availability_index": 72},
    {"region": "austin_tx", "trade": "electrician", "month": "2026-05", "avg_wage": 37.10, "availability_index": 66},
    {"region": "austin_tx", "trade": "electrician", "month": "2026-06", "avg_wage": 38.20, "availability_index": 61},
    {"region": "austin_tx", "trade": "electrician", "month": "2026-07", "avg_wage": 39.10, "availability_index": 58},
    # HVAC Technician — also crosses both thresholds, slightly less severe
    {"region": "austin_tx", "trade": "hvac_technician", "month": "2026-02", "avg_wage": 31.00, "availability_index": 79},
    {"region": "austin_tx", "trade": "hvac_technician", "month": "2026-03", "avg_wage": 31.60, "availability_index": 76},
    {"region": "austin_tx", "trade": "hvac_technician", "month": "2026-04", "avg_wage": 32.30, "availability_index": 72},
    {"region": "austin_tx", "trade": "hvac_technician", "month": "2026-05", "avg_wage": 33.10, "availability_index": 68},
    {"region": "austin_tx", "trade": "hvac_technician", "month": "2026-06", "avg_wage": 33.70, "availability_index": 65},
    {"region": "austin_tx", "trade": "hvac_technician", "month": "2026-07", "avg_wage": 34.00, "availability_index": 64},
    # Plumber — mild movement, stays below threshold
    {"region": "austin_tx", "trade": "plumber", "month": "2026-02", "avg_wage": 33.00, "availability_index": 80},
    {"region": "austin_tx", "trade": "plumber", "month": "2026-03", "avg_wage": 33.20, "availability_index": 78},
    {"region": "austin_tx", "trade": "plumber", "month": "2026-04", "avg_wage": 33.60, "availability_index": 77},
    {"region": "austin_tx", "trade": "plumber", "month": "2026-05", "avg_wage": 33.90, "availability_index": 76},
    {"region": "austin_tx", "trade": "plumber", "month": "2026-06", "avg_wage": 34.20, "availability_index": 75},
    {"region": "austin_tx", "trade": "plumber", "month": "2026-07", "avg_wage": 34.50, "availability_index": 74},
    # Structural Ironworker — essentially flat
    {"region": "austin_tx", "trade": "ironworker", "month": "2026-02", "avg_wage": 36.00, "availability_index": 70},
    {"region": "austin_tx", "trade": "ironworker", "month": "2026-03", "avg_wage": 36.20, "availability_index": 69},
    {"region": "austin_tx", "trade": "ironworker", "month": "2026-04", "avg_wage": 36.50, "availability_index": 69},
    {"region": "austin_tx", "trade": "ironworker", "month": "2026-05", "avg_wage": 36.70, "availability_index": 68},
    {"region": "austin_tx", "trade": "ironworker", "month": "2026-06", "avg_wage": 37.00, "availability_index": 68},
    {"region": "austin_tx", "trade": "ironworker", "month": "2026-07", "avg_wage": 37.20, "availability_index": 68},
    # General Laborer — stable, low risk
    {"region": "austin_tx", "trade": "general_laborer", "month": "2026-02", "avg_wage": 22.00, "availability_index": 90},
    {"region": "austin_tx", "trade": "general_laborer", "month": "2026-03", "avg_wage": 22.05, "availability_index": 90},
    {"region": "austin_tx", "trade": "general_laborer", "month": "2026-04", "avg_wage": 22.10, "availability_index": 89},
    {"region": "austin_tx", "trade": "general_laborer", "month": "2026-05", "avg_wage": 22.15, "availability_index": 89},
    {"region": "austin_tx", "trade": "general_laborer", "month": "2026-06", "avg_wage": 22.20, "availability_index": 89},
    {"region": "austin_tx", "trade": "general_laborer", "month": "2026-07", "avg_wage": 22.30, "availability_index": 89},
]

_TRADE_LABELS = {
    "electrician": "Electrician",
    "hvac_technician": "HVAC Technician",
    "plumber": "Plumber",
    "ironworker": "Structural Ironworker",
    "general_laborer": "General Laborer",
}

# Risk thresholds — an "and" condition, intentionally, not "or": flagging on
# either trend alone would over-flag trades with completely normal seasonal
# wage drift or minor availability noise. Staffing risk is only meaningful
# when rising cost and shrinking supply are happening together.
WAGE_RISK_THRESHOLD_PCT = 0.08  # +8% or more over the observed window
AVAILABILITY_RISK_THRESHOLD_PCT = -0.15  # -15% or more over the observed window


# ---------------------------------------------------------------------------
# Deterministic trend computation
# ---------------------------------------------------------------------------

def _linear_regression_slope(values: list[float]) -> float:
    """Simple least-squares slope of `values` against month index 0..n-1."""
    n = len(values)
    if n < 2:
        return 0.0
    xs = list(range(n))
    mean_x = sum(xs) / n
    mean_y = sum(values) / n
    denom = sum((x - mean_x) ** 2 for x in xs)
    if denom == 0:
        return 0.0
    return sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, values)) / denom


def _build_trend(region: str, trade: str) -> TradeTrend:
    rows = [r for r in LABOR_MARKET_TRENDS if r["region"] == region and r["trade"] == trade]
    if not rows:
        raise ValueError(f"No labor market data for region='{region}', trade='{trade}'.")
    rows.sort(key=lambda r: r["month"])

    history = [
        MonthlyLaborPoint(month=r["month"], avg_wage=r["avg_wage"], availability_index=r["availability_index"])
        for r in rows
    ]
    wages = [p.avg_wage for p in history]
    availability = [p.availability_index for p in history]

    wage_trend_pct = (wages[-1] - wages[0]) / wages[0]
    availability_trend_pct = (availability[-1] - availability[0]) / availability[0]

    wage_slope = _linear_regression_slope(wages)
    availability_slope = _linear_regression_slope(availability)

    risk_score = round(wage_trend_pct - availability_trend_pct, 4)

    # Intentional "and", not "or" — see module-level comment on the thresholds.
    staffing_risk = wage_trend_pct >= WAGE_RISK_THRESHOLD_PCT and availability_trend_pct <= AVAILABILITY_RISK_THRESHOLD_PCT

    return TradeTrend(
        trade=trade,
        region=region,
        history=history,
        wage_trend_pct=round(wage_trend_pct, 4),
        availability_trend_pct=round(availability_trend_pct, 4),
        wage_slope_per_month=round(wage_slope, 3),
        availability_slope_per_month=round(availability_slope, 3),
        risk_score=risk_score,
        staffing_risk=staffing_risk,
    )


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.get("/atlas/labor-market", response_model=LaborMarketResponse)
async def get_labor_market(region: str = "austin_tx", trade: str = "electrician") -> LaborMarketResponse:
    try:
        primary = _build_trend(region, trade)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    all_trades_in_region = sorted({r["trade"] for r in LABOR_MARKET_TRENDS if r["region"] == region})
    comparable = [
        _build_trend(region, t) for t in all_trades_in_region if t != trade
    ]
    comparable.sort(key=lambda t: t.risk_score, reverse=True)

    project_id = "project_austin_fab"
    affected_entity_ids = [project_id]
    # Electrician staffing risk touches the switchgear shipment specifically,
    # since electrical install labor is what receives that shipment's contents.
    if trade == "electrician":
        affected_entity_ids.append("shipment_switchgear_4471")

    staffing_risk_assessment = (
        f"{_TRADE_LABELS.get(trade, trade)} may be harder and more expensive to staff than planned "
        f"on {_PROJECT_NAMES[project_id]} — wages are up {primary.wage_trend_pct*100:.1f}% while "
        f"availability is down {abs(primary.availability_trend_pct)*100:.1f}% over the last "
        f"{len(primary.history)} months."
        if primary.staffing_risk
        else None
    )

    severity: Literal["info", "watch", "action_needed"] = (
        "action_needed" if primary.staffing_risk else ("watch" if primary.risk_score > 0.05 else "info")
    )

    signal = WorldSignal(
        signal_type="labor_market",
        affected_entity_ids=affected_entity_ids,
        severity=severity,
        summary=f"{_TRADE_LABELS.get(trade, trade)} wages in {region} are up "
        f"{primary.wage_trend_pct*100:.1f}% with availability down {abs(primary.availability_trend_pct)*100:.1f}% "
        f"over the last {len(primary.history)} months.",
        detail={
            "wage_trend_pct": primary.wage_trend_pct,
            "availability_trend_pct": primary.availability_trend_pct,
            "wage_slope_per_month": primary.wage_slope_per_month,
            "availability_slope_per_month": primary.availability_slope_per_month,
        },
        recommended_action=(
            "Consider locking in electrician subcontractor rates or accelerating the hiring timeline "
            "for this trade before the trend advances further."
            if primary.staffing_risk
            else None
        ),
        detected_at=_NOW,
    )

    return LaborMarketResponse(
        region=region,
        primary_trade=primary,
        project_id=project_id,
        project_name=_PROJECT_NAMES[project_id],
        affected_entity_ids=affected_entity_ids,
        staffing_risk_assessment=staffing_risk_assessment,
        comparable_trades=comparable,
        signal=signal,
    )
