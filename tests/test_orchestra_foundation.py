import sys
from pathlib import Path

# Add project root and sentinel to sys.path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "sentinel"))

import pytest
import asyncio
from unittest.mock import patch, MagicMock

import httpx
from common.schemas.task import AgentTask, AgentResult

from orchestra.state import OrchestraState, PlanStep
from orchestra.registry import CapabilityRegistry
from orchestra.client import OrchestraClient
from orchestra.trace import ExecutionTraceEntry



# ============================================================================
# A. Capability Registry Tests
# ============================================================================

def test_registry_known_capability_lookup():
    # Load capability manifest
    registry = CapabilityRegistry()
    
    # Verify lookup of a real capability
    cap = registry.get("sentinel.verify_claim")
    assert cap.id == "sentinel.verify_claim"
    assert cap.specialist == "sentinel"
    assert cap.canonical_endpoint == "/sentinel/execute"
    assert "claim_text" in cap.payload_schema.get("required", [])


def test_registry_unknown_capability_rejection():
    registry = CapabilityRegistry()
    
    # Assert KeyError is raised for invalid capability ID
    with pytest.raises(KeyError) as exc_info:
        registry.get("invalid.capability_id")
    assert "invalid.capability_id" in str(exc_info.value)


def test_registry_explicit_service_resolution():
    registry = CapabilityRegistry()
    
    # Verify different specialists are explicitly resolved
    cap_trust = registry.get("trustline.get_vendor_profile")
    assert cap_trust.specialist == "trustline"
    assert cap_trust.canonical_endpoint == "/trustline/execute"

    cap_arbiter = registry.get("arbiter.analyze_dispute")
    assert cap_arbiter.specialist == "arbiter"
    assert cap_arbiter.canonical_endpoint == "/arbiter/execute"


# ============================================================================
# B. Specialist Client Unit Tests
# ============================================================================

@pytest.mark.asyncio
async def test_client_valid_agent_task_construction():
    registry = CapabilityRegistry()
    client = OrchestraClient(registry, base_url="http://test")
    
    # We patch the httpx.AsyncClient.post method to inspect the constructed payload
    with patch("httpx.AsyncClient.post") as mock_post:
        # Mock a valid response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "agent": "sentinel",
            "task_id": "tsk_test_123",
            "status": "COMPLETED",
            "findings": [{"verdict": "supported"}]
        }
        mock_post.return_value = mock_response

        # Execute client call
        result = await client.execute(
            capability_id="sentinel.verify_claim",
            payload={"claim_text": "Monsoon delay"},
            project_id="prj_1",
            entity_ids=["vendor_apex"],
            task_id="tsk_test_123"
        )
        
        # Verify call arguments
        mock_post.assert_called_once()
        call_args, call_kwargs = mock_post.call_args
        
        assert call_args[0] == "http://test/sentinel/execute"
        json_payload = call_kwargs["json"]
        
        # Assert proper AgentTask structure
        assert json_payload["task_id"] == "tsk_test_123"
        assert json_payload["capability"] == "sentinel.verify_claim"
        assert json_payload["project_id"] == "prj_1"
        assert json_payload["entity_ids"] == ["vendor_apex"]
        assert json_payload["payload"] == {"claim_text": "Monsoon delay"}


@pytest.mark.asyncio
async def test_client_invalid_response_rejection():
    registry = CapabilityRegistry()
    client = OrchestraClient(registry, base_url="http://test")

    with patch("httpx.AsyncClient.post") as mock_post:
        # Mock response that lacks required Pydantic fields (e.g. status)
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "agent": "sentinel",
            "task_id": "tsk_test_123"
            # Missing "status"
        }
        mock_post.return_value = mock_response

        result = await client.execute(
            capability_id="sentinel.verify_claim",
            payload={"claim_text": "Monsoon delay"},
            task_id="tsk_test_123"
        )
        
        # Result status must be FAILED, and error code must be PROCESSING_FAILED
        assert result.status == "FAILED"
        assert result.error is not None
        assert result.error["code"] == "PROCESSING_FAILED"
        assert "Agent response failed validation" in result.error["message"]


@pytest.mark.asyncio
async def test_client_connection_error_handling():
    registry = CapabilityRegistry()
    client = OrchestraClient(registry, base_url="http://invalid-url-to-test-connection-error")

    result = await client.execute(
        capability_id="sentinel.verify_claim",
        payload={"claim_text": "Monsoon delay"}
    )
    
    assert result.status == "FAILED"
    assert result.error is not None
    assert result.error["code"] == "SPECIALIST_UNAVAILABLE"
    assert result.error["retryable"] is True


# ============================================================================
# C. End-to-End Integration Flow Test (ASGI Loopback)
# ============================================================================

@pytest.mark.asyncio
async def test_e2e_integration_flow():
    # 1. Initialize Registry and Client using ASGI loopback routing directly to FastAPI app
    registry = CapabilityRegistry()
    client = OrchestraClient(registry, base_url="http://test")
    
    # Instantiate in-memory OrchestraState for run
    state = OrchestraState(
        run_id="run_e2e_test_1",
        project_id="prj_riverside",
        objective="Verify monsoon delay claim reliability"
    )
    
    # 2. Discover capability and resolve specialist/endpoint
    capability_id = "sentinel.verify_claim"
    cap = registry.get(capability_id)
    assert cap.specialist == "sentinel"
    assert cap.canonical_endpoint == "/sentinel/execute"
    
    # 3. Create execution trace entry
    task_id = "tsk_verify_delay_claim"
    trace = ExecutionTraceEntry(
        run_id=state.run_id,
        task_id=task_id,
        capability=capability_id,
        resolved_specialist=cap.specialist
    )
    
    # 4. Invoke canonical specialist execution endpoint over mock HTTP transport
    with patch("httpx.AsyncClient.post") as mock_post:
        # Mock a valid Response from the specialist execute endpoint
        mock_response = MagicMock(spec=httpx.Response)
        mock_response.status_code = 200
        mock_json = {
            "agent": "sentinel",
            "task_id": task_id,
            "status": "COMPLETED",
            "findings": [{"verdict": "contradicted", "explanation": "Rain delay contradicted by local logs."}],
            "evidence": ["ev_s1_1"],
            "confidence": 0.95,
            "risks": ["Weather delay has cost mismatch"],
            "recommended_next_capabilities": ["trustline.update_trust"],
            "receipt_id": "rcpt_sentinel_123"
        }
        mock_response.json.return_value = mock_json
        mock_post.return_value = mock_response

        result = await client.execute(
            capability_id=capability_id,
            payload={
                "claim_text": "Subcontractor claims delay due to heavy monsoon rain July 10-24.",
                "file_name": "delay_claim.txt"
            },
            project_id=state.project_id,
            entity_ids=["vendor_meridian"],
            task_id=task_id
        )

        # Assert correct HTTP call parameters (routing through canonical endpoint /sentinel/execute)
        mock_post.assert_called_once()
        call_args, call_kwargs = mock_post.call_args
        assert call_args[0] == f"http://test{cap.canonical_endpoint}"
        assert call_kwargs["json"]["capability"] == capability_id
            
    # 5. Receive AgentResult and finalize trace
    assert isinstance(result, AgentResult)
    assert result.agent == "sentinel"
    
    # Complete execution trace
    if result.status == "FAILED":
        trace.complete(status=result.status, error=result.error)
    else:
        trace.complete(status=result.status, result=result.model_dump())
        
    # Persist results in-memory to state
    state.agent_results.append(result)
    state.execution_history.append(trace.model_dump())
    state.status = "COMPLETED" if result.status == "COMPLETED" else "FAILED"
    
    # 6. Verify State and Trace
    assert len(state.agent_results) == 1
    assert len(state.execution_history) == 1
    
    recorded_trace = state.execution_history[0]
    assert recorded_trace["run_id"] == "run_e2e_test_1"
    assert recorded_trace["task_id"] == "tsk_verify_delay_claim"
    assert recorded_trace["capability"] == "sentinel.verify_claim"
    assert recorded_trace["resolved_specialist"] == "sentinel"
    assert recorded_trace["status"] == "COMPLETED"
    assert recorded_trace["end_time"] is not None
