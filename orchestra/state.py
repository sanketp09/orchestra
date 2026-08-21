from __future__ import annotations
from typing import Optional, Any, List
from pydantic import BaseModel, Field
from common.schemas.task import AgentResult
from orchestra.situation import SituationContext

# Lazy import / runtime import for Type hints of extended fields
# to avoid circular import issues
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from orchestra.planner import InformationNeed, CapabilityCandidate, ValidatedPlan
    from orchestra.execution import PlanExecutionResult


class PlanStep(BaseModel):
    """
    Represents a single planned capability call in a plan.
    """
    step_id: str
    capability: str                # e.g., "sentinel.verify_claim"
    payload: dict[str, Any] = Field(default_factory=dict)
    reason: str
    expected_outputs: List[str] = Field(default_factory=list)
    parallel_group: Optional[int] = None


class OrchestraState(BaseModel):
    """
    Tracks the active run context, planned steps, results, and loop iteration counts.
    """
    run_id: str
    project_id: Optional[str] = None
    objective: str
    status: str = "PENDING"        # PENDING, RUNNING, COMPLETED, FAILED, NEEDS_HUMAN_REVIEW
    situation: Optional[SituationContext] = None
    context: dict[str, Any] = Field(default_factory=dict)
    executed_steps: List[PlanStep] = Field(default_factory=list)
    agent_results: List[AgentResult] = Field(default_factory=list)
    execution_history: List[dict[str, Any]] = Field(default_factory=list)
    iteration_count: int = 0

    # Phase 4 Extensions
    information_needs: List[Any] = Field(default_factory=list)
    capability_candidates: List[Any] = Field(default_factory=list)
    plan: Optional[Any] = None
    execution: Optional[Any] = None
    evaluation: Optional[Any] = None

    # Phase 6 Extensions
    replanning_history: List[Any] = Field(default_factory=list)
    replanning_status: Optional[str] = None
    active_iteration: int = 0
