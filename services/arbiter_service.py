import uuid
import hashlib
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Body

from common.schemas.task import AgentTask, AgentResult
from common.schemas.capability import Capability
from common.schemas.evidence import Receipt
from common.belief_ledger.client import BeliefLedgerClient
from common.supabase_client import get_supabase_client

# Import single source of truth logic
import codes.arbiter.logic as logic

router = APIRouter(prefix="/arbiter", tags=["arbiter"])
belief_ledger = BeliefLedgerClient()


ARBITER_CAPABILITIES = [
    Capability(
        name="arbiter.reconstruct_timeline",
        description="Reconstructs a chronological sequence of events from raw evidence, logs, and claims.",
        input_schema={"event_refs": "list[dict]"},
        output_schema={"timeline": "dict"},
        endpoint="/arbiter/reconstruct_timeline"
    ),
    Capability(
        name="arbiter.analyze_causation",
        description="Identifies true root cause of project delay, defect, or dispute using multi-agent evidence context.",
        input_schema={"claims": "list[dict]", "evidence_context": "dict"},
        output_schema={"causes": "list[dict]", "reasoning_summary": "str"},
        endpoint="/arbiter/analyze_causation"
    ),
    Capability(
        name="arbiter.assess_responsibility",
        description="Attributes contractual responsibility and financial split percentage between vendor, buyer, and external factors.",
        input_schema={"causes": "list[dict]"},
        output_schema={"vendor": "float", "external": "float", "buyer": "float", "shared": "float", "unknown": "float"},
        endpoint="/arbiter/assess_responsibility"
    ),
    Capability(
        name="arbiter.analyze_dispute",
        description="Runs full dispute analysis including timeline, causation, and responsibility attribution.",
        input_schema={"dispute_context": "dict"},
        output_schema={"timeline": "dict", "causes": "list[dict]", "responsibility": "dict"},
        endpoint="/arbiter/analyze_dispute"
    ),
    Capability(
        name="arbiter.run_debate",
        description="Runs the 3-step adversarial debate: Buyer Advocate -> Vendor Advocate -> Judge.",
        input_schema={"evidence_context": "dict"},
        output_schema={"buyer_case": "dict", "vendor_case": "dict", "judge_verdict": "dict"},
        endpoint="/arbiter/run_debate"
    )
]


class ArbiterService:
    """
    Arbiter Agent Service — Adapts AgentTask inputs to the real Arbiter core
    logic and manages database writes.
    """
    def list_capabilities(self) -> List[Capability]:
        return ARBITER_CAPABILITIES

    def execute_task(self, task: AgentTask) -> AgentResult:
        cap_name = task.capability
        if cap_name == "arbiter.reconstruct_timeline":
            return self.reconstruct_timeline(task)
        elif cap_name == "arbiter.analyze_causation":
            return self.analyze_causation(task)
        elif cap_name == "arbiter.assess_responsibility":
            return self.assess_responsibility(task)
        elif cap_name == "arbiter.analyze_dispute":
            return self.analyze_dispute(task)
        elif cap_name == "arbiter.run_debate":
            return self.run_debate(task)
        else:
            return self.analyze_causation(task)

    def _new_receipt(self) -> str:
        return f"rcpt_arbiter_{uuid.uuid4().hex[:8]}"

    def _persist_receipt(
        self,
        receipt_id: str,
        project_id: Optional[str],
        task_id: str,
        capability: str,
        evidence_ids: List[str],
        summary: str,
        confidence: float,
        reasoning: Optional[str] = None
    ):
        client = get_supabase_client()
        metadata = {
            "confidence": confidence,
            "reasoning": reasoning or ""
        }
        db_payload = {
            "receipt_id": receipt_id,
            "project_id": project_id,
            "agent": "arbiter",
            "task_id": task_id,
            "capability": capability,
            "evidence_ids": evidence_ids,
            "summary": summary,
            "metadata": metadata
        }
        try:
            client.table("receipts").insert(db_payload).execute()
        except Exception as e:
            print(f"[Receipts] Warning: Failed to persist receipt: {e}")

    def _error_result(self, task_id: str, code: str, message: str, retryable: bool = False) -> AgentResult:
        import uuid
        return AgentResult(
            agent="arbiter",
            task_id=task_id,
            status="failed",
            error={
                "code": code,
                "message": message,
                "retryable": retryable
            },
            receipt_id=f"rcpt_arbiter_err_{uuid.uuid4().hex[:8]}"
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

    def reconstruct_timeline(self, task: AgentTask) -> AgentResult:
        receipt_id = self._new_receipt()
        event_refs = task.payload.get("event_refs")

        if not event_refs:
            return self._error_result(task.task_id, "MISSING_REQUIRED_CONTEXT", "event_refs is required.")

        try:
            timeline_result = logic.reconstruct_timeline(task.entity_ids, event_refs)
            evidence = [e.get("source") for e in event_refs if e.get("source")]
            has_gaps = bool(timeline_result.get("gaps_or_inconsistencies"))
            confidence = 0.6 if has_gaps else 0.95

            try:
                get_supabase_client().table("timelines").insert(
                    {
                        "timeline_id": str(uuid.uuid4()),
                        "project_id": task.project_id,
                        "entity_ids": task.entity_ids,
                        "events": timeline_result["events"],
                        "evidence_refs": evidence,
                        "confidence": confidence,
                        "source_agent": "arbiter",
                        "receipt_id": receipt_id
                    }
                ).execute()
            except Exception as exc:
                print(f"[Supabase] Warning: Timelines insert failed: {exc}")

            self._persist_receipt(
                receipt_id=receipt_id,
                project_id=task.project_id,
                task_id=task.task_id,
                capability="arbiter.reconstruct_timeline",
                evidence_ids=evidence,
                summary=f"Timeline reconstructed ({len(timeline_result.get('events', []))} events)",
                confidence=confidence
            )

            return AgentResult(
                agent="arbiter",
                task_id=task.task_id,
                status="completed",
                findings=[timeline_result],
                evidence=evidence,
                confidence=confidence,
                risks=timeline_result.get("gaps_or_inconsistencies", []),
                recommended_next_capabilities=["arbiter.analyze_causation"],
                receipt_id=receipt_id
            )
        except Exception as e:
            return self._handle_exception(task.task_id, e)

    def analyze_causation(self, task: AgentTask) -> AgentResult:
        receipt_id = self._new_receipt()
        claims = task.payload.get("claims")
        evidence_context = task.payload.get("evidence_context", task.payload.get("evidence"))

        if not claims or evidence_context is None:
            return self._error_result(task.task_id, "MISSING_REQUIRED_CONTEXT", "claims and evidence_context are required.")

        # Convert simple list of strings into dict if needed
        if isinstance(evidence_context, list):
            evidence_context = {x: "Provided evidence source" for x in evidence_context}

        evidence_refs = list(evidence_context.keys()) if isinstance(evidence_context, dict) else []

        if logic.evidence_is_too_thin(evidence_context):
            self._persist_receipt(
                receipt_id=receipt_id,
                project_id=task.project_id,
                task_id=task.task_id,
                capability="arbiter.analyze_causation",
                evidence_ids=evidence_refs,
                summary="Causation analysis deferred: thin context",
                confidence=0.0
            )
            return AgentResult(
                agent="arbiter",
                task_id=task.task_id,
                status="needs_more_evidence",
                findings=[{"message": "evidence_context is too thin to reach a confident causation conclusion."}],
                recommended_next_capabilities=logic.missing_capabilities_for(evidence_context, None),
                receipt_id=receipt_id
            )

        try:
            timeline = task.payload.get("timeline")
            result = logic.analyze_causation(claims, evidence_context, timeline)
            causes = result.get("causes", [])
            top_confidence = causes[0]["confidence"] if causes else 0.0
            reasoning_summary = result.get("reasoning_summary", "")

            # Save to causation_results table
            causation_result_id = str(uuid.uuid4())
            try:
                get_supabase_client().table("causation_results").insert(
                    {
                        "causation_result_id": causation_result_id,
                        "project_id": task.project_id,
                        "case_ref": claims[0].get("claim_id") if claims else None,
                        "causes": causes,
                        "evidence_refs": evidence_refs,
                        "reasoning_summary": reasoning_summary,
                        "confidence": top_confidence,
                        "receipt_id": receipt_id,
                        "source_agent": "arbiter"
                    }
                ).execute()
            except Exception as exc:
                print(f"[Supabase] Warning: causation_results insert failed: {exc}")

            # Record belief edges for established causes
            for cause in causes:
                if cause.get("confidence", 0.0) >= 0.5:
                    subj_id = task.entity_ids[0] if task.entity_ids else "vendor_unknown"
                    belief_ledger.record_edge(
                        entity_id=subj_id,
                        relation="caused_delay",
                        target_id=cause.get("cause_id", "unknown_cause"),
                        confidence=cause.get("confidence", 0.5),
                        source_agent="arbiter",
                        subject_type="vendor",
                        object_type="cause",
                        evidence_ids=cause.get("evidence_ids", []),
                        project_id=task.project_id
                    )

            self._persist_receipt(
                receipt_id=receipt_id,
                project_id=task.project_id,
                task_id=task.task_id,
                capability="arbiter.analyze_causation",
                evidence_ids=evidence_refs,
                summary=f"Causation Analyzed: {reasoning_summary[:60]}...",
                confidence=top_confidence,
                reasoning=reasoning_summary
            )

            return AgentResult(
                agent="arbiter",
                task_id=task.task_id,
                status="completed",
                findings=causes,
                claims=claims,
                evidence=evidence_refs,
                confidence=top_confidence,
                recommended_next_capabilities=["arbiter.assess_responsibility"],
                receipt_id=receipt_id
            )
        except Exception as e:
            return self._handle_exception(task.task_id, e)

    def assess_responsibility(self, task: AgentTask) -> AgentResult:
        receipt_id = self._new_receipt()
        causes = task.payload.get("causes")
        causation_result_id = task.payload.get("causation_result_id")
        project_id = task.project_id

        if causes is None and not causation_result_id:
            return self._error_result(task.task_id, "MISSING_REQUIRED_CONTEXT", "Either causes or causation_result_id is required.")

        try:
            if causes is None:
                resp = (
                    get_supabase_client()
                    .table("causation_results")
                    .select("*")
                    .eq("causation_result_id", causation_result_id)
                    .single()
                    .execute()
                )
                causation_row = resp.data
                causes = causation_row["causes"]
                project_id = project_id or causation_row.get("project_id")

            result = logic.assess_responsibility(causes)
            vendor_pct = result.get("vendor", 0.0)
            external_pct = result.get("external", 0.0)
            buyer_pct = result.get("buyer", 0.0)
            shared_pct = result.get("shared", 0.0)
            unknown_pct = result.get("unknown", 0.0)
            rationale = result.get("rationale", "")

            total_pct = round(vendor_pct + external_pct + buyer_pct + shared_pct + unknown_pct, 4)
            is_valid = abs(total_pct - 1.0) < 0.01

            try:
                if causation_result_id:
                    get_supabase_client().table("causation_results").update(
                        {"responsibility": result}
                    ).eq("causation_result_id", causation_result_id).execute()
            except Exception as exc:
                print(f"[Supabase] Warning: causation_results update failed: {exc}")

            self._persist_receipt(
                receipt_id=receipt_id,
                project_id=project_id,
                task_id=task.task_id,
                capability="arbiter.assess_responsibility",
                evidence_ids=["causation_result"],
                summary=f"Responsibility split: vendor={vendor_pct}, external={external_pct}, buyer={buyer_pct}",
                confidence=1.0 if is_valid else 0.5,
                reasoning=rationale
            )

            return AgentResult(
                agent="arbiter",
                task_id=task.task_id,
                status="completed",
                findings=[result],
                evidence=["causation_result"],
                confidence=1.0 if is_valid else 0.5,
                risks=[] if is_valid else [f"Responsibility values summed to {total_pct}, not 1.0."],
                receipt_id=receipt_id
            )
        except Exception as e:
            return self._handle_exception(task.task_id, e)

    def analyze_dispute(self, task: AgentTask) -> AgentResult:
        receipt_id = self._new_receipt()
        dispute_context = task.payload.get("dispute_context") or task.payload.get("full_context") or task.payload

        if not dispute_context:
            return self._error_result(task.task_id, "MISSING_REQUIRED_CONTEXT", "dispute_context or full_context is required.")

        evidence_context = {
            k: v
            for k, v in dispute_context.items()
            if k in ("verified_facts", "contradictions", "vendor_trust_signals", "documents", "claims_evidence")
        }

        if logic.evidence_is_too_thin(evidence_context):
            self._persist_receipt(
                receipt_id=receipt_id,
                project_id=task.project_id,
                task_id=task.task_id,
                capability="arbiter.analyze_dispute",
                evidence_ids=list(evidence_context.keys()),
                summary="Dispute analysis deferred: thin context",
                confidence=0.0
            )
            return AgentResult(
                agent="arbiter",
                task_id=task.task_id,
                status="needs_more_evidence",
                findings=[{"message": "full_context does not contain enough verified evidence for a full dispute analysis."}],
                recommended_next_capabilities=logic.missing_capabilities_for(evidence_context, None),
                receipt_id=receipt_id
            )

        try:
            result = logic.analyze_dispute(task.entity_ids, dispute_context)
            causes = result.get("causes", [])
            evidence_refs = list(evidence_context.keys())

            # Save belief edges
            for cause in causes:
                if cause.get("confidence", 0.0) >= 0.5:
                    subj_id = task.entity_ids[0] if task.entity_ids else "vendor_unknown"
                    belief_ledger.record_edge(
                        entity_id=subj_id,
                        relation="caused_delay",
                        target_id=cause.get("cause_id", "unknown_cause"),
                        confidence=cause.get("confidence", 0.5),
                        source_agent="arbiter",
                        subject_type="vendor",
                        object_type="cause",
                        evidence_ids=cause.get("evidence_ids", []),
                        project_id=task.project_id
                    )

            self._persist_receipt(
                receipt_id=receipt_id,
                project_id=task.project_id,
                task_id=task.task_id,
                capability="arbiter.analyze_dispute",
                evidence_ids=list(evidence_context.keys()),
                summary=f"Dispute debate resolved with confidence {result['confidence']}",
                confidence=result["confidence"],
                reasoning=result["reasoning_summary"]
            )

            return AgentResult(
                agent="arbiter",
                task_id=task.task_id,
                status="completed",
                findings=[
                    {
                        "timeline": result["timeline"],
                        "causes": result["causes"],
                        "responsibility": result["responsibility"],
                        "reasoning_summary": result["reasoning_summary"],
                    }
                ],
                evidence=list(evidence_context.keys()),
                confidence=result["confidence"],
                receipt_id=receipt_id
            )
        except Exception as e:
            return self._handle_exception(task.task_id, e)

    def run_debate(self, task: AgentTask) -> AgentResult:
        receipt_id = self._new_receipt()
        evidence_context = task.payload.get("evidence_context")

        if not evidence_context:
            return self._error_result(task.task_id, "MISSING_REQUIRED_CONTEXT", "evidence_context is required.")

        try:
            verdict = logic.run_adversarial_debate(evidence_context)
            self._persist_receipt(
                receipt_id=receipt_id,
                project_id=task.project_id,
                task_id=task.task_id,
                capability="arbiter.run_debate",
                evidence_ids=list(evidence_context.keys()),
                summary=f"Debate resolved: {verdict['judge_verdict'].get('judge_ruling', 'Completed')}",
                confidence=0.8,
                reasoning=verdict['judge_verdict'].get("judge_ruling", "")
            )

            return AgentResult(
                agent="arbiter",
                task_id=task.task_id,
                status="completed",
                findings=[verdict],
                evidence=list(evidence_context.keys()),
                confidence=0.8,
                receipt_id=receipt_id
            )
        except Exception as e:
            return self._handle_exception(task.task_id, e)


arbiter_service = ArbiterService()


# ============================================================================
# FastAPI Route Handlers
# ============================================================================

from common.health import get_specialist_capabilities_manifest

@router.get("/capabilities")
async def get_arbiter_capabilities():
    return get_specialist_capabilities_manifest("arbiter")

@router.post("/reconstruct_timeline")
async def api_reconstruct_timeline(task: AgentTask = Body(...)):
    return arbiter_service.reconstruct_timeline(task)

@router.post("/analyze_causation")
async def api_analyze_causation(task: AgentTask = Body(...)):
    return arbiter_service.analyze_causation(task)

@router.post("/assess_responsibility")
async def api_assess_responsibility(task: AgentTask = Body(...)):
    return arbiter_service.assess_responsibility(task)

@router.post("/analyze_dispute")
async def api_analyze_dispute(task: AgentTask = Body(...)):
    return arbiter_service.analyze_dispute(task)

@router.post("/run_debate")
async def api_run_debate(task: AgentTask = Body(...)):
    return arbiter_service.run_debate(task)
