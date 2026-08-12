from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.evidence import EvidenceResult


class DetectedItem(BaseModel):
    name: str
    category: str
    estimated_qty: int
    condition: Literal["good", "damaged", "unclear"]
    confidence: float
    bounding_box: Optional[dict] = None
    frame_number: int
    frame_timestamp: float = 0.0  # seconds into the video this frame was sampled from


class POMatch(BaseModel):
    po_line_item_id: str
    item_name: str
    sku: Optional[str] = None
    expected_qty: int
    detected_qty: int
    delta: int  # expected_qty - detected_qty; positive = shortage, negative = surplus
    unit: str


class SiteWalkResult(BaseModel):
    session_id: str
    detected_items: list[DetectedItem] = Field(default_factory=list)
    po_matches: list[POMatch] = Field(default_factory=list)
    missing_items: list[str] = Field(default_factory=list)
    damaged_items: list[DetectedItem] = Field(default_factory=list)
    summary: EvidenceResult
