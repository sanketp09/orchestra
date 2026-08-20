"""
Unit tests for the core intelligence of Trustline: the update_trust decision
logic in logic.py. These test pure functions only - no FastAPI, no Supabase.

Run with: pytest
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from datetime import datetime, timedelta, timezone

import logic


def test_significant_external_cause_applies_little_to_no_penalty():
    verified_event = {
        "impact_dimension": "schedule_reliability",
        "impact_delta": -0.2,
        "event_type": "late_delivery",
        "vendor_at_fault": False,
    }
    external_context = {"relevance": 0.85, "explains_majority": True}

    decision = logic.determine_trust_update(verified_event, external_context)

    assert decision["external_cause"] is True
    # Penalty should be small relative to the raw delta, not zeroed out but
    # clearly reduced.
    assert decision["applied_delta"] > verified_event["impact_delta"]
    assert abs(decision["applied_delta"]) < abs(verified_event["impact_delta"]) * 0.2

    profile = {dim: 0.7 for dim in logic.TRUST_DIMENSIONS}
    updated = logic.apply_penalty_to_profile(
        profile, decision["dimension"], decision["applied_delta"]
    )
    assert updated["schedule_reliability"] > 0.65  # barely moved
    assert updated["overall_trust"] > 0.69


def test_no_external_cause_applies_real_penalty():
    verified_event = {
        "impact_dimension": "quality_reliability",
        "impact_delta": -0.15,
        "event_type": "defective_goods",
        "vendor_at_fault": True,
    }

    decision = logic.determine_trust_update(verified_event, external_context=None)

    assert decision["external_cause"] is False
    assert decision["applied_delta"] == -0.15

    profile = {dim: 0.6 for dim in logic.TRUST_DIMENSIONS}
    updated = logic.apply_penalty_to_profile(
        profile, decision["dimension"], decision["applied_delta"]
    )
    assert updated["quality_reliability"] == 0.45
    # overall_trust is the average of all five dimensions.
    assert updated["overall_trust"] == round((0.45 + 0.6 * 4) / 5, 4)


def test_vendor_at_fault_overrides_external_cause():
    verified_event = {
        "impact_dimension": "commercial_reliability",
        "impact_delta": -0.1,
        "vendor_at_fault": True,
    }
    external_context = {"relevance": 0.9, "explains_majority": True}

    decision = logic.determine_trust_update(verified_event, external_context)

    assert decision["external_cause"] is False
    assert decision["applied_delta"] == -0.1


def test_detect_drift_flags_repeated_negative_pattern():
    now = datetime(2026, 8, 20, tzinfo=timezone.utc)
    events = [
        {"impact_delta": -0.05, "created_at": (now - timedelta(days=10)).isoformat()},
        {"impact_delta": -0.03, "created_at": (now - timedelta(days=25)).isoformat()},
        {"impact_delta": -0.04, "created_at": (now - timedelta(days=40)).isoformat()},
        {"impact_delta": 0.02, "created_at": (now - timedelta(days=90)).isoformat()},  # outside window
    ]

    findings = logic.detect_drift({"claim_reliability": events}, now=now)

    assert len(findings) == 1
    assert findings[0]["dimension"] == "claim_reliability"
    assert findings[0]["negative_event_count"] == 3


def test_detect_drift_no_flag_below_threshold():
    now = datetime(2026, 8, 20, tzinfo=timezone.utc)
    events = [
        {"impact_delta": -0.05, "created_at": (now - timedelta(days=5)).isoformat()},
        {"impact_delta": -0.03, "created_at": (now - timedelta(days=20)).isoformat()},
    ]

    findings = logic.detect_drift({"claim_reliability": events}, now=now)

    assert findings == []
