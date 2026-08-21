from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Any, Optional
import os
from dotenv import load_dotenv
from services.supabase_service import SupabaseClient
from services.grok_service import GrokClient
from services.relevance_engine import RelevanceEngine
from services.receipt_service import ReceiptService
from schemas.task import AgentTask
from schemas.result import AgentResult
from schemas.external_risk import ExternalRisk

load_dotenv()

app = FastAPI(title="Atlas Microservice", version="0.1.0")

# Initialize services (singleton)
supabase_client = SupabaseClient()

grok_client = GrokClient()
rel_engine = RelevanceEngine()
receipt_service = ReceiptService()

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/capabilities")
def list_capabilities():
    return {
        "agent": "atlas",
        "capabilities": [
            {
                "name": "atlas.assess_external_event",
                "description": "Assess which external events affect the procurement.",
                "endpoint": "/atlas/assess-external-event",
            },
            {
                "name": "atlas.check_commodity_exposure",
                "description": "Determine commodity price exposure.",
                "endpoint": "/atlas/check-commodity-exposure",
            },
            {
                "name": "atlas.check_shipping_risk",
                "description": "Assess shipping risk for a shipment.",
                "endpoint": "/atlas/check-shipping-risk",
            },
            {
                "name": "atlas.check_geopolitical_risk",
                "description": "Assess geopolitical risk.",
                "endpoint": "/atlas/check-geopolitical-risk",
            },
        ],
    }

def process_task(task: AgentTask, capability_func) -> AgentResult:
    try:
        result_data = capability_func(task)
        receipt_id = receipt_service.create_receipt(task.task_id, "atlas", task.capability, result_data)
        return AgentResult(
            agent="atlas",
            task_id=task.task_id,
            status="completed",
            receipt_id=receipt_id,
            **result_data,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/atlas/assess-external-event")
def assess_external_event(task: AgentTask):
    def func(t: AgentTask):
        return external_event_capability(t)
    return process_task(task, func)

@app.post("/atlas/check-commodity-exposure")
def check_commodity_exposure(task: AgentTask):
    def func(t: AgentTask):
        return commodity_capability(t)
    return process_task(task, func)

@app.post("/atlas/check-shipping-risk")
def check_shipping_risk(task: AgentTask):
    def func(t: AgentTask):
        return shipping_capability(t)
    return process_task(task, func)

@app.post("/atlas/check-geopolitical-risk")
def check_geopolitical_risk(task: AgentTask):
    def func(t: AgentTask):
        return geopolitical_capability(t)
    return process_task(task, func)

# ----- Capability implementations -----
from capabilities.external_event import external_event_capability
from capabilities.commodity import commodity_capability
from capabilities.shipping import shipping_capability
from capabilities.geopolitical import geopolitical_capability
