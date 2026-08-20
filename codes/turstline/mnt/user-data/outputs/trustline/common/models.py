"""
Shared contract models for the multi-agent procurement system.

Every capability microservice (Trustline, Sentinel, etc.) is called by
ORCHESTRA with an AgentTask and must respond with an AgentResult. Do not
modify these models per-service - if a service needs extra structure, put it
inside `payload` / `context` (request) or `findings` / `claims` (response).
"""

from __future__ import annotations

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
    status: Literal["completed", "needs_more_evidence", "failed"]
    findings: list[dict] = Field(default_factory=list)
    claims: list[dict] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)
    confidence: float
    risks: list[str] = Field(default_factory=list)
    recommended_next_capabilities: list[str] = Field(default_factory=list)
    receipt_id: str
