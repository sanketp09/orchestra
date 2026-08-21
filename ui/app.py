import streamlit as st
import httpx
import json
from pathlib import Path

API_URL = "http://localhost:8000"

st.set_page_config(page_title="Atlas Demo UI", layout="centered")
st.title("ATLAS – External Risk Intelligence")

capability_map = {
    "Assess External Event": "assess-external-event",
    "Check Commodity Exposure": "check-commodity-exposure",
    "Check Shipping Risk": "check-shipping-risk",
    "Check Geopolitical Risk": "check-geopolitical-risk",
}

selected = st.selectbox("Capability", list(capability_map.keys()))

# Demo scenarios
scenarios = {
    "Scenario A – Shipping (Relevant)": {
        "task_id": "demo-001",
        "capability": f"atlas.{capability_map[selected]}",
        "project_id": "proj-001",
        "entity_ids": ["SHIP-001"],
        "payload": {
            "route": {"origin": "Shanghai", "destination": "Mumbai"},
            "expected_arrival": ("2023-01-15T00:00:00"),
            "shipment_id": "SHIP-001",
            "material": "steel",
        },
        "context": {}
    },
    "Scenario B – Shipping (Irrelevant)": {
        "task_id": "demo-002",
        "capability": f"atlas.{capability_map[selected]}",
        "project_id": "proj-002",
        "entity_ids": ["SHIP-002"],
        "payload": {
            "route": {"origin": "Singapore", "destination": "Chennai"},
            "expected_arrival": "2023-01-20T00:00:00",
            "shipment_id": "SHIP-002",
            "material": "steel",
        },
        "context": {}
    },
    "Scenario C – Commodity": {
        "task_id": "demo-003",
        "capability": f"atlas.{capability_map[selected]}",
        "project_id": "proj-003",
        "entity_ids": ["MATERIAL-001"],
        "payload": {
            "material": "steel",
            "commodity": "steel",
            "quantity": 1000,
            "current_price": 800,
            "historical_price": 750,
            "price_trend": "up",
            "procurement_date": "2023-02-01",
            "contract_price": 770,
            "price_lock": False,
            "supplier": "VendorX",
            "project_id": "proj-003",
        },
        "context": {}
    },
    "Scenario D – Geopolitical": {
        "task_id": "demo-004",
        "capability": f"atlas.{capability_map[selected]}",
        "project_id": "proj-004",
        "entity_ids": ["VENDOR-42"],
        "payload": {
            "vendor": "VendorY",
            "vendor_country": "Vietnam",
            "material": "aluminum",
        },
        "context": {}
    },
    "Scenario E – Insufficient Evidence": {
        "task_id": "demo-005",
        "capability": f"atlas.{capability_map[selected]}",
        "project_id": "proj-005",
        "entity_ids": [],
        "payload": {},
        "context": {},
    },
}

scenario_name = st.selectbox("Demo Scenario", list(scenarios.keys()))
if st.button("Load Demo Scenario"):
    task = scenarios[scenario_name]
    st.session_state["task_json"] = json.dumps(task, indent=2)

task_json = st.text_area("Task JSON", value=st.session_state.get("task_json", ""), height=300)

if st.button("RUN ATLAS"):
    if not task_json:
        st.error("Please provide a Task JSON.")
    else:
        try:
            task = json.loads(task_json)
            endpoint = f"/atlas/{capability_map[selected]}"
            with httpx.Client() as client:
                response = client.post(API_URL + endpoint, json=task, timeout=30)
            if response.status_code == 200:
                result = response.json()
                st.success("✅ Completed")
                st.subheader("Result")
                st.json(result)
            else:
                st.error(f"Error {response.status_code}: {response.text}")
        except json.JSONDecodeError as e:
            st.error(f"Invalid JSON: {e}")
        except Exception as e:
            st.error(f"Unexpected error: {e}")
