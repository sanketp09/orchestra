import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add project root to sys.path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

import pytest

from orchestra.situation import SituationContext
from orchestra.planner import InformationNeed, ValidatedPlan, ValidatedPlanStep
from orchestra.execution import PlanExecutionResult, StepExecutionResult, StepStatus, ProvenanceRecord, StepBlockReason
from orchestra.evaluation import (
    EvaluationEngine,
    EvaluationStatus,
    NeedEvaluationStatus,
    EvaluationResult
)


# ============================================================================
# Helpers to build test fixtures
# ============================================================================

def make_situation():
    return SituationContext(
        objective="Assess procurement logistics and vendor reliability",
        requested_outcome="sufficiency report",
        entities=["prj_resort", "vendor_steel"],
        known_facts=["PO issued for steel beams"],
        uncertainties=["delivery date uncertainty"],
        information_gaps=["actual delivery status"]
    )


# ============================================================================
# Level A Unit Tests
# ============================================================================

@patch("orchestra.evaluation.generate_structured")
def test_all_high_priority_needs_resolved(mock_gen):
    """Test 1: All high-priority needs resolved -> SUFFICIENT, requires_replanning = False."""
    situation = make_situation()
    needs = [
        InformationNeed(
            need_id="need_1",
            description="Verify steel beam delivery date",
            priority="high",
            source_context="po details"
        )
    ]
    plan = ValidatedPlan(
        steps=[
            ValidatedPlanStep(
                step_id="step_1",
                information_need_id="need_1",
                capability_id="sentinel.verify_claim",
                specialist="sentinel",
                endpoint="/sentinel/execute",
                description="check PO delivery date",
                objective="retrieve delivery date",
                expected_output="date verified",
                reasoning="critical check"
            )
        ]
    )
    execution = PlanExecutionResult(
        status="completed",
        step_results=[
            StepExecutionResult(
                step_id="step_1",
                capability_id="sentinel.verify_claim",
                status=StepStatus.COMPLETED,
                output="Steel beams delivered on 2026-08-15.",
                output_provenance=[
                    ProvenanceRecord(source_type="case_record", origin="verified_public")
                ]
            )
        ]
    )

    mock_gen.return_value = {
        "status": "SUFFICIENT",
        "need_evaluations": [
            {
                "information_need_id": "need_1",
                "status": "RESOLVED",
                "reasoning": "Output shows steel beams delivered.",
                "supporting_step_ids": ["step_1"],
                "confidence": 0.95
            }
        ],
        "resolved_information": ["steel beams delivered"],
        "unresolved_information": [],
        "remaining_uncertainties": [],
        "remaining_information_gaps": [],
        "requires_replanning": False,
        "requires_human_review": False,
        "reasoning": "Objective met successfully.",
        "recommendation": "Proceed.",
        "confidence": 0.95
    }

    engine = EvaluationEngine()
    res = engine.evaluate(situation, needs, plan, execution)

    assert res.status == EvaluationStatus.SUFFICIENT
    assert res.requires_replanning is False
    assert res.requires_human_review is False
    assert len(res.need_evaluations) == 1
    assert res.need_evaluations[0].status == NeedEvaluationStatus.RESOLVED


@patch("orchestra.evaluation.generate_structured")
def test_high_priority_need_unresolved_overrides_to_insufficiency(mock_gen):
    """Test 2: A high-priority need unresolved -> requires_replanning = True, status is INSUFFICIENT."""
    situation = make_situation()
    needs = [
        InformationNeed(
            need_id="need_1",
            description="Verify steel beam delivery date",
            priority="high",
            source_context="po details"
        )
    ]
    plan = ValidatedPlan(
        steps=[
            ValidatedPlanStep(
                step_id="step_1",
                information_need_id="need_1",
                capability_id="sentinel.verify_claim",
                specialist="sentinel",
                endpoint="/sentinel/execute",
                description="check PO delivery date",
                objective="retrieve delivery date",
                expected_output="date verified",
                reasoning="critical check"
            )
        ]
    )
    # Execution failed
    execution = PlanExecutionResult(
        status="partial",
        step_results=[
            StepExecutionResult(
                step_id="step_1",
                capability_id="sentinel.verify_claim",
                status=StepStatus.FAILED,
                error="Service timeout"
            )
        ]
    )

    # Even if LLM proposed success or requires_replanning=False, the override must persist it as unresolved
    mock_gen.return_value = {
        "status": "INSUFFICIENT",
        "need_evaluations": [
            {
                "information_need_id": "need_1",
                "status": "RESOLVED",  # Attempted override by LLM
                "reasoning": "Falsely claiming resolved.",
                "supporting_step_ids": [],
                "confidence": 0.9
            }
        ],
        "resolved_information": [],
        "unresolved_information": ["delivery date"],
        "remaining_uncertainties": ["actual delivery date"],
        "remaining_information_gaps": [],
        "requires_replanning": False,  # Attempted override by LLM
        "requires_human_review": False,
        "reasoning": "Attempting completion.",
        "recommendation": "Proceed.",
        "confidence": 0.8
    }

    engine = EvaluationEngine()
    res = engine.evaluate(situation, needs, plan, execution)

    assert res.status == EvaluationStatus.INSUFFICIENT
    assert res.requires_replanning is True
    assert res.need_evaluations[0].status == NeedEvaluationStatus.UNRESOLVED
    assert "DETERMINISTIC OVERRIDE" in res.need_evaluations[0].reasoning


@patch("orchestra.evaluation.generate_structured")
def test_low_priority_need_unresolved(mock_gen):
    """Test 3: Low-priority unresolved need while high-priority is resolved -> SUFFICIENT/PARTIAL."""
    situation = make_situation()
    needs = [
        InformationNeed(
            need_id="need_1",
            description="Verify steel beam delivery date",
            priority="high",
            source_context="po details"
        ),
        InformationNeed(
            need_id="need_2",
            description="Verify weather status",
            priority="low",
            source_context="weather"
        )
    ]
    plan = ValidatedPlan(
        steps=[
            ValidatedPlanStep(
                step_id="step_1",
                information_need_id="need_1",
                capability_id="sentinel.verify_claim",
                specialist="sentinel",
                endpoint="/sentinel/execute",
                description="check PO delivery date",
                objective="retrieve delivery date",
                expected_output="date verified",
                reasoning="critical check"
            ),
            ValidatedPlanStep(
                step_id="step_2",
                information_need_id="need_2",
                capability_id="atlas.external_event",
                specialist="atlas",
                endpoint="/atlas/execute",
                description="check weather",
                objective="weather events",
                expected_output="weather report",
                reasoning="nice to have"
            )
        ]
    )
    execution = PlanExecutionResult(
        status="partial",
        step_results=[
            StepExecutionResult(
                step_id="step_1",
                capability_id="sentinel.verify_claim",
                status=StepStatus.COMPLETED,
                output="Steel beams delivered.",
                output_provenance=[ProvenanceRecord(source_type="case_record", origin="verified_public")]
            ),
            StepExecutionResult(
                step_id="step_2",
                capability_id="atlas.external_event",
                status=StepStatus.FAILED,
                error="Provider offline"
            )
        ]
    )

    mock_gen.return_value = {
        "status": "SUFFICIENT",
        "need_evaluations": [
            {
                "information_need_id": "need_1",
                "status": "RESOLVED",
                "reasoning": "High-priority resolved.",
                "supporting_step_ids": ["step_1"],
                "confidence": 0.95
            },
            {
                "information_need_id": "need_2",
                "status": "UNRESOLVED",
                "reasoning": "Weather report failed.",
                "supporting_step_ids": [],
                "confidence": 0.9
            }
        ],
        "resolved_information": ["steel beams delivered"],
        "unresolved_information": ["weather"],
        "remaining_uncertainties": ["weather events"],
        "remaining_information_gaps": [],
        "requires_replanning": False,
        "requires_human_review": False,
        "reasoning": "Critical objectives met; weather is minor.",
        "recommendation": "Proceed.",
        "confidence": 0.9
    }

    engine = EvaluationEngine()
    res = engine.evaluate(situation, needs, plan, execution)

    # Low priority failure does not force insufficiency
    assert res.status in [EvaluationStatus.SUFFICIENT, EvaluationStatus.PARTIAL]
    assert res.requires_replanning is False


@patch("orchestra.evaluation.generate_structured")
def test_alternative_step_succeeds(mock_gen):
    """Test 4: One step fails but sibling step successfully resolves the need."""
    situation = make_situation()
    needs = [
        InformationNeed(
            need_id="need_1",
            description="Verify steel beam delivery",
            priority="high",
            source_context="delivery status"
        )
    ]
    # Two steps planned to resolve need_1
    plan = ValidatedPlan(
        steps=[
            ValidatedPlanStep(
                step_id="step_1a",
                information_need_id="need_1",
                capability_id="sentinel.verify_claim",
                specialist="sentinel",
                endpoint="/sentinel/execute",
                description="Check invoice",
                objective="retrieve delivery info",
                expected_output="delivery info",
                reasoning="check delivery"
            ),
            ValidatedPlanStep(
                step_id="step_1b",
                information_need_id="need_1",
                capability_id="trustline.verify_vendor",
                specialist="trustline",
                endpoint="/trustline/execute",
                description="Check delivery photos",
                objective="retrieve photos",
                expected_output="photos",
                reasoning="check delivery photos"
            )
        ]
    )
    # One fails, one succeeds
    execution = PlanExecutionResult(
        status="partial",
        step_results=[
            StepExecutionResult(
                step_id="step_1a",
                capability_id="sentinel.verify_claim",
                status=StepStatus.FAILED,
                error="Service unavailable"
            ),
            StepExecutionResult(
                step_id="step_1b",
                capability_id="trustline.verify_vendor",
                status=StepStatus.COMPLETED,
                output="Photos confirm delivery on site.",
                output_provenance=[ProvenanceRecord(source_type="case_record", origin="verified_public")]
            )
        ]
    )

    mock_gen.return_value = {
        "status": "SUFFICIENT",
        "need_evaluations": [
            {
                "information_need_id": "need_1",
                "status": "RESOLVED",
                "reasoning": "Step 1b successfully resolved delivery question.",
                "supporting_step_ids": ["step_1b"],
                "confidence": 0.95
            }
        ],
        "resolved_information": ["delivery confirmed by photo evidence"],
        "unresolved_information": [],
        "remaining_uncertainties": [],
        "remaining_information_gaps": [],
        "requires_replanning": False,
        "requires_human_review": False,
        "reasoning": "Alternative step succeeded.",
        "recommendation": "Proceed.",
        "confidence": 0.95
    }

    engine = EvaluationEngine()
    res = engine.evaluate(situation, needs, plan, execution)

    assert res.status == EvaluationStatus.SUFFICIENT
    assert res.need_evaluations[0].status == NeedEvaluationStatus.RESOLVED
    assert res.requires_replanning is False


@patch("orchestra.evaluation.generate_structured")
def test_failed_dependency_blocker_identification(mock_gen):
    """Test 5: Blocked steps correctly trace back to their root failed dependency."""
    situation = make_situation()
    needs = [
        InformationNeed(
            need_id="need_1",
            description="Verify steel beam delivery",
            priority="high",
            source_context="po check"
        )
    ]
    # Chain: step_1 (failed) -> step_2 (blocked) -> step_3 (blocked)
    plan = ValidatedPlan(
        steps=[
            ValidatedPlanStep(
                step_id="step_1",
                information_need_id="need_1",
                capability_id="sentinel.verify_claim",
                specialist="sentinel",
                endpoint="/sentinel/execute",
                description="Get delivery invoice",
                objective="retrieve invoice",
                expected_output="invoice",
                reasoning="check invoice"
            ),
            ValidatedPlanStep(
                step_id="step_2",
                information_need_id="need_1",
                capability_id="trustline.verify_vendor",
                specialist="trustline",
                endpoint="/trustline/execute",
                description="Process payment check",
                objective="verify payment",
                expected_output="payment status",
                reasoning="audit payments",
                depends_on=["step_1"]
            ),
            ValidatedPlanStep(
                step_id="step_3",
                information_need_id="need_1",
                capability_id="arbiter.analyze_dispute",
                specialist="arbiter",
                endpoint="/arbiter/execute",
                description="Check legal dispute",
                objective="dispute checks",
                expected_output="dispute status",
                reasoning="audit disputes",
                depends_on=["step_2"]
            )
        ]
    )
    execution = PlanExecutionResult(
        status="failed",
        step_results=[
            StepExecutionResult(
                step_id="step_1",
                capability_id="sentinel.verify_claim",
                status=StepStatus.FAILED,
                error="DB crash"
            ),
            StepExecutionResult(
                step_id="step_2",
                capability_id="trustline.verify_vendor",
                status=StepStatus.BLOCKED,
                blocked_reason=StepBlockReason.FAILED_DEPENDENCY
            ),
            StepExecutionResult(
                step_id="step_3",
                capability_id="arbiter.analyze_dispute",
                status=StepStatus.BLOCKED,
                blocked_reason=StepBlockReason.BLOCKED_DEPENDENCY
            )
        ]
    )

    mock_gen.return_value = {
        "status": "INSUFFICIENT",
        "need_evaluations": [
            {
                "information_need_id": "need_1",
                "status": "UNRESOLVED",
                "reasoning": "Root step failed.",
                "supporting_step_ids": [],
                "confidence": 0.95
            }
        ],
        "resolved_information": [],
        "unresolved_information": ["dispute and invoice"],
        "remaining_uncertainties": ["invoice status"],
        "remaining_information_gaps": [],
        "requires_replanning": True,
        "requires_human_review": False,
        "reasoning": "Blocked chain.",
        "recommendation": "Replan.",
        "confidence": 0.95
    }

    engine = EvaluationEngine()
    res = engine.evaluate(situation, needs, plan, execution)

    assert "step_1" in res.material_failures
    assert "step_1" in res.material_blockers  # step_3 and step_2 trace back to step_1
    assert res.requires_replanning is True


@patch("orchestra.evaluation.generate_structured")
def test_independent_branch_failure(mock_gen):
    """Test 6: Independent branch failure does not block unrelated high-priority paths."""
    situation = make_situation()
    needs = [
        InformationNeed(
            need_id="need_high",
            description="Verify critical safety compliance",
            priority="high",
            source_context="safety"
        ),
        InformationNeed(
            need_id="need_low",
            description="Verify carbon footprint score",
            priority="low",
            source_context="sustainability"
        )
    ]
    # step_1 (high-priority, completed)
    # step_2 (low-priority, failed)
    plan = ValidatedPlan(
        steps=[
            ValidatedPlanStep(
                step_id="step_1",
                information_need_id="need_high",
                capability_id="sentinel.verify_claim",
                specialist="sentinel",
                endpoint="/sentinel/execute",
                description="check safety certs",
                objective="retrieve safety certs",
                expected_output="certs details",
                reasoning="mandatory compliance check"
            ),
            ValidatedPlanStep(
                step_id="step_2",
                information_need_id="need_low",
                capability_id="atlas.commodity",
                specialist="atlas",
                endpoint="/atlas/execute",
                description="check carbon score",
                objective="retrieve carbon score",
                expected_output="score info",
                reasoning="optional sustainability check"
            )
        ]
    )
    execution = PlanExecutionResult(
        status="partial",
        step_results=[
            StepExecutionResult(
                step_id="step_1",
                capability_id="sentinel.verify_claim",
                status=StepStatus.COMPLETED,
                output="All safety certifications are current and compliant.",
                output_provenance=[ProvenanceRecord(source_type="case_record", origin="verified_public")]
            ),
            StepExecutionResult(
                step_id="step_2",
                capability_id="atlas.commodity",
                status=StepStatus.FAILED,
                error="Carbon index service returned 503"
            )
        ]
    )

    mock_gen.return_value = {
        "status": "SUFFICIENT",
        "need_evaluations": [
            {
                "information_need_id": "need_high",
                "status": "RESOLVED",
                "reasoning": "Safety verified.",
                "supporting_step_ids": ["step_1"],
                "confidence": 0.98
            },
            {
                "information_need_id": "need_low",
                "status": "UNRESOLVED",
                "reasoning": "Sustainability search failed.",
                "supporting_step_ids": [],
                "confidence": 0.9
            }
        ],
        "resolved_information": ["safety certifications verified"],
        "unresolved_information": ["carbon score"],
        "remaining_uncertainties": [],
        "remaining_information_gaps": ["carbon score Gap"],
        "requires_replanning": False,
        "requires_human_review": False,
        "reasoning": "High priority safety checks passed. Sustainability failed but is non-blocking.",
        "recommendation": "Proceed with purchase.",
        "confidence": 0.95
    }

    engine = EvaluationEngine()
    res = engine.evaluate(situation, needs, plan, execution)

    assert res.status in [EvaluationStatus.SUFFICIENT, EvaluationStatus.PARTIAL]
    assert res.requires_replanning is False
    assert "step_2" not in res.material_failures  # step_2 is low priority, not material failure


@patch("orchestra.evaluation.generate_structured")
def test_conflicting_specialist_results(mock_gen):
    """Test 7: Conflicting outputs triggers HUMAN_REVIEW_REQUIRED status."""
    situation = make_situation()
    needs = [
        InformationNeed(
            need_id="need_1",
            description="Verify invoice duplicates",
            priority="high",
            source_context="billing check"
        )
    ]
    plan = ValidatedPlan(
        steps=[
            ValidatedPlanStep(
                step_id="step_1a",
                information_need_id="need_1",
                capability_id="sentinel.verify_claim",
                specialist="sentinel",
                endpoint="/sentinel/execute",
                description="Sentinel duplicate invoice check",
                objective="detect duplicates",
                expected_output="duplicates report",
                reasoning="check billing"
            ),
            ValidatedPlanStep(
                step_id="step_1b",
                information_need_id="need_1",
                capability_id="trustline.verify_vendor",
                specialist="trustline",
                endpoint="/trustline/execute",
                description="Trustline vendor billing check",
                objective="audit invoice list",
                expected_output="audit status",
                reasoning="double check billing"
            )
        ]
    )
    # Execution returns conflicting text results
    execution = PlanExecutionResult(
        status="completed",
        step_results=[
            StepExecutionResult(
                step_id="step_1a",
                capability_id="sentinel.verify_claim",
                status=StepStatus.COMPLETED,
                output="Duplicate found: INV-001 matches INV-002",
                output_provenance=[ProvenanceRecord(source_type="case_record", origin="verified_public")]
            ),
            StepExecutionResult(
                step_id="step_1b",
                capability_id="trustline.verify_vendor",
                status=StepStatus.COMPLETED,
                output="No duplicate detected on billing system.",
                output_provenance=[ProvenanceRecord(source_type="case_record", origin="verified_public")]
            )
        ]
    )

    mock_gen.return_value = {
        "status": "HUMAN_REVIEW_REQUIRED",
        "need_evaluations": [
            {
                "information_need_id": "need_1",
                "status": "RESOLVED",
                "reasoning": "Duplicate checks completed.",
                "supporting_step_ids": ["step_1a", "step_1b"],
                "confidence": 0.7
            }
        ],
        "resolved_information": ["Billing audited"],
        "unresolved_information": [],
        "remaining_uncertainties": ["duplicate contradiction"],
        "remaining_information_gaps": [],
        "requires_replanning": False,
        "requires_human_review": True,  # Triggers review
        "reasoning": "Outputs contradict.",
        "recommendation": "Review manually.",
        "confidence": 0.6
    }

    engine = EvaluationEngine()
    res = engine.evaluate(situation, needs, plan, execution)

    assert res.status == EvaluationStatus.HUMAN_REVIEW_REQUIRED
    assert res.requires_human_review is True


@patch("orchestra.evaluation.generate_structured")
def test_provenance_preservation(mock_gen):
    """Test 8: Ensure reasoning claims respect provenance levels and are safeguarded from upgrading."""
    situation = make_situation()
    needs = [
        InformationNeed(
            need_id="need_1",
            description="Verify vendor license status",
            priority="high",
            source_context="vendor verification"
        )
    ]
    plan = ValidatedPlan(
        steps=[
            ValidatedPlanStep(
                step_id="step_1",
                information_need_id="need_1",
                capability_id="trustline.verify_vendor",
                specialist="trustline",
                endpoint="/trustline/execute",
                description="Retrieve vendor registration",
                objective="retrieve registration details",
                expected_output="registration details",
                reasoning="compliance check"
            )
        ]
    )
    # Output provenance is synthetic_augmented (augmented, not verified public)
    execution = PlanExecutionResult(
        status="completed",
        step_results=[
            StepExecutionResult(
                step_id="step_1",
                capability_id="trustline.verify_vendor",
                status=StepStatus.COMPLETED,
                output="Vendor registered on synthetic registry index.",
                output_provenance=[
                    ProvenanceRecord(source_type="case_record", origin="synthetic_augmented")
                ]
            )
        ]
    )

    # LLM makes the mistake of calling it "verified public"
    mock_gen.return_value = {
        "status": "SUFFICIENT",
        "need_evaluations": [
            {
                "information_need_id": "need_1",
                "status": "RESOLVED",
                "reasoning": "Vendor license has been confirmed by verified public records.",
                "supporting_step_ids": ["step_1"],
                "confidence": 0.95
            }
        ],
        "resolved_information": ["license verified"],
        "unresolved_information": [],
        "remaining_uncertainties": [],
        "remaining_information_gaps": [],
        "requires_replanning": False,
        "requires_human_review": False,
        "reasoning": "Compliance resolved.",
        "recommendation": "Proceed.",
        "confidence": 0.95
    }

    engine = EvaluationEngine()
    res = engine.evaluate(situation, needs, plan, execution)

    # Override should replace "verified public" with "synthetic/derived" in the reasoning
    assert "verified public" not in res.need_evaluations[0].reasoning
    assert "synthetic/derived" in res.need_evaluations[0].reasoning


@patch("orchestra.evaluation.generate_structured")
def test_dynamic_behavior(mock_gen):
    """Test 9: Changes to objectives or needs dynamically modify evaluations without code edits."""
    engine = EvaluationEngine()

    situation = make_situation()
    needs_a = [
        InformationNeed(
            need_id="need_a",
            description="Verify steel beam delivery date",
            priority="high",
            source_context="po check"
        )
    ]
    plan_a = ValidatedPlan(
        steps=[
            ValidatedPlanStep(
                step_id="step_a",
                information_need_id="need_a",
                capability_id="sentinel.verify_claim",
                specialist="sentinel",
                endpoint="/sentinel/execute",
                description="PO details check",
                objective="retrieve PO date",
                expected_output="PO date info",
                reasoning="critical validation"
            )
        ]
    )
    execution_a = PlanExecutionResult(
        status="completed",
        step_results=[
            StepExecutionResult(
                step_id="step_a",
                capability_id="sentinel.verify_claim",
                status=StepStatus.COMPLETED,
                output="Delivered.",
                output_provenance=[ProvenanceRecord(source_type="case_record", origin="verified_public")]
            )
        ]
    )

    mock_gen.return_value = {
        "status": "SUFFICIENT",
        "need_evaluations": [
            {
                "information_need_id": "need_a",
                "status": "RESOLVED",
                "reasoning": "Date verified.",
                "supporting_step_ids": ["step_a"],
                "confidence": 0.95
            }
        ],
        "resolved_information": ["delivery date verified"],
        "unresolved_information": [],
        "remaining_uncertainties": [],
        "remaining_information_gaps": [],
        "requires_replanning": False,
        "requires_human_review": False,
        "reasoning": "Sufficient details collected.",
        "recommendation": "Proceed.",
        "confidence": 0.95
    }

    res_a = engine.evaluate(situation, needs_a, plan_a, execution_a)
    assert res_a.status == EvaluationStatus.SUFFICIENT
    assert res_a.requires_replanning is False

    # Now change needs to have an unresolved high priority gap
    needs_b = [
        InformationNeed(
            need_id="need_a",
            description="Verify steel beam delivery date",
            priority="high",
            source_context="po check"
        ),
        InformationNeed(
            need_id="need_critical",
            description="Verify geo risks",
            priority="high",
            source_context="geopolitical risks"
        )
    ]
    # No step planned for need_critical
    mock_gen.return_value = {
        "status": "INSUFFICIENT",
        "need_evaluations": [
            {
                "information_need_id": "need_a",
                "status": "RESOLVED",
                "reasoning": "Date verified.",
                "supporting_step_ids": ["step_a"],
                "confidence": 0.95
            },
            {
                "information_need_id": "need_critical",
                "status": "NOT_EXECUTED",
                "reasoning": "No steps executed.",
                "supporting_step_ids": [],
                "confidence": 0.5
            }
        ],
        "resolved_information": ["delivery date verified"],
        "unresolved_information": ["geo risks"],
        "remaining_uncertainties": [],
        "remaining_information_gaps": ["geo risks"],
        "requires_replanning": True,
        "requires_human_review": False,
        "reasoning": "Geopolitical risks not checked.",
        "recommendation": "Replan.",
        "confidence": 0.9
    }

    res_b = engine.evaluate(situation, needs_b, plan_a, execution_a)
    # Shifting needs dynamically updates final evaluation to require replanning
    assert res_b.requires_replanning is True
    assert res_b.status == EvaluationStatus.INSUFFICIENT
