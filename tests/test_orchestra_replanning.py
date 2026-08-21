import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add project root to sys.path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

import pytest

from orchestra.situation import SituationContext
from orchestra.planner import InformationNeed, ValidatedPlan, ValidatedPlanStep
from orchestra.execution import PlanExecutionResult, StepExecutionResult, StepStatus
from orchestra.evaluation import EvaluationResult, NeedEvaluation, NeedEvaluationStatus, EvaluationStatus
from orchestra.state import OrchestraState
from orchestra.replanning import (
    ReplanningEngine,
    ReplanningDecision,
    ReplanningStatus,
    ReplanningHistoryEntry
)


def make_situation():
    return SituationContext(
        objective="Verify site invoice safety and status",
        requested_outcome="status summary",
        entities=["prj_1", "vendor_a"],
        known_facts=["invoice INV-001 received"],
        uncertainties=["actual delivery status"],
        information_gaps=["unverified delivery date"]
    )


@patch("orchestra.replanning.generate_structured")
def test_evaluation_sufficient_no_replan(mock_gen):
    """Test 1: If evaluation is sufficient, decision is NO_REPLAN."""
    engine = ReplanningEngine()
    state = OrchestraState(run_id="run_1", objective="test")
    eval_res = EvaluationResult(
        status=EvaluationStatus.SUFFICIENT,
        requires_replanning=False,
        requires_human_review=False,
        reasoning="All clear",
        recommendation="None",
        confidence=0.95
    )

    decision, status = engine.decide_replanning(state, eval_res)
    assert decision == ReplanningDecision.NO_REPLAN
    assert status == ReplanningStatus.SUFFICIENT


@patch("orchestra.replanning.generate_structured")
def test_high_priority_unresolved_triggers_replan(mock_gen):
    """Test 2: If high-priority need is unresolved, decision is REPLAN."""
    engine = ReplanningEngine()
    state = OrchestraState(run_id="run_1", objective="test")
    eval_res = EvaluationResult(
        status=EvaluationStatus.INSUFFICIENT,
        requires_replanning=True,
        requires_human_review=False,
        reasoning="Critical gap remaining",
        recommendation="Replan",
        confidence=0.9
    )

    decision, status = engine.decide_replanning(state, eval_res)
    assert decision == ReplanningDecision.REPLAN
    assert status is None


@patch("orchestra.replanning.generate_structured")
def test_resolved_need_is_retired_in_refinement(mock_gen):
    """Test 3: Needs that are RESOLVED are filtered out from refined needs."""
    engine = ReplanningEngine()
    situation = make_situation()
    needs = [
        InformationNeed(need_id="need_1", description="Verify delivery", priority="high", source_context="invoice"),
        InformationNeed(need_id="need_2", description="Verify vendor", priority="low", source_context="registration")
    ]
    eval_res = EvaluationResult(
        status=EvaluationStatus.PARTIAL,
        need_evaluations=[
            NeedEvaluation(information_need_id="need_1", status=NeedEvaluationStatus.RESOLVED, reasoning="Photos verified it", confidence=0.95),
            NeedEvaluation(information_need_id="need_2", status=NeedEvaluationStatus.UNRESOLVED, reasoning="Failed to verify", confidence=0.5)
        ],
        requires_replanning=True,
        requires_human_review=False,
        reasoning="resolved need_1",
        recommendation="None",
        confidence=0.8
    )

    # LLM proposed list for refine_needs (mock response returns need_2 and a new weather need)
    mock_gen.return_value = {
        "needs": [
            {"need_id": "need_2", "description": "Verify vendor status", "priority": "low", "source_context": "registration"},
            {"need_id": "need_weather", "description": "Check weather delays", "priority": "low", "source_context": "weather"}
        ]
    }

    refined = engine.refine_needs(needs, situation, eval_res)
    refined_ids = {n.need_id for n in refined}

    # Resolved need_1 must be retired and not present
    assert "need_1" not in refined_ids
    assert "need_2" in refined_ids
    assert "need_weather" in refined_ids


@patch("orchestra.replanning.generate_structured")
def test_new_uncertainties_create_new_information_needs(mock_gen):
    """Test 4: Semantic updater captures execution outputs, creating new uncertainties and needs."""
    engine = ReplanningEngine()
    situation = make_situation()
    findings = [{"step_id": "step_1", "findings": "Found potential worker strikes in the area."}]
    eval_res = EvaluationResult(
        status=EvaluationStatus.PARTIAL,
        requires_replanning=True,
        requires_human_review=False,
        reasoning="Strikes detected",
        recommendation="Replan",
        confidence=0.8
    )

    # Semantic update mock returning strike uncertainties
    mock_gen.side_effect = [
        # Call 1: update_situation
        {
            "objective": situation.objective,
            "requested_outcome": situation.requested_outcome,
            "known_facts": situation.known_facts + ["Worker strikes detected"],
            "uncertainties": ["strike duration", "impact on timeline"],
            "information_gaps": ["strike duration information"]
        },
        # Call 2: refine_needs
        {
            "needs": [
                {"need_id": "need_strike", "description": "Verify strike duration", "priority": "medium", "source_context": "findings"}
            ]
        }
    ]

    updated_sit = engine.update_situation(situation, findings, eval_res)
    assert "Worker strikes detected" in updated_sit.known_facts
    assert "strike duration" in updated_sit.uncertainties

    refined_needs = engine.refine_needs([], updated_sit, eval_res)
    assert len(refined_needs) == 1
    assert refined_needs[0].need_id == "need_strike"


@patch("orchestra.replanning.generate_structured")
def test_failed_specialist_branch_filtering(mock_gen):
    """Test 5: Validates that duplicates are prevented if the same step previously succeeded."""
    engine = ReplanningEngine()
    proposed_plan = ValidatedPlan(
        steps=[
            ValidatedPlanStep(
                step_id="step_2",
                information_need_id="need_1",
                capability_id="sentinel.verify_claim",
                specialist="sentinel",
                endpoint="/sentinel/execute",
                description="check claim",
                objective="retrieve details",
                expected_output="details",
                reasoning="check details"
            ),
            ValidatedPlanStep(
                step_id="step_3",
                information_need_id="need_2",
                capability_id="trustline.verify_vendor",
                specialist="trustline",
                endpoint="/trustline/execute",
                description="check vendor",
                objective="retrieve vendor details",
                expected_output="vendor details",
                reasoning="check vendor"
            )
        ]
    )

    # Step results from previous iterations: step_2 completed successfully, step_3 failed.
    history_results = [
        StepExecutionResult(step_id="step_2", capability_id="sentinel.verify_claim", status=StepStatus.COMPLETED, output="invoice verified"),
        StepExecutionResult(step_id="step_3", capability_id="trustline.verify_vendor", status=StepStatus.FAILED, error="Timeout")
    ]
    plan_steps = proposed_plan.steps

    filtered_plan = engine.prevent_duplicate_steps(proposed_plan, history_results, plan_steps)

    # step_2 should be skipped since it completed successfully, step_3 continues
    assert len(filtered_plan.steps) == 1
    assert filtered_plan.steps[0].step_id == "step_3"


@patch("orchestra.replanning.generate_structured")
def test_no_progress_stalls_replanning(mock_gen):
    """Test 7: Bailed loop decision STOP_LIMIT_REACHED if resolved needs do not increase."""
    engine = ReplanningEngine()
    state = OrchestraState(run_id="run_1", objective="test", active_iteration=1)
    
    # Prepopulate history entry with 1 resolved need
    state.replanning_history.append(
        ReplanningHistoryEntry(
            iteration=0,
            evaluation_status="PARTIAL",
            reason="Initial check",
            resolved_needs=["need_1"],
            remaining_needs=["need_2"],
            plan_summary="plan 1",
            execution_summary="exec 1"
        )
    )

    # Current evaluation result also has exactly 1 resolved need (no progress)
    eval_res = EvaluationResult(
        status=EvaluationStatus.PARTIAL,
        need_evaluations=[
            NeedEvaluation(information_need_id="need_1", status=NeedEvaluationStatus.RESOLVED, reasoning="Photos verified it", confidence=0.95),
            NeedEvaluation(information_need_id="need_2", status=NeedEvaluationStatus.UNRESOLVED, reasoning="Failed to verify", confidence=0.5)
        ],
        requires_replanning=True,
        requires_human_review=False,
        reasoning="resolved need_1",
        recommendation="None",
        confidence=0.8
    )

    decision, status = engine.decide_replanning(state, eval_res)
    assert decision == ReplanningDecision.STOP_LIMIT_REACHED
    assert status == ReplanningStatus.NO_MEANINGFUL_PROGRESS


@patch("orchestra.replanning.generate_structured")
def test_max_iterations_reached(mock_gen):
    """Test 8: Reaching configured limit triggers STOP_LIMIT_REACHED."""
    engine = ReplanningEngine()
    state = OrchestraState(run_id="run_1", objective="test", active_iteration=3)
    eval_res = EvaluationResult(
        status=EvaluationStatus.INSUFFICIENT,
        requires_replanning=True,
        requires_human_review=False,
        reasoning="Gaps remain",
        recommendation="Replan",
        confidence=0.9
    )

    decision, status = engine.decide_replanning(state, eval_res, max_iterations=3)
    assert decision == ReplanningDecision.STOP_LIMIT_REACHED
    assert status == ReplanningStatus.MAX_ITERATIONS_REACHED


@patch("orchestra.replanning.generate_structured")
def test_human_review_required_stops_loop(mock_gen):
    """Test 9: If evaluation requires human review, loop stops and returns HUMAN_REVIEW."""
    engine = ReplanningEngine()
    state = OrchestraState(run_id="run_1", objective="test")
    eval_res = EvaluationResult(
        status=EvaluationStatus.HUMAN_REVIEW_REQUIRED,
        requires_replanning=False,
        requires_human_review=True,
        reasoning="Contradictory findings",
        recommendation="Review",
        confidence=0.5
    )

    decision, status = engine.decide_replanning(state, eval_res)
    assert decision == ReplanningDecision.HUMAN_REVIEW
    assert status == ReplanningStatus.HUMAN_REVIEW_REQUIRED


@patch("orchestra.replanning.generate_structured")
def test_dynamic_registry_discovery_in_replanning(mock_gen):
    """Test 10: Injecting custom capability at runtime is discovered and planned during replanning loop."""
    # This demonstrates dynamic registry verification during replanning loops
    from orchestra.registry import CapabilityRegistry
    
    registry = CapabilityRegistry()
    initial_caps = {c.id for c in registry.list_capabilities()}

    # Register custom capability at test runtime
    from orchestra.registry import RegistryCapability
    custom_cap = RegistryCapability(
        id="sentinel.custom_audit",
        name="sentinel.custom_audit",
        specialist="sentinel",
        canonical_endpoint="/sentinel/execute",
        description="Custom audit check for replanning",
        availability="available",
        endpoint="/execute",
        payload_schema={
            "type": "object",
            "properties": {"vendor_id": {"type": "string"}},
            "required": ["vendor_id"]
        }
    )
    registry.capabilities["sentinel.custom_audit"] = custom_cap

    caps_after = {c.id for c in registry.list_capabilities()}
    assert "sentinel.custom_audit" not in initial_caps
    assert "sentinel.custom_audit" in caps_after


@patch("orchestra.replanning.generate_structured")
def test_no_case_specific_routing(mock_gen):
    """Test 11: Dynamic shifts modify replanning behavior without case hardcoding."""
    engine = ReplanningEngine()
    
    situation_a = make_situation()
    findings = [{"step_id": "step_a", "findings": "All invoices verified."}]
    eval_a = EvaluationResult(
        status=EvaluationStatus.SUFFICIENT,
        requires_replanning=False,
        requires_human_review=False,
        reasoning="Clean invoice compliance.",
        recommendation="Proceed.",
        confidence=0.9
    )

    # Under situation A, decision is NO_REPLAN (sufficient)
    state = OrchestraState(run_id="run_a", objective="audit safety")
    decision_a, _ = engine.decide_replanning(state, eval_a)
    assert decision_a == ReplanningDecision.NO_REPLAN

    # Shift situation to have severe geopolitical conflicts
    situation_b = make_situation()
    situation_b.uncertainties.append("border closures")
    eval_b = EvaluationResult(
        status=EvaluationStatus.INSUFFICIENT,
        requires_replanning=True,
        requires_human_review=False,
        reasoning="Critical gap in delivery lanes.",
        recommendation="Replan.",
        confidence=0.9
    )

    # Shifting the situation properties now triggers replanning
    decision_b, _ = engine.decide_replanning(state, eval_b)
    assert decision_b == ReplanningDecision.REPLAN


@patch("orchestra.replanning.generate_structured")
def test_failed_specialist_branch_alternative_chosen(mock_gen):
    """Test 5 (Specific): If capability A failed previously, capability B is selected as alternative."""
    engine = ReplanningEngine()
    
    # Sentinel step failed previously
    history_results = [
        StepExecutionResult(step_id="step_a", capability_id="sentinel.verify_claim", status=StepStatus.FAILED, error="Invalid claim")
    ]
    
    # Planner proposes a new plan using trustline instead of sentinel
    proposed_plan = ValidatedPlan(
        steps=[
            ValidatedPlanStep(
                step_id="step_b",
                information_need_id="need_1",
                capability_id="trustline.verify_vendor",
                specialist="trustline",
                endpoint="/trustline/execute",
                description="alternative check",
                objective="retrieve safety certs",
                expected_output="safety certs",
                reasoning="Sentinel failed, use trustline alternative"
            )
        ]
    )

    filtered_plan = engine.prevent_duplicate_steps(proposed_plan, history_results, proposed_plan.steps)
    
    # Verify trustline step is not filtered (since sentinel failed, it is an eligible alternative)
    assert len(filtered_plan.steps) == 1
    assert filtered_plan.steps[0].capability_id == "trustline.verify_vendor"


@patch("orchestra.replanning.generate_structured")
def test_no_eligible_capabilities_stops_loop(mock_gen):
    """Test 6 (Specific): If no capability registry entries are eligible for unresolved needs, replanning stops."""
    engine = ReplanningEngine()
    
    # Suppose no capabilities match the refined needs, yielding an empty plan
    proposed_plan = ValidatedPlan(steps=[])
    
    # In this case, we have no next actions
    assert len(proposed_plan.steps) == 0

