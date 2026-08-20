import os
import sys
import uuid
from pathlib import Path

# Add project root to sys.path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv(str(project_root / ".env"))
except ImportError:
    pass

from fastapi import FastAPI
from fastapi.testclient import TestClient
from services.arbiter_service import router as arbiter_router
from common.supabase_client import get_supabase_client

# Initialize test app
app = FastAPI()
app.include_router(arbiter_router)
client = TestClient(app)

PROJECT_ID = "prj_riverside"
VENDOR_ID = "vendor_apex"


def setup_database_fixtures():
    """
    Ensure the project and vendor exist in the real cloud Supabase database
    so that foreign key constraints do not fail during testing.
    """
    sb = get_supabase_client()
    print("Setting up database fixtures on real Supabase...")
    
    # Upsert project
    try:
        sb.table("projects").upsert({
            "project_id": PROJECT_ID,
            "name": "Riverside E2E Test Project"
        }).execute()
        print(f"  - Project '{PROJECT_ID}' verified.")
    except Exception as e:
        print(f"  - Warning: Failed to upsert project: {e}")

    # Upsert vendor
    try:
        sb.table("vendors").upsert({
            "vendor_id": VENDOR_ID,
            "name": "Apex Rebar Supply",
            "projects": [PROJECT_ID]
        }).execute()
        print(f"  - Vendor '{VENDOR_ID}' verified.")
    except Exception as e:
        print(f"  - Warning: Failed to upsert vendor: {e}")


def run_tests():
    sb = get_supabase_client()
    setup_database_fixtures()
    
    print("\n==================================================")
    print("RUNNING ARBITER E2E VALIDATION SCENARIOS")
    print("==================================================\n")

    # --------------------------------------------------
    # SCENARIO 1: Vendor fault delay (100% vendor)
    # --------------------------------------------------
    print("Scenario 1: Vendor fault delay...")
    payload = {
        "task_id": f"task-s1-{uuid.uuid4().hex[:6]}",
        "capability": "arbiter.analyze_dispute",
        "project_id": PROJECT_ID,
        "entity_ids": [VENDOR_ID],
        "payload": {
            "dispute_context": {
                "claims": [{"claim_id": "claim_s1", "claim_text": "Vendor delay was due to supplier commitments"}],
                "verified_facts": {
                    "ev_s1_1": "Vendor production started late due to internal mill commitments."
                },
                "event_refs": [
                    {"description": "Vendor production started late", "date": "2026-08-01", "source": "ev_s1_1"}
                ]
            }
        }
    }
    res = client.post("/arbiter/analyze_dispute", json=payload)
    assert res.status_code == 200, res.text
    data = res.json()
    print(f"  Status: {data['status']}")
    print(f"  Confidence: {data['confidence']}")
    print(f"  Receipt: {data['receipt_id']}")
    responsibility = data["findings"][0]["responsibility"]
    print(f"  Responsibility Split: {responsibility}")
    
    # Assertions
    assert data["status"] == "completed"
    assert responsibility["vendor"] == 1.0
    assert responsibility["external"] == 0.0
    assert data["receipt_id"].startswith("rcpt_arbiter_")
    
    # Verify DB persistence
    receipt_row = sb.table("receipts").select("*").eq("receipt_id", data["receipt_id"]).single().execute().data
    assert receipt_row, "Receipt row must exist in Supabase receipts table"
    print(f"  [DB verified] Receipt persisted: {receipt_row['receipt_id']}")

    timeline_row = sb.table("timelines").select("*").eq("receipt_id", data["receipt_id"]).single().execute().data
    assert timeline_row, "Timeline row must exist in Supabase timelines table"
    print(f"  [DB verified] Timeline persisted: {timeline_row['timeline_id']}")

    causation_row = sb.table("causation_results").select("*").eq("receipt_id", data["receipt_id"]).single().execute().data
    assert causation_row, "Causation result row must exist in Supabase causation_results table"
    print(f"  [DB verified] Causation result persisted: {causation_row['causation_result_id']}")

    edges = sb.table("belief_edges").select("*").eq("project_id", PROJECT_ID).eq("subject_id", VENDOR_ID).execute().data
    assert len(edges) > 0, "Belief edge must exist in Supabase belief_edges table"
    print(f"  [DB verified] Belief edges found count: {len(edges)}")
    print("Scenario 1 passed successfully.\n")

    # --------------------------------------------------
    # SCENARIO 2: External cause delay (100% external)
    # --------------------------------------------------
    print("Scenario 2: External cause delay...")
    payload["task_id"] = f"task-s2-{uuid.uuid4().hex[:6]}"
    payload["payload"]["dispute_context"] = {
        "claims": [{"claim_id": "claim_s2", "claim_text": "Port closure caused delay."}],
        "verified_facts": {
            "ev_s2_1": "Port authority issued warning: port closure caused shipping interruption."
        },
        "event_refs": [
            {"description": "Port closure announced", "date": "2026-08-05", "source": "ev_s2_1"}
        ]
    }
    res = client.post("/arbiter/analyze_dispute", json=payload)
    assert res.status_code == 200, res.text
    data = res.json()
    print(f"  Status: {data['status']}")
    print(f"  Confidence: {data['confidence']}")
    responsibility = data["findings"][0]["responsibility"]
    print(f"  Responsibility Split: {responsibility}")
    
    assert data["status"] == "completed"
    assert responsibility["external"] == 1.0
    assert responsibility["vendor"] == 0.0
    print("Scenario 2 passed successfully.\n")

    # --------------------------------------------------
    # SCENARIO 3: Mixed cause delay (mixed attribution)
    # --------------------------------------------------
    print("Scenario 3: Mixed cause delay...")
    payload["task_id"] = f"task-s3-{uuid.uuid4().hex[:6]}"
    payload["payload"]["dispute_context"] = {
        "claims": [{"claim_id": "claim_s3", "claim_text": "Both vendor delay and port closure occurred."}],
        "verified_facts": {
            "ev_s3_1": "Vendor production started late.",
            "ev_s3_2": "Port closure caused shipping interruption."
        },
        "event_refs": [
            {"description": "Vendor production started late", "date": "2026-08-01", "source": "ev_s3_1"},
            {"description": "Port closure announced", "date": "2026-08-05", "source": "ev_s3_2"}
        ]
    }
    res = client.post("/arbiter/analyze_dispute", json=payload)
    assert res.status_code == 200, res.text
    data = res.json()
    print(f"  Status: {data['status']}")
    print(f"  Confidence: {data['confidence']}")
    responsibility = data["findings"][0]["responsibility"]
    print(f"  Responsibility Split: {responsibility}")
    
    assert data["status"] == "completed"
    assert responsibility["vendor"] > 0.0
    assert responsibility["external"] > 0.0
    print("Scenario 3 passed successfully.\n")

    # --------------------------------------------------
    # SCENARIO 4: Thin context (needs_more_evidence)
    # --------------------------------------------------
    print("Scenario 4: Thin context...")
    payload["task_id"] = f"task-s4-{uuid.uuid4().hex[:6]}"
    payload["payload"]["dispute_context"] = {
        "claims": [],
        "verified_facts": {},
        "event_refs": []
    }
    res = client.post("/arbiter/analyze_dispute", json=payload)
    assert res.status_code == 200, res.text
    data = res.json()
    print(f"  Status: {data['status']}")
    print(f"  Recommended next capabilities: {data['recommended_next_capabilities']}")
    
    assert data["status"] == "needs_more_evidence"
    assert "sentinel.find_missing_evidence" in data["recommended_next_capabilities"]
    print("Scenario 4 passed successfully.\n")

    # --------------------------------------------------
    # SCENARIO 5: Contradictory evidence (reduced confidence)
    # --------------------------------------------------
    print("Scenario 5: Contradictory evidence...")
    payload["task_id"] = f"task-s5-{uuid.uuid4().hex[:6]}"
    payload["payload"]["dispute_context"] = {
        "claims": [{"claim_id": "claim_s5", "claim_text": "Vendor delay dispute."}],
        "verified_facts": {
            "ev_s5_1": "Vendor production started late.",
            "ev_s5_2": "Bill of lading shows shipment left Aug 10.",
            "ev_s5_3": "Site log shows shipment arrived late, left mill Aug 15."
        },
        "event_refs": [
            {"description": "Production delay", "date": "2026-08-01", "source": "ev_s5_1"},
            {"description": "Shipment left Aug 10", "date": "2026-08-10", "source": "ev_s5_2"},
            {"description": "Shipment left Aug 15", "date": "2026-08-15", "source": "ev_s5_3"}
        ]
    }
    res = client.post("/arbiter/analyze_dispute", json=payload)
    assert res.status_code == 200, res.text
    data = res.json()
    print(f"  Status: {data['status']}")
    print(f"  Confidence: {data['confidence']}")
    responsibility = data["findings"][0]["responsibility"]
    print(f"  Responsibility Split: {responsibility}")
    
    # We expect confidence to be lower due to contradiction in shipment dates
    # (0.5 top cause confidence * 0.7 + 0.95 timeline confidence * 0.3 = 0.635)
    # versus scenario 1 (0.9 top cause confidence * 0.7 + 0.95 timeline confidence * 0.3 = 0.915)
    print(f"  Causation confidence comparison: {data['confidence']} (expected lower than Scenario 1)")
    assert data["confidence"] < 0.8
    print("Scenario 5 passed successfully.\n")

    # --------------------------------------------------
    # SCENARIO 6: Weak evidence (reduced confidence)
    # --------------------------------------------------
    print("Scenario 6: Weak evidence...")
    payload["task_id"] = f"task-s6-{uuid.uuid4().hex[:6]}"
    payload["payload"]["dispute_context"] = {
        "claims": [{"claim_id": "claim_s6", "claim_text": "Vendor delay dispute."}],
        # Provide thin verified facts, but enough to pass evidence_is_too_thin gate (need at least one fact)
        "verified_facts": {
            "ev_s6_1": "There is a rumor of vendor schedule delay."
        },
        "event_refs": [
            {"description": "Rumored delay", "date": None, "source": "ev_s6_1"}
        ]
    }
    res = client.post("/arbiter/analyze_dispute", json=payload)
    assert res.status_code == 200, res.text
    data = res.json()
    print(f"  Status: {data['status']}")
    print(f"  Confidence: {data['confidence']}")
    print(f"  Risks: {data['risks']}")
    
    # Timeline should have gaps/inconsistencies (missing date) reducing overall confidence
    assert data["confidence"] < 0.75
    print("Scenario 6 passed successfully.\n")

    print("==================================================")
    print("ALL ARBITER E2E VALIDATION SCENARIOS PASSED")
    print("==================================================")


if __name__ == "__main__":
    run_tests()
