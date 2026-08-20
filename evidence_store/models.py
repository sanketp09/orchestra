from __future__ import annotations
from datetime import datetime, timezone
from typing import Literal, Optional, Dict, List, Any
from pydantic import BaseModel, Field


class Vendor(BaseModel):
    vendor_id: str
    name: str
    projects: List[str] = Field(default_factory=list)
    contact_email: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class Claim(BaseModel):
    claim_id: str
    project_id: str
    vendor_id: str
    text: str
    claim_type: Literal["progress", "invoice", "quality", "delay", "collusion", "material", "statutory", "wage"]
    status: Literal["unverified", "verified", "contradicted"] = "unverified"
    confidence: float = 0.0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class TrustProfile(BaseModel):
    vendor_id: str
    schedule_reliability: float = 0.85
    commercial_reliability: float = 0.90
    claim_reliability: float = 0.80
    quality_reliability: float = 0.88
    financial_stability: float = 0.85
    overall_trust: float = 0.856
    last_updated: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class HistoricalCase(BaseModel):
    case_id: str
    project_id: str
    vendor_id: Optional[str] = None
    summary: str
    outcome: str
    dispute_type: str = "general"
    embedding: List[float] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class CausationResult(BaseModel):
    case_id: str
    causes: List[str] = Field(default_factory=list)
    responsibility: Dict[str, float] = Field(default_factory=dict)  # e.g., {"vendor": 0.7, "external": 0.3}
    evidence_refs: List[str] = Field(default_factory=list)
    reasoning: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
