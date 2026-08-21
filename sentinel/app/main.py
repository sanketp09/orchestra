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

from services.sentinel_service import router as sentinel_router, sentinel_service
from services.trustline_service import router as trustline_router, trustline_service
from services.precedent_service import router as precedent_router, precedent_service
from services.arbiter_service import router as arbiter_router, arbiter_service
from services.compass_service import router as compass_router, compass_service
from services.atlas_service import router as atlas_router, atlas_service

app = FastAPI(title="Orchestra Person 2 Intelligence & Evidence API")

# Include Person 2 Specialist Routers
app.include_router(sentinel_router)
app.include_router(trustline_router)
app.include_router(precedent_router)
app.include_router(arbiter_router)
app.include_router(compass_router)
app.include_router(atlas_router)


# Include Legacy Sentinel Core Routers
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


from common.health import check_db_health, check_llm_health, get_specialist_availability

class VerificationRequest(BaseModel):
    input_text: str
    file_name: Optional[str] = None


@app.get("/health")
async def health():
    db_ok = check_db_health()
    llm_ok = check_llm_health()
    status = "ok" if (db_ok and llm_ok) else "degraded"
    if not db_ok and not llm_ok:
        status = "error"
    return {
        "status": status,
        "system": "PERSON 2 INTELLIGENCE & EVIDENCE ENGINE",
        "database_connected": db_ok,
        "llm_available": llm_ok,
        "specialists": ["sentinel", "trustline", "precedent", "arbiter", "compass", "atlas"],
        "features_count": len(FEATURE_METADATA)
    }



@app.get("/capabilities")
async def get_all_p2_capabilities():
    """
    Returns ALL registered Person 2 specialist capabilities for ORCHESTRA Brain.
    """
    import json
    from pathlib import Path
    manifest_path = Path(__file__).parent.parent / "specialists" / "capabilities.json"
    if not manifest_path.exists():
        manifest_path = Path(__file__).parent.parent / "capabilities.json"
    
    try:
        with open(manifest_path, "r") as f:
            manifest = json.load(f)
    except Exception:
        manifest = {"version": "1.0", "specialists": []}
        
    availability = get_specialist_availability()
    
    for specialist in manifest.get("specialists", []):
        specialist["availability"] = availability
        for cap in specialist.get("capabilities", []):
            cap["availability"] = availability
            
    return manifest


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

