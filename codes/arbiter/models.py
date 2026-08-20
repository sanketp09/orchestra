"""
Shared contract + Arbiter-specific request models.

AgentTask / AgentResult mirror the contract used across the ORCHESTRA
multi-agent system (Sentinel, Trustline, Precedent, Atlas, Arbiter).
If `common.models` already defines these, delete this duplication and
import from there instead — kept local here so this service is runnable
standalone during development.
"""
from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field


class AgentTask(BaseModel):
    task_id: str
    capability: str
    project_id: str
    entity_ids: list[str]
    payload: dict
    context: Optional[dict] = None  # Sentinel/Trustline/Precedent/Atlas findings, assembled by ORCHESTRA


class AgentResult(BaseModel):
    agent: str = "arbiter"
    task_id: str
    status: Literal["COMPLETED", "INSUFFICIENT_INFORMATION", "FAILED"]
    findings: list[dict] = Field(default_factory=list)
    claims: list[dict] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)
    confidence: float = 0.0
    risks: list[str] = Field(default_factory=list)
    recommended_next_capabilities: list[str] = Field(default_factory=list)
    receipt_id: str
    error: dict | None = None


# ---------------------------------------------------------------------------
# Capability-specific I/O models
# ---------------------------------------------------------------------------

class EventRef(BaseModel):
    description: str
    date: Optional[str] = None
    source: Optional[str] = None


class ReconstructTimelineRequest(BaseModel):
    project_id: str
    entity_ids: list[str]
    event_refs: list[EventRef]
    task_id: Optional[str] = None


class AnalyzeCausationRequest(BaseModel):
    project_id: str
    claims: list[dict]
    evidence_context: dict = Field(default_factory=dict)
    timeline: Optional[dict] = None
    task_id: Optional[str] = None


class AssessResponsibilityRequest(BaseModel):
    causation_result_id: Optional[str] = None
    causes: Optional[list[dict]] = None
    project_id: Optional[str] = None
    task_id: Optional[str] = None


class AnalyzeDisputeRequest(BaseModel):
    project_id: str
    full_context: dict
    task_id: Optional[str] = None


class RunDebateRequest(BaseModel):
    evidence_context: dict
    task_id: Optional[str] = None
