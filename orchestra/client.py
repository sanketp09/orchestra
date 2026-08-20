import httpx
import uuid
from typing import Any, Optional, Dict
from pydantic import ValidationError

from common.schemas.task import AgentTask, AgentResult
from orchestra.registry import CapabilityRegistry


class OrchestraClient:
    """
    Generic HTTP execution client for ORCHESTRA.
    Resolves capability IDs, builds tasks, invokes canonical endpoints,
    and returns validated AgentResults.
    """
    def __init__(self, registry: CapabilityRegistry, base_url: str = "http://localhost:8000"):
        self.registry = registry
        self.base_url = base_url.rstrip("/")

    async def execute(
        self,
        capability_id: str,
        payload: Dict[str, Any],
        project_id: Optional[str] = None,
        entity_ids: Optional[list[str]] = None,
        context: Optional[Dict[str, Any]] = None,
        task_id: Optional[str] = None,
        timeout_seconds: float = 15.0
    ) -> AgentResult:
        """
        Executes a specialist capability asynchronously.
        
        1. Resolves capability ID in CapabilityRegistry
        2. Resolves explicit owner service and canonical execution endpoint
        3. Constructs AgentTask
        4. Invokes POST /{specialist}/execute via httpx
        5. Validates Response payload against AgentResult contract
        """
        # 1. Resolve capability metadata
        try:
            cap = self.registry.get(capability_id)
        except KeyError as e:
            return self._error_result(
                task_id or f"tsk_err_{uuid.uuid4().hex[:8]}",
                "INVALID_INPUT",
                str(e),
                retryable=False
            )

        # 2. Build AgentTask envelope
        resolved_task_id = task_id or f"tsk_{cap.specialist}_{uuid.uuid4().hex[:8]}"
        task = AgentTask(
            task_id=resolved_task_id,
            capability=capability_id,
            project_id=project_id,
            entity_ids=entity_ids or [],
            payload=payload,
            context=context
        )

        # 3. Resolve canonical endpoint URL
        # e.g., http://localhost:8000/sentinel/execute
        target_url = f"{self.base_url}{cap.canonical_endpoint}"

        # 4. Invoke canonical specialist execution endpoint
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    target_url,
                    json=task.model_dump(),
                    timeout=timeout_seconds
                )
                
                # Check for HTTP status errors before attempting parsing
                if response.status_code != 200:
                    return self._error_result(
                        resolved_task_id,
                        "PROCESSING_FAILED",
                        f"Specialist returned HTTP status code {response.status_code}: {response.text}",
                        retryable=False
                    )
                
                response_json = response.json()
            except httpx.ConnectError as e:
                return self._error_result(
                    resolved_task_id,
                    "SPECIALIST_UNAVAILABLE",
                    f"Failed to connect to specialist '{cap.specialist}': {str(e)}",
                    retryable=True
                )
            except httpx.TimeoutException as e:
                return self._error_result(
                    resolved_task_id,
                    "TIMEOUT",
                    f"Execution timed out after {timeout_seconds}s: {str(e)}",
                    retryable=True
                )
            except Exception as e:
                return self._error_result(
                    resolved_task_id,
                    "PROCESSING_FAILED",
                    f"HTTP call encountered an unexpected error: {str(e)}",
                    retryable=True
                )

        # 5. Validate output payload against shared AgentResult schema
        try:
            agent_result = AgentResult.model_validate(response_json)
            # Ensure the response envelope's agent field matches resolved specialist
            if not agent_result.agent:
                agent_result.agent = cap.specialist
            return agent_result
        except ValidationError as e:
            return self._error_result(
                resolved_task_id,
                "PROCESSING_FAILED",
                f"Agent response failed validation against AgentResult schema: {str(e)}",
                retryable=False
            )

    def _error_result(
        self,
        task_id: str,
        code: str,
        message: str,
        retryable: bool = False
    ) -> AgentResult:
        """Helper to build a standard AgentResult wrapper representing an integration error."""
        return AgentResult(
            agent="orchestra",
            task_id=task_id,
            status="FAILED",
            error={
                "code": code,
                "message": message,
                "retryable": retryable
            }
        )
