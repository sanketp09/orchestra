from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional, Any
from pydantic import BaseModel, Field


class BeliefEdge(BaseModel):
    """
    Belief Graph Edge representing relationships between entities, claims, evidence, and outcomes.
    Stored in Supabase 'belief_edges' table.
    """
    edge_id: Optional[str] = None
    entity_id: str                 # Legacy: e.g., claim_id or vendor_id
    relation: str                  # Legacy: "supported_by", "contradicted_by", etc.
    target_id: str                 # Legacy: evidence_id, receipt_id, or related entity_id
    confidence: float              # 0.0 - 1.0
    source_agent: str              # "sentinel", "trustline", "precedent", "arbiter"
    metadata: dict[str, Any] = Field(default_factory=dict)
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    # Normalized Supabase schema columns
    project_id: Optional[str] = None
    subject_id: Optional[str] = None
    subject_type: Optional[str] = None
    predicate: Optional[str] = None
    object_id: Optional[str] = None
    object_type: Optional[str] = None
    evidence_ids: list[str] = Field(default_factory=list)
