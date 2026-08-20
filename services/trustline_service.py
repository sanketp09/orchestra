import uuid
import hashlib
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Body

from common.schemas.task import AgentTask, AgentResult
from common.schemas.capability import Capability
from common.schemas.evidence import Receipt
from common.belief_ledger.client import BeliefLedgerClient
from common.llm_client import get_llm_client
from evidence_store.models import TrustProfile

# Add codes/turstline to path for logic & db access
turstline_dir = str(Path(__file__).parent.parent / "codes" / "turstline")
if turstline_dir not in sys.path:
    sys.path.insert(0, turstline_dir)

from codes.turstline import db as trustline_db
from codes.turstline import logic as trustline_logic
from codes.turstline.models import (
    TRUST_DIMENSIONS,
    GetVendorProfileRequest,
    AssessVendorReliabilityRequest,
    DetectBehaviouralDriftRequest,
    UpdateTrustRequest,
    CompareVendorHistoryRequest
)

router = APIRouter(prefix="/trustline", tags=["trustline"])
belief_ledger = BeliefLedgerClient()
llm_client = get_llm_client()


TRUSTLINE_CAPABILITIES = [
    Capability(
        name="trustline.get_vendor_profile",
        description="Retrieves comprehensive vendor trust profile across schedule, commercial, claim, quality, and financial dimensions.",
        input_schema={"vendor_id": "str"},
        output_schema={"overall_trust": "float", "schedule_reliability": "float", "claim_reliability": "float"},
        endpoint="/trustline/get_vendor_profile"
    ),
    Capability(
        name="trustline.assess_vendor_reliability",
        description="Evaluates a single reliability dimension (e.g. schedule or quality) for a vendor with historical trend.",
        input_schema={"vendor_id": "str", "dimension": "str", "project_id": "str | None"},
        output_schema={"dimension": "str", "score": "float", "trend": "str"},
        endpoint="/trustline/assess_vendor_reliability"
    ),
    Capability(
        name="trustline.detect_behavioural_drift",
        description="Detects negative behavioral drift in vendor performance over time (change-order frequency, response lags).",
        input_schema={"vendor_id": "str", "project_id": "str | None"},
        output_schema={"drift_detected": "bool", "drift_signals": "list[str]"},
        endpoint="/trustline/detect_behavioural_drift"
    ),
    Capability(
        name="trustline.update_trust",
        description="Dynamically updates vendor trust score based on Sentinel verified findings and optional Atlas external context.",
        input_schema={"vendor_id": "str", "verified_event": "dict", "external_context": "dict | None", "source_event_id": "str | None", "project_id": "str | None"},
        output_schema={"previous_trust": "float", "new_trust": "float", "penalty_applied": "bool"},
        endpoint="/trustline/update_trust"
    ),
    Capability(
        name="trustline.compare_vendor_history",
        description="Compares historical reliability trajectories across multiple vendors for bid evaluation.",
        input_schema={"vendor_ids": "list[str]", "project_id": "str | None"},
        output_schema={"rankings": "list[dict]"},
        endpoint="/trustline/compare_vendor_history"
    )
]


class TrustlineService:
    """
    Trustline Agent Service — Wraps codes/turstline microservice architecture.
    Provides unified support for both AgentTask inputs and direct payload endpoints.
    """
    def list_capabilities(self) -> List[Capability]:
        return TRUSTLINE_CAPABILITIES

    def execute_task(self, task: AgentTask) -> AgentResult:
        cap_name = task.capability
        if cap_name in ["trustline.get_vendor_profile", "get_vendor_profile"]:
            return self.get_vendor_profile(task)
        elif cap_name in ["trustline.assess_vendor_reliability", "assess_vendor_reliability"]:
            return self.assess_vendor_reliability(task)
        elif cap_name in ["trustline.detect_behavioural_drift", "detect_behavioural_drift"]:
            return self.detect_behavioural_drift(task)
        elif cap_name in ["trustline.update_trust", "update_trust"]:
            return self.update_trust(task)
        elif cap_name in ["trustline.compare_vendor_history", "compare_vendor_history"]:
            return self.compare_vendor_history(task)
        else:
            return self.get_vendor_profile(task)

    def _create_receipt(self, task_id: str, summary: str, confidence: float, reasoning: str, evidence_ids: List[str]) -> Receipt:
        receipt_id = f"rcpt_trustline_{uuid.uuid4().hex[:8]}"
        inputs_hash = hashlib.sha256(f"{task_id}:{summary}".encode()).hexdigest()[:16]
        return Receipt(
            receipt_id=receipt_id,
            agent="trustline",
            task_id=task_id,
            inputs_hash=inputs_hash,
            output_summary=summary,
            confidence=confidence,
            evidence_ids=evidence_ids,
            reasoning=reasoning
        )

    def _error_result(self, task_id: str, code: str, message: str, retryable: bool = False) -> AgentResult:
        import uuid
        return AgentResult(
            agent="trustline",
            task_id=task_id,
            status="failed",
            error={
                "code": code,
                "message": message,
                "retryable": retryable
            },
            receipt_id=f"rcpt_trustline_err_{uuid.uuid4().hex[:8]}"
        )

    def _handle_exception(self, task_id: str, e: Exception) -> AgentResult:
        msg = str(e)
        code = "PROCESSING_FAILED"
        retryable = True
        if "connection" in msg.lower() or "dial" in msg.lower() or "supabase" in msg.lower():
            code = "SPECIALIST_UNAVAILABLE"
            retryable = True
        elif "timeout" in msg.lower():
            code = "TIMEOUT"
            retryable = True
        return self._error_result(task_id, code, msg, retryable)

    def get_vendor_profile(self, payload: Any) -> AgentResult:
        if isinstance(payload, AgentTask):
            task_id = payload.task_id
            vendor_id = payload.payload.get("vendor_id") or (payload.entity_ids[0] if payload.entity_ids else None)
        elif isinstance(payload, GetVendorProfileRequest):
            task_id = str(uuid.uuid4())
            vendor_id = payload.vendor_id
        else:
            task_id = str(uuid.uuid4())
            vendor_id = payload.get("vendor_id") if isinstance(payload, dict) else None

        if not vendor_id:
            return self._error_result(task_id, "MISSING_REQUIRED_CONTEXT", "vendor_id is required.")

        try:
            profile = trustline_db.fetch_trust_profile(vendor_id)
            if profile is None:
                profile = {
                    "vendor_id": vendor_id,
                    "schedule_reliability": 0.75,
                    "commercial_reliability": 0.75,
                    "claim_reliability": 0.75,
                    "quality_reliability": 0.75,
                    "financial_stability": 0.75,
                    "overall_trust": 0.75,
                    "last_updated": "2026-08-20T12:00:00Z"
                }

            receipt = self._create_receipt(task_id, f"Profile lookup for {vendor_id}", 0.96, f"Overall Trust Score: {profile.get('overall_trust')}", [f"trust_profiles:{vendor_id}"])

            return AgentResult(
                agent="trustline",
                task_id=task_id,
                status="completed",
                findings=[profile],
                evidence=[f"trust_profiles:{vendor_id}"],
                confidence=0.96,
                risks=["High claim frequency risk flagged"] if profile.get("claim_reliability", 1.0) < 0.65 else [],
                recommended_next_capabilities=["trustline.assess_vendor_reliability"],
                receipt_id=receipt.receipt_id
            )
        except Exception as e:
            return self._handle_exception(task_id, e)

    def assess_vendor_reliability(self, payload: Any) -> AgentResult:
        if isinstance(payload, AgentTask):
            task_id = payload.task_id
            vendor_id = payload.payload.get("vendor_id")
            dim = payload.payload.get("dimension")
            project_id = payload.project_id or payload.payload.get("project_id")
        elif isinstance(payload, AssessVendorReliabilityRequest):
            task_id = str(uuid.uuid4())
            vendor_id = payload.vendor_id
            dim = payload.dimension
            project_id = payload.project_id
        else:
            task_id = str(uuid.uuid4())
            vendor_id = payload.get("vendor_id") if isinstance(payload, dict) else None
            dim = payload.get("dimension") if isinstance(payload, dict) else None
            project_id = payload.get("project_id") if isinstance(payload, dict) else None

        if not vendor_id or not dim:
            return self._error_result(task_id, "MISSING_REQUIRED_CONTEXT", "vendor_id and dimension are required.")

        try:
            profile = trustline_db.fetch_trust_profile(vendor_id) or {dim: 0.75}
            events = trustline_db.fetch_trust_events(vendor_id, impact_dimension=dim, project_id=project_id)
            assessment = trustline_logic.assess_reliability(profile.get(dim, 0.75), events)

            receipt = self._create_receipt(task_id, f"Assessed {dim} for {vendor_id}", 0.93, f"Trend: {assessment['trend']}", [vendor_id])

            return AgentResult(
                agent="trustline",
                task_id=task_id,
                status="completed",
                findings=[{"vendor_id": vendor_id, "dimension": dim, "project_id": project_id, **assessment}],
                evidence=[f"trust_events:{vendor_id}:{dim}"],
                confidence=0.93,
                recommended_next_capabilities=["trustline.detect_behavioural_drift"] if assessment["trend"] == "declining" else [],
                receipt_id=receipt.receipt_id
            )
        except Exception as e:
            return self._handle_exception(task_id, e)

    def detect_behavioural_drift(self, payload: Any) -> AgentResult:
        if isinstance(payload, AgentTask):
            task_id = payload.task_id
            vendor_id = payload.payload.get("vendor_id")
            project_id = payload.project_id or payload.payload.get("project_id")
        elif isinstance(payload, DetectBehaviouralDriftRequest):
            task_id = str(uuid.uuid4())
            vendor_id = payload.vendor_id
            project_id = payload.project_id
        else:
            task_id = str(uuid.uuid4())
            vendor_id = payload.get("vendor_id") if isinstance(payload, dict) else None
            project_id = payload.get("project_id") if isinstance(payload, dict) else None

        if not vendor_id:
            return self._error_result(task_id, "MISSING_REQUIRED_CONTEXT", "vendor_id is required.")

        try:
            events_by_dim = {
                dim: trustline_db.fetch_trust_events(vendor_id, impact_dimension=dim, project_id=project_id)
                for dim in TRUST_DIMENSIONS
            }
            drift_findings = trustline_logic.detect_drift(events_by_dim)

            receipt = self._create_receipt(task_id, f"Behavioral drift check for {vendor_id}", 0.91, f"Found {len(drift_findings)} drift flags", [vendor_id])

            return AgentResult(
                agent="trustline",
                task_id=task_id,
                status="completed",
                findings=drift_findings if drift_findings else [{"vendor_id": vendor_id, "drift_detected": False, "drift_signals": [], "project_id": project_id}],
                evidence=[f"trust_events:{vendor_id}"],
                confidence=0.91,
                risks=[f"drift:{f['dimension']}" for f in drift_findings],
                recommended_next_capabilities=["arbiter.analyze_causation"],
                receipt_id=receipt.receipt_id
            )
        except Exception as e:
            return self._handle_exception(task_id, e)

    def update_trust(self, payload: Any) -> AgentResult:
        if isinstance(payload, AgentTask):
            task_id = payload.task_id
            vendor_id = payload.payload.get("vendor_id") or (payload.entity_ids[0] if payload.entity_ids else None)
            verified_event = payload.payload.get("verified_event")
            external_context = payload.payload.get("external_context") or (payload.context.get("external_context") if payload.context else None)
            source_event_id = payload.payload.get("source_event_id")
            project_id = payload.project_id or payload.payload.get("project_id")
        elif isinstance(payload, UpdateTrustRequest):
            task_id = str(uuid.uuid4())
            vendor_id = payload.vendor_id
            verified_event = payload.verified_event
            external_context = payload.external_context
            source_event_id = payload.source_event_id
            project_id = payload.project_id
        else:
            task_id = str(uuid.uuid4())
            vendor_id = payload.get("vendor_id") if isinstance(payload, dict) else None
            verified_event = payload.get("verified_event") if isinstance(payload, dict) else None
            external_context = payload.get("external_context") if isinstance(payload, dict) else None
            source_event_id = payload.get("source_event_id") if isinstance(payload, dict) else None
            project_id = payload.get("project_id") if isinstance(payload, dict) else None

        if not vendor_id or not verified_event:
            return self._error_result(task_id, "MISSING_REQUIRED_CONTEXT", "vendor_id and verified_event are required.")

        try:
            # 1. Idempotency Check
            if source_event_id:
                existing_event = trustline_db.fetch_trust_event_by_source_id(vendor_id, source_event_id)
                if existing_event:
                    current_profile = trustline_db.fetch_trust_profile(vendor_id) or {}
                    receipt = self._create_receipt(task_id, f"Duplicate event {source_event_id} ignored", 1.0, f"Event already processed for {vendor_id}.", [vendor_id])
                    return AgentResult(
                        agent="trustline",
                        task_id=task_id,
                        status="completed",
                        findings=[{
                            "already_processed": True,
                            "source_event_id": source_event_id,
                            "existing_event": existing_event,
                            "profile": current_profile
                        }],
                        claims=[{
                            "already_processed": True,
                            "reason": f"Event {source_event_id} already processed. Idempotency preserved.",
                            "applied_delta": existing_event.get("impact_delta", 0.0)
                        }],
                        evidence=[f"trust_events:{vendor_id}:{source_event_id}"],
                        confidence=1.0,
                        risks=[],
                        recommended_next_capabilities=[],
                        receipt_id=receipt.receipt_id
                    )

            if "impact_dimension" not in verified_event:
                verified_event["impact_dimension"] = "schedule_reliability"

            profile = trustline_db.fetch_trust_profile(vendor_id) or {
                "vendor_id": vendor_id,
                "schedule_reliability": 0.75,
                "commercial_reliability": 0.75,
                "claim_reliability": 0.75,
                "quality_reliability": 0.75,
                "financial_stability": 0.75,
                "overall_trust": 0.75
            }

            decision = trustline_logic.determine_trust_update(verified_event, external_context)
            dimension = decision["dimension"]
            updated_profile = trustline_logic.apply_penalty_to_profile(profile, dimension, decision["applied_delta"])

            # Persist event & profile
            trustline_db.insert_trust_event({
                "vendor_id": vendor_id,
                "source_event_id": source_event_id,
                "project_id": project_id,
                "event_type": verified_event.get("event_type", "unverified_delay_claim"),
                "verified": True,
                "external_cause": decision["external_cause"],
                "impact_dimension": dimension,
                "impact_delta": decision["applied_delta"],
                "source_agent": verified_event.get("source_agent", "sentinel"),
                "raw_context": {
                    "verified_event": verified_event,
                    "external_context": external_context,
                    "reason": decision["reason"],
                    "raw_delta": decision["raw_delta"],
                    "project_id": project_id,
                    "source_event_id": source_event_id
                }
            })
            trustline_db.update_trust_profile(vendor_id, {
                dimension: updated_profile[dimension],
                "overall_trust": updated_profile["overall_trust"],
                "last_updated": "now()"
            })

            receipt = self._create_receipt(task_id, f"Trust score updated for {vendor_id}: {decision['reason']}", 0.95, decision["reason"], [vendor_id])

            # Record edge to Belief Graph
            belief_ledger.record_edge(
                entity_id=vendor_id,
                relation="affects",
                target_id=receipt.receipt_id,
                confidence=0.95,
                source_agent="trustline",
                metadata={"previous_trust": profile.get("overall_trust"), "new_trust": updated_profile["overall_trust"], "penalty_applied": not decision["external_cause"]}
            )

            return AgentResult(
                agent="trustline",
                task_id=task_id,
                status="completed",
                findings=[{
                    "already_processed": False,
                    "vendor_id": vendor_id,
                    "previous_trust": profile.get("overall_trust"),
                    "new_trust": updated_profile["overall_trust"],
                    "penalty_applied": not decision["external_cause"],
                    "external_cause": decision["external_cause"],
                    "applied_delta": decision["applied_delta"],
                    "explanation": decision["reason"],
                    "profile": updated_profile
                }],
                claims=[{
                    "already_processed": False,
                    "dimension": dimension,
                    "external_cause": decision["external_cause"],
                    "applied_delta": decision["applied_delta"],
                    "reason": decision["reason"]
                }],
                evidence=[f"trust_events:{vendor_id}", f"trust_profiles:{vendor_id}"],
                confidence=0.95,
                risks=[] if decision["external_cause"] else [f"trust_penalty:{dimension}"],
                recommended_next_capabilities=["arbiter.analyze_causation"],
                receipt_id=receipt.receipt_id
            )
        except Exception as e:
            return self._handle_exception(task_id, e)

    def compare_vendor_history(self, payload: Any) -> AgentResult:
        if isinstance(payload, AgentTask):
            task_id = payload.task_id
            vendor_ids = payload.payload.get("vendor_ids")
            project_id = payload.project_id or payload.payload.get("project_id")
        elif isinstance(payload, CompareVendorHistoryRequest):
            task_id = str(uuid.uuid4())
            vendor_ids = payload.vendor_ids
            project_id = payload.project_id
        else:
            task_id = str(uuid.uuid4())
            vendor_ids = payload.get("vendor_ids") if isinstance(payload, dict) else None
            project_id = payload.get("project_id") if isinstance(payload, dict) else None

        if not vendor_ids:
            return self._error_result(task_id, "MISSING_REQUIRED_CONTEXT", "vendor_ids is required.")
        if len(vendor_ids) < 2:
            return self._error_result(task_id, "INVALID_INPUT", "At least two vendor_ids are required for comparison.")

        try:
            profiles = []
            drift_flags = {}
            missing = []

            for vid in vendor_ids:
                prof = trustline_db.fetch_trust_profile(vid)
                if prof is None:
                    missing.append(vid)
                    continue
                profiles.append(prof)
                events_by_dim = {
                    dim: trustline_db.fetch_trust_events(vid, impact_dimension=dim, project_id=project_id)
                    for dim in TRUST_DIMENSIONS
                }
                drift_flags[vid] = trustline_logic.detect_drift(events_by_dim)

            note = trustline_logic.summarize_comparison(profiles, drift_flags)
            receipt = self._create_receipt(task_id, f"Compared {len(profiles)} vendor profiles", 0.95, note, vendor_ids)

            return AgentResult(
                agent="trustline",
                task_id=task_id,
                status="completed" if not missing else "needs_more_evidence",
                findings=profiles,
                claims=[{"note": note, "missing_vendor_ids": missing}],
                evidence=[f"trust_profiles:{vid}" for vid in vendor_ids],
                confidence=0.95,
                recommended_next_capabilities=[],
                receipt_id=receipt.receipt_id
            )
        except Exception as e:
            return self._handle_exception(task_id, e)


trustline_service = TrustlineService()


# ============================================================================
# FastAPI Route Handlers
# ============================================================================

from common.health import get_specialist_capabilities_manifest

@router.get("/capabilities")
async def get_trustline_capabilities():
    return get_specialist_capabilities_manifest("trustline")

@router.post("/get_vendor_profile")
async def api_get_vendor_profile(payload: Any = Body(...)):
    return trustline_service.get_vendor_profile(payload)

@router.post("/assess_vendor_reliability")
async def api_assess_vendor_reliability(payload: Any = Body(...)):
    return trustline_service.assess_vendor_reliability(payload)

@router.post("/detect_behavioural_drift")
async def api_detect_behavioural_drift(payload: Any = Body(...)):
    return trustline_service.detect_behavioural_drift(payload)

@router.post("/update_trust")
async def api_update_trust(payload: Any = Body(...)):
    return trustline_service.update_trust(payload)

@router.post("/compare_vendor_history")
async def api_compare_vendor_history(payload: Any = Body(...)):
    return trustline_service.compare_vendor_history(payload)
