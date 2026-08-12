from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.evidence import EvidenceResult


class DuplicateMatch(BaseModel):
    existing_po_id: str
    existing_po_line_item_id: str
    existing_item_name: str
    existing_team: Optional[str] = None
    similarity_score: float  # 1.0 for exact SKU match; cosine similarity otherwise
    severity: Literal["exact_duplicate", "likely_duplicate", "possible_overlap"]
    estimated_savings_if_merged: Optional[float] = None


class DuplicateCheckResult(BaseModel):
    new_po_line_item_id: str
    new_item_name: str
    matches: list[DuplicateMatch] = Field(default_factory=list)
    summary: EvidenceResult
