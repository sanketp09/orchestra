from __future__ import annotations
from enum import Enum
from typing import Any, Optional, Dict, List
from pydantic import BaseModel, Field

from orchestra.situation import SituationContext
from orchestra.planner import (
    InformationNeed,
    ValidatedPlan,
    ValidatedPlanStep,
    InformationNeedsList,
    extract_information_needs
)
from orchestra.execution import PlanExecutionResult, StepExecutionResult, StepStatus
from orchestra.evaluation import EvaluationResult, NeedEvaluationStatus, EvaluationStatus
from orchestra.state import OrchestraState
from common.llm_client import generate_structured, get_llm_client


# ============================================================================
# Replanning Schema Contracts
# ============================================================================

class ReplanningStatus(str, Enum):
    SUFFICIENT = "SUFFICIENT"
    HUMAN_REVIEW_REQUIRED = "HUMAN_REVIEW_REQUIRED"
    MAX_ITERATIONS_REACHED = "MAX_ITERATIONS_REACHED"
    NO_MEANINGFUL_PROGRESS = "NO_MEANINGFUL_PROGRESS"
    NO_ELIGIBLE_CAPABILITIES = "NO_ELIGIBLE_CAPABILITIES"
    UNRESOLVED_CRITICAL_GAP = "UNRESOLVED_CRITICAL_GAP"


class ReplanningDecision(str, Enum):
    NO_REPLAN = "NO_REPLAN"
    REPLAN = "REPLAN"
    HUMAN_REVIEW = "HUMAN_REVIEW"
    STOP_LIMIT_REACHED = "STOP_LIMIT_REACHED"


class ReplanningHistoryEntry(BaseModel):
    """
    State snapshot of a single replanning loop iteration.
    """
    iteration: int
    evaluation_status: str
    reason: str
    resolved_needs: List[str] = Field(default_factory=list)
    remaining_needs: List[str] = Field(default_factory=list)
    new_needs: List[str] = Field(default_factory=list)
    plan_summary: str
    execution_summary: str


class ReplanningResult(BaseModel):
    decision: ReplanningDecision
    stop_reason: Optional[ReplanningStatus] = None
    updated_situation: Optional[SituationContext] = None
    refined_needs: List[InformationNeed] = Field(default_factory=list)
    next_plan: Optional[ValidatedPlan] = None
    history_entry: Optional[ReplanningHistoryEntry] = None


# ============================================================================
# Replanning Engine
# ============================================================================

class ReplanningEngine:
    """
    State-aware, bounded, and progress-detecting replanning coordinator.
    """
    def decide_replanning(
        self,
        state: OrchestraState,
        evaluation: EvaluationResult,
        max_iterations: int = 3
    ) -> tuple[ReplanningDecision, Optional[ReplanningStatus]]:
        """
        Determines if replanning should continue or stop based on factual checks.
        """
        # Rule 1: Sufficiency reached
        if evaluation.status == EvaluationStatus.SUFFICIENT:
            return ReplanningDecision.NO_REPLAN, ReplanningStatus.SUFFICIENT

        # Rule 2: Escalation to human review required
        if evaluation.status == EvaluationStatus.HUMAN_REVIEW_REQUIRED or evaluation.requires_human_review:
            return ReplanningDecision.HUMAN_REVIEW, ReplanningStatus.HUMAN_REVIEW_REQUIRED

        # Rule 3: Bounded loops limit reached
        if state.active_iteration >= max_iterations:
            return ReplanningDecision.STOP_LIMIT_REACHED, ReplanningStatus.MAX_ITERATIONS_REACHED

        # Rule 4: Progress stall check
        if state.replanning_history:
            last_entry = state.replanning_history[-1]
            prev_resolved = len(last_entry.resolved_needs)
            curr_resolved = len([e for e in evaluation.need_evaluations if e.status == NeedEvaluationStatus.RESOLVED])
            
            prev_remaining = len(last_entry.remaining_needs)
            curr_remaining = len([e for e in evaluation.need_evaluations if e.status != NeedEvaluationStatus.RESOLVED])

            # If resolved needs didn't increase AND unresolved remaining did not decrease
            if curr_resolved <= prev_resolved and curr_remaining >= prev_remaining:
                return ReplanningDecision.STOP_LIMIT_REACHED, ReplanningStatus.NO_MEANINGFUL_PROGRESS

        # Default: Proceed to next replanning step
        return ReplanningDecision.REPLAN, None

    def update_situation(
        self,
        original_situation: SituationContext,
        completed_outputs: List[Dict[str, Any]],
        evaluation: EvaluationResult
    ) -> SituationContext:
        """
        Semantically updates facts, uncertainties, and gaps using specialist outputs,
        strictly maintaining verified provenance.
        """
        prompt = f"""
Update the SituationContext by incorporating the latest findings from execution outputs.

Original Situation:
Objective: {original_situation.objective}
Known Facts: {original_situation.known_facts}
Uncertainties: {original_situation.uncertainties}
Information Gaps: {original_situation.information_gaps}

Execution Findings (Specialist Outputs):
{completed_outputs}

Unresolved Information Needs & Gaps:
{evaluation.unresolved_information}

CRITICAL RULES:
1. Preserve all original verified facts. Do not overwrite or delete any fact from the original known_facts list.
2. Formulate new facts discovered during execution and add them to the known_facts list.
3. Update uncertainties: remove resolved uncertainties, and add new uncertainties arising from findings.
4. Update information_gaps: remove filled gaps, and add any new gaps discovered.

Return the updated SituationContext.
"""
        res = generate_structured(prompt=prompt, schema=SituationContext)
        updated = SituationContext.model_validate(res)

        # Factual override safeguard: ensure original facts survive
        for fact in original_situation.known_facts:
            if fact not in updated.known_facts:
                updated.known_facts.append(fact)

        return updated

    def refine_needs(
        self,
        original_needs: List[InformationNeed],
        updated_situation: SituationContext,
        evaluation: EvaluationResult
    ) -> List[InformationNeed]:
        """
        Refines outstanding information needs, retiring resolved needs, and introducing new gaps.
        """
        # Determine resolved need IDs
        resolved_need_ids = {
            e.information_need_id for e in evaluation.need_evaluations
            if e.status == NeedEvaluationStatus.RESOLVED
        }

        # Bounded prompt to extract needs from the new uncertainties/gaps
        prompt = f"""
Identify the outstanding or new information needs that must be addressed based on the updated situation.

Updated Situation Context:
Objective: {updated_situation.objective}
Known Facts: {updated_situation.known_facts}
Uncertainties: {updated_situation.uncertainties}
Information Gaps: {updated_situation.information_gaps}

Already Resolved Needs:
{list(resolved_need_ids)}

Identify and extract only unresolved or newly arising information needs.
"""
        res = generate_structured(prompt=prompt, schema=InformationNeedsList)
        proposed_list = InformationNeedsList.model_validate(res)

        # Filter out resolved needs deterministically
        final_needs = []
        seen_need_ids = set()
        for need in proposed_list.needs:
            if need.need_id in resolved_need_ids or need.need_id in seen_need_ids:
                continue
            seen_need_ids.add(need.need_id)
            final_needs.append(need)

        # Ensure any originally unresolved high-priority needs that got omitted are preserved
        for orig in original_needs:
            if orig.need_id not in resolved_need_ids and orig.need_id not in seen_need_ids:
                final_needs.append(orig)
                seen_need_ids.add(orig.need_id)

        return final_needs

    def prevent_duplicate_steps(
        self,
        proposed_plan: ValidatedPlan,
        history_step_results: List[StepExecutionResult],
        plan_steps: List[ValidatedPlanStep]
    ) -> ValidatedPlan:
        """
        Removes plan steps that duplicate previously completed actions to prevent redundant work.
        """
        completed_cap_needs = set()
        for res in history_step_results:
            if res.status == StepStatus.COMPLETED:
                # Find matching step declaration to resolve its cap/need
                decl = next((s for s in plan_steps if s.step_id == res.step_id), None)
                if decl:
                    completed_cap_needs.add((decl.capability_id, decl.information_need_id))

        filtered_steps = []
        for step in proposed_plan.steps:
            if (step.capability_id, step.information_need_id) in completed_cap_needs:
                # Duplicate completed step detected -> skip executing it again
                continue
            filtered_steps.append(step)

        return ValidatedPlan(steps=filtered_steps)
