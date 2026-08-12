from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Any, Dict
from app.services.compass_core import process_compass_analysis

router = APIRouter()

class AnalyzeRequest(BaseModel):
    inputText: str
    fileName: Optional[str] = None

@router.post("/api/compass/analyze")
async def analyze(payload: AnalyzeRequest):
    if not payload.inputText.strip():
        raise HTTPException(status_code=400, detail="inputText must not be empty.")
    
    try:
        result = await process_compass_analysis(payload.inputText, payload.fileName)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
