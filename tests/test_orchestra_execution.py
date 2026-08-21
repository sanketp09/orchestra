import sys
from pathlib import Path

# Add project root to sys.path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

import pytest
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock
from datetime import datetime, timezone

from common.schemas.task import AgentResult
from orchestra.situation import SituationContext
from orchestra.registry import CapabilityRegistry, RegistryCapability
from orchestra.client import OrchestraClient
from orchestra.planner import InformationNeed, ValidatedPlan, ValidatedPlanStep
from orchestra.repository import NormalizedCaseContext, ProjectRecord, VendorRecord, EvidenceRecord
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
    """Helper to mock specialist response AgentResult."""
    return AgentResult(
        agent="sentinel",
        task_id="tsk_mock_123",
        status=status,
        findings=findings or [],
        claims=claims or [],
        error=error
    )


# ============================================================================
# Level A — Deterministic Unit Tests
# ============================================================================

@pytest.mark.asyncio
async def test_single_dynamic_capability_execution():
    """Test 1: Dynamic capability lookup, payload resolution, and execution."""
    registry = CapabilityRegistry()
    
    # 1. Register a capability dynamically
    new_cap = RegistryCapability(
        id="sentinel.verify_claim",
        name="Verify Claim",
        description="Verify claim evidence",
        use_when=["monsoon delays"],
        endpoint="/sentinel/verify_claim",
        specialist="sentinel",
        canonical_endpoint="/sentinel/execute",
        payload_schema={"required": ["claim_text"]}
    )
    registry.capabilities[new_cap.id] = new_cap

    # 2. Build a valid plan referencing it
    step = ValidatedPlanStep(
        step_id="step_1",
        information_need_id="need_1",
        capability_id="sentinel.verify_claim",
        specialist="sentinel",
        endpoint="/sentinel/execute",
        description="Verify",
        objective="Verify rain events",
        expected_output="Verified rain days",
        reasoning="needed"
    )
    plan = ValidatedPlan(steps=[step])

    situation = SituationContext(
        objective="Monsoon delay assessment",
        requested_outcome="Approve extension",
        entities=[],
        known_facts=["Late works"],
        uncertainties=[]
    )
    needs = [
        InformationNeed(
            need_id="need_1",
            description="Verify monsoon claim text",
            priority="high",
            source_context="Facts"
        )
    ]

    mock_client = MagicMock(spec=OrchestraClient)
    mock_res = make_mock_client_response(status="COMPLETED", findings=[{"verdict": "valid"}])
    mock_client.execute = AsyncMock(return_value=mock_res)

    orchestrator = ExecutionOrchestrator(registry, mock_client)
    res = await orchestrator.execute(plan, situation, needs)

    # 3. Assertions
    assert res.status == PlanExecutionStatus.COMPLETED
    assert len(res.step_results) == 1
    assert res.step_results[0].status == StepStatus.COMPLETED
    assert res.step_results[0].output["findings"][0]["verdict"] == "valid"
    
    # Verify input payload was mapped generically from the information need
    mock_client.execute.assert_called_once()
    kwargs = mock_client.execute.call_args[1]
    assert kwargs["payload"]["claim_text"] == "Verify monsoon claim text"


@pytest.mark.asyncio
async def test_newly_registered_capability():
    """Test 2: Register a completely new capability and execute without engine changes."""
    registry = CapabilityRegistry()
    
    # Injected new capability at test runtime
    new_cap = RegistryCapability(
        id="custom_specialist.do_something_novel",
        name="Novel Action",
        description="Novel task",
        use_when=["unrelated"],
        endpoint="/custom/novel",
        specialist="custom_specialist",
        canonical_endpoint="/custom_specialist/execute",
        payload_schema={"required": ["custom_param"]}
    )
    registry.capabilities[new_cap.id] = new_cap

    step = ValidatedPlanStep(
        step_id="step_1",
        information_need_id="need_1",
        capability_id="custom_specialist.do_something_novel",
        specialist="custom_specialist",
        endpoint="/custom_specialist/execute",
        description="Run novel task",
        objective="Novel target",
        expected_output="novel output",
        reasoning="needed"
    )
    plan = ValidatedPlan(steps=[step])

    situation = SituationContext(
        objective="Analyze objective",
        requested_outcome="outcome",
        entities=["vendor_ape"],
        known_facts=[],
        uncertainties=[]
    )
    needs = [
        InformationNeed(
            need_id="need_1",
            description="need description text",
            priority="high",
            source_context="Facts"
        )
    ]

    mock_client = MagicMock(spec=OrchestraClient)
    mock_res = make_mock_client_response(status="COMPLETED")
    mock_client.execute = AsyncMock(return_value=mock_res)

    orchestrator = ExecutionOrchestrator(registry, mock_client)
    
    with patch("orchestra.execution.resolve_field_value", return_value=("novel_value", None)):
        res = await orchestrator.execute(plan, situation, needs)
        assert res.status == PlanExecutionStatus.COMPLETED
        assert res.step_results[0].status == StepStatus.COMPLETED


@pytest.mark.asyncio
async def test_independent_steps():
    """Test 3: Verify independent steps become ready and execute independently."""
    registry = CapabilityRegistry()
    registry.capabilities["sentinel.verify_claim"] = RegistryCapability(
        id="sentinel.verify_claim",
        name="Verify",
        description="Verify",
        endpoint="/sentinel",
        specialist="sentinel",
        canonical_endpoint="/sentinel/execute",
        payload_schema={"required": ["claim_text"]}
    )

    # Two independent steps
    step_a = ValidatedPlanStep(
        step_id="step_a",
        information_need_id="need_1",
        capability_id="sentinel.verify_claim",
        specialist="sentinel",
        endpoint="/sentinel/execute",
        description="Verify A",
        objective="objective a",
        expected_output="output a",
        reasoning="needed"
    )
    step_b = ValidatedPlanStep(
        step_id="step_b",
        information_need_id="need_2",
        capability_id="sentinel.verify_claim",
        specialist="sentinel",
        endpoint="/sentinel/execute",
        description="Verify B",
        objective="objective b",
        expected_output="output b",
        reasoning="needed"
    )
    plan = ValidatedPlan(steps=[step_a, step_b])

    situation = SituationContext(objective="Verify", requested_outcome="out", entities=[], known_facts=[], uncertainties=[])
    needs = [
        InformationNeed(need_id="need_1", description="desc 1", priority="high", source_context="Facts"),
        InformationNeed(need_id="need_2", description="desc 2", priority="high", source_context="Facts")
    ]

    mock_client = MagicMock(spec=OrchestraClient)
    mock_res = make_mock_client_response(status="COMPLETED")
    mock_client.execute = AsyncMock(return_value=mock_res)

    orchestrator = ExecutionOrchestrator(registry, mock_client)
    res = await orchestrator.execute(plan, situation, needs)

    assert res.status == PlanExecutionStatus.COMPLETED
    assert len(res.step_results) == 2
    assert res.step_results[0].status == StepStatus.COMPLETED
    assert res.step_results[1].status == StepStatus.COMPLETED
    
    # Assert neither step has depends_on constraint
    assert res.step_results[0].blocked_reason is None
    assert res.step_results[1].blocked_reason is None


@pytest.mark.asyncio
async def test_dependency_propagation():
    """Test 4: Verify step B receives step A's output via dependency_outputs."""
    registry = CapabilityRegistry()
    registry.capabilities["sentinel.verify_claim"] = RegistryCapability(
        id="sentinel.verify_claim",
        name="Verify",
        description="Verify",
        endpoint="/sentinel",
        specialist="sentinel",
        canonical_endpoint="/sentinel/execute",
        payload_schema={"required": ["claim_text"]}
    )
    registry.capabilities["arbiter.analyze_causation"] = RegistryCapability(
        id="arbiter.analyze_causation",
        name="Causation",
        description="Causation",
        endpoint="/arbiter",
        specialist="arbiter",
        canonical_endpoint="/arbiter/execute",
        payload_schema={"required": ["claims"]}
    )

    # A -> B dependency
    step_a = ValidatedPlanStep(
        step_id="step_a",
        information_need_id="need_1",
        capability_id="sentinel.verify_claim",
        specialist="sentinel",
        endpoint="/sentinel/execute",
        description="Verify",
        objective="Verify monsoon",
        expected_output="Verification outcomes",
        reasoning="needed"
    )
    step_b = ValidatedPlanStep(
        step_id="step_b",
        information_need_id="need_2",
        capability_id="arbiter.analyze_causation",
        specialist="arbiter",
        endpoint="/arbiter/execute",
        description="Analyze",
        objective="Analyze causation",
        depends_on=["step_a"],
        dependency_reasoning={"step_a": "Requires verification findings"},
        expected_output="Causation results",
        reasoning="needed"
    )
    plan = ValidatedPlan(steps=[step_a, step_b])

    situation = SituationContext(objective="Verify", requested_outcome="out", entities=[], known_facts=[], uncertainties=[])
    needs = [
        InformationNeed(need_id="need_1", description="Claim text", priority="high", source_context="Facts"),
        InformationNeed(need_id="need_2", description="Causation text", priority="high", source_context="Facts")
    ]

    mock_client = MagicMock(spec=OrchestraClient)
    
    # Step A returns output claims list
    mock_res_a = make_mock_client_response(
        status="COMPLETED",
        claims=[{"claim_id": "c1", "text": "monsoon delay text"}]
    )
    # Step B returns COMPLETED
    mock_res_b = make_mock_client_response(status="COMPLETED")

    # Wire mocked execute returns
    mock_client.execute = AsyncMock()
    mock_client.execute.side_effect = [mock_res_a, mock_res_b]

    orchestrator = ExecutionOrchestrator(registry, mock_client)
    res = await orchestrator.execute(plan, situation, needs)

    assert res.status == PlanExecutionStatus.COMPLETED
    assert len(res.step_results) == 2
    
    # Assert Step B received B's dependency outputs correctly
    assert mock_client.execute.call_count == 2
    # Verify B's call contains step_a's outcome envelope
    b_context = mock_client.execute.call_args_list[1][1]["context"]
    assert "step_a" in b_context["dependency_outputs"]
    assert b_context["dependency_outputs"]["step_a"]["claims"][0]["claim_id"] == "c1"


@pytest.mark.asyncio
async def test_failed_dependency_blocking():
    """Test 5: Verify if Step A fails, Step B becomes BLOCKED (reason: FAILED_DEPENDENCY)."""
    registry = CapabilityRegistry()
    registry.capabilities["sentinel.verify_claim"] = RegistryCapability(
        id="sentinel.verify_claim",
        name="Verify",
        description="Verify",
        endpoint="/sentinel",
        specialist="sentinel",
        canonical_endpoint="/sentinel/execute",
        payload_schema={"required": ["claim_text"]}
    )

    # A -> B
    step_a = ValidatedPlanStep(
        step_id="step_a",
        information_need_id="need_1",
        capability_id="sentinel.verify_claim",
        specialist="sentinel",
        endpoint="/sentinel/execute",
        description="Verify",
        objective="Verify claim",
        expected_output="Verification outcomes",
        reasoning="needed"
    )
    step_b = ValidatedPlanStep(
        step_id="step_b",
        information_need_id="need_2",
        capability_id="sentinel.verify_claim",
        specialist="sentinel",
        endpoint="/sentinel/execute",
        description="Verify B",
        objective="Verify B",
        depends_on=["step_a"],
        dependency_reasoning={"step_a": "Requires outcomes"},
        expected_output="Causation results",
        reasoning="needed"
    )
    plan = ValidatedPlan(steps=[step_a, step_b])

    situation = SituationContext(objective="Verify", requested_outcome="out", entities=[], known_facts=[], uncertainties=[])
    needs = [
        InformationNeed(need_id="need_1", description="desc 1", priority="high", source_context="Facts"),
        InformationNeed(need_id="need_2", description="desc 2", priority="high", source_context="Facts")
    ]

    mock_client = MagicMock(spec=OrchestraClient)
    # A returns FAILED
    mock_res_a = make_mock_client_response(status="FAILED", error={"code": "ERR", "message": "Failed"})
    
    mock_client.execute = AsyncMock(return_value=mock_res_a)

    orchestrator = ExecutionOrchestrator(registry, mock_client)
    res = await orchestrator.execute(plan, situation, needs)

    # Overall execution fails because no steps succeeded
    assert res.status == PlanExecutionStatus.FAILED
    assert len(res.step_results) == 2
    
    # A fails
    assert res.step_results[0].step_id == "step_a"
    assert res.step_results[0].status == StepStatus.FAILED
    
    # B is blocked due to parent dependency failure
    assert res.step_results[1].step_id == "step_b"
    assert res.step_results[1].status == StepStatus.BLOCKED
    assert res.step_results[1].blocked_reason == StepBlockReason.FAILED_DEPENDENCY


@pytest.mark.asyncio
async def test_independent_branch_continues():
    """Test 6: Verify if A fails, B continues successfully, and C becomes BLOCKED."""
    registry = CapabilityRegistry()
    registry.capabilities["sentinel.verify_claim"] = RegistryCapability(
        id="sentinel.verify_claim",
        name="Verify",
        description="Verify",
        endpoint="/sentinel",
        specialist="sentinel",
        canonical_endpoint="/sentinel/execute",
        payload_schema={"required": ["claim_text"]}
    )

    # A -> C, B (independent)
    step_a = ValidatedPlanStep(
        step_id="step_a",
        information_need_id="need_1",
        capability_id="sentinel.verify_claim",
        specialist="sentinel",
        endpoint="/sentinel/execute",
        description="Verify A",
        objective="Verify A",
        expected_output="Verified output",
        reasoning="needed"
    )
    step_b = ValidatedPlanStep(
        step_id="step_b",
        information_need_id="need_2",
        capability_id="sentinel.verify_claim",
        specialist="sentinel",
        endpoint="/sentinel/execute",
        description="Verify B",
        objective="Verify B",
        expected_output="Verified output",
        reasoning="needed"
    )
    step_c = ValidatedPlanStep(
        step_id="step_c",
        information_need_id="need_3",
        capability_id="sentinel.verify_claim",
        specialist="sentinel",
        endpoint="/sentinel/execute",
        description="Verify C",
        objective="Verify C",
        depends_on=["step_a"],
        dependency_reasoning={"step_a": "Requires outcomes"},
        expected_output="Verified output",
        reasoning="needed"
    )
    plan = ValidatedPlan(steps=[step_a, step_b, step_c])

    situation = SituationContext(objective="Verify", requested_outcome="out", entities=[], known_facts=[], uncertainties=[])
    needs = [
        InformationNeed(need_id="need_1", description="desc 1", priority="high", source_context="Facts"),
        InformationNeed(need_id="need_2", description="desc 2", priority="high", source_context="Facts"),
        InformationNeed(need_id="need_3", description="desc 3", priority="high", source_context="Facts")
    ]

    mock_client = MagicMock(spec=OrchestraClient)
    # A fails, B succeeds
    mock_res_a = make_mock_client_response(status="FAILED")
    mock_res_b = make_mock_client_response(status="COMPLETED")
    
    mock_client.execute = AsyncMock()
    mock_client.execute.side_effect = [mock_res_a, mock_res_b]

    orchestrator = ExecutionOrchestrator(registry, mock_client)
    res = await orchestrator.execute(plan, situation, needs)

    # Succeeded B (1 out of 3), so overall status is PARTIAL
    assert res.status == PlanExecutionStatus.PARTIAL
    assert len(res.step_results) == 3
    
    # Assert individual step outcomes
    step_statuses = {s.step_id: s for s in res.step_results}
    assert step_statuses["step_a"].status == StepStatus.FAILED
    assert step_statuses["step_b"].status == StepStatus.COMPLETED
    assert step_statuses["step_c"].status == StepStatus.BLOCKED
    assert step_statuses["step_c"].blocked_reason == StepBlockReason.FAILED_DEPENDENCY


@pytest.mark.asyncio
async def test_invalid_capability_execution_rejection():
    """Test 8: Verify plan requesting unknown capability ID is rejected and marked FAILED."""
    registry = CapabilityRegistry()

    # Step requests capability not in registry
    step = ValidatedPlanStep(
        step_id="step_1",
        information_need_id="need_1",
        capability_id="sentinel.fabricated_capability_999",
        specialist="sentinel",
        endpoint="/sentinel/execute",
        description="Verify",
        objective="Verify claim",
        expected_output="Verification outcomes",
        reasoning="needed"
    )
    plan = ValidatedPlan(steps=[step])

    situation = SituationContext(objective="Verify", requested_outcome="out", entities=[], known_facts=[], uncertainties=[])
    needs = [
        InformationNeed(need_id="need_1", description="desc 1", priority="high", source_context="Facts")
    ]

    mock_client = MagicMock(spec=OrchestraClient)
    orchestrator = ExecutionOrchestrator(registry, mock_client)
    res = await orchestrator.execute(plan, situation, needs)

    assert res.status == PlanExecutionStatus.FAILED
    assert len(res.step_results) == 1
    assert res.step_results[0].status == StepStatus.FAILED
    assert "not found in registry" in res.step_results[0].error
    
    # Verify OrchestraClient was NEVER called
    mock_client.execute.assert_not_called()


@pytest.mark.asyncio
async def test_dependency_output_isolation():
    """Test 9: Verify Step C receives Step A's output, but independent Step B does not."""
    registry = CapabilityRegistry()
    registry.capabilities["sentinel.verify_claim"] = RegistryCapability(
        id="sentinel.verify_claim",
        name="Verify",
        description="Verify",
        endpoint="/sentinel",
        specialist="sentinel",
        canonical_endpoint="/sentinel/execute",
        payload_schema={"required": ["claim_text"]}
    )

    # A -> C, B (independent)
    step_a = ValidatedPlanStep(
        step_id="step_a",
        information_need_id="need_1",
        capability_id="sentinel.verify_claim",
        specialist="sentinel",
        endpoint="/sentinel/execute",
        description="Verify A",
        objective="Verify A",
        expected_output="output a",
        reasoning="needed"
    )
    step_b = ValidatedPlanStep(
        step_id="step_b",
        information_need_id="need_2",
        capability_id="sentinel.verify_claim",
        specialist="sentinel",
        endpoint="/sentinel/execute",
        description="Verify B",
        objective="Verify B",
        expected_output="output b",
        reasoning="needed"
    )
    step_c = ValidatedPlanStep(
        step_id="step_c",
        information_need_id="need_3",
        capability_id="sentinel.verify_claim",
        specialist="sentinel",
        endpoint="/sentinel/execute",
        description="Verify C",
        objective="Verify C",
        depends_on=["step_a"],
        dependency_reasoning={"step_a": "Requires outcomes"},
        expected_output="output c",
        reasoning="needed"
    )
    plan = ValidatedPlan(steps=[step_a, step_b, step_c])

    situation = SituationContext(objective="Verify", requested_outcome="out", entities=[], known_facts=[], uncertainties=[])
    needs = [
        InformationNeed(need_id="need_1", description="desc 1", priority="high", source_context="Facts"),
        InformationNeed(need_id="need_2", description="desc 2", priority="high", source_context="Facts"),
        InformationNeed(need_id="need_3", description="desc 3", priority="high", source_context="Facts")
    ]

    mock_client = MagicMock(spec=OrchestraClient)
    
    # A returns claim_id output
    mock_res_a = AgentResult(agent="sentinel", task_id="tsk_a", status="COMPLETED", claims=[{"claim_id": "c_a"}])
    # B returns COMPLETED
    mock_res_b = make_mock_client_response(status="COMPLETED")
    # C returns COMPLETED
    mock_res_c = make_mock_client_response(status="COMPLETED")

    mock_client.execute = AsyncMock()
    mock_client.execute.side_effect = [mock_res_a, mock_res_b, mock_res_c]

    orchestrator = ExecutionOrchestrator(registry, mock_client)
    res = await orchestrator.execute(plan, situation, needs)

    assert res.status == PlanExecutionStatus.COMPLETED
    assert mock_client.execute.call_count == 3
    
    # Verify B's context did NOT receive A's output
    b_context = mock_client.execute.call_args_list[1][1]["context"]
    assert "step_a" not in b_context["dependency_outputs"]
    
    # Verify C's context DID receive A's output
    c_context = mock_client.execute.call_args_list[2][1]["context"]
    assert "step_a" in c_context["dependency_outputs"]
    assert c_context["dependency_outputs"]["step_a"]["claims"][0]["claim_id"] == "c_a"


@pytest.mark.asyncio
async def test_provenance_preservation():
    """Test 10: Verify ProvenanceRecord propagation and lineage tracking."""
    registry = CapabilityRegistry()
    registry.capabilities["sentinel.verify_claim"] = RegistryCapability(
        id="sentinel.verify_claim",
        name="Verify",
        description="Verify",
        endpoint="/sentinel",
        specialist="sentinel",
        canonical_endpoint="/sentinel/execute",
        payload_schema={
            "required": ["claim_text"],
            "optional": ["evidence_refs"]
        }
    )

    step = ValidatedPlanStep(
        step_id="step_a",
        information_need_id="need_1",
        capability_id="sentinel.verify_claim",
        specialist="sentinel",
        endpoint="/sentinel/execute",
        description="Verify A",
        objective="Verify A",
        expected_output="output a",
        reasoning="needed"
    )
    plan = ValidatedPlan(steps=[step])

    situation = SituationContext(objective="Verify", requested_outcome="out", entities=[], known_facts=[], uncertainties=[])
    needs = [
        InformationNeed(need_id="need_1", description="desc 1", priority="high", source_context="Facts")
    ]

    # Create case context containing evidence with origin records
    case_context = NormalizedCaseContext(
        project=ProjectRecord(project_id="prj_1", name="name", description="desc", origin="verified_public"),
        vendors=[VendorRecord(vendor_id="vendor_apex", name="Apex", origin="verified_public")],
        evidence=[
            EvidenceRecord(
                evidence_id="ev_001",
                project_id="prj_1",
                source_ref="NAO Report",
                source_title="Completing Crossrail",
                origin="verified_public"
            )
        ]
    )

    mock_client = MagicMock(spec=OrchestraClient)
    mock_client.execute = AsyncMock(return_value=make_mock_client_response(status="COMPLETED"))

    orchestrator = ExecutionOrchestrator(registry, mock_client)
    res = await orchestrator.execute(plan, situation, needs, case_context=case_context)

    assert res.status == PlanExecutionStatus.COMPLETED
    
    # Verify input_provenance populated the project evidence records
    step_res = res.step_results[0]
    assert len(step_res.input_provenance) > 0
    
    # Must contain case evidence record with matching origin/reference
    ev_prov = next(p for p in step_res.input_provenance if p.source_id == "ev_001")
    assert ev_prov.source_type == "case_record"
    assert ev_prov.origin == "verified_public"

    # Verify output_provenance tracks step lineage
    assert len(step_res.output_provenance) == 1
    out_prov = step_res.output_provenance[0]
    assert out_prov.source_type == "dependency_output"
    assert out_prov.produced_by_step == "step_a"
    assert "ev_001" in out_prov.parent_provenance_ids
