import sys
from pathlib import Path

# Add project root to sys.path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

import pytest
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock

from common.schemas.task import AgentResult, AgentTask
from orchestra.situation import SituationContext
from orchestra.registry import CapabilityRegistry, RegistryCapability
from orchestra.client import OrchestraClient
from orchestra.planner import InformationNeed, ValidatedPlan, ValidatedPlanStep
from orchestra.repository import NormalizedCaseContext, ProjectRecord, VendorRecord, EvidenceRecord, ClaimRecord
from orchestra.execution import (
    ExecutionOrchestrator,
    StepStatus,
    StepBlockReason,
    PlanExecutionStatus,
    ProvenanceRecord,
    StepExecutionResult,
    PlanExecutionResult
)


# ============================================================================
# Helpers
# ============================================================================

def make_mock_client_response(status: str = "COMPLETED", findings: list = None, error: dict = None, claims: list = None) -> AgentResult:
    return AgentResult(
        agent="arbiter",
        task_id="tsk_mock_123",
        status=status,
        findings=findings or [],
        claims=claims or [],
        error=error
    )


# ============================================================================
# Arbiter Specialist Tests
# ============================================================================

def test_arbiter_registry_discovery():
    """Test A: Verify Arbiter appears through registry.list_capabilities() dynamically."""
    registry = CapabilityRegistry()
    capabilities = {c.id: c for c in registry.list_capabilities()}
    
    assert "arbiter.analyze_dispute" in capabilities
    assert "arbiter.reconstruct_timeline" in capabilities
    assert "arbiter.analyze_causation" in capabilities
    assert "arbiter.assess_responsibility" in capabilities
    assert "arbiter.run_debate" in capabilities
    
    # Assert authoritative metadata comes from the registry
    cap = registry.get("arbiter.analyze_dispute")
    assert cap.specialist == "arbiter"
    assert cap.canonical_endpoint == "/arbiter/execute"
    assert "dispute_context" in cap.payload_schema.get("required", [])


@patch("common.llm_client.UnifiedLLMClient.generate_structured")
def test_arbiter_candidate_evaluation(mock_generate):
    """Test B: Verify Arbiter is evaluated as a candidate based on causation/timeline needs."""
    from orchestra.planner import evaluate_capabilities
    
    # Mock LLM evaluation response
    mock_generate.return_value = {
        "candidates": [
            {
                "capability_id": "arbiter.analyze_causation",
                "information_need_id": "need_root_cause",
                "relevance_score": 0.98,
                "explanation": "Perfect fit for causal and responsibility reasoning"
            }
        ]
    }

    registry = CapabilityRegistry()
    needs = [
        InformationNeed(
            need_id="need_root_cause",
            description="Assess contractual responsibility and find the root cause of the delay.",
            priority="high",
            source_context="dispute"
        )
    ]

    candidates = evaluate_capabilities(needs, registry)
    assert len(candidates) == 1
    assert candidates[0].capability_id == "arbiter.analyze_causation"
    assert candidates[0].relevance_score == 0.98


def test_arbiter_plan_validation():
    """Test C: Verify plan step validators correctly resolve Arbiter metadata from the registry."""
    registry = CapabilityRegistry()
    step = ValidatedPlanStep(
        step_id="step_dispute",
        information_need_id="need_1",
        capability_id="arbiter.analyze_dispute",
        specialist="arbiter",
        endpoint="/arbiter/execute",
        description="Run dispute analysis",
        objective="Find responsibility split",
        expected_output="Attribution splits",
        reasoning="required for analysis"
    )
    
    # Ensure properties match CapabilityRegistry's declarations
    cap = registry.get(step.capability_id)
    assert step.specialist == cap.specialist
    assert step.endpoint == cap.canonical_endpoint


@pytest.mark.asyncio
async def test_arbiter_step_execution():
    """Test D: Verify Arbiter plan step executes successfully using mocked local client."""
    registry = CapabilityRegistry()
    step = ValidatedPlanStep(
        step_id="step_1",
        information_need_id="need_1",
        capability_id="arbiter.analyze_dispute",
        specialist="arbiter",
        endpoint="/arbiter/execute",
        description="Analyze dispute context",
        objective="Run causal loop",
        expected_output="timeline and causes",
        reasoning="needed"
    )
    plan = ValidatedPlan(steps=[step])
    
    situation = SituationContext(objective="Resort dispute", requested_outcome="verdict", entities=[], known_facts=[], uncertainties=[])
    needs = [InformationNeed(need_id="need_1", description="Analyze dispute context", priority="high", source_context="Facts")]
    
    case_context = NormalizedCaseContext(
        project=ProjectRecord(project_id="prj_1", name="resort", description="desc", origin="verified_public"),
        claims=[ClaimRecord(claim_id="cl_1", project_id="prj_1", claim_text="Delay", origin="verified_public")]
    )

    mock_client = MagicMock(spec=OrchestraClient)
    mock_res = make_mock_client_response(
        status="COMPLETED",
        findings=[{"timeline": {"events": []}, "causes": [], "responsibility": {}}]
    )
    mock_client.execute = AsyncMock(return_value=mock_res)

    orchestrator = ExecutionOrchestrator(registry, mock_client)
    res = await orchestrator.execute(plan, situation, needs, case_context=case_context)

    assert res.status == PlanExecutionStatus.COMPLETED
    assert len(res.step_results) == 1
    assert res.step_results[0].status == StepStatus.COMPLETED
    
    # Verify input payload was generically built and contains dispute_context
    mock_client.execute.assert_called_once()
    kwargs = mock_client.execute.call_args[1]
    assert "dispute_context" in kwargs["payload"]
    assert kwargs["payload"]["dispute_context"]["project_id"] == "prj_1"


@pytest.mark.asyncio
async def test_arbiter_dependency_propagation():
    """Test E: Verify dependency outputs from analyze_causation propagate to assess_responsibility."""
    registry = CapabilityRegistry()
    
    step_causation = ValidatedPlanStep(
        step_id="step_causation",
        information_need_id="need_1",
        capability_id="arbiter.analyze_causation",
        specialist="arbiter",
        endpoint="/arbiter/execute",
        description="Find causes",
        objective="causal analysis",
        expected_output="causes list",
        reasoning="needed"
    )
    step_resp = ValidatedPlanStep(
        step_id="step_responsibility",
        information_need_id="need_2",
        capability_id="arbiter.assess_responsibility",
        specialist="arbiter",
        endpoint="/arbiter/execute",
        description="Attribute fault split",
        objective="fault attribution",
        depends_on=["step_causation"],
        dependency_reasoning={"step_causation": "requires causes findings"},
        expected_output="fault splits",
        reasoning="needed"
    )
    plan = ValidatedPlan(steps=[step_causation, step_resp])

    situation = SituationContext(objective="Dispute", requested_outcome="Resolution", entities=[], known_facts=[], uncertainties=[])
    needs = [
        InformationNeed(need_id="need_1", description="Causation check", priority="high", source_context="Facts"),
        InformationNeed(need_id="need_2", description="Fault check", priority="high", source_context="Facts")
    ]
    
    case_context = NormalizedCaseContext(
        project=ProjectRecord(project_id="prj_1", name="resort", description="desc", origin="verified_public"),
        claims=[ClaimRecord(claim_id="cl_1", project_id="prj_1", claim_text="Delay", origin="verified_public")]
    )

    mock_client = MagicMock(spec=OrchestraClient)
    mock_causation_res = make_mock_client_response(
        status="COMPLETED",
        findings=[{"causes": [{"cause_id": "c1", "type": "vendor_fault", "contribution": 0.8}]}]
    )
    mock_resp_res = make_mock_client_response(
        status="COMPLETED",
        findings=[{"vendor": 80.0, "buyer": 20.0}]
    )

    mock_client.execute = AsyncMock()
    mock_client.execute.side_effect = [mock_causation_res, mock_resp_res]

    orchestrator = ExecutionOrchestrator(registry, mock_client)
    res = await orchestrator.execute(plan, situation, needs, case_context=case_context)

    assert res.status == PlanExecutionStatus.COMPLETED
    assert mock_client.execute.call_count == 2
    
    # Verify causes were dynamically passed from Step Causation's output findings
    kwargs = mock_client.execute.call_args_list[1][1]
    assert "causes" in kwargs["payload"]
    assert kwargs["payload"]["causes"][0]["cause_id"] == "c1"


@pytest.mark.asyncio
async def test_arbiter_failure_isolation():
    """Test F: If Arbiter fails, dependent steps block while unrelated branches continue."""
    registry = CapabilityRegistry()
    
    step_arbiter = ValidatedPlanStep(
        step_id="step_arbiter",
        information_need_id="need_1",
        capability_id="arbiter.analyze_dispute",
        specialist="arbiter",
        endpoint="/arbiter/execute",
        description="Arbiter analysis",
        objective="Run dispute",
        expected_output="verdict",
        reasoning="needed"
    )
    step_dependent = ValidatedPlanStep(
        step_id="step_dependent",
        information_need_id="need_2",
        capability_id="arbiter.assess_responsibility",
        specialist="arbiter",
        endpoint="/arbiter/execute",
        description="Dependent step",
        objective="Assess responsibility",
        depends_on=["step_arbiter"],
        dependency_reasoning={"step_arbiter": "requires dispute outcome"},
        expected_output="fault splits",
        reasoning="needed"
    )
    step_independent = ValidatedPlanStep(
        step_id="step_independent",
        information_need_id="need_3",
        capability_id="sentinel.verify_claim",
        specialist="sentinel",
        endpoint="/sentinel/execute",
        description="Independent claim verification",
        objective="Verify rain days",
        expected_output="rain days",
        reasoning="needed"
    )
    plan = ValidatedPlan(steps=[step_arbiter, step_dependent, step_independent])

    situation = SituationContext(objective="Dispute", requested_outcome="splits", entities=[], known_facts=[], uncertainties=[])
    needs = [
        InformationNeed(need_id="need_1", description="Arbiter analysis", priority="high", source_context="Facts"),
        InformationNeed(need_id="need_2", description="Dependent step", priority="high", source_context="Facts"),
        InformationNeed(need_id="need_3", description="Independent claim verification", priority="high", source_context="Facts")
    ]
    
    case_context = NormalizedCaseContext(
        project=ProjectRecord(project_id="prj_1", name="resort", description="desc", origin="verified_public"),
        claims=[ClaimRecord(claim_id="cl_1", project_id="prj_1", claim_text="Delay", origin="verified_public")]
    )

    mock_client = MagicMock(spec=OrchestraClient)
    # Arbiter fails, Sentinel succeeds
    mock_arbiter_res = make_mock_client_response(status="FAILED", error={"code": "TIMEOUT", "message": "Arbiter timed out."})
    mock_sentinel_res = AgentResult(agent="sentinel", task_id="tsk_ind", status="COMPLETED", findings=[{"verified": True}])

    mock_client.execute = AsyncMock()
    mock_client.execute.side_effect = [mock_arbiter_res, mock_sentinel_res]

    orchestrator = ExecutionOrchestrator(registry, mock_client)
    res = await orchestrator.execute(plan, situation, needs, case_context=case_context)

    # Whole plan status is partial due to the failed branch
    assert res.status == PlanExecutionStatus.PARTIAL
    
    statuses = {r.step_id: r.status for r in res.step_results}
    assert statuses["step_arbiter"] == StepStatus.FAILED
    assert statuses["step_dependent"] == StepStatus.BLOCKED
    assert res.step_results[1].blocked_reason == StepBlockReason.FAILED_DEPENDENCY
    assert statuses["step_independent"] == StepStatus.COMPLETED


@pytest.mark.asyncio
async def test_arbiter_dynamic_extensiblity():
    """Test G: Register a temporary capability at runtime and verify pipeline continues to function dynamically."""
    registry = CapabilityRegistry()
    
    # Runtime register a novel capability
    new_cap = RegistryCapability(
        id="arbiter.evaluate_mediation_chance",
        name="Mediation Predictor",
        description="Assesses probability of success in dispute mediation.",
        use_when=["mediation considered"],
        endpoint="/arbiter/evaluate_mediation",
        specialist="arbiter",
        canonical_endpoint="/arbiter/execute",
        payload_schema={"required": ["subject"]}
    )
    registry.capabilities[new_cap.id] = new_cap

    step = ValidatedPlanStep(
        step_id="step_1",
        information_need_id="need_1",
        capability_id="arbiter.evaluate_mediation_chance",
        specialist="arbiter",
        endpoint="/arbiter/execute",
        description="Mediation check",
        objective="Assess mediation chances",
        expected_output="mediation probability",
        reasoning="needed"
    )
    plan = ValidatedPlan(steps=[step])

    situation = SituationContext(objective="Dispute", requested_outcome="resolution", entities=[], known_facts=[], uncertainties=[])
    needs = [InformationNeed(need_id="need_1", description="Assess mediation chances", priority="high", source_context="Facts")]

    mock_client = MagicMock(spec=OrchestraClient)
    mock_res = make_mock_client_response(status="COMPLETED", findings=[{"mediation_success_prob": 0.75}])
    mock_client.execute = AsyncMock(return_value=mock_res)

    orchestrator = ExecutionOrchestrator(registry, mock_client)
    res = await orchestrator.execute(plan, situation, needs)

    assert res.status == PlanExecutionStatus.COMPLETED
    assert res.step_results[0].status == StepStatus.COMPLETED
    assert res.step_results[0].capability_id == "arbiter.evaluate_mediation_chance"
