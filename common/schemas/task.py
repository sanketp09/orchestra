from __future__ import annotations
from typing import Literal, Optional, Any
from pydantic import BaseModel, Field


class AgentTask(BaseModel):
    """
    Standard input contract sent from ORCHESTRA brain to any specialist agent.
    """
    task_id: str
    capability: str                # e.g., "sentinel.verify_claim", "trustline.get_vendor_profile"
    project_id: Optional[str] = None
    entity_ids: list[str] = Field(default_factory=list)  # vendor_id, contract_id, claim_id, etc.
    payload: dict[str, Any] = Field(default_factory=dict)
    context: Optional[dict[str, Any]] = None  # Belief Graph snippet, prior agent outputs


class AgentResult(BaseModel):
    """
    Standard output contract returned by EVERY specialist agent back to ORCHESTRA.
    """
    agent: str = ""                     # e.g., "sentinel", "trustline", "precedent", "arbiter"
    task_id: str
    status: Literal["COMPLETED", "INSUFFICIENT_INFORMATION", "FAILED", "NEEDS_HUMAN_REVIEW"]
    findings: list[dict[str, Any]] = Field(default_factory=list)
    claims: list[dict[str, Any]] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)  # list of evidence_id / receipt_id refs
    confidence: float = 0.0              # 0.0 - 1.0
    risks: list[str] = Field(default_factory=list)
    recommended_next_capabilities: list[str] = Field(default_factory=list)
    receipt_id: Optional[str] = None
    error: Optional[dict[str, Any]] = None
