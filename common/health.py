import os
from common.supabase_client import get_supabase_client
from common.llm_client import get_llm_client

def check_db_health() -> bool:
    try:
        client = get_supabase_client()
        # Make a simple query to ensure connectivity
        client.table("receipts").select("receipt_id").limit(1).execute()
        return True
    except Exception:
        return False

def check_llm_health() -> bool:
    try:
        # Check if environment keys are present
        if "ANTHROPIC_API_KEY" not in os.environ:
            return False
        # Test client retrieval
        client = get_llm_client()
        return client is not None
    except Exception:
        return False

def get_specialist_availability() -> str:
    db_ok = check_db_health()
    llm_ok = check_llm_health()
    if db_ok and llm_ok:
        return "available"
    elif db_ok or llm_ok:
        return "degraded"
    else:
        return "unavailable"

def get_specialist_capabilities_manifest(specialist_name: str) -> dict:
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
        if specialist["name"] == specialist_name:
            specialist["availability"] = availability
            for cap in specialist.get("capabilities", []):
                cap["availability"] = availability
            return specialist
            
    return {"name": specialist_name, "availability": availability, "capabilities": []}
