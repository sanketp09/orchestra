"""
Verification/reasoning logic for Sentinel's six capabilities.

Kept separate from main.py so the route handlers stay thin: each function
here takes plain inputs (+ a Supabase client), does the LLM reasoning, and
returns a dict of the pieces main.py needs to assemble an AgentResult.
No FastAPI/HTTP concerns belong in this file.
"""

from pydantic import BaseModel
from supabase import Client

from common.llm_client import generate_structured
from sentinel.retrieval import find_relevant_evidence, get_evidence_by_refs

CONFIDENCE_THRESHOLD = 0.5


# ---------------------------------------------------------------------------
# LLM output schemas
# ---------------------------------------------------------------------------


class VerdictSchema(BaseModel):
    verdict: str  # "supported" | "contradicted" | "not_addressed"
    confidence: float  # 0-1
    explanation: str
    contradiction_details: str | None = None


class ComparisonSchema(BaseModel):
    consistent: bool
    discrepancies: list[str]
    summary: str


class ContradictionSchema(BaseModel):
    contradiction: bool
    confidence: float
    explanation: str


class MissingEvidenceSchema(BaseModel):
    gaps: list[str]


class ProgressVerdictSchema(BaseModel):
    verdict: str  # "supported" | "contradicted" | "not_addressed"
    confidence: float
    explanation: str
    estimated_actual_progress: float | None = None  # 0-100, only if evidence suggests a different value


class InvoiceCheckSchema(BaseModel):
    matches: bool
    anomalies: list[str]
    summary: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _evidence_block(evidence_rows: list[dict]) -> str:
    """Render evidence rows into a labeled block for prompt context."""
    parts = []
    for row in evidence_rows:
        parts.append(
            f"[evidence_id={row['evidence_id']} source={row.get('source_ref', '?')}]\n"
            f"{row.get('extracted_text', '')}"
        )
    return "\n\n---\n\n".join(parts)


def _gather_evidence(
    supabase: Client, project_id: str, claim_text: str, evidence_refs: list[str] | None
) -> list[dict]:
    """Use explicit evidence_refs if given, else retrieve top-k by similarity."""
    if evidence_refs:
        return get_evidence_by_refs(supabase, evidence_refs)
    return find_relevant_evidence(supabase, project_id, claim_text)


# ---------------------------------------------------------------------------
# 1. verify_claim
# ---------------------------------------------------------------------------


def verify_claim(
    supabase: Client, project_id: str, claim_text: str, evidence_refs: list[str] | None
) -> dict:
    evidence_rows = _gather_evidence(supabase, project_id, claim_text, evidence_refs)

    if not evidence_rows:
        return {
            "verdict": None,
            "confidence": 0.0,
            "explanation": "no relevant evidence found",
            "evidence_ids": [],
        }

    prompt = (
        "You are verifying a claim against a set of evidence excerpts.\n\n"
        f"CLAIM:\n{claim_text}\n\n"
        f"EVIDENCE:\n{_evidence_block(evidence_rows)}\n\n"
        "Judge whether the evidence SUPPORTS the claim, CONTRADICTS it, or "
        "FAILS TO ADDRESS it. Give a confidence score from 0 to 1, a short "
        "explanation, and contradiction_details if the verdict is "
        "'contradicted'."
    )
    result = generate_structured(prompt, VerdictSchema)

    return {
        "verdict": result.verdict,
        "confidence": result.confidence,
        "explanation": result.explanation,
        "contradiction_details": result.contradiction_details,
        "evidence_ids": [row["evidence_id"] for row in evidence_rows],
    }


def persist_verification(
    supabase: Client,
    claim_id: str | None,
    verdict: str | None,
    confidence: float,
    contradiction_details: str | None,
    evidence_ids: list[str],
) -> str:
    """Write a verification_results row and, if we have a claim_id, update
    claims.status to match. Returns the new result_id."""
    row = {
        "claim_id": claim_id,
        "verdict": verdict,
        "confidence": confidence,
        "contradiction_details": (
            {"details": contradiction_details} if contradiction_details else None
        ),
        "evidence_refs": evidence_ids,
    }
    resp = supabase.table("verification_results").insert(row).execute()
    result_id = resp.data[0]["result_id"]

    if claim_id:
        new_status = _status_for_verdict(verdict, confidence)
        supabase.table("claims").update({"status": new_status}).eq(
            "claim_id", claim_id
        ).execute()

    return result_id


def _status_for_verdict(verdict: str | None, confidence: float) -> str:
    if confidence < CONFIDENCE_THRESHOLD or verdict is None:
        return "INSUFFICIENT_INFORMATION"
    if verdict == "supported":
        return "verified"
    if verdict == "contradicted":
        return "disputed"
    return "unverified"


# ---------------------------------------------------------------------------
# 2. compare_documents
# ---------------------------------------------------------------------------


def compare_documents(supabase: Client, evidence_refs: list[str]) -> ComparisonSchema:
    evidence_rows = get_evidence_by_refs(supabase, evidence_refs)
    prompt = (
        "Compare the following documents for consistency. Identify any "
        "discrepancies (dates, amounts, names, claims that conflict with "
        "each other).\n\n"
        f"{_evidence_block(evidence_rows)}"
    )
    return generate_structured(prompt, ComparisonSchema)


# ---------------------------------------------------------------------------
# 3. detect_contradiction
# ---------------------------------------------------------------------------


def detect_contradiction(
    supabase: Client, claim_text: str, evidence_refs: list[str]
) -> ContradictionSchema:
    evidence_rows = get_evidence_by_refs(supabase, evidence_refs)
    prompt = (
        "Does the evidence below directly CONTRADICT the claim? Answer "
        "yes/no with a confidence score and a clear explanation. Only "
        "answer yes if there is a genuine, specific contradiction - not "
        "merely an absence of supporting evidence.\n\n"
        f"CLAIM:\n{claim_text}\n\n"
        f"EVIDENCE:\n{_evidence_block(evidence_rows)}"
    )
    return generate_structured(prompt, ContradictionSchema)


# ---------------------------------------------------------------------------
# 4. find_missing_evidence
# ---------------------------------------------------------------------------


def find_missing_evidence(
    claim_text: str,
    claim_type: str | None,
    available_evidence: list[dict],
) -> MissingEvidenceSchema:
    available_desc = (
        "\n".join(
            f"- {row.get('source_type', '?')}: {row.get('source_ref', '?')}"
            for row in available_evidence
        )
        or "(none)"
    )
    prompt = (
        f"A claim of type '{claim_type or 'unknown'}' has been made:\n"
        f"{claim_text}\n\n"
        f"Evidence currently available for this claim:\n{available_desc}\n\n"
        "What kinds of evidence would typically be needed to verify a claim "
        "like this that are NOT currently available? List specific gaps, "
        "e.g. 'no site inspection report found for this progress claim'."
    )
    return generate_structured(prompt, MissingEvidenceSchema)


# ---------------------------------------------------------------------------
# 5. verify_progress
# ---------------------------------------------------------------------------


def verify_progress(
    supabase: Client, claim_text: str, evidence_refs: list[str]
) -> ProgressVerdictSchema:
    evidence_rows = get_evidence_by_refs(supabase, evidence_refs)
    prompt = (
        "This is a manufacturing/FAT/progress-percentage claim. Reason "
        "specifically about whether the evidence supports the CLAIMED "
        "PERCENTAGE of completion, not just general plausibility. If the "
        "evidence suggests the true progress differs from what's claimed, "
        "set estimated_actual_progress to your best estimate (0-100); "
        "otherwise leave it null.\n\n"
        f"CLAIM:\n{claim_text}\n\n"
        f"EVIDENCE:\n{_evidence_block(evidence_rows)}"
    )
    return generate_structured(prompt, ProgressVerdictSchema)


# ---------------------------------------------------------------------------
# 6. verify_invoice
# ---------------------------------------------------------------------------


def verify_invoice(
    supabase: Client, invoice_ref: str, po_ref: str, contract_ref: str
) -> InvoiceCheckSchema:
    rows = get_evidence_by_refs(supabase, [invoice_ref, po_ref, contract_ref])
    by_ref = {row["evidence_id"]: row for row in rows}

    invoice_text = by_ref.get(invoice_ref, {}).get("extracted_text", "")
    po_text = by_ref.get(po_ref, {}).get("extracted_text", "")
    contract_text = by_ref.get(contract_ref, {}).get("extracted_text", "")

    prompt = (
        "Check whether the invoice's amount and line items match the "
        "purchase order and contract terms. Flag anomalies such as "
        "duplicate line items or amounts inconsistent with the PO.\n\n"
        f"INVOICE:\n{invoice_text}\n\n"
        f"PURCHASE ORDER:\n{po_text}\n\n"
        f"CONTRACT:\n{contract_text}"
    )
    return generate_structured(prompt, InvoiceCheckSchema)
