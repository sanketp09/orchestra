import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add project root to sys.path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

import pytest

from orchestra.situation import SituationContext
from orchestra.planner import InformationNeed
from orchestra.execution import PlanExecutionResult, StepExecutionResult, StepStatus, ProvenanceRecord
from orchestra.evaluation import EvaluationResult, EvaluationStatus, NeedEvaluation, NeedEvaluationStatus
from orchestra.replanning import ReplanningHistoryEntry
from orchestra.outcome import (
    FinalSynthesizer,
    OutcomeStatus,
    DecisionRecommendation,
    IOutcomeRecorder,
    OutcomeRecord,
    FinalOutcome,
    HumanReviewRequest,
    UnresolvedIssue
)


# ============================================================================
# Persistence Mock Implementation
# ============================================================================

class InMemoryOutcomeRecorder(IOutcomeRecorder):
    def __init__(self):
        self.records = []

    def record_outcome(self, record: OutcomeRecord) -> bool:
        self.records.append(record)
        return True


# ============================================================================
# Helpers
# ============================================================================

def make_situation():
    return SituationContext(
        objective="Verify safety timeline for steel beams",
        requested_outcome="sufficiency synthesis",
        entities=["prj_1", "vendor_a"],
        known_facts=["invoice INV-001 received"],
        uncertainties=["actual delivery status"],
        information_gaps=["delivery details gap"]
    )


# ============================================================================
# Unit Tests
# ============================================================================

@patch("orchestra.outcome.generate_structured")
def test_sufficient_evaluation_generates_outcome(mock_gen):
    """Test 1: Sufficient evaluation creates FinalOutcome with PROCEED recommendation."""
    synthesizer = FinalSynthesizer()
    situation = make_situation()
    needs = [
        InformationNeed(need_id="need_1", description="Verify delivery", priority="high", source_context="invoice")
    ]
    exec_res = PlanExecutionResult(
        status="completed",
        step_results=[
            StepExecutionResult(
                step_id="step_1",
                capability_id="sentinel.verify_claim",
                status=StepStatus.COMPLETED,
                output="Steel delivered on 2026-08-15.",
                output_provenance=[ProvenanceRecord(source_type="case_record", origin="verified_public")]
            )
        ]
    )
    eval_res = EvaluationResult(
        status=EvaluationStatus.SUFFICIENT,
        need_evaluations=[
            NeedEvaluation(information_need_id="need_1", status=NeedEvaluationStatus.RESOLVED, reasoning="Verified date.", confidence=0.95)
        ],
        requires_replanning=False,
        requires_human_review=False,
        reasoning="All requirements met.",
        recommendation="Proceed.",
        confidence=0.95
    )

    mock_gen.return_value = {
        "status": "SUFFICIENT",
        "executive_summary": "Invoices and delivery confirm steel beam receipt.",
        "recommendation": "PROCEED",
        "confidence": 0.95,
        "supporting_evidence": [
            {
                "description": "Delivery confirmed by invoice.",
                "source_step_id": "step_1",
                "provenance_origins": ["verified_public"],
                "fact_statement": "Delivered on 2026-08-15."
            }
        ],
        "key_findings": ["Delivery occurred on schedule"],
        "unresolved_issues": [],
        "material_uncertainties": [],
        "provenance_summary": {"verified_public": 1},
        "human_review_required": False,
        "replanning_history_summary": "No replanning iterations executed."
    }

    outcome = synthesizer.synthesize(situation, needs, exec_res, eval_res, [])
    
    assert outcome.status == OutcomeStatus.SUFFICIENT
    assert outcome.recommendation == DecisionRecommendation.PROCEED
    assert outcome.confidence == 0.95
    assert len(outcome.supporting_evidence) == 1
    assert outcome.supporting_evidence[0].source_step_id == "step_1"


@patch("orchestra.outcome.generate_structured")
def test_unresolved_low_priority_issues(mock_gen):
    """Test 2: Outstanding low-priority issue cataloged, status is PARTIAL_SUCCESS but recommendation is PROCEED."""
    synthesizer = FinalSynthesizer()
    situation = make_situation()
    needs = [
        InformationNeed(need_id="need_1", description="Verify delivery", priority="high", source_context="invoice"),
        InformationNeed(need_id="need_2", description="Verify weather", priority="low", source_context="weather")
    ]
    exec_res = PlanExecutionResult(
        status="completed",
        step_results=[
            StepExecutionResult(
                step_id="step_1",
                capability_id="sentinel.verify_claim",
                status=StepStatus.COMPLETED,
                output="Steel delivered.",
                output_provenance=[ProvenanceRecord(source_type="case_record", origin="verified_public")]
            ),
            StepExecutionResult(
                step_id="step_2",
                capability_id="atlas.external_event",
                status=StepStatus.FAILED,
                error="Service timeout"
            )
        ]
    )
    eval_res = EvaluationResult(
        status=EvaluationStatus.PARTIAL,
        need_evaluations=[
            NeedEvaluation(information_need_id="need_1", status=NeedEvaluationStatus.RESOLVED, reasoning="Verified date.", confidence=0.95),
            NeedEvaluation(information_need_id="need_2", status=NeedEvaluationStatus.UNRESOLVED, reasoning="Failed to verify weather.", confidence=0.5)
        ],
        requires_replanning=False,
        requires_human_review=False,
        reasoning="High priority met, low priority failed.",
        recommendation="Proceed.",
        confidence=0.9
    )

    mock_gen.return_value = {
        "status": "PARTIAL_SUCCESS",
        "executive_summary": "Delivery safety verified. Weather remains unconfirmed.",
        "recommendation": "PROCEED",
        "confidence": 0.9,
        "supporting_evidence": [
            {
                "description": "Delivery confirmed by invoice.",
                "source_step_id": "step_1",
                "provenance_origins": ["verified_public"],
                "fact_statement": "Delivered."
            }
        ],
        "key_findings": ["Delivery occurred"],
        "unresolved_issues": [
            {
                "need_id": "need_2",
                "description": "Verify weather delays",
                "reason": "Failed execution"
            }
        ],
        "material_uncertainties": ["Weather context unverified"],
        "provenance_summary": {"verified_public": 1},
        "human_review_required": False,
        "replanning_history_summary": "No replanning iterations executed."
    }

    outcome = synthesizer.synthesize(situation, needs, exec_res, eval_res, [])
    
    assert outcome.status == OutcomeStatus.PARTIAL_SUCCESS
    assert outcome.recommendation == DecisionRecommendation.PROCEED
    assert len(outcome.unresolved_issues) == 1
    assert outcome.unresolved_issues[0].need_id == "need_2"


@patch("orchestra.outcome.generate_structured")
def test_human_review_escalation(mock_gen):
    """Test 3: Human review evaluation triggers a detailed HumanReviewRequest override."""
    synthesizer = FinalSynthesizer()
    situation = make_situation()
    needs = [
        InformationNeed(need_id="need_1", description="Verify delivery", priority="high", source_context="invoice")
    ]
    exec_res = PlanExecutionResult(
        status="failed",
        step_results=[
            StepExecutionResult(
                step_id="step_1",
                capability_id="sentinel.verify_claim",
                status=StepStatus.FAILED,
                error="Service crash"
            )
        ]
    )
    eval_res = EvaluationResult(
        status=EvaluationStatus.HUMAN_REVIEW_REQUIRED,
        need_evaluations=[
            NeedEvaluation(information_need_id="need_1", status=NeedEvaluationStatus.UNRESOLVED, reasoning="Step failed.", confidence=0.5)
        ],
        requires_replanning=False,
        requires_human_review=True,
        reasoning="Critical information checks crashed.",
        recommendation="Escalate.",
        confidence=0.5
    )

    mock_gen.return_value = {
        "status": "HUMAN_REVIEW_REQUIRED",
        "executive_summary": "Escalation requested.",
        "recommendation": "HUMAN_REVIEW_REQUIRED",
        "confidence": 0.5,
        "supporting_evidence": [],
        "key_findings": [],
        "unresolved_issues": [
            {"need_id": "need_1", "description": "Verify delivery", "reason": "Step execution failed"}
        ],
        "material_uncertainties": ["Delivery date status"],
        "provenance_summary": {},
        "human_review_required": True,
        "human_review_request": {
            "reason": "Specialist service crashed during delivery check.",
            "decision_critical_issues": [
                {"need_id": "need_1", "description": "Verify delivery", "reason": "Step execution failed"}
            ],
            "conflicting_evidence": [],
            "recommended_questions": ["Verify vendor details manually."],
            "preliminary_recommendation": "HOLD",
            "confidence": 0.5
        },
        "replanning_history_summary": "No replanning iterations executed."
    }

    outcome = synthesizer.synthesize(situation, needs, exec_res, eval_res, [])
    
    assert outcome.status == OutcomeStatus.HUMAN_REVIEW_REQUIRED
    assert outcome.recommendation == DecisionRecommendation.HUMAN_REVIEW_REQUIRED
    assert outcome.human_review_required is True
    assert outcome.human_review_request is not None
    assert "crashed" in outcome.human_review_request.reason


@patch("orchestra.outcome.generate_structured")
def test_conflicting_specialist_conclusions(mock_gen):
    """Test 4: Contradictory specialist results are highlighted in conflicting evidence."""
    synthesizer = FinalSynthesizer()
    situation = make_situation()
    needs = [
        InformationNeed(need_id="need_1", description="Verify delivery", priority="high", source_context="invoice")
    ]
    exec_res = PlanExecutionResult(
        status="completed",
        step_results=[
            StepExecutionResult(
                step_id="step_1a",
                capability_id="sentinel.verify_claim",
                status=StepStatus.COMPLETED,
                output="Steel beams delivered.",
                output_provenance=[ProvenanceRecord(source_type="case_record", origin="verified_public")]
            ),
            StepExecutionResult(
                step_id="step_1b",
                capability_id="trustline.verify_vendor",
                status=StepStatus.COMPLETED,
                output="No record of delivery.",
                output_provenance=[ProvenanceRecord(source_type="case_record", origin="verified_public")]
            )
        ]
    )
    eval_res = EvaluationResult(
        status=EvaluationStatus.HUMAN_REVIEW_REQUIRED,
        need_evaluations=[
            NeedEvaluation(information_need_id="need_1", status=NeedEvaluationStatus.RESOLVED, reasoning="Conflicting results.", confidence=0.5)
        ],
        requires_replanning=False,
        requires_human_review=True,
        reasoning="Contradictory findings from sentinel and trustline.",
        recommendation="Escalate.",
        confidence=0.5
    )

    mock_gen.return_value = {
        "status": "HUMAN_REVIEW_REQUIRED",
        "executive_summary": "Escalation due to conflicting outputs.",
        "recommendation": "HUMAN_REVIEW_REQUIRED",
        "confidence": 0.5,
        "supporting_evidence": [
            {
                "description": "Sentinel confirms receipt.",
                "source_step_id": "step_1a",
                "provenance_origins": ["verified_public"],
                "fact_statement": "Steel beams delivered."
            },
            {
                "description": "Trustline reports no record.",
                "source_step_id": "step_1b",
                "provenance_origins": ["verified_public"],
                "fact_statement": "No record of delivery."
            }
        ],
        "key_findings": [],
        "unresolved_issues": [],
        "material_uncertainties": ["Contradictory delivery status"],
        "provenance_summary": {"verified_public": 2},
        "human_review_required": True,
        "human_review_request": {
            "reason": "Specialists returned contradictory outcomes.",
            "decision_critical_issues": [],
            "conflicting_evidence": ["Sentinel claims delivered, Trustline claims unverified."],
            "recommended_questions": ["Manually review delivery photos."],
            "preliminary_recommendation": "HOLD",
            "confidence": 0.5
        },
        "replanning_history_summary": "No replanning iterations executed."
    }

    outcome = synthesizer.synthesize(situation, needs, exec_res, eval_res, [])
    
    assert outcome.status == OutcomeStatus.HUMAN_REVIEW_REQUIRED
    assert len(outcome.human_review_request.conflicting_evidence) == 1
    assert "contradictory" in outcome.human_review_request.reason


@patch("orchestra.outcome.generate_structured")
def test_provenance_integrity(mock_gen):
    """Test 5: Validates that synthetic output source is not upgraded to verified public."""
    synthesizer = FinalSynthesizer()
    situation = make_situation()
    needs = [
        InformationNeed(need_id="need_1", description="Verify delivery", priority="high", source_context="invoice")
    ]
    exec_res = PlanExecutionResult(
        status="completed",
        step_results=[
            StepExecutionResult(
                step_id="step_1",
                capability_id="sentinel.verify_claim",
                status=StepStatus.COMPLETED,
                output="Synthetic record match.",
                output_provenance=[ProvenanceRecord(source_type="case_record", origin="synthetic_augmented")]
            )
        ]
    )
    eval_res = EvaluationResult(
        status=EvaluationStatus.SUFFICIENT,
        need_evaluations=[
            NeedEvaluation(information_need_id="need_1", status=NeedEvaluationStatus.RESOLVED, reasoning="Synthetic match.", confidence=0.95)
        ],
        requires_replanning=False,
        requires_human_review=False,
        reasoning="All requirements met.",
        recommendation="Proceed.",
        confidence=0.95
    )

    # LLM falsely tags it as verified public records in description/origins
    mock_gen.return_value = {
        "status": "SUFFICIENT",
        "executive_summary": "Delivery confirmed.",
        "recommendation": "PROCEED",
        "confidence": 0.95,
        "supporting_evidence": [
            {
                "description": "Vendor delivery confirmed by verified public records.",
                "source_step_id": "step_1",
                "provenance_origins": ["verified_public"],
                "fact_statement": "Matches verified public indexes."
            }
        ],
        "key_findings": ["Delivery occurred"],
        "unresolved_issues": [],
        "material_uncertainties": [],
        "provenance_summary": {"synthetic_augmented": 1},
        "human_review_required": False,
        "replanning_history_summary": "No replanning iterations executed."
    }

    outcome = synthesizer.synthesize(situation, needs, exec_res, eval_res, [])
    
    # Overwrite checks must force synthetic_augmented and sanitize wording from verified public
    assert "synthetic_augmented" in outcome.supporting_evidence[0].provenance_origins
    assert "verified public" not in outcome.supporting_evidence[0].description.lower()
    assert "synthetic/derived" in outcome.supporting_evidence[0].description.lower()


@patch("orchestra.outcome.generate_structured")
def test_dynamic_outcome_behavior(mock_gen):
    """Test 6: Outcome synthesis changes dynamically based on modified situation objectives."""
    synthesizer = FinalSynthesizer()
    needs = [
        InformationNeed(need_id="need_1", description="Verify delivery", priority="high", source_context="invoice")
    ]
    exec_res = PlanExecutionResult(
        status="completed",
        step_results=[
            StepExecutionResult(
                step_id="step_1",
                capability_id="sentinel.verify_claim",
                status=StepStatus.COMPLETED,
                output="Invoices look standard.",
                output_provenance=[ProvenanceRecord(source_type="case_record", origin="verified_public")]
            )
        ]
    )
    eval_res = EvaluationResult(
        status=EvaluationStatus.SUFFICIENT,
        need_evaluations=[
            NeedEvaluation(information_need_id="need_1", status=NeedEvaluationStatus.RESOLVED, reasoning="Verified date.", confidence=0.95)
        ],
        requires_replanning=False,
        requires_human_review=False,
        reasoning="All requirements met.",
        recommendation="Proceed.",
        confidence=0.95
    )

    # Context A: steel check
    situation_a = make_situation()
    mock_gen.return_value = {
        "status": "SUFFICIENT",
        "executive_summary": "Safety timelines verified for steel.",
        "recommendation": "PROCEED",
        "confidence": 0.95,
        "supporting_evidence": [],
        "key_findings": ["Steel timeline verified"],
        "unresolved_issues": [],
        "material_uncertainties": [],
        "provenance_summary": {"verified_public": 1},
        "human_review_required": False,
        "replanning_history_summary": "No iterations."
    }

    outcome_a = synthesizer.synthesize(situation_a, needs, exec_res, eval_res, [])
    assert outcome_a.status == OutcomeStatus.SUFFICIENT
    assert "steel" in outcome_a.key_findings[0].lower()

    # Context B: Dynamic objective change to check geopolitical closures
    situation_b = make_situation()
    situation_b.objective = "Verify geopolitical route closures"
    mock_gen.return_value = {
        "status": "SUFFICIENT",
        "executive_summary": "Safety timelines verified for route closures.",
        "recommendation": "HOLD",
        "confidence": 0.95,
        "supporting_evidence": [],
        "key_findings": ["Route closures require investigation"],
        "unresolved_issues": [],
        "material_uncertainties": [],
        "provenance_summary": {"verified_public": 1},
        "human_review_required": False,
        "replanning_history_summary": "No iterations."
    }

    outcome_b = synthesizer.synthesize(situation_b, needs, exec_res, eval_res, [])
    assert outcome_b.recommendation == DecisionRecommendation.HOLD
    assert "closures" in outcome_b.key_findings[0].lower()


def test_outcome_persistence_abstraction():
    """Test 7: Validates that outcome persistence abstraction saves records correctly."""
    recorder = InMemoryOutcomeRecorder()
    record = OutcomeRecord(
        case_ref="prj_crossrail",
        recommendation="PROCEED",
        confidence=0.95,
        review_status="approved",
        outcome_status="SUFFICIENT",
        provenance_summary={"verified_public": 2, "synthetic_augmented": 1}
    )

    result = recorder.record_outcome(record)
    assert result is True
    assert len(recorder.records) == 1
    assert recorder.records[0].case_ref == "prj_crossrail"
    assert recorder.records[0].review_status == "approved"
