import sys
from pathlib import Path

# Add project root to sys.path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

import pytest
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock
from datetime import datetime, timezone

from common.schemas.task import AgentResult, AgentTask
from orchestra.situation import SituationContext
from orchestra.registry import CapabilityRegistry, RegistryCapability
from orchestra.client import OrchestraClient
from orchestra.planner import InformationNeed, ValidatedPlan, ValidatedPlanStep
from orchestra.repository import NormalizedCaseContext, ProjectRecord, VendorRecord, EvidenceRecord, PORecord, EngineeringChangeRecord, ScheduleEventRecord, ProcurementItemRecord
from orchestra.execution import (
    ExecutionOrchestrator,
    StepStatus,
    StepBlockReason,
    PlanExecutionStatus,
    ProvenanceRecord,
    StepExecutionResult,
    PlanExecutionResult
)
from services.compass_service import compass_service, build_dynamic_ripple_graph


# ============================================================================
# Helpers
# ============================================================================

def make_mock_client_response(status: str = "COMPLETED", findings: list = None, error: dict = None, claims: list = None) -> AgentResult:
    return AgentResult(
        agent="compass",
        task_id="tsk_mock_123",
        status=status,
        findings=findings or [],
        claims=claims or [],
        error=error
    )

def make_agent_task(capability: str, payload: dict, context: dict = None) -> AgentTask:
    return AgentTask(
        task_id="tsk_test_123",
        capability=capability,
        project_id="prj_test",
        entity_ids=[],
        payload=payload,
        context=context
    )



# ============================================================================
# Compass Specialist Unit & Integration Tests
# ============================================================================

def test_compass_capability_present_in_registry():
    """Test 1: Compass capability is dynamically present in the registry."""
    registry = CapabilityRegistry()
    assert "compass.analyze_downstream_impact" in registry.capabilities
    
    cap = registry.get("compass.analyze_downstream_impact")
    assert cap.specialist == "compass"
    assert cap.canonical_endpoint == "/compass/execute"
    assert "subject" in cap.payload_schema.get("required", [])


@patch("common.llm_client.UnifiedLLMClient.generate_structured")
def test_compass_candidate_scoring_eval(mock_generate):
    """Test 2: Compass is scored as a candidate based on needs without case-specific logic."""
    from orchestra.planner import evaluate_capabilities
    
    # Mock LLM evaluation response
    mock_generate.return_value = {
        "candidates": [
            {
                "capability_id": "compass.analyze_downstream_impact",
                "information_need_id": "need_downstream",
                "relevance_score": 0.95,
                "explanation": "Perfect match to trace downstream activities"
            }
        ]
    }

    registry = CapabilityRegistry()
    needs = [
        InformationNeed(
            need_id="need_downstream",
            description="Trace downstream activities and blast radius of the anchor bolt change.",
            priority="high",
            source_context="Engineering Change"
        )
    ]

    candidates = evaluate_capabilities(needs, registry)
    assert len(candidates) == 1
    assert candidates[0].capability_id == "compass.analyze_downstream_impact"
    assert candidates[0].relevance_score == 0.95


@pytest.mark.asyncio
async def test_dynamic_capability_flow_end_to_end():
    """Test 3: A newly registered capability flows through discovery, planning, and execution dynamically."""
    registry = CapabilityRegistry()
    
    # Injected new capability at runtime
    new_cap = RegistryCapability(
        id="compass.analyze_warranty_exposure",
        name="Warranty Exposure Check",
        description="Tracks active subcontractor warranties and calculates defect remediation exposure windows.",
        use_when=["checking warranties"],
        endpoint="/compass/warranty_check",
        specialist="compass",
        canonical_endpoint="/compass/execute",
        payload_schema={"required": ["claim_text"]}
    )
    registry.capabilities[new_cap.id] = new_cap

    # Step builds and references it
    step = ValidatedPlanStep(
        step_id="step_1",
        information_need_id="need_1",
        capability_id="compass.analyze_warranty_exposure",
        specialist="compass",
        endpoint="/compass/execute",
        description="Audit warranties",
        objective="Analyze defect windows",
        expected_output="Warranty clock status",
        reasoning="needed"
    )
    plan = ValidatedPlan(steps=[step])

    situation = SituationContext(objective="Warranty check", requested_outcome="remediation status", entities=[], known_facts=[], uncertainties=[])
    needs = [InformationNeed(need_id="need_1", description="desc 1", priority="high", source_context="Facts")]

    mock_client = MagicMock(spec=OrchestraClient)
    mock_res = AgentResult(agent="compass", task_id="tsk_1", status="COMPLETED", findings=[{"verdict": "active"}])
    mock_client.execute = AsyncMock(return_value=mock_res)

    orchestrator = ExecutionOrchestrator(registry, mock_client)
    res = await orchestrator.execute(plan, situation, needs)

    assert res.status == PlanExecutionStatus.COMPLETED
    assert res.step_results[0].status == StepStatus.COMPLETED
    assert res.step_results[0].capability_id == "compass.analyze_warranty_exposure"


@pytest.mark.asyncio
async def test_compass_step_execution():
    """Test 4: A Compass plan step executes through generic registry resolution."""
    registry = CapabilityRegistry()
    
    step = ValidatedPlanStep(
        step_id="step_1",
        information_need_id="need_1",
        capability_id="compass.analyze_downstream_impact",
        specialist="compass",
        endpoint="/compass/execute",
        description="Downstream Analysis",
        objective="Trace Paddington access delay impact",
        expected_output="Downstream activities affected",
        reasoning="needed"
    )
    plan = ValidatedPlan(steps=[step])

    situation = SituationContext(objective="Access window block", requested_outcome="resolution", entities=[], known_facts=[], uncertainties=[])
    needs = [
        InformationNeed(
            need_id="need_1",
            description="Trace Paddington access delay impact",
            priority="high",
            source_context="Facts"
        )
    ]

    mock_client = MagicMock(spec=OrchestraClient)
    mock_res = AgentResult(agent="compass", task_id="tsk_1", status="COMPLETED", findings=[{"impact": "energization delayed"}])
    mock_client.execute = AsyncMock(return_value=mock_res)

    orchestrator = ExecutionOrchestrator(registry, mock_client)
    res = await orchestrator.execute(plan, situation, needs)

    assert res.status == PlanExecutionStatus.COMPLETED
    assert res.step_results[0].status == StepStatus.COMPLETED
    
    # Assert dynamic payload mapping resolved claim_text/subject from description
    mock_client.execute.assert_called_once()
    kwargs = mock_client.execute.call_args[1]
    assert kwargs["payload"]["subject"] == "Trace Paddington access delay impact"


@pytest.mark.asyncio
async def test_upstream_dependency_propagation_to_compass():
    """Test 5: Dependency outputs from an upstream step are available to Compass."""
    registry = CapabilityRegistry()
    
    step_a = ValidatedPlanStep(
        step_id="step_a",
        information_need_id="need_1",
        capability_id="sentinel.verify_claim",
        specialist="sentinel",
        endpoint="/sentinel/execute",
        description="Verify",
        objective="Verify rain delay",
        expected_output="Output rain stats",
        reasoning="needed"
    )
    step_b = ValidatedPlanStep(
        step_id="step_b",
        information_need_id="need_2",
        capability_id="compass.analyze_downstream_impact",
        specialist="compass",
        endpoint="/compass/execute",
        description="Compass Downstream",
        objective="Analyze rain delay impact",
        depends_on=["step_a"],
        dependency_reasoning={"step_a": "Requires verification findings"},
        expected_output="Downstream schedule slippage",
        reasoning="needed"
    )
    plan = ValidatedPlan(steps=[step_a, step_b])

    situation = SituationContext(objective="Verify", requested_outcome="out", entities=[], known_facts=[], uncertainties=[])
    needs = [
        InformationNeed(need_id="need_1", description="desc 1", priority="high", source_context="Facts"),
        InformationNeed(need_id="need_2", description="desc 2", priority="high", source_context="Facts")
    ]

    mock_client = MagicMock(spec=OrchestraClient)
    mock_res_a = AgentResult(agent="sentinel", task_id="tsk_a", status="COMPLETED", findings=[{"verified_days": 12}])
    mock_res_b = AgentResult(agent="compass", task_id="tsk_b", status="COMPLETED", findings=[{"impact": "24 days"}])

    mock_client.execute = AsyncMock()
    mock_client.execute.side_effect = [mock_res_a, mock_res_b]

    orchestrator = ExecutionOrchestrator(registry, mock_client)
    res = await orchestrator.execute(plan, situation, needs)

    assert res.status == PlanExecutionStatus.COMPLETED
    assert mock_client.execute.call_count == 2
    
    # Verify B's context includes A's findings
    b_context = mock_client.execute.call_args_list[1][1]["context"]
    assert "step_a" in b_context["dependency_outputs"]
    assert b_context["dependency_outputs"]["step_a"]["findings"][0]["verified_days"] == 12


@pytest.mark.asyncio
async def test_missing_required_input_blocks_compass():
    """Test 6: Missing required input results in BLOCKED status, not a fabricated value."""
    registry = CapabilityRegistry()
    
    step = ValidatedPlanStep(
        step_id="step_1",
        information_need_id="need_1",
        capability_id="compass.analyze_downstream_impact",
        specialist="compass",
        endpoint="/compass/execute",
        description="Verify",
        objective="Action",
        expected_output="output",
        reasoning="needed"
    )
    plan = ValidatedPlan(steps=[step])

    # Situation containing no facts/entities to map, and need description does not resolve "subject"
    # To simulate this, we patch resolve_field_value to return None
    situation = SituationContext(objective="", requested_outcome="", entities=[], known_facts=[], uncertainties=[])
    needs = [InformationNeed(need_id="need_1", description="", priority="high", source_context="Facts")]

    mock_client = MagicMock(spec=OrchestraClient)
    orchestrator = ExecutionOrchestrator(registry, mock_client)
    
    with patch("orchestra.execution.resolve_field_value", return_value=(None, None)):
        res = await orchestrator.execute(plan, situation, needs)
        
        assert res.status == PlanExecutionStatus.FAILED
        assert res.step_results[0].status == StepStatus.BLOCKED
        assert res.step_results[0].blocked_reason == StepBlockReason.MISSING_REQUIRED_INPUT
        mock_client.execute.assert_not_called()


@pytest.mark.asyncio
async def test_inactive_compass_capability_blocks():
    """Test 7: Inactive Compass capability blocks execution."""
    registry = CapabilityRegistry()
    
    # Set availability to unavailable
    registry.capabilities["compass.analyze_downstream_impact"].availability = "unavailable"

    step = ValidatedPlanStep(
        step_id="step_1",
        information_need_id="need_1",
        capability_id="compass.analyze_downstream_impact",
        specialist="compass",
        endpoint="/compass/execute",
        description="Compass Check",
        objective="Audit",
        expected_output="Out",
        reasoning="needed"
    )
    plan = ValidatedPlan(steps=[step])

    situation = SituationContext(objective="Audit", requested_outcome="Out", entities=[], known_facts=[], uncertainties=[])
    needs = [InformationNeed(need_id="need_1", description="Audit", priority="high", source_context="Facts")]

    mock_client = MagicMock(spec=OrchestraClient)
    orchestrator = ExecutionOrchestrator(registry, mock_client)
    res = await orchestrator.execute(plan, situation, needs)

    assert res.status == PlanExecutionStatus.FAILED
    assert res.step_results[0].status == StepStatus.BLOCKED
    assert res.step_results[0].blocked_reason == StepBlockReason.MISSING_REQUIRED_INPUT


@pytest.mark.asyncio
async def test_compass_provenance_preservation():
    """Test 8: Provenance records are preserved from inputs to Compass findings and results."""
    registry = CapabilityRegistry()
    
    step = ValidatedPlanStep(
        step_id="step_a",
        information_need_id="need_1",
        capability_id="compass.analyze_downstream_impact",
        specialist="compass",
        endpoint="/compass/execute",
        description="Verify",
        objective="Trace po_tunnel_systems_303",
        expected_output="output",
        reasoning="needed"
    )
    plan = ValidatedPlan(steps=[step])

    situation = SituationContext(objective="Verify", requested_outcome="out", entities=[], known_facts=[], uncertainties=[])
    needs = [
        InformationNeed(need_id="need_1", description="Trace po_tunnel_systems_303", priority="high", source_context="Facts")
    ]

    case_context = NormalizedCaseContext(
        project=ProjectRecord(project_id="prj_1", name="name", description="desc", origin="verified_public"),
        vendors=[VendorRecord(vendor_id="vendor_apex", name="Apex", origin="verified_public")],
        purchase_orders=[
            PORecord(
                po_id="po_tunnel_systems_303",
                project_id="prj_1",
                vendor_id="vendor_apex",
                procurement_item_id="item_1",
                issue_date="2026-01-01",
                original_delivery_date="2026-05-15",
                revised_delivery_date="2026-07-20",
                status="delayed",
                origin="verified_public"
            )
        ]
    )

    mock_client = MagicMock(spec=OrchestraClient)
    mock_client.execute = AsyncMock(return_value=make_mock_client_response(status="COMPLETED"))

    orchestrator = ExecutionOrchestrator(registry, mock_client)
    res = await orchestrator.execute(plan, situation, needs, case_context=case_context)

    assert res.status == PlanExecutionStatus.COMPLETED
    
    # Assert input_provenance was successfully captured from Case Context purchase order record
    step_res = res.step_results[0]
    assert len(step_res.input_provenance) > 0
    po_prov = next(p for p in step_res.input_provenance if p.source_id == "po_tunnel_systems_303")
    assert po_prov.source_type == "case_record"
    assert po_prov.origin == "verified_public"

    # Verify lineage is traced in output_provenance
    assert len(step_res.output_provenance) == 1
    assert "po_tunnel_systems_303" in step_res.output_provenance[0].parent_provenance_ids


def test_crossrail_style_dependency_analysis():
    """Test 9: Crossrail-style dependency context can be analyzed without case-specific routing."""
    # Build case context mock replicating Crossrail case records
    case_context = NormalizedCaseContext(
        project=ProjectRecord(project_id="prj_crossrail_tunnel_systems", name="Crossrail", origin="verified_public"),
        vendors=[VendorRecord(vendor_id="vendor_railtech_infrastructure", name="RailTech", origin="verified_public")],
        procurement_items=[
            ProcurementItemRecord(
                item_id="item_tunnel_power_cables",
                project_id="prj_crossrail_tunnel_systems",
                description="Power cables",
                origin="verified_public"
            )
        ],
        purchase_orders=[
            PORecord(
                po_id="po_tunnel_systems_303",
                project_id="prj_crossrail_tunnel_systems",
                vendor_id="vendor_railtech_infrastructure",
                procurement_item_id="item_tunnel_power_cables",
                issue_date="2026-01-10",
                original_delivery_date="2026-05-15",
                revised_delivery_date="2026-07-20",
                status="delayed",
                value_range="$1M - $5M",
                origin="synthetic_augmented"
            )
        ],
        engineering_changes=[
            EngineeringChangeRecord(
                change_id="ec_tunnel_cable_brackets",
                project_id="prj_crossrail_tunnel_systems",
                affected_entity="item_tunnel_power_cables",
                revision_date="2026-03-01",
                description="Revision to brackets load specification.",
                impact="Delayed catenary activity.",
                origin="synthetic_augmented"
            )
        ],
        schedule_events=[
            ScheduleEventRecord(
                event_id="se_station_access_delay",
                project_id="prj_crossrail_tunnel_systems",
                event_date="2026-06-01",
                affected_work_package="Overhead Line Catenary Installation",
                description="Delayed station structural works, blocking access.",
                impact="Forced sequential change.",
                origin="synthetic_augmented"
            )
        ]
    )

    # 1. Subject is the Engineering Change ec_tunnel_cable_brackets
    nodes, edges, summary, reasoning, confidence = build_dynamic_ripple_graph("ec_tunnel_cable_brackets", case_context)

    # Assertions
    # ec_tunnel_cable_brackets should trigger the engineering change spec node,
    # the matching PO material node, and the schedule event node
    node_ids = [n["id"] for n in nodes]
    assert "ec_tunnel_cable_brackets" in node_ids
    assert "po_tunnel_systems_303" in node_ids
    assert "se_station_access_delay" in node_ids
    assert "milestone_energization" in node_ids

    # Cost rollup should match po_tunnel_systems_303 ($1M - $5M midpoint) plus spec reworking (500) and schedule (2000)
    assert summary["cost_impact_usd"] == 3000000.0 + 500.0 + 2000.0
    # Schedule impact calculated from PO delivery delta: 2026-05-15 to 2026-07-20 is 66 days
    # (plus schedule delay if critical, here it rolls up critical path PO + schedule delay: 66 + 25 = 91 days)
    assert summary["schedule_impact_days"] == 66.0 + 25.0


def test_dpr_style_dependency_analysis():
    """Test 10: DPR-style schedule/procurement dependency context can also be analyzed without specialist-specific routing."""
    case_context = NormalizedCaseContext(
        project=ProjectRecord(project_id="prj_data_center_dpr", name="DPR", origin="verified_public"),
        vendors=[VendorRecord(vendor_id="vendor_apex", name="Apex", origin="verified_public")],
        procurement_items=[
            ProcurementItemRecord(
                item_id="item_dc_coolant_pipes",
                project_id="prj_data_center_dpr",
                description="Coolant pipes",
                origin="verified_public"
            )
        ],
        purchase_orders=[
            PORecord(
                po_id="po_dc_pipes_505",
                project_id="prj_data_center_dpr",
                vendor_id="vendor_apex",
                procurement_item_id="item_dc_coolant_pipes",
                issue_date="2026-06-01",
                original_delivery_date="2026-10-10",
                revised_delivery_date="2026-09-10",
                status="accelerated",
                value_range="$500k - $1M",
                origin="synthetic_augmented"
            )
        ],
        schedule_events=[
            ScheduleEventRecord(
                event_id="se_dc_resequencing",
                project_id="prj_data_center_dpr",
                event_date="2026-07-15",
                affected_work_package="Cooling Loop Installation",
                description="structural foundation completed early, moving piping install window forward from Oct 12 to Sept 12.",
                impact="Requires cooling loop pipes to be delivered by Sept 10 instead of Oct 10",
                origin="synthetic_augmented"
            )
        ]
    )

    # 2. Subject is the schedule resequencing event se_dc_resequencing
    nodes, edges, summary, reasoning, confidence = build_dynamic_ripple_graph("se_dc_resequencing", case_context)

    node_ids = [n["id"] for n in nodes]
    assert "se_dc_resequencing" in node_ids
    assert "po_dc_pipes_505" in node_ids

    # Cost rollup should match po_dc_pipes_505 ($500k - $1M midpoint = 750000.0) plus schedule advanced (no positive cost delta)
    assert summary["cost_impact_usd"] == 750000.0
    
    # Schedule impact calculated from PO delivery delta: 2026-10-10 to 2026-09-10 is -30 days
    # Resequencing event specifies advanced/early install window: -30 days. Critical path checks rollup: -30 days.
    assert summary["schedule_impact_days"] == -30.0


def test_no_fabricated_impact_if_unsupported():
    """Test 11: No numeric cost/schedule impact is fabricated when the source context does not support it."""
    # Context contains no matching records
    case_context = NormalizedCaseContext(
        project=ProjectRecord(project_id="prj_empty", name="empty", origin="verified_public")
    )

    nodes, edges, summary, reasoning, confidence = build_dynamic_ripple_graph("unknown_decision_abc", case_context)
    
    node_ids = [n["id"] for n in nodes]
    assert "impact_uncertain" in node_ids
    assert summary["cost_impact_usd"] == 0.0
    assert summary["schedule_impact_days"] == 0.0
    assert "Insufficient source data" in reasoning
