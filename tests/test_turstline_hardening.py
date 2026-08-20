import pytest
from fastapi.testclient import TestClient
import sys
from pathlib import Path

# Add codes/turstline to python path
turstline_path = str(Path(__file__).parent.parent / "codes" / "turstline")
if turstline_path not in sys.path:
    sys.path.insert(0, turstline_path)

from codes.turstline.main import app
from codes.turstline import db
from codes.turstline import logic

client = TestClient(app)


def test_idempotency_duplicate_event_processing():
    """
    Test Requirement 1:
    1. First event changes score.
    2. Same event submitted again does not change score.
    3. Only one trust_event exists for that source_event_id.
    """
    vendor_id = "V-001"
    source_event_id = "evt_idempotency_test_001"

    # Get baseline profile
    initial_profile = db.fetch_trust_profile(vendor_id)
    initial_score = initial_profile["schedule_reliability"]

    payload = {
        "vendor_id": vendor_id,
        "source_event_id": source_event_id,
        "project_id": "PRJ-TEST-100",
        "verified_event": {
            "source_event_id": source_event_id,
            "impact_dimension": "schedule_reliability",
            "impact_delta": -0.10,
            "vendor_at_fault": True
        }
    }

    # First request - should apply penalty
    res1 = client.post("/update_trust", json=payload)
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["status"] == "COMPLETED"
    assert data1["claims"][0]["already_processed"] is False

    profile1 = db.fetch_trust_profile(vendor_id)
    score1 = profile1["schedule_reliability"]
    assert score1 < initial_score, "First request should reduce score"

    # Second request - identical source_event_id should NOT apply penalty again
    res2 = client.post("/update_trust", json=payload)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["status"] == "COMPLETED"
    assert data2["claims"][0]["already_processed"] is True

    profile2 = db.fetch_trust_profile(vendor_id)
    score2 = profile2["schedule_reliability"]
    assert score2 == score1, "Second request with same source_event_id MUST NOT change score again"

    # Verify only ONE trust_event exists for this source_event_id
    matching_events = [
        e for e in db.fetch_trust_events(vendor_id)
        if e.get("source_event_id") == source_event_id
    ]
    assert len(matching_events) == 1, f"Expected exactly 1 event, found {len(matching_events)}"


def test_project_id_persistence_and_filtering():
    """
    Test Requirement 2:
    1. project_id is persisted as top-level column in trust_events.
    2. Trustline can distinguish events for a SPECIFIC project vs ALL projects.
    """
    vendor_id = "V-001"
    proj_a = "PRJ-ALPHA"
    proj_b = "PRJ-BETA"

    # Submit event for PRJ-ALPHA
    client.post("/update_trust", json={
        "vendor_id": vendor_id,
        "source_event_id": "evt_proj_a_1",
        "project_id": proj_a,
        "verified_event": {
            "impact_dimension": "commercial_reliability",
            "impact_delta": -0.05
        }
    })

    # Submit event for PRJ-BETA
    client.post("/update_trust", json={
        "vendor_id": vendor_id,
        "source_event_id": "evt_proj_b_1",
        "project_id": proj_b,
        "verified_event": {
            "impact_dimension": "commercial_reliability",
            "impact_delta": -0.05
        }
    })

    # Fetch events for PRJ-ALPHA
    events_a = db.fetch_trust_events(vendor_id, impact_dimension="commercial_reliability", project_id=proj_a)
    assert all(e.get("project_id") == proj_a for e in events_a)
    assert any(e.get("source_event_id") == "evt_proj_a_1" for e in events_a)

    # Fetch events for PRJ-BETA
    events_b = db.fetch_trust_events(vendor_id, impact_dimension="commercial_reliability", project_id=proj_b)
    assert all(e.get("project_id") == proj_b for e in events_b)
    assert any(e.get("source_event_id") == "evt_proj_b_1" for e in events_b)

    # Fetch events across ALL projects
    all_events = db.fetch_trust_events(vendor_id, impact_dimension="commercial_reliability")
    assert len(all_events) >= len(events_a) + len(events_b)


def test_behavioural_drift_excludes_external_cause_events():
    """
    Test Requirement 3:
    Events where external_cause=true must NOT count toward vendor behavioural drift.
    """
    # 2 vendor-caused negative events + 1 external-cause negative event
    events_by_dim = {
        "schedule_reliability": [
            {"impact_delta": -0.10, "external_cause": False, "created_at": "2026-08-15T00:00:00Z"},
            {"impact_delta": -0.10, "external_cause": False, "created_at": "2026-08-16T00:00:00Z"},
            {"impact_delta": -0.10, "external_cause": True, "created_at": "2026-08-17T00:00:00Z"},
        ]
    }

    # Should NOT trigger drift because only 2 vendor-caused negative events exist (threshold is >= 3)
    findings = logic.detect_drift(events_by_dim)
    assert len(findings) == 0, "External cause event should be excluded, resulting in 2 negative events < threshold 3"

    # Add 1 more vendor-caused negative event (total 3 vendor-caused)
    events_by_dim["schedule_reliability"].append(
        {"impact_delta": -0.10, "external_cause": False, "created_at": "2026-08-18T00:00:00Z"}
    )

    # Should NOW trigger drift
    findings2 = logic.detect_drift(events_by_dim)
    assert len(findings2) == 1
    assert findings2[0]["dimension"] == "schedule_reliability"
    assert findings2[0]["negative_event_count"] == 3
