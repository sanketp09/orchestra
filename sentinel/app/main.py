from fastapi import FastAPI, Body
from typing import Optional
from pydantic import BaseModel

from app.api.routes import purchase_orders, site_walk
from app.api.routes.compass import (
    clause_value as compass_clause_value,
    decision_debt as compass_decision_debt,
    pattern_break as compass_pattern_break,
    pre_mortem as compass_pre_mortem,
    procurement_opportunity as compass_procurement_opportunity,
    ripple as compass_ripple,
    warranty_clock as compass_warranty_clock,
    xray as compass_xray,
    analyze as compass_analyze,
)
from app.services.sentinel_core import (
    process_sentinel_verification,
    classify_procurement_intent,
    FEATURE_METADATA,
    EvidenceResult
)

app = FastAPI(title="Orchestra Sentinel Core API")

app.include_router(site_walk.router)
app.include_router(purchase_orders.router)
app.include_router(compass_clause_value.router)
app.include_router(compass_decision_debt.router)
app.include_router(compass_pattern_break.router)
app.include_router(compass_pre_mortem.router)
app.include_router(compass_procurement_opportunity.router)
app.include_router(compass_ripple.router)
app.include_router(compass_warranty_clock.router)
app.include_router(compass_xray.router)
app.include_router(compass_analyze.router)




class VerificationRequest(BaseModel):
    input_text: str
    file_name: Optional[str] = None


@app.get("/health")
async def health():
    return {"status": "ok", "system": "SENTINEL CORE", "features_count": len(FEATURE_METADATA)}


@app.get("/sentinel/features")
async def get_features():
    return list(FEATURE_METADATA.values())


@app.post("/sentinel/classify")
async def classify_event(request: VerificationRequest):
    feature_id = classify_procurement_intent(request.input_text, request.file_name)
    return {
        "feature_id": feature_id,
        "metadata": FEATURE_METADATA[feature_id]
    }


@app.post("/sentinel/verify", response_model=EvidenceResult)
async def verify_procurement_event(request: VerificationRequest):
    return process_sentinel_verification(request.input_text, request.file_name)
