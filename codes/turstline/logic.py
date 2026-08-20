"""
Trust-scoring logic for Trustline.

Deliberately kept free of FastAPI/Supabase imports so it can be unit tested
in isolation. Route handlers in main.py fetch/persist data and call these
pure(ish) functions to do the actual reasoning.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

TRUST_DIMENSIONS = [
    "schedule_reliability",
    "commercial_reliability",
    "claim_reliability",
    "quality_reliability",
    "financial_stability",
]

# Below this magnitude, a trend is considered flat rather than improving/declining.
TREND_FLAT_THRESHOLD = 0.02

# Behavioural-drift defaults per the spec: 3+ negative events in a dimension
# within 60 days counts as drift.
DRIFT_EVENT_THRESHOLD = 3
DRIFT_WINDOW_DAYS = 60

# Window used by assess_vendor_reliability for trend computation.
RELIABILITY_WINDOW_DAYS = 90

# External-cause determination: relevance above this counts as "significant".
EXTERNAL_RELEVANCE_THRESHOLD = 0.6

# When a significant external cause is found and the vendor isn't at fault,
# only this fraction of the raw delta is applied (i.e. "little or no penalty").
EXTERNAL_CAUSE_PENALTY_FACTOR = 0.05


def _parse_created_at(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    else:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def filter_recent_events(
    events: list[dict], days: int, now: datetime | None = None
) -> list[dict]:
    """Return only events with created_at within the last `days` days."""
    now = now or datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days)
    recent = []
    for event in events:
        created_at = _parse_created_at(event.get("created_at"))
        if created_at is None or created_at >= cutoff:
            recent.append(event)
    return recent


def average_impact_delta(events: list[dict]) -> float:
    deltas = [float(e["impact_delta"]) for e in events if e.get("impact_delta") is not None]
    if not deltas:
        return 0.0
    return round(sum(deltas) / len(deltas), 4)


def trend_direction(avg_delta: float) -> str:
    if avg_delta > TREND_FLAT_THRESHOLD:
        return "improving"
    if avg_delta < -TREND_FLAT_THRESHOLD:
        return "declining"
    return "stable"


def assess_reliability(
    current_score: float,
    dimension_events: list[dict],
    now: datetime | None = None,
    window_days: int = RELIABILITY_WINDOW_DAYS,
) -> dict:
    """
    Compute a trend summary for one vendor/dimension from that dimension's
    trust_events, over the last `window_days` days.
    """
    recent = filter_recent_events(dimension_events, window_days, now=now)
    avg_delta = average_impact_delta(recent)
    return {
        "current_score": current_score,
        "window_days": window_days,
        "event_count": len(recent),
        "avg_impact_delta": avg_delta,
        "trend": trend_direction(avg_delta),
    }


def detect_drift(
    events_by_dimension: dict[str, list[dict]],
    now: datetime | None = None,
    window_days: int = DRIFT_WINDOW_DAYS,
    event_threshold: int = DRIFT_EVENT_THRESHOLD,
) -> list[dict]:
    """
    Flag any dimension with `event_threshold` or more negative-impact events
    within `window_days` days. Deliberately simple thresholding, not a real
    statistical trend test.
    """
    findings = []
    for dimension, events in events_by_dimension.items():
        recent = filter_recent_events(events, window_days, now=now)
        negative = [e for e in recent if (e.get("impact_delta") or 0) < 0 and not bool(e.get("external_cause", False))]
        if len(negative) >= event_threshold:
            findings.append(
                {
                    "dimension": dimension,
                    "negative_event_count": len(negative),
                    "window_days": window_days,
                    "avg_impact_delta": average_impact_delta(negative),
                    "flag": "consistent_negative_trend",
                }
            )
    return findings


def determine_trust_update(
    verified_event: dict, external_context: dict | None
) -> dict:
    """
    Core decision logic for /update_trust.

    Returns a dict describing what happened: whether an external cause was
    accepted, the impact_delta to actually apply, and a human-readable
    reason (stored in trust_events.raw_context and surfaced in findings).
    """
    dimension = verified_event.get("impact_dimension")
    raw_delta = float(verified_event.get("impact_delta", -0.05))
    # Only ever a penalty for a "raw" delta - clamp to <= 0 so this endpoint
    # can't accidentally be used to inflate scores.
    raw_delta = min(raw_delta, 0.0)
    vendor_at_fault = bool(verified_event.get("vendor_at_fault", False if external_context else True))

    relevance = float((external_context or {}).get("relevance", 0.0))
    if relevance == 0.0 and external_context:
        ext_str = str(external_context).lower()
        if any(k in ext_str for k in ["strike", "monsoon", "earthquake", "disruption", "force majeure", "congestion", "storm", "hurricane"]):
            relevance = 0.85

    explains_majority = bool(
        (external_context or {}).get("explains_majority", relevance > EXTERNAL_RELEVANCE_THRESHOLD)
    )
    significant_external_cause = (
        external_context is not None
        and relevance > EXTERNAL_RELEVANCE_THRESHOLD
        and explains_majority
    )

    if significant_external_cause and not vendor_at_fault:
        external_cause = True
        applied_delta = round(raw_delta * EXTERNAL_CAUSE_PENALTY_FACTOR, 4)
        reason = (
            f"Significant external cause verified (relevance={relevance:.2f}); "
            "little to no penalty applied."
        )
    elif significant_external_cause and vendor_at_fault:
        external_cause = False
        applied_delta = raw_delta
        reason = (
            "External factor present but vendor determined to be at fault; "
            "full penalty applied."
        )
    else:
        external_cause = False
        applied_delta = raw_delta
        reason = "No significant external cause identified; standard penalty applied."

    return {
        "dimension": dimension,
        "external_cause": external_cause,
        "raw_delta": raw_delta,
        "applied_delta": applied_delta,
        "reason": reason,
    }


def apply_penalty_to_profile(profile: dict, dimension: str, applied_delta: float) -> dict:
    """
    Apply applied_delta to profile[dimension] (clamped to [0, 1]) and
    recompute overall_trust as the average of the five dimensions. Returns a
    new profile dict; does not mutate the input.
    """
    if dimension not in TRUST_DIMENSIONS:
        raise ValueError(f"Unknown trust dimension: {dimension}")

    updated = dict(profile)
    current = float(updated.get(dimension, 0.5))
    new_value = max(0.0, min(1.0, current + applied_delta))
    updated[dimension] = round(new_value, 4)
    updated["overall_trust"] = round(
        sum(float(updated.get(d, 0.5)) for d in TRUST_DIMENSIONS) / len(TRUST_DIMENSIONS),
        4,
    )
    return updated


def summarize_comparison(profiles: list[dict], drift_flags: dict[str, list[dict]]) -> str:
    """Build a short human-readable note on which vendor looks most reliable."""
    if not profiles:
        return "No vendor profiles available for comparison."

    ranked = sorted(profiles, key=lambda p: p.get("overall_trust", 0.0), reverse=True)
    best = ranked[0]
    best_id = best.get("vendor_id")
    note = f"{best_id} has the highest overall_trust ({best.get('overall_trust')})."

    flagged = [vid for vid, flags in drift_flags.items() if flags]
    if flagged:
        note += f" Note: recent negative drift detected for {', '.join(flagged)}."
    return note
