from __future__ import annotations
import datetime
from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from orchestra.situation import SituationContext
from orchestra.planner import InformationNeed, ValidatedPlan
from orchestra.execution import PlanExecutionResult, StepExecutionResult, StepStatus
from orchestra.evaluation import EvaluationResult, EvaluationStatus
from orchestra.replanning import ReplanningHistoryEntry
from common.llm_client import generate_structured


# ============================================================================
# Synthesized Outcome Models
# ============================================================================

class OutcomeStatus(str, Enum):
    SUFFICIENT = "SUFFICIENT"
    HUMAN_REVIEW_REQUIRED = "HUMAN_REVIEW_REQUIRED"
    PARTIAL_SUCCESS = "PARTIAL_SUCCESS"
    FAILED = "FAILED"


class DecisionRecommendation(str, Enum):
    PROCEED = "PROCEED"
    REJECT = "REJECT"
    HOLD = "HOLD"
    HUMAN_REVIEW_REQUIRED = "HUMAN_REVIEW_REQUIRED"


class DecisionEvidence(BaseModel):
    description: str = Field(description="Statement of evidence summarizing what was found.")
    source_step_id: str = Field(description="Step ID that produced this finding.")
    provenance_origins: List[str] = Field(default_factory=list, description="Associated provenance origins (e.g., verified_public, synthetic_augmented)")
    fact_statement: str = Field(description="The underlying concrete data or fact extracted from specialist output.")


class UnresolvedIssue(BaseModel):
    need_id: str = Field(description="Information Need ID associated with this issue.")
    description: str = Field(description="Description of the outstanding information gap.")
    reason: str = Field(description="Reason why this need remains unresolved (e.g. failure, blocked).")


class HumanReviewRequest(BaseModel):
    reason: str = Field(description="Reason why human review is escalated.")
    decision_critical_issues: List[UnresolvedIssue] = Field(default_factory=list, description="Unresolved issues that prevent automatic decisions.")
    conflicting_evidence: List[str] = Field(default_factory=list, description="Description of any contradictory findings or data.")
    recommended_questions: List[str] = Field(default_factory=list, description="Actionable questions for the reviewer to focus on.")
    preliminary_recommendation: Optional[str] = Field(default=None, description="Preliminary suggestion if any.")
    confidence: float = Field(default=0.5, description="Synthesis confidence between 0.0 and 1.0.")


class FinalOutcome(BaseModel):
    """
    Richer decision support container synthesizing execution state, evaluation,
    evidence, and replanning history.
    """
    status: OutcomeStatus
    executive_summary: str
    recommendation: DecisionRecommendation
    confidence: float = Field(ge=0.0, le=1.0)
    supporting_evidence: List[DecisionEvidence] = Field(default_factory=list)
    key_findings: List[str] = Field(default_factory=list)
    unresolved_issues: List[UnresolvedIssue] = Field(default_factory=list)
    material_uncertainties: List[str] = Field(default_factory=list)
    provenance_summary: Dict[str, int] = Field(default_factory=dict, description="Counts of evidence by provenance origin type.")
    human_review_required: bool = False
    human_review_request: Optional[HumanReviewRequest] = None
    replanning_history_summary: str


# ============================================================================
# Persistency Layer Abstraction
# ============================================================================

class OutcomeRecord(BaseModel):
    case_ref: str
    recommendation: str
    confidence: float
    review_status: str  # "approved", "pending_review", "flagged"
    outcome_status: str
    provenance_summary: Dict[str, int]
    timestamp: str = Field(default_factory=lambda: datetime.datetime.utcnow().isoformat())


class IOutcomeRecorder(ABC):
    """
    Supabase-agnostic interface for persisting final outcome decisions.
    """
    @abstractmethod
    def record_outcome(self, record: OutcomeRecord) -> bool:
        pass


# ============================================================================
# Final Synthesizer
# ============================================================================

class FinalSynthesizer:
    """
    Synthesizer compiling full execution context and enforcing structural overrides.
    """
    def synthesize(
        self,
        situation: SituationContext,
        needs: List[InformationNeed],
        execution_result: PlanExecutionResult,
        evaluation: EvaluationResult,
        replanning_history: List[ReplanningHistoryEntry]
    ) -> FinalOutcome:
        # 1. Compile bounded context
        completed_findings = []
        provenance_counts: Dict[str, int] = {}
        steps_by_id = {}

        for res in execution_result.step_results:
            steps_by_id[res.step_id] = res
            if res.status == StepStatus.COMPLETED:
                completed_findings.append({
                    "step_id": res.step_id,
                    "output": res.output,
                    "provenance": [p.origin for p in res.output_provenance] if res.output_provenance else []
                })
                # Count provenance origins
                if res.output_provenance:
                    for prov in res.output_provenance:
                        provenance_counts[prov.origin] = provenance_counts.get(prov.origin, 0) + 1

        prompt = f"""
Compile the Final Decision Support Outcome based on the cumulative workspace state.

Situation Context:
Objective: {situation.objective}
Facts: {situation.known_facts}
Uncertainties: {situation.uncertainties}

Information Needs:
{[n.dict() for n in needs]}

Completed Step Findings:
{completed_findings}

Evaluation Outcome:
Status: {evaluation.status}
Reasoning: {evaluation.reasoning}
Resolved: {evaluation.resolved_information}
Unresolved: {evaluation.unresolved_information}

Replanning History Summary:
Total Iterations: {len(replanning_history)}

Generate the structured FinalOutcome JSON matching the schema.
"""
        # 2. Invoke LLM structured generation
        res_dict = generate_structured(prompt=prompt, schema=FinalOutcome)
        outcome = FinalOutcome.model_validate(res_dict)

        # 3. Apply Deterministic Overrides
        # Force provenance count mapping
        outcome.provenance_summary = provenance_counts

        # Core Check: If evaluation requires human review, outcome must be flagged
        if evaluation.status == EvaluationStatus.HUMAN_REVIEW_REQUIRED or evaluation.requires_human_review:
            outcome.status = OutcomeStatus.HUMAN_REVIEW_REQUIRED
            outcome.recommendation = DecisionRecommendation.HUMAN_REVIEW_REQUIRED
            outcome.human_review_required = True
            
            # If LLM didn't synthesize a request, build a safety fallback request
            if not outcome.human_review_request:
                outcome.human_review_request = HumanReviewRequest(
                    reason="Escalated due to conflicting specialist findings or unresolved critical needs.",
                    decision_critical_issues=[
                        UnresolvedIssue(need_id=i.information_need_id, description=i.reasoning, reason="Failed or blocked")
                        for i in evaluation.need_evaluations if i.status != "RESOLVED"
                    ],
                    conflicting_evidence=["Contradiction detected in sibling specialist paths."],
                    recommended_questions=["Review specialist logs manually.", "Audit source documents."],
                    preliminary_recommendation="Escalate",
                    confidence=0.5
                )

        # 4. Provenance Integrity Safeguard: Ensure no upgrades of synthetic_augmented data
        for ev in outcome.supporting_evidence:
            matching_step = steps_by_id.get(ev.source_step_id)
            if matching_step and matching_step.output_provenance:
                # Get actual origins from execution results
                actual_origins = [p.origin for p in matching_step.output_provenance]
                ev.provenance_origins = actual_origins

                # Overwrite "verified public" with "synthetic/derived" in statements if origin is synthetic
                if "synthetic_augmented" in actual_origins or "logically_derived" in actual_origins:
                    if "verified public" in ev.description.lower():
                        ev.description = ev.description.replace("verified public", "synthetic/derived")
                        ev.description = ev.description.replace("Verified Public", "synthetic/derived")
                    if "verified public" in ev.fact_statement.lower():
                        ev.fact_statement = ev.fact_statement.replace("verified public", "synthetic/derived")
                        ev.fact_statement = ev.fact_statement.replace("Verified Public", "synthetic/derived")

        # Compile summaries
        outcome.replanning_history_summary = f"Execution adapted through {len(replanning_history)} replanning iterations."

        return outcome
