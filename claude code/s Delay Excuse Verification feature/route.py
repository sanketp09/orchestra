"""
GET /sentinel/factory-status/{order_id}

*** SIMULATED DATA FEED — NOT A REAL FACTORY INTEGRATION ***
This endpoint does not connect to any real IoT/MES/factory system. It advances
an in-memory mock `percent_complete` value a few points each time it's polled,
to simulate what a live production feed would look like. Swap
`_advance_mock_progress` for a real MES/IoT adapter when one exists.

Design:
- No LLM call is used here at all — there is nothing to extract or synthesize
  from free text; every field is either simulated telemetry or a deterministic
  computation over that telemetry (rate-of-change regression, threshold
  comparison, date math). Per the "LLM only extracts/synthesizes" rule, that
  means this endpoint is 100% deterministic Python. (get_claude_client is
  imported for interface parity with other Sentinel routes but intentionally
  unused here.)
- Progress history is kept in-memory per order_id (swap for DB-backed storage
  in production).
- Dispatch date projection + delay_risk flag are computed via a simple
  rate-of-change / linear regression over recent readings, compared against
  the pace required to hit the order's original expected date.
"""

from __future__ import annotations

import random
import statistics
from datetime import date, datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


# ---------------------------------------------------------------------------
# Base evidence contract
# ---------------------------------------------------------------------------

class EvidenceItem(BaseModel):
    source: str
    reliability_tier: Literal["self_reported", "third_party_observed", "verified_transaction"]
    timestamp: datetime
    raw_ref: str


class EvidenceResult(BaseModel):
    confidence: float
    evidence: list[EvidenceItem]
    reasoning: str
    needs_human: bool
    writes_to: list[str]


class FactoryStatusResult(EvidenceResult):
    production_status: str
    percent_complete: float
    dispatch_date_estimate: date
    delay_risk: bool


# ---------------------------------------------------------------------------
# Seeded / mock reference data (clearly marked as such)
# ---------------------------------------------------------------------------

STAGES: list[str] = ["cutting", "assembly", "testing", "packaging"]

# MOCK/SEEDED: one fabricated order backlog. In a real system this would come
# from an ERP/procurement DB, keyed by order_id.
MOCK_ORDERS: dict[str, dict] = {
    "ORD-4471": {
        "factory": "Shreeji Metal Works, Bhiwandi",
        "item": "MS structural columns — Block C, qty 40",
        "order_placed": date(2026, 7, 1),
        "expected_dispatch": date(2026, 8, 20),
        "machine": "Machine #12",
    },
    "ORD-5209": {
        "factory": "Konark Fabricators, Vasai",
        "item": "Precast staircase units, qty 12",
        "order_placed": date(2026, 7, 10),
        "expected_dispatch": date(2026, 8, 15),
        "machine": "Machine #06",
    },
}

# In-memory progress history: order_id -> list[(timestamp, percent_complete)]
# Swap for a persistent store in production; this resets on process restart.
_PROGRESS_HISTORY: dict[str, list[tuple[datetime, float]]] = {}

# Threshold: if the projected pace needed to finish is more than this many
# times the observed recent pace, we flag delay risk. (i.e. observed pace is
# less than 1/RISK_PACE_RATIO of what's needed.)
RISK_PACE_RATIO = 1.35

# Minimum number of readings needed before a regression-based projection is
# trusted; below this we fall back to a simpler rate-of-change and mark lower
# confidence.
MIN_READINGS_FOR_REGRESSION = 4


# ---------------------------------------------------------------------------
# Step 1 (simulated telemetry): advance mock progress on each poll
# ---------------------------------------------------------------------------

def _advance_mock_progress(order_id: str) -> list[tuple[datetime, float]]:
    """
    Simulates a live factory feed: each call to this order's status advances
    percent_complete by a small, seeded-random increment, capped at 100.
    """
    history = _PROGRESS_HISTORY.setdefault(order_id, [])
    now = datetime.now(timezone.utc)

    if not history:
        start = 4.0  # every order starts having just cleared intake
        history.append((now, start))
        return history

    last_ts, last_pct = history[-1]
    if last_pct >= 100.0:
        history.append((now, 100.0))
        return history

    # Seed the RNG off order_id + reading count so repeated test runs are
    # reproducible per-call-index, while still varying call to call.
    rng = random.Random(f"{order_id}-{len(history)}")
    increment = rng.uniform(1.5, 6.0)

    # Occasionally simulate a slowdown (machine stoppage, QC hold) so the
    # delay-risk path is actually reachable in a demo.
    if rng.random() < 0.25:
        increment *= 0.3

    new_pct = min(100.0, last_pct + increment)
    history.append((now, new_pct))
    return history


def _stage_for_progress(pct: float) -> str:
    if pct >= 95:
        return "packaging"
    if pct >= 70:
        return "testing"
    if pct >= 30:
        return "assembly"
    return "cutting"


# ---------------------------------------------------------------------------
# Step 2 (deterministic): rate-of-change / regression -> dispatch projection
# ---------------------------------------------------------------------------

def _project_dispatch(
    history: list[tuple[datetime, float]],
    order_placed: date,
    expected_dispatch: date,
) -> tuple[date, bool, float]:
    """
    Returns (dispatch_date_estimate, delay_risk, confidence).
    Pure Python: a simple linear rate-of-change over recent readings,
    compared against the pace required to hit the original expected date.
    """
    now = history[-1][0]
    current_pct = history[-1][1]

    if current_pct >= 100.0:
        return (now.date(), False, 0.97)

    if len(history) < 2:
        # No slope information yet; fall back to the original expected date
        # with reduced confidence, no risk determination possible yet.
        return (expected_dispatch, False, 0.4)

    # Observed pace: percent-per-day over the readings we have.
    if len(history) >= MIN_READINGS_FOR_REGRESSION:
        # Simple linear regression (least squares) of pct vs. days-since-first-reading.
        t0 = history[0][0]
        xs = [(ts - t0).total_seconds() / 86400.0 for ts, _ in history]
        ys = [pct for _, pct in history]
        n = len(xs)
        mean_x = statistics.fmean(xs)
        mean_y = statistics.fmean(ys)
        denom = sum((x - mean_x) ** 2 for x in xs)
        if denom == 0:
            slope = 0.0
        else:
            slope = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys)) / denom
        confidence = 0.9
    else:
        # Fallback: rate of change between first and last reading.
        t0, p0 = history[0]
        elapsed_days = max((now - t0).total_seconds() / 86400.0, 0.01)
        slope = (current_pct - p0) / elapsed_days
        confidence = 0.55

    if slope <= 0:
        # No forward progress observed — can't project, flag for a human.
        return (expected_dispatch, True, 0.3)

    days_remaining = (100.0 - current_pct) / slope
    dispatch_estimate = (now + timedelta(days=days_remaining)).date()

    # Required pace to still hit the original expected date from today.
    days_until_expected = max((expected_dispatch - now.date()).days, 0.5)
    required_pace = (100.0 - current_pct) / days_until_expected

    delay_risk = slope < (required_pace / RISK_PACE_RATIO)

    return (dispatch_estimate, delay_risk, confidence)


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.get("/sentinel/factory-status/{order_id}", response_model=FactoryStatusResult)
async def get_factory_status(order_id: str) -> FactoryStatusResult:
    order = MOCK_ORDERS.get(order_id)
    if order is None:
        raise HTTPException(status_code=404, detail=f"No order found for '{order_id}'.")

    now = datetime.now(timezone.utc)

    history = _advance_mock_progress(order_id)
    current_pct = history[-1][1]
    stage = _stage_for_progress(current_pct)

    dispatch_estimate, delay_risk, confidence = _project_dispatch(
        history, order["order_placed"], order["expected_dispatch"]
    )

    production_status = f"{order['machine']} — {stage}"

    reasoning_parts = [
        f"Order {order_id} at {order['factory']} is {current_pct:.1f}% complete, currently in the "
        f"{stage} stage ({production_status}).",
    ]
    if delay_risk:
        reasoning_parts.append(
            "Observed progress rate over recent readings is slower than the pace required to hit the "
            f"original expected dispatch date of {order['expected_dispatch'].isoformat()}. "
            f"Projected dispatch has slipped to {dispatch_estimate.isoformat()}."
        )
    else:
        reasoning_parts.append(
            f"Observed progress rate supports a projected dispatch date of {dispatch_estimate.isoformat()}, "
            f"in line with the original expected date of {order['expected_dispatch'].isoformat()}."
        )

    needs_human = delay_risk  # computed, not hardcoded — per the stated rule

    evidence = [
        EvidenceItem(
            source="factory_iot_feed_simulated",
            reliability_tier="third_party_observed",
            timestamp=now,
            raw_ref=(
                f"order_id={order_id},readings={len(history)},"
                f"latest_pct={current_pct:.2f},stage={stage} (SIMULATED — no live MES/IoT integration)"
            ),
        ),
        EvidenceItem(
            source="procurement_order_record",
            reliability_tier="verified_transaction",
            timestamp=datetime.combine(order["order_placed"], datetime.min.time(), tzinfo=timezone.utc),
            raw_ref=f"order_id={order_id},item={order['item']},expected_dispatch={order['expected_dispatch'].isoformat()}",
        ),
    ]

    return FactoryStatusResult(
        confidence=confidence,
        evidence=evidence,
        reasoning=" ".join(reasoning_parts),
        needs_human=needs_human,
        writes_to=["procurement.order_tracking", "vendor.production_log"],
        production_status=production_status,
        percent_complete=round(current_pct, 1),
        dispatch_date_estimate=dispatch_estimate,
        delay_risk=delay_risk,
    )
