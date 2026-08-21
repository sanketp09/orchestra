from __future__ import annotations
from enum import Enum
from typing import Any, Optional, Dict, List
from pydantic import BaseModel, Field, field_validator

from orchestra.situation import SituationContext
from orchestra.planner import InformationNeed, ValidatedPlan, ValidatedPlanStep
from orchestra.execution import PlanExecutionResult, StepExecutionResult, StepStatus, ProvenanceRecord, StepBlockReason
from common.llm_client import generate_structured


# ============================================================================
# Evaluation Schema Contracts
# ============================================================================

class EvaluationStatus(str, Enum):
    SUFFICIENT = "SUFFICIENT"
    INSUFFICIENT = "INSUFFICIENT"
    PARTIAL = "PARTIAL"
    HUMAN_REVIEW_REQUIRED = "HUMAN_REVIEW_REQUIRED"


class NeedEvaluationStatus(str, Enum):
    RESOLVED = "RESOLVED"
    PARTIALLY_RESOLVED = "PARTIALLY_RESOLVED"
    UNRESOLVED = "UNRESOLVED"
    BLOCKED = "BLOCKED"
    NOT_EXECUTED = "NOT_EXECUTED"


class DeterministicNeedAssessment(BaseModel):
    """
    Factual, structural execution summary per InformationNeed.
    """
    information_need_id: str
    status: NeedEvaluationStatus
    supporting_step_ids: List[str] = Field(default_factory=list)
    failed_step_ids: List[str] = Field(default_factory=list)
    blocked_step_ids: List[str] = Field(default_factory=list)
    provenance_origins: List[str] = Field(default_factory=list)


class NeedEvaluation(BaseModel):
    """
    Semantically evaluated resolution status of an individual information need.
    """
    information_need_id: str
    status: NeedEvaluationStatus
    reasoning: str
    supporting_step_ids: List[str] = Field(default_factory=list)
    remaining_gap: Optional[str] = None
    confidence: float = Field(ge=0.0, le=1.0)


class SemanticEvaluationOutput(BaseModel):
    """
    Parsing model for the bounded, structured semantic LLM response.
    """
    status: EvaluationStatus
    need_evaluations: List[NeedEvaluation] = Field(default_factory=list)
    resolved_information: List[str] = Field(default_factory=list)
    unresolved_information: List[str] = Field(default_factory=list)
    remaining_uncertainties: List[str] = Field(default_factory=list)
    remaining_information_gaps: List[str] = Field(default_factory=list)
    requires_replanning: bool
    requires_human_review: bool
    reasoning: str
    recommendation: str
    confidence: float = Field(ge=0.0, le=1.0)


class EvaluationResult(BaseModel):
    """
    Authoritative evaluation output combining Layer A and Layer B with deterministic overrides.
    """
    status: EvaluationStatus
    need_evaluations: List[NeedEvaluation] = Field(default_factory=list)
    resolved_information: List[str] = Field(default_factory=list)
    unresolved_information: List[str] = Field(default_factory=list)
    material_failures: List[str] = Field(default_factory=list)
    material_blockers: List[str] = Field(default_factory=list)
    remaining_uncertainties: List[str] = Field(default_factory=list)
    remaining_information_gaps: List[str] = Field(default_factory=list)
    requires_replanning: bool
    requires_human_review: bool
    reasoning: str
    recommendation: str
    confidence: float = Field(ge=0.0, le=1.0)


# ============================================================================
# Helper Functions
# ============================================================================

def find_root_blockers(
    step_id: str,
    plan_steps: Dict[str, ValidatedPlanStep],
    step_results: Dict[str, StepExecutionResult]
) -> List[str]:
    """
    Recursively traces blocked step dependencies to identify root failure causes.
    """
    step = plan_steps.get(step_id)
    if not step:
        return []

    root = []
    for dep_id in step.depends_on:
        dep_res = step_results.get(dep_id)
        if not dep_res:
            root.append(dep_id)
        elif dep_res.status == StepStatus.FAILED:
            root.append(dep_id)
        elif dep_res.status == StepStatus.BLOCKED:
            deep = find_root_blockers(dep_id, plan_steps, step_results)
            if deep:
                root.extend(deep)
            else:
                root.append(dep_id)
    return list(set(root))


# ============================================================================
# Evaluation Engine
# ============================================================================

class EvaluationEngine:
    """
    Hybrid semantic and deterministic evaluation coordinator for Phase 5.
    """
    def evaluate(
        self,
        situation: SituationContext,
        needs: List[InformationNeed],
        plan: ValidatedPlan,
        execution_result: PlanExecutionResult
    ) -> EvaluationResult:
        
        plan_steps = {s.step_id: s for s in plan.steps}
        step_results = {r.step_id: r for r in execution_result.step_results}

        # --------------------------------------------------------------------
        # LAYER A: DETERMINISTIC ANALYSIS
        # --------------------------------------------------------------------
        deterministic_assessments: List[DeterministicNeedAssessment] = []
        material_failures: List[str] = []
        material_blockers: List[str] = []

        for need in needs:
            steps_for_need = [s for s in plan.steps if s.information_need_id == need.need_id]
            
            supporting: List[str] = []
            failed: List[str] = []
            blocked: List[str] = []
            provenance: List[str] = []

            for step in steps_for_need:
                res = step_results.get(step.step_id)
                if not res:
                    continue
                if res.status == StepStatus.COMPLETED:
                    supporting.append(step.step_id)
                    # Accumulate provenance origins
                    for p in res.output_provenance + res.input_provenance:
                        if p.origin and p.origin not in provenance:
                            provenance.append(p.origin)
                elif res.status == StepStatus.FAILED:
                    failed.append(step.step_id)
                elif res.status == StepStatus.BLOCKED:
                    blocked.append(step.step_id)

            # Determine baseline status
            if not steps_for_need:
                baseline_status = NeedEvaluationStatus.NOT_EXECUTED
            elif len(supporting) == len(steps_for_need):
                baseline_status = NeedEvaluationStatus.RESOLVED
            elif len(supporting) > 0:
                baseline_status = NeedEvaluationStatus.PARTIALLY_RESOLVED
            elif blocked:
                baseline_status = NeedEvaluationStatus.BLOCKED
            elif failed:
                baseline_status = NeedEvaluationStatus.UNRESOLVED
            else:
                baseline_status = NeedEvaluationStatus.NOT_EXECUTED

            deterministic_assessments.append(
                DeterministicNeedAssessment(
                    information_need_id=need.need_id,
                    status=baseline_status,
                    supporting_step_ids=supporting,
                    failed_step_ids=failed,
                    blocked_step_ids=blocked,
                    provenance_origins=provenance
                )
            )

            # Execution Impact & Materiality Checks
            for f_id in failed:
                # Material if high priority need is completely unresolved
                # or if it was required by downstream steps
                is_downstream_dependency = any(f_id in s.depends_on for s in plan.steps)
                is_critical_need_failure = (need.priority == "high" and len(supporting) == 0)
                if is_critical_need_failure or is_downstream_dependency:
                    if f_id not in material_failures:
                        material_failures.append(f_id)

            # Blocked Dependency Root Blocker Tracing
            for b_id in blocked:
                roots = find_root_blockers(b_id, plan_steps, step_results)
                for r in roots:
                    if r not in material_blockers:
                        material_blockers.append(r)

        # --------------------------------------------------------------------
        # LAYER B: SEMANTIC EVALUATION (LLM)
        # --------------------------------------------------------------------
        # Bounded context preparation
        needs_dict = [n.model_dump() for n in needs]
        assessments_dict = [a.model_dump() for a in deterministic_assessments]
        
        findings = []
        for r in execution_result.step_results:
            if r.status == StepStatus.COMPLETED:
                findings.append({
                    "step_id": r.step_id,
                    "capability_id": r.capability_id,
                    "findings": r.output
                })

        prompt = f"""
Evaluate the sufficiency of the current procurement situation findings and needs resolution.

Situation Objective: {situation.objective}
Known Facts: {situation.known_facts}
Uncertainties: {situation.uncertainties}
Information Gaps: {situation.information_gaps}

Information Needs:
{needs_dict}

Deterministic Need Assessments (Layer A):
{assessments_dict}

Execution Findings (Specialist Outputs):
{findings}

Evaluate each need semantically and formulate the overall sufficiency status:
1. "SUFFICIENT": Objective is met, critical needs are resolved.
2. "INSUFFICIENT": Critical decision gaps remain.
3. "PARTIAL": Minor gaps remain but major objective parts are resolved.
4. "HUMAN_REVIEW_REQUIRED": Specialist outputs conflict, confidence is too low, or policy approval is required.

Provide the response in the structured JSON format matching the schema.
"""

        llm_res = generate_structured(prompt=prompt, schema=SemanticEvaluationOutput)
        proposed = SemanticEvaluationOutput.model_validate(llm_res)

        # --------------------------------------------------------------------
        # LAYER C: DETERMINISTIC VALIDATION & OVERRIDES
        # --------------------------------------------------------------------
        final_need_evaluations: List[NeedEvaluation] = []
        unresolved_high_priority_need = False

        # Map need evaluations
        proposed_need_evals = {e.information_need_id: e for e in proposed.need_evaluations}

        for need, assessment in zip(needs, deterministic_assessments):
            prop_eval = proposed_need_evals.get(need.need_id)
            
            # Default fallback if LLM omitted a need
            if not prop_eval:
                prop_eval = NeedEvaluation(
                    information_need_id=need.need_id,
                    status=assessment.status,
                    reasoning="Deterministic baseline assessment fallback.",
                    supporting_step_ids=assessment.supporting_step_ids,
                    confidence=0.5
                )

            # High Priority Persistence Overrides
            if need.priority == "high":
                # Cannot upgrade to RESOLVED if there are zero successful execution outputs
                if assessment.status in [NeedEvaluationStatus.UNRESOLVED, NeedEvaluationStatus.BLOCKED, NeedEvaluationStatus.NOT_EXECUTED]:
                    if prop_eval.status == NeedEvaluationStatus.RESOLVED:
                        prop_eval.status = assessment.status
                        prop_eval.reasoning = (
                            "[DETERMINISTIC OVERRIDE] " + prop_eval.reasoning + 
                            " (Overridden because no plan steps completed successfully to address this high-priority need.)"
                        )
                    unresolved_high_priority_need = True

            # No Provenance Upgrading Checks
            all_synthetic_or_derived = True
            if assessment.supporting_step_ids:
                for origin in assessment.provenance_origins:
                    if origin == "verified_public":
                        all_synthetic_or_derived = False
                        break
            else:
                all_synthetic_or_derived = False

            if all_synthetic_or_derived and "verified public" in prop_eval.reasoning.lower():
                prop_eval.reasoning = (
                    "[DETERMINISTIC PROVENANCE SAFEGUARD] " + 
                    prop_eval.reasoning.replace("verified public", "synthetic/derived")
                )

            final_need_evaluations.append(prop_eval)

        # Replanning & Human Review Rules
        requires_replanning = proposed.requires_replanning
        requires_human_review = proposed.requires_human_review
        final_status = proposed.status

        # If any high-priority need remains unresolved or blocked, force replanning or human review
        if unresolved_high_priority_need:
            requires_replanning = True
            if final_status == EvaluationStatus.SUFFICIENT:
                final_status = EvaluationStatus.INSUFFICIENT

        # Conflict Safeguard Checks:
        has_conflicts = False
        completed_outputs = [r.output for r in execution_result.step_results if r.status == StepStatus.COMPLETED]
        
        # Look for contradictory flag signals in text fields or structured lists
        for o1 in completed_outputs:
            for o2 in completed_outputs:
                if o1 != o2:
                    o1_str = str(o1).lower()
                    o2_str = str(o2).lower()
                    if ("duplicate" in o1_str and "no duplicate" in o2_str) or \
                       ("failed" in o1_str and "success" in o2_str) or \
                       ("contradict" in o1_str or "conflict" in o1_str):
                        has_conflicts = True
                        break

        if has_conflicts or requires_human_review:
            requires_human_review = True
            final_status = EvaluationStatus.HUMAN_REVIEW_REQUIRED

        # Clean reasoning overrides
        final_reasoning = proposed.reasoning
        if unresolved_high_priority_need:
            final_reasoning = (
                "[Deterministic Rule Enforced] High-priority information need remains unresolved. " +
                final_reasoning
            )

        return EvaluationResult(
            status=final_status,
            need_evaluations=final_need_evaluations,
            resolved_information=proposed.resolved_information,
            unresolved_information=proposed.unresolved_information,
            material_failures=material_failures,
            material_blockers=material_blockers,
            remaining_uncertainties=proposed.remaining_uncertainties,
            remaining_information_gaps=proposed.remaining_information_gaps,
            requires_replanning=requires_replanning,
            requires_human_review=requires_human_review,
            reasoning=final_reasoning,
            recommendation=proposed.recommendation,
            confidence=proposed.confidence
        )
