import uuid
import hashlib
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Body

from common.schemas.task import AgentTask, AgentResult
from common.schemas.capability import Capability
from common.schemas.evidence import Receipt

# Import capability functions
from capabilities.external_event import external_event_capability
from capabilities.commodity import commodity_capability
from capabilities.shipping import shipping_capability
from capabilities.geopolitical import geopolitical_capability

router = APIRouter(prefix="/atlas", tags=["atlas"])

ATLAS_CAPABILITIES = [
    Capability(
        name="atlas.external_event",
        description="Assess all external events for relevance to the given task.",
        input_schema={"route": "dict", "expected_arrival": "str", "material": "str", "vendor_country": "str"},
        output_schema={"findings": "list[dict]"},
        endpoint="/atlas/external_event"
    ),
    Capability(
        name="atlas.commodity",
        description="Determine commodity price exposure for the procurement task.",
        input_schema={"material": "str"},
        output_schema={"findings": "list[dict]"},
        endpoint="/atlas/commodity"
    ),
    Capability(
        name="atlas.shipping",
        description="Assess shipping/logistics risk for a specific shipment.",
        input_schema={"route": "dict", "expected_arrival": "str"},
        output_schema={"findings": "list[dict]"},
        endpoint="/atlas/shipping"
    ),
    Capability(
        name="atlas.geopolitical",
        description="Determine geopolitical/trade risk for the procurement.",
        input_schema={"vendor_country": "str"},
        output_schema={"findings": "list[dict]"},
        endpoint="/atlas/geopolitical"
    )
]

class AtlasService:
    def list_capabilities(self) -> List[Capability]:
        return ATLAS_CAPABILITIES

    def execute_task(self, task: AgentTask) -> AgentResult:
        cap_name = task.capability
        payload = task.payload or {}
        
        try:
            if cap_name in ["atlas.external_event", "external_event"]:
                # route and expected_arrival are required by contract
                if "route" not in payload or "expected_arrival" not in payload:
                    return self._error_result(task.task_id, "MISSING_REQUIRED_INPUT", "route and expected_arrival are required.")
                res_dict = external_event_capability(task)
            elif cap_name in ["atlas.commodity", "commodity"]:
                # material is required
                if "material" not in payload:
                    return self._error_result(task.task_id, "MISSING_REQUIRED_INPUT", "material is required.")
                res_dict = commodity_capability(task)
            elif cap_name in ["atlas.shipping", "shipping"]:
                # route and expected_arrival are required
                if "route" not in payload or "expected_arrival" not in payload:
                    return self._error_result(task.task_id, "MISSING_REQUIRED_INPUT", "route and expected_arrival are required.")
                res_dict = shipping_capability(task)
            elif cap_name in ["atlas.geopolitical", "geopolitical"]:
                # vendor_country is required
                if "vendor_country" not in payload:
                    return self._error_result(task.task_id, "MISSING_REQUIRED_INPUT", "vendor_country is required.")
                res_dict = geopolitical_capability(task)
            else:
                return self._error_result(task.task_id, "INVALID_INPUT", f"Unknown capability: {cap_name}")

            receipt_id = f"rcpt_atlas_{uuid.uuid4().hex[:8]}"
            
            return AgentResult(
                agent="atlas",
                task_id=task.task_id,
                status="COMPLETED",
                findings=res_dict.get("findings", []),
                evidence=res_dict.get("evidence", []),
                confidence=res_dict.get("confidence", 0.0),
                risks=res_dict.get("risks", []),
                recommended_next_capabilities=res_dict.get("recommended_next_capabilities", []),
                receipt_id=receipt_id
            )
        except Exception as e:
            return self._handle_exception(task.task_id, e)

    def _error_result(self, task_id: str, code: str, message: str, retryable: bool = False) -> AgentResult:
        return AgentResult(
            agent="atlas",
            task_id=task_id,
            status="FAILED",
            error={
                "code": code,
                "message": message,
                "retryable": retryable
            },
            receipt_id=f"rcpt_atlas_err_{uuid.uuid4().hex[:8]}"
        )

    def _handle_exception(self, task_id: str, e: Exception) -> AgentResult:
        return self._error_result(task_id, "PROCESSING_FAILED", str(e), retryable=True)

atlas_service = AtlasService()

@router.get("/health")
async def get_atlas_health():
    return {
        "service": "atlas",
        "status": "healthy",
        "version": "1.0"
    }

@router.get("/capabilities")
async def get_atlas_capabilities():
    from common.health import get_specialist_capabilities_manifest
    try:
        return get_specialist_capabilities_manifest("atlas")
    except Exception:
        return ATLAS_CAPABILITIES

@router.post("/execute")
async def api_execute(task: AgentTask = Body(...)):
    return atlas_service.execute_task(task)
