"""
Shared contract types for the multi-agent procurement system.

Every specialist microservice (Trustline, Sentinel, ...) is called only by
the orchestrator ("ORCHESTRA") over HTTP, and every capability endpoint
accepts an AgentTask and returns an AgentResult. Specialists never call each
other directly.
"""

from typing import Literal

from pydantic import BaseModel, Field


class AgentTask(BaseModel):
    task_id: str
    capability: str
    project_id: str
    entity_ids: list[str]
    payload: dict
    context: dict | None = None


class AgentResult(BaseModel):
    agent: str
    task_id: str
    status: Literal["COMPLETED", "INSUFFICIENT_INFORMATION", "FAILED"]
    findings: list[dict]
    claims: list[dict] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)
    confidence: float
    risks: list[str] = Field(default_factory=list)
    recommended_next_capabilities: list[str] = Field(default_factory=list)
    receipt_id: str
    error: dict | None = None
