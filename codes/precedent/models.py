"""
Shared agent contract models.

Precedent is a specialist microservice in the ORCHESTRA multi-agent
procurement system. Like all specialists, it only ever talks to the
orchestrator over HTTP — it never calls other specialists directly.

This module tries to import the canonical AgentTask / AgentResult
definitions from `common.models` (shared across SENTINEL, TRUSTLINE,
COMPASS, ATLAS, etc.). If that package isn't on the path in this
environment, it falls back to a local copy with an identical contract so
the service can still run standalone.
"""

from typing import Literal

from pydantic import BaseModel, Field

try:
    from common.models import AgentTask, AgentResult  # type: ignore
except ImportError:

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
        findings: list[dict]
        claims: list[dict] = Field(default_factory=list)
        evidence: list[str] = Field(default_factory=list)
        confidence: float
        risks: list[str] = []
        recommended_next_capabilities: list[str] = []
        receipt_id: str
        error: dict | None = None


__all__ = ["AgentTask", "AgentResult"]
