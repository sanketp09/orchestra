"""
Precedent — organizational-memory microservice.

Part of the ORCHESTRA multi-agent procurement system. Called only by the
orchestrator over HTTP; never calls other specialists directly.
"""

import json
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI
from pydantic import BaseModel

from models import AgentResult
from retrieval import SIMILARITY_THRESHOLD, get_case_by_id, search_cases

app = FastAPI(title="Precedent", description="Organizational-memory specialist for ORCHESTRA")

AGENT_NAME = "precedent"

CAPABILITIES_PATH = Path(__file__).parent / "capabilities.json"


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class FindSimilarCaseRequest(BaseModel):
    situation_description: str
    entity_ids: Optional[list[str]] = None
    top_k: int = 5


class FindSimilarVendorRequest(BaseModel):
    vendor_profile_summary: str
    top_k: int = 5


class FindSimilarContractRequest(BaseModel):
    clause_text: str
    top_k: int = 5


class FindSimilarDisputeRequest(BaseModel):
    dispute_description: str
    top_k: int = 5


class RetrievePreviousOutcomeRequest(BaseModel):
    case_id: str


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _build_result(
    task_id: str,
    cases: list[dict],
    no_match_message: str,
) -> AgentResult:
    """
    Turn a list of scored cases (from retrieval.search_cases) into an
    AgentResult, applying the "don't force a weak match" rule.
    """
    strong = [c for c in cases if c.get("similarity", 0) >= SIMILARITY_THRESHOLD]

    if not strong:
        return AgentResult(
            agent=AGENT_NAME,
            task_id=task_id,
            status="INSUFFICIENT_INFORMATION",
            findings=[{"message": no_match_message, "checked_candidates": len(cases)}],
            claims=[],
            evidence=[],
            confidence=cases[0]["similarity"] if cases else 0.0,
            risks=[],
            recommended_next_capabilities=[],
            receipt_id=str(uuid.uuid4()),
        )

    findings = [
        {
            "case_id": c["case_id"],
            "summary": c["summary"],
            "outcome": c["outcome"],
            "similarity": c["similarity"],
            "project_id": c.get("project_id"),
            "vendor_id": c.get("vendor_id"),
        }
        for c in strong
    ]

    return AgentResult(
        agent=AGENT_NAME,
        task_id=task_id,
        status="COMPLETED",
        findings=findings,
        claims=[],
        evidence=[c["case_id"] for c in strong],
        confidence=strong[0]["similarity"],
        risks=[],
        recommended_next_capabilities=[],
        receipt_id=str(uuid.uuid4()),
    )


def _failed_result(task_id: str, message: str) -> AgentResult:
    return AgentResult(
        agent=AGENT_NAME,
        task_id=task_id,
        status="FAILED",
        findings=[{"message": message}],
        claims=[],
        evidence=[],
        confidence=0.0,
        risks=[],
        recommended_next_capabilities=[],
        receipt_id=str(uuid.uuid4()),
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/find_similar_case", response_model=AgentResult)
def find_similar_case(req: FindSimilarCaseRequest) -> AgentResult:
    task_id = str(uuid.uuid4())
    try:
        cases = search_cases(req.situation_description, case_type=None, top_k=req.top_k)
    except Exception as exc:  # noqa: BLE001
        return _failed_result(task_id, f"find_similar_case failed: {exc}")

    return _build_result(
        task_id, cases, "No precedent case scored above the similarity threshold — treat this as novel territory."
    )


@app.post("/find_similar_vendor", response_model=AgentResult)
def find_similar_vendor(req: FindSimilarVendorRequest) -> AgentResult:
    task_id = str(uuid.uuid4())
    try:
        cases = search_cases(req.vendor_profile_summary, case_type="vendor_history", top_k=req.top_k)
    except Exception as exc:  # noqa: BLE001
        return _failed_result(task_id, f"find_similar_vendor failed: {exc}")

    return _build_result(
        task_id, cases, "No comparable vendor history found above the similarity threshold."
    )


@app.post("/find_similar_contract", response_model=AgentResult)
def find_similar_contract(req: FindSimilarContractRequest) -> AgentResult:
    task_id = str(uuid.uuid4())
    try:
        cases = search_cases(req.clause_text, case_type="contract", top_k=req.top_k)
    except Exception as exc:  # noqa: BLE001
        return _failed_result(task_id, f"find_similar_contract failed: {exc}")

    return _build_result(
        task_id, cases, "No comparable contract precedent found above the similarity threshold."
    )


@app.post("/find_similar_dispute", response_model=AgentResult)
def find_similar_dispute(req: FindSimilarDisputeRequest) -> AgentResult:
    task_id = str(uuid.uuid4())
    try:
        cases = search_cases(req.dispute_description, case_type="dispute", top_k=req.top_k)
    except Exception as exc:  # noqa: BLE001
        return _failed_result(task_id, f"find_similar_dispute failed: {exc}")

    return _build_result(
        task_id, cases, "No comparable dispute precedent found above the similarity threshold."
    )


@app.post("/retrieve_previous_outcome", response_model=AgentResult)
def retrieve_previous_outcome(req: RetrievePreviousOutcomeRequest) -> AgentResult:
    task_id = str(uuid.uuid4())
    try:
        case = get_case_by_id(req.case_id)
    except Exception as exc:  # noqa: BLE001
        return _failed_result(task_id, f"retrieve_previous_outcome failed: {exc}")

    if case is None:
        return AgentResult(
            agent=AGENT_NAME,
            task_id=task_id,
            status="INSUFFICIENT_INFORMATION",
            findings=[{"message": f"No case found with case_id={req.case_id}"}],
            claims=[],
            evidence=[],
            confidence=0.0,
            risks=[],
            recommended_next_capabilities=[],
            receipt_id=str(uuid.uuid4()),
        )

    return AgentResult(
        agent=AGENT_NAME,
        task_id=task_id,
        status="COMPLETED",
        findings=[case],
        claims=[],
        evidence=[case["case_id"]],
        confidence=1.0,
        risks=[],
        recommended_next_capabilities=[],
        receipt_id=str(uuid.uuid4()),
    )


@app.get("/capabilities")
def capabilities() -> dict:
    return json.loads(CAPABILITIES_PATH.read_text())
