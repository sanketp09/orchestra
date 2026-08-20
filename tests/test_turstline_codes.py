import pytest
from fastapi.testclient import TestClient
import sys
from pathlib import Path

# Add codes/turstline to python path
turstline_path = str(Path(__file__).parent.parent / "codes" / "turstline")
if turstline_path not in sys.path:
    sys.path.insert(0, turstline_path)

from codes.turstline.main import app


client = TestClient(app)


def test_capabilities_endpoint():
    res = client.get("/capabilities")
    assert res.status_code == 200
    data = res.json()
    assert data.get("agent") == "trustline"
    assert len(data.get("capabilities", [])) == 5


def test_get_vendor_profile_endpoint():
    res = client.post("/get_vendor_profile", json={"vendor_id": "vendor_apex"})
    assert res.status_code == 200
    data = res.json()
    assert data["agent"] == "trustline"
    assert data["status"] == "COMPLETED"
    assert len(data["findings"]) == 1
    assert data["findings"][0]["vendor_id"] == "vendor_apex"


def test_assess_vendor_reliability_endpoint():
    res = client.post("/assess_vendor_reliability", json={"vendor_id": "vendor_apex", "dimension": "schedule_reliability"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "COMPLETED"
    assert data["findings"][0]["dimension"] == "schedule_reliability"
    assert "trend" in data["findings"][0]


def test_detect_behavioural_drift_endpoint():
    res = client.post("/detect_behavioural_drift", json={"vendor_id": "vendor_apex"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "COMPLETED"
    assert isinstance(data["findings"], list)


def test_update_trust_endpoint_external_cause():
    payload = {
        "vendor_id": "vendor_apex",
        "verified_event": {
            "impact_dimension": "schedule_reliability",
            "impact_delta": -0.10,
            "vendor_at_fault": False
        },
        "external_context": {
            "relevance": 0.85,
            "explains_majority": True,
            "summary": "Port Strike at Nhava Sheva"
        }
    }
    res = client.post("/update_trust", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "COMPLETED"
    assert len(data["claims"]) == 1
    assert data["claims"][0]["external_cause"] is True
    # Applied delta should be tiny penalty (-0.005)
    assert data["claims"][0]["applied_delta"] == -0.005


def test_update_trust_endpoint_vendor_fault():
    payload = {
        "vendor_id": "vendor_apex",
        "verified_event": {
            "impact_dimension": "schedule_reliability",
            "impact_delta": -0.10,
            "vendor_at_fault": True
        },
        "external_context": None
    }
    res = client.post("/update_trust", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "COMPLETED"
    assert data["claims"][0]["external_cause"] is False
    assert data["claims"][0]["applied_delta"] == -0.10


def test_compare_vendor_history_endpoint():
    res = client.post("/compare_vendor_history", json={"vendor_ids": ["vendor_apex", "vendor_meridian"]})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "COMPLETED"
    assert len(data["findings"]) == 2
    assert "note" in data["claims"][0]
