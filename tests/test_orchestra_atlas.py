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
from orchestra.repository import NormalizedCaseContext, ProjectRecord, VendorRecord, PORecord
from orchestra.execution import (
    ExecutionOrchestrator,
    StepStatus,
    StepBlockReason,
    PlanExecutionStatus,
    ProvenanceRecord
)

from services.relevance_engine import RelevanceEngine


# ============================================================================
# Helpers
# ============================================================================

def make_mock_client_response(agent: str, status: str = "COMPLETED", findings: list = None) -> AgentResult:
    return AgentResult(
        agent=agent,
        task_id="tsk_mock_123",
        status=status,
        findings=findings or [],
        claims=[],
        error=None,
        receipt_id="rcpt_atlas_test"
    )


# ============================================================================
# Atlas Specialist Tests
# ============================================================================

def test_atlas_registry_discovery():
    """Test 1: Verify Atlas capabilities are registered and dynamically discoverable."""
    registry = CapabilityRegistry()
    capabilities = {c.id: c for c in registry.list_capabilities()}
    
    assert "atlas.external_event" in capabilities
    assert "atlas.commodity" in capabilities
    assert "atlas.shipping" in capabilities
    assert "atlas.geopolitical" in capabilities
    
    # Assert authoritative metadata comes from the registry
    cap = registry.get("atlas.shipping")
    assert cap.specialist == "atlas"
    assert cap.canonical_endpoint == "/atlas/execute"
    assert "route" in cap.payload_schema.get("required", [])
    assert "expected_arrival" in cap.payload_schema.get("required", [])


def test_relevance_engine_filtering():
    """Test 2: Verify that relevant events are matched and irrelevant events are excluded."""
    engine = RelevanceEngine()
    
    from datetime import datetime
    # Task 1: A shipping task looking at Mumbai port congestion
    task_shipping = {
        "payload": {
            "route": {"origin": "Mumbai Port", "destination": "Delhi"},
            "expected_arrival": datetime.utcnow().isoformat()
        }
    }
    
    risks = engine.assess_event(task_shipping)
    port_congestion_risk = next((r for r in risks if r["event_id"] == "EXT-MUM-001"), None)
    irrelevant_risk = next((r for r in risks if r["event_id"] == "EXT-IRR-001"), None)
    
    assert port_congestion_risk is not None
    assert port_congestion_risk["relevance"] > 0.8
    assert "congestion" in port_congestion_risk["estimated_impact"].lower()
    
    assert irrelevant_risk is not None
    assert irrelevant_risk["relevance"] == 0.0


def test_relevance_engine_commodity_price_exposure():
    """Test 3: Verify commodity price risk relevance matching."""
    engine = RelevanceEngine()
    
    task_steel = {
        "payload": {
            "material": "steel"
        }
    }
    
    risks = engine.assess_event(task_steel)
    steel_risk = next((r for r in risks if r["event_id"] == "EXT-COMM-001"), None)
    assert steel_risk is not None
    assert steel_risk["relevance"] > 0.8
    assert "steel" in steel_risk["description"].lower()


@pytest.mark.asyncio
async def test_atlas_execution_pipeline():
    """Test 4: Verify that an Atlas capability can execute cleanly through the standard orchestrator."""
    registry = CapabilityRegistry()
    
    step = ValidatedPlanStep(
        step_id="step_shipping",
        information_need_id="need_1",
        capability_id="atlas.shipping",
        specialist="atlas",
        endpoint="/atlas/execute",
        description="Check shipping risks",
        objective="Find port congestion",
        expected_output="Logistics risks",
        reasoning="needed"
    )
    plan = ValidatedPlan(steps=[step])
    
    situation = SituationContext(objective="Assess routes", requested_outcome="shipping status", entities=[], known_facts=[], uncertainties=[])
    needs = [InformationNeed(need_id="need_1", description="Check route and expected arrival date for Mumbai Port", priority="high", source_context="Facts")]
    
    case_context = NormalizedCaseContext(
        project=ProjectRecord(project_id="prj_1", name="resort", description="desc", origin="verified_public"),
        purchase_orders=[
            PORecord(
                po_id="po_1",
                project_id="prj_1",
                vendor_id="v_1",
                procurement_item_id="pi_1",
                issue_date="2026-01-01",
                original_delivery_date="2026-08-02",
                status="delayed",
                origin="verified_public"
            )
        ]
    )

    mock_client = MagicMock(spec=OrchestraClient)
    mock_res = make_mock_client_response(
        agent="atlas",
        status="COMPLETED",
        findings=[{"event_id": "EXT-MUM-001", "relevance": 0.95}]
    )
    mock_client.execute = AsyncMock(return_value=mock_res)

    orchestrator = ExecutionOrchestrator(registry, mock_client)
    res = await orchestrator.execute(plan, situation, needs, case_context=case_context)

    assert res.status == PlanExecutionStatus.COMPLETED
    assert len(res.step_results) == 1
    assert res.step_results[0].status == StepStatus.COMPLETED
    
    # Confirm mock client was invoked with correctly resolved payload
    mock_client.execute.assert_called_once()
    kwargs = mock_client.execute.call_args[1]
    assert "route" in kwargs["payload"]
    assert "expected_arrival" in kwargs["payload"]
    assert kwargs["payload"]["route"]["origin"] == "Mumbai Port"


@pytest.mark.asyncio
async def test_atlas_missing_inputs_blocks():
    """Test 5: Unresolved required inputs block step execution instead of inventing data."""
    registry = CapabilityRegistry()
    
    step = ValidatedPlanStep(
        step_id="step_shipping",
        information_need_id="need_1",
        capability_id="atlas.shipping",
        specialist="atlas",
        endpoint="/atlas/execute",
        description="Check shipping risks",
        objective="Find port congestion",
        expected_output="Logistics risks",
        reasoning="needed"
    )
    plan = ValidatedPlan(steps=[step])
    
    # Scenario: situation and needs do NOT have route or expected arrival dates, and case context has no POs
    situation = SituationContext(objective="Assess routes", requested_outcome="shipping status", entities=[], known_facts=[], uncertainties=[])
    needs = [InformationNeed(need_id="need_1", description="General query", priority="high", source_context="Facts")]
    
    # We patch resolve_field_value to return None to simulate failure to resolve
    with patch("orchestra.execution.resolve_field_value", return_value=(None, None)):
        mock_client = MagicMock(spec=OrchestraClient)
        orchestrator = ExecutionOrchestrator(registry, mock_client)
        res = await orchestrator.execute(plan, situation, needs)
        
        # Step should become BLOCKED
        assert res.status == PlanExecutionStatus.FAILED
        assert res.step_results[0].status == StepStatus.BLOCKED
        assert res.step_results[0].blocked_reason == StepBlockReason.MISSING_REQUIRED_INPUT
        mock_client.execute.assert_not_called()
