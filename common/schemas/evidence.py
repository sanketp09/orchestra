from __future__ import annotations
from datetime import datetime, timezone
from typing import Literal, Optional, Any
from pydantic import BaseModel, Field


class Evidence(BaseModel):
    """
    Evidence primitive representing documents, photos, logs, or external data.
    """
    evidence_id: str
    source_type: Literal["document", "photo", "report", "api", "site_walk", "telemetry"]
    source_ref: str                # Supabase Storage path, URL, or document ID
    reliability_tier: Literal["self_reported", "third_party_observed", "verified_transaction"] = "third_party_observed"
    extracted_text: Optional[str] = None
    project_id: str
    linked_claim_ids: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class Receipt(BaseModel):
    """
    Receipt audit trail generated for every specialist agent execution.
    """
    receipt_id: str
    agent: str
    task_id: str
    inputs_hash: str               # SHA-256 or MD5 hash for reproducibility/audit
    output_summary: str
    confidence: float              # 0.0 - 1.0
    evidence_ids: list[str] = Field(default_factory=list)
    reasoning: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
