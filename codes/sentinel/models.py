"""
Pydantic request models for Sentinel's endpoints, plus the shared Supabase
client. AgentTask / AgentResult live in common/contracts.py and are reused
as-is.
"""

import os

from pydantic import BaseModel, model_validator
from supabase import Client, create_client

# ---------------------------------------------------------------------------
# Supabase client
# ---------------------------------------------------------------------------


def get_supabase() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


# ---------------------------------------------------------------------------
# Shared "claim_id OR claim_text" mixin
# ---------------------------------------------------------------------------


class ClaimRef(BaseModel):
    """
    Most endpoints accept either a claim_id (look the claim up) or a raw
    claim_text (verify an ad-hoc claim that isn't stored yet). Exactly one
    must be given.
    """

    claim_id: str | None = None
    claim_text: str | None = None
    project_id: str

    @model_validator(mode="after")
    def _one_of_claim_id_or_text(self) -> "ClaimRef":
        if not self.claim_id and not self.claim_text:
            raise ValueError("one of claim_id or claim_text is required")
        return self


# ---------------------------------------------------------------------------
# Per-endpoint request bodies
# ---------------------------------------------------------------------------


class VerifyClaimRequest(ClaimRef):
    evidence_refs: list[str] | None = None  # evidence_ids; if omitted, retrieve top-k


class CompareDocumentsRequest(BaseModel):
    project_id: str
    evidence_refs: list[str]

    @model_validator(mode="after")
    def _at_least_two(self) -> "CompareDocumentsRequest":
        if len(self.evidence_refs) < 2:
            raise ValueError("compare_documents needs at least 2 evidence_refs")
        return self


class DetectContradictionRequest(ClaimRef):
    evidence_refs: list[str]


class FindMissingEvidenceRequest(ClaimRef):
    available_evidence_refs: list[str] = []
    claim_type: str | None = None


class VerifyProgressRequest(ClaimRef):
    evidence_refs: list[str]


class VerifyInvoiceRequest(BaseModel):
    project_id: str
    invoice_ref: str
    po_ref: str
    contract_ref: str
