from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel

from app.schemas.shared import EvidenceResult


class ExtractedStampData(BaseModel):
    visible_text: str
    heat_number: Optional[str] = None
    manufacturer_mark: Optional[str] = None
    estimated_font_style: str
    spacing_notes: str


class MaterialAuthResult(BaseModel):
    claimed_manufacturer: str
    extracted: ExtractedStampData
    match_score: float
    verdict: Literal["verified", "contradicted", "uncertain"]
    summary: EvidenceResult
