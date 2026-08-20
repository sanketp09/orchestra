"""Trustline-specific request bodies. Response bodies are always AgentResult."""

from __future__ import annotations

from typing import Optional
from pydantic import BaseModel

TRUST_DIMENSIONS = [
    "schedule_reliability",
    "commercial_reliability",
    "claim_reliability",
    "quality_reliability",
    "financial_stability",
]


class GetVendorProfileRequest(BaseModel):
    vendor_id: str


class AssessVendorReliabilityRequest(BaseModel):
    vendor_id: str
    dimension: str
    project_id: Optional[str] = None


class DetectBehaviouralDriftRequest(BaseModel):
    vendor_id: str
    project_id: Optional[str] = None


class UpdateTrustRequest(BaseModel):
    vendor_id: str
    verified_event: dict
    external_context: Optional[dict] = None
    source_event_id: Optional[str] = None
    project_id: Optional[str] = None


class CompareVendorHistoryRequest(BaseModel):
    vendor_ids: list[str]
    project_id: Optional[str] = None
