"""
Pydantic schemas for the Compass service.

These mirror the shared Integration Contract defined in
00_UNIVERSAL_ARCHITECTURE.md (section 4). In the real monorepo these
would live in `common/schemas/` and be imported via `pip install -e ./common`.
For this Phase 1 stub, they are duplicated locally so Compass can run
standalone. When `common/` is frozen, swap these imports for the shared
package and delete this file's model definitions.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Shared contract (from 00_UNIVERSAL_ARCHITECTURE.md, section 4.2 / 4.3)
# ---------------------------------------------------------------------------

class AgentTask(BaseModel):
    """What ORCHESTRA sends a specialist."""

    task_id: str
    capability: str  # e.g. "compass.recommend"
    project_id: str
    entity_ids: list[str] = Field(default_factory=list)
    payload: dict = Field(default_factory=dict)  # capability-specific input
    context: dict | None = None  # assembled multi-specialist context from ORCHESTRA


class AgentResult(BaseModel):
    """What every specialist returns to ORCHESTRA. No exceptions."""

    agent: str  # "compass"
    task_id: str
    status: Literal["completed", "needs_more_evidence", "failed"]
    findings: list[dict] = Field(default_factory=list)
    claims: list[dict] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)  # evidence/receipt IDs only
    confidence: float = 0.0
    risks: list[str] = Field(default_factory=list)
    recommended_next_capabilities: list[str] = Field(default_factory=list)
    receipt_id: str


# ---------------------------------------------------------------------------
# Compass-specific output shape (from 03_PERSON3_RISK_DECISION.md, section 3)
# ---------------------------------------------------------------------------

class Recommendation(BaseModel):
    recommendation_id: str = Field(default_factory=lambda: new_id("rec"))
    situation_id: str = "unknown"
    recommendation: str = ""
    rationale: str = ""
    contributing_factors: list[str] = Field(default_factory=list)
    cost_impact: str | None = None
    schedule_impact: str | None = None
    risk_exposure: str = ""
    confidence: float = 0.0
    alternatives_considered: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
