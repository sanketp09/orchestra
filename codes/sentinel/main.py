"""
Sentinel - claim/document verification microservice.

Called only by ORCHESTRA over HTTP. Never calls other specialist services
directly. Every capability endpoint returns a schema-valid AgentResult.
"""

import json
import uuid
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from supabase import Client

from common.contracts import AgentResult
from sentinel import logic
from sentinel.ingestion import ingest_document as run_ingest_document
from sentinel.models import (
    CompareDocumentsRequest,
    DetectContradictionRequest,
    FindMissingEvidenceRequest,
    VerifyClaimRequest,
    VerifyInvoiceRequest,
    VerifyProgressRequest,
    get_supabase,
)
from sentinel.retrieval import get_evidence_by_refs, resolve_claim_text

AGENT_NAME = "sentinel"
CAPABILITIES_PATH = Path(__file__).parent / "capabilities.json"

app = FastAPI(title="Sentinel")


def _new_receipt_id() -> str:
    return str(uuid.uuid4())


def _failed_result(task_id: str, message: str) -> AgentResult:
    return AgentResult(
        agent=AGENT_NAME,
        task_id=task_id,
        status="FAILED",
        findings=[{"error": message}],
        confidence=0.0,
        receipt_id=_new_receipt_id(),
    )


def _status_for_confidence(confidence: float) -> str:
    return "COMPLETED" if confidence >= logic.CONFIDENCE_THRESHOLD else "INSUFFICIENT_INFORMATION"


# ---------------------------------------------------------------------------
# Plumbing
# ---------------------------------------------------------------------------


@app.post("/ingest_document")
async def ingest_document_endpoint(
    project_id: str,
    file: UploadFile = File(...),
    supabase: Client = Depends(get_supabase),
):
    try:
        evidence_ids = await run_ingest_document(supabase, project_id, file)
    except Exception as exc:  # noqa: BLE001 - surfaced to caller, not raised
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"evidence_ids": evidence_ids}


@app.get("/capabilities")
def capabilities():
    return json.loads(CAPABILITIES_PATH.read_text())


# ---------------------------------------------------------------------------
# 1. verify_claim
# ---------------------------------------------------------------------------


@app.post("/verify_claim", response_model=AgentResult)
def verify_claim_endpoint(
    task_id: str, body: VerifyClaimRequest, supabase: Client = Depends(get_supabase)
):
    try:
        claim_text = resolve_claim_text(supabase, body.claim_id, body.claim_text)
        result = logic.verify_claim(
            supabase, body.project_id, claim_text, body.evidence_refs
        )

        if not result["evidence_ids"]:
            return AgentResult(
                agent=AGENT_NAME,
                task_id=task_id,
                status="INSUFFICIENT_INFORMATION",
                findings=[{"reason": result["explanation"]}],
                confidence=0.0,
                recommended_next_capabilities=["sentinel.find_missing_evidence"],
                receipt_id=_new_receipt_id(),
            )

        result_id = logic.persist_verification(
            supabase,
            body.claim_id,
            result["verdict"],
            result["confidence"],
            result.get("contradiction_details"),
            result["evidence_ids"],
        )

        status = _status_for_confidence(result["confidence"])
        recommended = (
            ["sentinel.find_missing_evidence"] if status == "INSUFFICIENT_INFORMATION" else []
        )

        return AgentResult(
            agent=AGENT_NAME,
            task_id=task_id,
            status=status,
            findings=[
                {
                    "verdict": result["verdict"],
                    "explanation": result["explanation"],
                    "contradiction_details": result.get("contradiction_details"),
                    "result_id": result_id,
                }
            ],
            confidence=result["confidence"],
            evidence=result["evidence_ids"],
            recommended_next_capabilities=recommended,
            receipt_id=_new_receipt_id(),
        )
    except Exception as exc:  # noqa: BLE001
        return _failed_result(task_id, str(exc))


# ---------------------------------------------------------------------------
# 2. compare_documents
# ---------------------------------------------------------------------------


@app.post("/compare_documents", response_model=AgentResult)
def compare_documents_endpoint(
    task_id: str, body: CompareDocumentsRequest, supabase: Client = Depends(get_supabase)
):
    try:
        comparison = logic.compare_documents(supabase, body.evidence_refs)
        confidence = 1.0 if comparison.consistent or comparison.discrepancies else 0.4

        return AgentResult(
            agent=AGENT_NAME,
            task_id=task_id,
            status=_status_for_confidence(confidence),
            findings=[
                {
                    "consistent": comparison.consistent,
                    "discrepancies": comparison.discrepancies,
                    "summary": comparison.summary,
                }
            ],
            confidence=confidence,
            evidence=body.evidence_refs,
            receipt_id=_new_receipt_id(),
        )
    except Exception as exc:  # noqa: BLE001
        return _failed_result(task_id, str(exc))


# ---------------------------------------------------------------------------
# 3. detect_contradiction
# ---------------------------------------------------------------------------


@app.post("/detect_contradiction", response_model=AgentResult)
def detect_contradiction_endpoint(
    task_id: str,
    body: DetectContradictionRequest,
    supabase: Client = Depends(get_supabase),
):
    try:
        claim_text = resolve_claim_text(supabase, body.claim_id, body.claim_text)
        result = logic.detect_contradiction(supabase, claim_text, body.evidence_refs)

        return AgentResult(
            agent=AGENT_NAME,
            task_id=task_id,
            status=_status_for_confidence(result.confidence),
            findings=[
                {"contradiction": result.contradiction, "explanation": result.explanation}
            ],
            confidence=result.confidence,
            evidence=body.evidence_refs,
            receipt_id=_new_receipt_id(),
        )
    except Exception as exc:  # noqa: BLE001
        return _failed_result(task_id, str(exc))


# ---------------------------------------------------------------------------
# 4. find_missing_evidence
# ---------------------------------------------------------------------------


@app.post("/find_missing_evidence", response_model=AgentResult)
def find_missing_evidence_endpoint(
    task_id: str,
    body: FindMissingEvidenceRequest,
    supabase: Client = Depends(get_supabase),
):
    try:
        claim_text = resolve_claim_text(supabase, body.claim_id, body.claim_text)
        available = get_evidence_by_refs(supabase, body.available_evidence_refs)
        result = logic.find_missing_evidence(claim_text, body.claim_type, available)

        confidence = 1.0 if not result.gaps else 0.6

        return AgentResult(
            agent=AGENT_NAME,
            task_id=task_id,
            status="COMPLETED",
            findings=[{"gap": gap} for gap in result.gaps],
            confidence=confidence,
            evidence=body.available_evidence_refs,
            receipt_id=_new_receipt_id(),
        )
    except Exception as exc:  # noqa: BLE001
        return _failed_result(task_id, str(exc))


# ---------------------------------------------------------------------------
# 5. verify_progress
# ---------------------------------------------------------------------------


@app.post("/verify_progress", response_model=AgentResult)
def verify_progress_endpoint(
    task_id: str, body: VerifyProgressRequest, supabase: Client = Depends(get_supabase)
):
    try:
        claim_text = resolve_claim_text(supabase, body.claim_id, body.claim_text)
        result = logic.verify_progress(supabase, claim_text, body.evidence_refs)

        status = _status_for_confidence(result.confidence)
        recommended = (
            ["sentinel.find_missing_evidence"] if status == "INSUFFICIENT_INFORMATION" else []
        )

        return AgentResult(
            agent=AGENT_NAME,
            task_id=task_id,
            status=status,
            findings=[
                {
                    "verdict": result.verdict,
                    "explanation": result.explanation,
                    "estimated_actual_progress": result.estimated_actual_progress,
                }
            ],
            confidence=result.confidence,
            evidence=body.evidence_refs,
            recommended_next_capabilities=recommended,
            receipt_id=_new_receipt_id(),
        )
    except Exception as exc:  # noqa: BLE001
        return _failed_result(task_id, str(exc))


# ---------------------------------------------------------------------------
# 6. verify_invoice
# ---------------------------------------------------------------------------


@app.post("/verify_invoice", response_model=AgentResult)
def verify_invoice_endpoint(
    task_id: str, body: VerifyInvoiceRequest, supabase: Client = Depends(get_supabase)
):
    try:
        result = logic.verify_invoice(
            supabase, body.invoice_ref, body.po_ref, body.contract_ref
        )
        confidence = 1.0 if result.matches and not result.anomalies else 0.5

        return AgentResult(
            agent=AGENT_NAME,
            task_id=task_id,
            status=_status_for_confidence(confidence),
            findings=[
                {
                    "matches": result.matches,
                    "anomalies": result.anomalies,
                    "summary": result.summary,
                }
            ],
            confidence=confidence,
            evidence=[body.invoice_ref, body.po_ref, body.contract_ref],
            receipt_id=_new_receipt_id(),
        )
    except Exception as exc:  # noqa: BLE001
        return _failed_result(task_id, str(exc))
