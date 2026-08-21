import sys
from pathlib import Path

# Add project root to sys.path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

import pytest
from unittest.mock import patch
from pydantic import ValidationError

from orchestra.situation import SituationContext
from orchestra.registry import CapabilityRegistry, RegistryCapability
from orchestra.planner import (
    InformationNeed,
    CapabilityCandidate,
    extract_information_needs,
    evaluate_capabilities,
    rank_candidates,
    InformationNeedsList,
    ScoredCandidateRawList
)


# ============================================================================
# Schema Validation Tests
# ============================================================================

def test_information_need_priority_validation():
    """Verify that only high, medium, and low priority values are accepted."""
    # Valid
    n = InformationNeed(
        need_id="need_1",
        description="Verify this claim",
        priority="high",
        source_context="Facts"
    )
    assert n.priority == "high"

    # Invalid
    with pytest.raises(ValidationError):
        InformationNeed(
            need_id="need_2",
            description="Verify this claim",
            priority="critical",  # Invalid
            source_context="Facts"
        )


def test_candidate_relevance_score_validation():
    """Verify that relevance_score is strictly bound between 0.0 and 1.0."""
    # Valid
    c = CapabilityCandidate(
        capability_id="sentinel.verify_claim",
        specialist="sentinel",
        description="Verify",
        information_need_id="need_1",
        relevance_score=0.85,
        explanation="Fits perfectly"
    )
    assert c.relevance_score == 0.85

    # Invalid - Too high
    with pytest.raises(ValidationError):
        CapabilityCandidate(
            capability_id="sentinel.verify_claim",
            specialist="sentinel",
            description="Verify",
            information_need_id="need_1",
            relevance_score=1.5,  # Out of range
            explanation="Fits perfectly"
        )

    # Invalid - Too low
    with pytest.raises(ValidationError):
        CapabilityCandidate(
            capability_id="sentinel.verify_claim",
            specialist="sentinel",
            description="Verify",
            information_need_id="need_1",
            relevance_score=-0.2,  # Out of range
            explanation="Fits perfectly"
        )


# ============================================================================
# Step 1 — Information Need Extraction Tests
# ============================================================================

MOCK_EXTRACTED_NEEDS = {
    "needs": [
        {
            "need_id": "need_1",
            "description": "Verify whether the contractor's delay claim is supported by available evidence.",
            "priority": "high",
            "source_context": "Uncertainty about late delivery cause",
            "related_facts": ["Project is delayed by 12 days"],
            "related_uncertainties": ["Contractor claims port congestion caused delay"],
            "related_information_gaps": ["Port records"]
        },
        {
            "need_id": "need_2",
            "description": "Assess historical reliability and capacity of the supplier.",
            "priority": "medium",
            "source_context": "Uncertainty about future schedule feasibility",
            "related_facts": ["Piping installation window advanced"],
            "related_uncertainties": ["Supplier capacity limits"],
            "related_information_gaps": ["Supplier historical delivery records"]
        }
    ]
}


@patch("common.llm_client.UnifiedLLMClient.generate_structured")
def test_extract_information_needs(mock_generate):
    """Verify InformationNeed extraction from a SituationContext."""
    mock_generate.return_value = MOCK_EXTRACTED_NEEDS.copy()

    situation = SituationContext(
        objective="Verify delivery delay responsibility",
        requested_outcome="Approve extension of time",
        entities=["vendor_apex"],
        known_facts=["Project delayed by 12 days"],
        uncertainties=["Port congestion claim"],
        information_gaps=["Port logs"]
    )

    needs = extract_information_needs(situation)
    assert len(needs) == 2
    assert needs[0].need_id == "need_1"
    assert "verify" in needs[0].description.lower()
    assert needs[1].priority == "medium"


# ============================================================================
# Step 2 — Evaluation & Rejection Guard Tests
# ============================================================================

MOCK_SEMANTIC_EVALUATION = {
    "candidates": [
        # Valid candidate
        {
            "capability_id": "sentinel.verify_claim",
            "information_need_id": "need_1",
            "relevance_score": 0.9,
            "explanation": "Directly maps to claim verification"
        },
        # Fabricated capability candidate (should be rejected)
        {
            "capability_id": "fake_agent.do_something_fabricated",
            "information_need_id": "need_1",
            "relevance_score": 0.8,
            "explanation": "Fabricated capability"
        },
        # Fabricated information need ID (should be rejected)
        {
            "capability_id": "sentinel.verify_claim",
            "information_need_id": "need_fabricated_999",
            "relevance_score": 0.95,
            "explanation": "Invalid need ID"
        },
        # Valid candidate with incorrect LLM specialist mapping (registry should override)
        {
            "capability_id": "trustline.assess_vendor_reliability",
            "information_need_id": "need_2",
            "relevance_score": 0.85,
            "explanation": "Evaluates reliability trends"
        }
    ]
}


@patch("common.llm_client.UnifiedLLMClient.generate_structured")
def test_evaluate_capabilities_validation_rules(mock_generate):
    """Verify that fabricated capabilities/needs are rejected and registry metadata is resolved."""
    mock_generate.return_value = MOCK_SEMANTIC_EVALUATION.copy()

    registry = CapabilityRegistry()
    needs = [
        InformationNeed(need_id="need_1", description="Verify claim", priority="high", source_context="Facts"),
        InformationNeed(need_id="need_2", description="Check reliability", priority="medium", source_context="Facts")
    ]

    candidates = evaluate_capabilities(needs, registry)
    
    # Verify fabricated components were successfully filtered out
    assert len(candidates) == 2
    
    # Assert registry authority resolved specialist mapping
    c_ids = [c.capability_id for c in candidates]
    assert "sentinel.verify_claim" in c_ids
    assert "trustline.assess_vendor_reliability" in c_ids
    
    # Confirm correct specialist resolution
    trust_candidate = next(c for c in candidates if c.capability_id == "trustline.assess_vendor_reliability")
    assert trust_candidate.specialist == "trustline"  # Resolved from registry metadata


# ============================================================================
# Step 3 — Deduplication, Threshold, and Ranking Tests
# ============================================================================

def test_duplicate_candidate_handling():
    """Verify that duplicate capability-need pairs retain the highest score."""
    registry = CapabilityRegistry()
    needs = [
        InformationNeed(need_id="need_1", description="Verify", priority="high", source_context="Facts")
    ]

    # Faked output containing duplicates
    mock_evaluated = {
        "candidates": [
            {
                "capability_id": "sentinel.verify_claim",
                "information_need_id": "need_1",
                "relevance_score": 0.7,
                "explanation": "Initial match"
            },
            {
                "capability_id": "sentinel.verify_claim",
                "information_need_id": "need_1",
                "relevance_score": 0.95,  # Higher score
                "explanation": "Better matching"
            }
        ]
    }

    with patch("common.llm_client.UnifiedLLMClient.generate_structured", return_value=mock_evaluated):
        candidates = evaluate_capabilities(needs, registry)
        
        # Deduplication yields exactly one candidate
        assert len(candidates) == 1
        assert candidates[0].relevance_score == 0.95


def test_ranking_and_threshold_filtering():
    """Verify that tie-breaker ranking and threshold filtering work correctly."""
    needs = [
        InformationNeed(need_id="need_high", description="High Need", priority="high", source_context="Facts"),
        InformationNeed(need_id="need_med", description="Med Need", priority="medium", source_context="Facts"),
        InformationNeed(need_id="need_low", description="Low Need", priority="low", source_context="Facts")
    ]

    candidates = [
        # Candidate 1: Med Need, sentinel.verify_claim, score 0.8
        CapabilityCandidate(
            capability_id="sentinel.verify_claim",
            specialist="sentinel",
            description="desc",
            information_need_id="need_med",
            relevance_score=0.8,
            explanation="exp"
        ),
        # Candidate 2: High Need, sentinel.verify_claim, score 0.8 (Should beat Med Need on priority)
        CapabilityCandidate(
            capability_id="sentinel.verify_claim",
            specialist="sentinel",
            description="desc",
            information_need_id="need_high",
            relevance_score=0.8,
            explanation="exp"
        ),
        # Candidate 3: Low Need, sentinel.verify_progress, score 0.9 (Should beat all on score)
        CapabilityCandidate(
            capability_id="sentinel.verify_progress",
            specialist="sentinel",
            description="desc",
            information_need_id="need_low",
            relevance_score=0.9,
            explanation="exp"
        ),
        # Candidate 4: Low Need, sentinel.compare_documents, score 0.3 (Should be ranked but excluded from selected)
        CapabilityCandidate(
            capability_id="sentinel.compare_documents",
            specialist="sentinel",
            description="desc",
            information_need_id="need_low",
            relevance_score=0.3,
            explanation="exp"
        )
    ]

    res = rank_candidates(candidates, needs, relevance_threshold=0.5)

    # 1. Check all_ranked preserves everything (4 items)
    assert len(res.all_ranked_candidates) == 4
    
    # Correct order validation:
    # 1st: Score 0.9 (Candidate 3)
    assert res.all_ranked_candidates[0].capability_id == "sentinel.verify_progress"
    
    # 2nd: Score 0.8, High priority (Candidate 2)
    assert res.all_ranked_candidates[1].information_need_id == "need_high"
    
    # 3rd: Score 0.8, Med priority (Candidate 1)
    assert res.all_ranked_candidates[2].information_need_id == "need_med"
    
    # 4th: Score 0.3 (Candidate 4)
    assert res.all_ranked_candidates[3].capability_id == "sentinel.compare_documents"

    # 2. Check selected_candidates (excludes < 0.5 threshold)
    assert len(res.selected_candidates) == 3
    assert all(c.relevance_score >= 0.5 for c in res.selected_candidates)


def test_dynamic_capability_discovery():
    """Verify that a newly added registry capability is evaluated without code modification."""
    registry = CapabilityRegistry()
    
    # Inject a new capability directly into the registry dictionary
    new_cap = RegistryCapability(
        id="custom_agent.resolve_novel_issue",
        name="Resolve Novel Issue",
        description="Fictional custom capability for testing dynamic registry discovery.",
        use_when=["Needing to test dynamic extension."],
        endpoint="/custom/resolve",
        specialist="custom_agent",
        canonical_endpoint="/custom_agent/execute"
    )
    registry.capabilities[new_cap.id] = new_cap

    needs = [
        InformationNeed(need_id="need_1", description="Solve issue", priority="high", source_context="Facts")
    ]

    mock_response = {
        "candidates": [
            {
                "capability_id": "custom_agent.resolve_novel_issue",
                "information_need_id": "need_1",
                "relevance_score": 0.95,
                "explanation": "Matches the newly injected capability"
            }
        ]
    }

    with patch("common.llm_client.UnifiedLLMClient.generate_structured", return_value=mock_response):
        candidates = evaluate_capabilities(needs, registry)
        
        # Verify the custom capability was successfully evaluated
        assert len(candidates) == 1
        assert candidates[0].capability_id == "custom_agent.resolve_novel_issue"
        assert candidates[0].specialist == "custom_agent"


# ============================================================================
# Phase 3B Planning Validation Tests
# ============================================================================

from orchestra.planner import (
    ProposedPlanStep,
    ProposedPlan,
    ValidatedPlanStep,
    ValidatedPlan,
    PlanValidationError,
    generate_plan,
    validate_and_normalize_plan
)


def test_planner_coverage_failure():
    """Verify that omitting a high-priority need causes validation failure."""
    needs = [
        InformationNeed(need_id="need_high", description="High Priority Need", priority="high", source_context="Facts")
    ]
    candidates = [
        CapabilityCandidate(
            capability_id="sentinel.verify_claim",
            specialist="sentinel",
            description="Verify",
            information_need_id="need_high",
            relevance_score=0.9,
            explanation="Match"
        )
    ]
    proposed = ProposedPlan(
        steps=[
            # Addresses some other need, ignoring high priority need_high
            ProposedPlanStep(
                step_id="step_1",
                information_need_id="need_low_fabricated",
                capability_id="sentinel.verify_claim",
                objective="unrelated objective",
                expected_output="output",
                reasoning="reason"
            )
        ]
    )
    registry = CapabilityRegistry()
    
    with pytest.raises(PlanValidationError) as exc:
        validate_and_normalize_plan(proposed, needs, candidates, registry)
    assert "High-priority information need" in str(exc.value)


def test_planner_valid_omission():
    """Verify that omitting a medium/low priority need is allowed if justified."""
    needs = [
        InformationNeed(need_id="need_high", description="High Need", priority="high", source_context="Facts"),
        InformationNeed(need_id="need_low", description="Low Need", priority="low", source_context="Facts")
    ]
    candidates = [
        CapabilityCandidate(
            capability_id="sentinel.verify_claim",
            specialist="sentinel",
            description="Verify",
            information_need_id="need_high",
            relevance_score=0.9,
            explanation="Match"
        ),
        CapabilityCandidate(
            capability_id="sentinel.verify_progress",
            specialist="sentinel",
            description="Verify progress",
            information_need_id="need_low",
            relevance_score=0.8,
            explanation="Match"
        )
    ]
    
    # Address need_high, and omit need_low with a reason
    proposed = ProposedPlan(
        steps=[
            ProposedPlanStep(
                step_id="step_1",
                information_need_id="need_high",
                capability_id="sentinel.verify_claim",
                objective="Verify high need",
                expected_output="Verification result",
                reasoning="reason"
            )
        ],
        omitted_need_reasons={
            "need_low": "Intentional omission because progress photos are not available yet"
        }
    )
    registry = CapabilityRegistry()
    
    with patch("orchestra.planner.validate_capability_contract", return_value=True):
        validated = validate_and_normalize_plan(proposed, needs, candidates, registry)
        assert len(validated.steps) == 1
        assert validated.steps[0].step_id == "step_1"


def test_planner_invalid_dependency_reasoning():
    """Verify that depends_on requires matching, non-empty dependency_reasoning."""
    needs = [
        InformationNeed(need_id="need_high", description="High Need", priority="high", source_context="Facts")
    ]
    candidates = [
        CapabilityCandidate(
            capability_id="sentinel.verify_claim",
            specialist="sentinel",
            description="Verify",
            information_need_id="need_high",
            relevance_score=0.9,
            explanation="Match"
        )
    ]
    proposed = ProposedPlan(
        steps=[
            ProposedPlanStep(
                step_id="step_1",
                information_need_id="need_high",
                capability_id="sentinel.verify_claim",
                objective="Verify",
                expected_output="output1",
                reasoning="reason"
            ),
            ProposedPlanStep(
                step_id="step_2",
                information_need_id="need_high",
                capability_id="sentinel.verify_claim",
                objective="Analyze",
                depends_on=["step_1"],
                dependency_reasoning={},  # Missing justification reasoning
                expected_output="output2",
                reasoning="reason"
            )
        ]
    )
    registry = CapabilityRegistry()
    
    with patch("orchestra.planner.validate_capability_contract", return_value=True):
        with pytest.raises(PlanValidationError) as exc:
            validate_and_normalize_plan(proposed, needs, candidates, registry)
        assert "missing a valid dependency reasoning explanation" in str(exc.value)


def test_planner_parallel_execution_preservation():
    """For two unrelated information needs, validate that the normalized DAG contains no artificial dependency."""
    needs = [
        InformationNeed(need_id="need_a", description="Need A", priority="high", source_context="Facts"),
        InformationNeed(need_id="need_b", description="Need B", priority="high", source_context="Facts")
    ]
    candidates = [
        CapabilityCandidate(
            capability_id="sentinel.verify_claim",
            specialist="sentinel",
            description="Verify",
            information_need_id="need_a",
            relevance_score=0.9,
            explanation="Match"
        ),
        CapabilityCandidate(
            capability_id="sentinel.verify_progress",
            specialist="sentinel",
            description="Progress",
            information_need_id="need_b",
            relevance_score=0.8,
            explanation="Match"
        )
    ]
    proposed = ProposedPlan(
        steps=[
            ProposedPlanStep(
                step_id="step_a",
                information_need_id="need_a",
                capability_id="sentinel.verify_claim",
                objective="Verify need a",
                expected_output="output a",
                reasoning="reason"
            ),
            ProposedPlanStep(
                step_id="step_b",
                information_need_id="need_b",
                capability_id="sentinel.verify_progress",
                objective="Verify need b",
                expected_output="output b",
                reasoning="reason"
            )
        ]
    )
    registry = CapabilityRegistry()
    
    with patch("orchestra.planner.validate_capability_contract", return_value=True):
        validated = validate_and_normalize_plan(proposed, needs, candidates, registry)
        assert len(validated.steps) == 2
        # Verify no artificial dependency exists
        assert validated.steps[0].depends_on == []
        assert validated.steps[1].depends_on == []


def test_planner_dynamic_registry_new_capability():
    """Verify a completely new capability is dynamically evaluated and selected."""
    registry = CapabilityRegistry()
    
    # 1. Register a completely new capability
    new_cap = RegistryCapability(
        id="specialist_x.new_capability",
        name="New Capability",
        description="Solve a novel issue.",
        use_when=["Monsoon rains block track works."],
        endpoint="/specialist_x/new_capability",
        specialist="specialist_x",
        canonical_endpoint="/specialist_x/execute"
    )
    registry.capabilities[new_cap.id] = new_cap
    
    needs = [
        InformationNeed(need_id="need_1", description="Monsoon blocks", priority="high", source_context="Facts")
    ]
    candidates = [
        CapabilityCandidate(
            capability_id="specialist_x.new_capability",
            specialist="specialist_x",
            description="Solve a novel issue.",
            information_need_id="need_1",
            relevance_score=0.95,
            explanation="Fits monsoon blocker need"
        )
    ]
    
    proposed = ProposedPlan(
        steps=[
            ProposedPlanStep(
                step_id="step_1",
                information_need_id="need_1",
                capability_id="specialist_x.new_capability",
                objective="Solve the monsoon delay",
                expected_output="Mitigation plan",
                reasoning="reason"
            )
        ]
    )
    
    with patch("orchestra.planner.validate_capability_contract", return_value=True):
        validated = validate_and_normalize_plan(proposed, needs, candidates, registry)
        assert len(validated.steps) == 1
        assert validated.steps[0].capability_id == "specialist_x.new_capability"
        assert validated.steps[0].specialist == "specialist_x"
        assert validated.steps[0].endpoint == "/specialist_x/execute"


def test_planner_capability_contract_compatibility_failure():
    """Verify that a step is rejected if its objective/expected output is incompatible with the contract."""
    needs = [
        InformationNeed(need_id="need_high", description="High Need", priority="high", source_context="Facts")
    ]
    candidates = [
        CapabilityCandidate(
            capability_id="sentinel.verify_claim",
            specialist="sentinel",
            description="Verify",
            information_need_id="need_high",
            relevance_score=0.9,
            explanation="Match"
        )
    ]
    proposed = ProposedPlan(
        steps=[
            ProposedPlanStep(
                step_id="step_1",
                information_need_id="need_high",
                capability_id="sentinel.verify_claim",
                objective="Perform unrelated task",
                expected_output="unrelated output",
                reasoning="reason"
            )
        ]
    )
    registry = CapabilityRegistry()
    
    # Mock validate_capability_contract to return False (incompatible)
    with patch("orchestra.planner.validate_capability_contract", return_value=False):
        with pytest.raises(PlanValidationError) as exc:
            validate_and_normalize_plan(proposed, needs, candidates, registry)
        assert "objective or expected output is incompatible" in str(exc.value)

