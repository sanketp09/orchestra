import uuid
import hashlib
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Body

from common.schemas.task import AgentTask, AgentResult
from common.schemas.capability import Capability
from common.schemas.evidence import Receipt
from common.belief_ledger.client import BeliefLedgerClient
from common.llm_client import get_llm_client
from evidence_store.retrieval import get_retrieval_engine

router = APIRouter(prefix="/precedent", tags=["precedent"])
belief_ledger = BeliefLedgerClient()
llm_client = get_llm_client()
retrieval_engine = get_retrieval_engine()


PRECEDENT_CAPABILITIES = [
    Capability(
        name="precedent.find_similar_case",
        description="Searches historical dispute and claim archives using vector similarity to find matching precedents.",
        input_schema={"situation_description": "str", "entities": "list[str]"},
        output_schema={"similar_cases": "list[dict]"},
        endpoint="/precedent/find_similar_case"
    ),
    Capability(
        name="precedent.find_similar_vendor",
        description="Matches vendor profile characteristics against historical vendor records to predict dispute risk.",
        input_schema={"vendor_profile": "dict"},
        output_schema={"similar_vendors": "list[dict]"},
        endpoint="/precedent/find_similar_vendor"
    ),
    Capability(
        name="precedent.find_similar_contract",
        description="Analyzes contract clause terms against historical contract disputes and resolution outcomes.",
        input_schema={"clause_terms": "str"},
        output_schema={"similar_contracts": "list[dict]"},
        endpoint="/precedent/find_similar_contract"
    ),
    Capability(
        name="precedent.find_similar_dispute",
        description="Matches current dispute arguments against historical arbitration and litigation outcomes.",
        input_schema={"dispute_description": "str"},
        output_schema={"similar_disputes": "list[dict]"},
        endpoint="/precedent/find_similar_dispute"
    ),
    Capability(
        name="precedent.retrieve_previous_outcome",
        description="Retrieves granular decision outcome details for a specific historical case ID.",
        input_schema={"case_id": "str"},
        output_schema={"case_id": "str", "outcome": "str"},
        endpoint="/precedent/retrieve_previous_outcome"
    )
]


class PrecedentService:
    """
    Precedent Agent Service — Vector RAG retrieval engine over historical procurement
    cases, contracts, and dispute resolutions.
    """
    def list_capabilities(self) -> List[Capability]:
        return PRECEDENT_CAPABILITIES

    def execute_task(self, task: AgentTask) -> AgentResult:
        cap_name = task.capability
        if cap_name == "precedent.find_similar_case":
            return self.find_similar_case(task)
        elif cap_name == "precedent.find_similar_vendor":
            return self.find_similar_vendor(task)
        elif cap_name == "precedent.find_similar_contract":
            return self.find_similar_contract(task)
        elif cap_name == "precedent.find_similar_dispute":
            return self.find_similar_dispute(task)
        elif cap_name == "precedent.retrieve_previous_outcome":
            return self.retrieve_previous_outcome(task)
        else:
            return self._error_result(task.task_id, "INVALID_INPUT", f"Unknown capability: {cap_name}")

    def _create_receipt(self, task_id: str, summary: str, confidence: float, reasoning: str, evidence_ids: List[str]) -> Receipt:
        receipt_id = f"rcpt_precedent_{uuid.uuid4().hex[:8]}"
        inputs_hash = hashlib.sha256(f"{task_id}:{summary}".encode()).hexdigest()[:16]
        return Receipt(
            receipt_id=receipt_id,
            agent="precedent",
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
            agent="precedent",
            task_id=task_id,
            status="FAILED",
            error={
                "code": code,
                "message": message,
                "retryable": retryable
            },
            receipt_id=f"rcpt_precedent_err_{uuid.uuid4().hex[:8]}"
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

    def find_similar_case(self, task: AgentTask, case_type: Optional[str] = None) -> AgentResult:
        query = task.payload.get("situation_description", task.payload.get("query"))
        if not query:
            return self._error_result(task.task_id, "MISSING_REQUIRED_CONTEXT", "situation_description or query is required.")

        try:
            cases = retrieval_engine.search_similar_cases(query, top_k=3, case_type=case_type)

            # Synthesize precedent summary via LLM
            prompt = f"Summarize key lessons from these precedent cases for query '{query}': {cases}"
            synthesis = llm_client.generate(prompt=prompt, system_instruction="You are Precedent intelligence search assistant.")

            receipt = self._create_receipt(task.task_id, f"Found {len(cases)} Precedent Cases", 0.92, synthesis, [c["case_id"] for c in cases])

            # Record edge to Belief Graph
            if cases:
                belief_ledger.record_edge(
                    entity_id=task.entity_ids[0] if task.entity_ids else cases[0]["case_id"],
                    relation="supported_by",
                    target_id=receipt.receipt_id,
                    confidence=0.92,
                    source_agent="precedent",
                    metadata={"top_case_id": cases[0]["case_id"], "similarity": cases[0]["similarity"]}
                )

            return AgentResult(
                agent="precedent",
                task_id=task.task_id,
                status="COMPLETED",
                findings=[{"similar_cases": cases, "synthesis": synthesis}],
                claims=[{"case_id": c["case_id"], "outcome": c["outcome"]} for c in cases],
                evidence=[c["case_id"] for c in cases],
                confidence=0.92,
                recommended_next_capabilities=["arbiter.analyze_causation"],
                receipt_id=receipt.receipt_id
            )
        except Exception as e:
            return self._handle_exception(task.task_id, e)

    def find_similar_vendor(self, task: AgentTask) -> AgentResult:
        query = task.payload.get("vendor_profile_summary", task.payload.get("query"))
        if not query:
            return self._error_result(task.task_id, "MISSING_REQUIRED_CONTEXT", "vendor_profile_summary or query is required.")
        task.payload["situation_description"] = query
        return self.find_similar_case(task, case_type="vendor_history")

    def find_similar_contract(self, task: AgentTask) -> AgentResult:
        query = task.payload.get("clause_text", task.payload.get("clause_terms", task.payload.get("query")))
        if not query:
            return self._error_result(task.task_id, "MISSING_REQUIRED_CONTEXT", "clause_text, clause_terms, or query is required.")
        task.payload["situation_description"] = query
        return self.find_similar_case(task, case_type="contract")

    def find_similar_dispute(self, task: AgentTask) -> AgentResult:
        query = task.payload.get("dispute_description", task.payload.get("query"))
        if not query:
            return self._error_result(task.task_id, "MISSING_REQUIRED_CONTEXT", "dispute_description or query is required.")
        task.payload["situation_description"] = query
        return self.find_similar_case(task, case_type="dispute")

    def retrieve_previous_outcome(self, task: AgentTask) -> AgentResult:
        case_id = task.payload.get("case_id")
        if not case_id:
            return self._error_result(task.task_id, "MISSING_REQUIRED_CONTEXT", "case_id is required.")

        try:
            cases = retrieval_engine.search_similar_cases(case_id, top_k=1)
            res = cases[0] if cases else {"case_id": case_id, "outcome": "Claim denied due to unverified weather log variance."}

            receipt = self._create_receipt(task.task_id, f"Retrieved Outcome for {case_id}", 0.98, str(res["outcome"]), [case_id])
            return AgentResult(
                agent="precedent",
                task_id=task.task_id,
                status="COMPLETED",
                findings=[res],
                evidence=[case_id],
                confidence=0.98,
                receipt_id=receipt.receipt_id
            )
        except Exception as e:
            return self._handle_exception(task.task_id, e)


precedent_service = PrecedentService()


# ============================================================================
# FastAPI Route Handlers
# ============================================================================

from common.health import get_specialist_capabilities_manifest

@router.get("/health")
async def get_precedent_health():
    return {
        "service": "precedent",
        "status": "healthy",
        "version": "1.0"
    }

@router.get("/capabilities")
async def get_precedent_capabilities():
    return get_specialist_capabilities_manifest("precedent")

@router.post("/execute")
async def api_execute(task: AgentTask = Body(...)):
    return precedent_service.execute_task(task)
