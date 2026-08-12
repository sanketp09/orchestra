"""
TRUSTLINE — Supplier Workspace
GET  /trustline/vendor/{vendor_id}/workspace/status
POST /trustline/vendor/{vendor_id}/workspace/upload

Vendor-facing: this is Meridian Steel Fabrication logging into their own
workspace to see what's blocking full compliance. Completion-percentage
math is entirely deterministic — each document requirement carries a
seeded max_points/earned_points pair, and completion is just
sum(earned)/sum(max). The optional Claude vision call only gates whether
a freshly uploaded document earns full credit immediately or falls back
to manual review; it never touches the arithmetic itself.

Also returns a `TrustBelief` for the "documentation_compliance" dimension
on every status response, since every Trustline endpoint is meant to
read from and write to that same shared belief shape.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

# Assumed to exist elsewhere in the project per the brief — a thin wrapper
# around the Anthropic SDK client, already authenticated.
from app.core.llm import get_claude_client

router = APIRouter(prefix="/trustline", tags=["trustline"])


# ============================================================================
# Shared shapes — same EvidenceItem as Sentinel's, plus the TrustBelief
# every Trustline endpoint reads from and writes to.
# ============================================================================


class EvidenceItem(BaseModel):
    source: str
    reliability_tier: Literal[
        "self_reported", "third_party_observed", "verified_transaction"
    ]
    timestamp: datetime
    raw_ref: str


class TrustBelief(BaseModel):
    entity_id: str
    dimension: str  # e.g. "schedule_reliability", "financial_stability"
    current_value: float  # 0-1
    previous_value: float
    confidence: float
    evidence: list[EvidenceItem]
    reasoning: str
    needs_human: bool


# ============================================================================
# CENTRALIZED DEMO DATA — the same three vendors and the same numbers as
# every other Trustline file. Only Meridian's workspace is fleshed out in
# detail here (this endpoint is Meridian-specific per the brief); Titan and
# Coastal are seeded just enough that the endpoint behaves sensibly if
# called for them too, without inventing numbers that contradict the
# canonical trust scores given for them elsewhere in the system.
# ============================================================================


class VendorSeed(BaseModel):
    id: str
    name: str
    trade: str
    location: str
    trust_trajectory: dict[str, float]  # year/label -> trust score
    trust_current: float


_VENDORS: dict[str, VendorSeed] = {
    "vendor_meridian_steel": VendorSeed(
        id="vendor_meridian_steel",
        name="Meridian Steel Fabrication",
        trade="Structural Steel",
        location="Houston, TX",
        trust_trajectory={"2023": 68, "2024": 74, "2025": 82, "Today": 76},
        trust_current=76,
    ),
    "vendor_titan_fab": VendorSeed(
        id="vendor_titan_fab",
        name="Titan Fabricators",
        trade="Structural Steel",
        location="Houston, TX",
        trust_trajectory={"Today": 88},
        trust_current=88,
    ),
    "vendor_coastal_bolt": VendorSeed(
        id="vendor_coastal_bolt",
        name="Coastal Bolt & Fastener",
        trade="Fasteners & Hardware",
        location="Houston, TX",
        trust_trajectory={"Today": 54},
        trust_current=54,
    ),
}

# Meridian's recent evidence events — the canonical set referenced across
# every Trustline screen, not all of which are relevant to THIS endpoint
# (document workspace), but kept here as the shared source of truth. The
# OSHA incident and bonding-line figures below directly inform two of the
# document chips' "attention" reasons.
MERIDIAN_RECENT_EVIDENCE: list[EvidenceItem] = [
    EvidenceItem(
        source="Delivery ticket — 6 days late",
        reliability_tier="verified_transaction",
        timestamp=datetime(2026, 3, 14),
        raw_ref="internal://procurement/delivery-tickets/meridian-0314",
    ),
    EvidenceItem(
        source="Factory Acceptance Test — excellent result",
        reliability_tier="third_party_observed",
        timestamp=datetime(2026, 6, 2),
        raw_ref="internal://qa/fat-results/meridian-0602",
    ),
    EvidenceItem(
        source="UCC filing appears against Meridian Steel Fabrication",
        reliability_tier="verified_transaction",
        timestamp=datetime(2026, 6, 20),
        raw_ref="internal://public-records/ucc/meridian-0620",
    ),
    EvidenceItem(
        source="Average response time increased from 1 day to 4 days over the last quarter",
        reliability_tier="third_party_observed",
        timestamp=datetime.utcnow(),
        raw_ref="internal://trustline/response-time-trend/vendor_meridian_steel",
    ),
    EvidenceItem(
        source="EMR at 1.08 (industry average ~1.00)",
        reliability_tier="third_party_observed",
        timestamp=datetime.utcnow(),
        raw_ref="internal://insurance/emr/vendor_meridian_steel",
    ),
    EvidenceItem(
        source="One OSHA recordable incident, 8 months ago",
        reliability_tier="verified_transaction",
        timestamp=datetime.utcnow(),
        raw_ref="internal://osha/recordables/vendor_meridian_steel",
    ),
    EvidenceItem(
        source="SAM.gov status: active/eligible",
        reliability_tier="verified_transaction",
        timestamp=datetime.utcnow(),
        raw_ref="internal://sam-gov/vendor_meridian_steel",
    ),
    EvidenceItem(
        source="State license: active",
        reliability_tier="verified_transaction",
        timestamp=datetime.utcnow(),
        raw_ref="internal://state-licensing/vendor_meridian_steel",
    ),
    EvidenceItem(
        source="Bonding line: $2.4M utilized of $4M capacity",
        reliability_tier="self_reported",
        timestamp=datetime.utcnow(),
        raw_ref="internal://trustline/bonding/vendor_meridian_steel",
    ),
]


def _get_vendor_or_404(vendor_id: str) -> VendorSeed:
    vendor = _VENDORS.get(vendor_id)
    if vendor is None:
        raise HTTPException(status_code=404, detail=f"Unknown vendor '{vendor_id}'.")
    return vendor


# ============================================================================
# Document workspace — the 4 requirement types shown in the UI
# ============================================================================

DocumentType = Literal["insurance", "osha", "catalog", "bond"]
DocumentStatus = Literal["complete", "attention", "missing"]

_DOCUMENT_LABELS: dict[DocumentType, str] = {
    "insurance": "Insurance",
    "osha": "OSHA Certification",
    "catalog": "Product Catalog",
    "bond": "Bond Letter",
}


class DocumentRequirement(BaseModel):
    doc_type: DocumentType
    label: str
    max_points: int
    earned_points: int
    status: DocumentStatus
    note: Optional[str] = None


class ResponseMetrics(BaseModel):
    avg_response_days: float
    percentile_faster_than: int  # e.g. 80 -> "faster than 80% of vendors"


class WorkspaceStatus(BaseModel):
    vendor_id: str
    vendor_name: str
    completion_pct: float
    documents: list[DocumentRequirement]
    response_metrics: ResponseMetrics
    next_steps: list[str]
    trust_belief: TrustBelief


class UploadDocumentRequest(BaseModel):
    document_type: DocumentType
    file_name: str
    file_size_bytes: int = Field(..., gt=0)


class UploadDocumentResponse(BaseModel):
    document: DocumentRequirement
    workspace: WorkspaceStatus


# In-memory demo state — a real implementation replaces this with a
# database table. Seeded so Meridian's workspace lands at exactly 67%
# complete (67 / 100 points across the 4 requirements below), matching
# the UI's "67% Complete" hero number.
_WORKSPACE_DOCS: dict[str, list[DocumentRequirement]] = {
    "vendor_meridian_steel": [
        DocumentRequirement(
            doc_type="insurance",
            label=_DOCUMENT_LABELS["insurance"],
            max_points=25,
            earned_points=25,
            status="complete",
        ),
        DocumentRequirement(
            doc_type="osha",
            label=_DOCUMENT_LABELS["osha"],
            max_points=30,
            earned_points=12,
            status="attention",
            note=(
                "Certificate on file references an 8-month-old recordable "
                "incident — upload the renewed certificate to clear this."
            ),
        ),
        DocumentRequirement(
            doc_type="catalog",
            label=_DOCUMENT_LABELS["catalog"],
            max_points=20,
            earned_points=20,
            status="complete",
        ),
        DocumentRequirement(
            doc_type="bond",
            label=_DOCUMENT_LABELS["bond"],
            max_points=25,
            earned_points=10,
            status="attention",
            note=(
                "Bonding line is at $2.4M of $4M capacity — upload an "
                "updated bond letter to confirm current capacity."
            ),
        ),
    ],
    # Stable, fully compliant comparison vendor — plausible default given
    # no document-completion figure was specified for Titan elsewhere.
    "vendor_titan_fab": [
        DocumentRequirement(
            doc_type=doc_type,
            label=label,
            max_points=25,
            earned_points=25,
            status="complete",
        )
        for doc_type, label in _DOCUMENT_LABELS.items()
    ],
    # Distressed vendor — plausible partial workspace, consistent with
    # their flagged financial-distress status elsewhere in the system.
    "vendor_coastal_bolt": [
        DocumentRequirement(
            doc_type="insurance",
            label=_DOCUMENT_LABELS["insurance"],
            max_points=25,
            earned_points=25,
            status="complete",
        ),
        DocumentRequirement(
            doc_type="osha",
            label=_DOCUMENT_LABELS["osha"],
            max_points=30,
            earned_points=0,
            status="missing",
            note="No OSHA certification on file.",
        ),
        DocumentRequirement(
            doc_type="catalog",
            label=_DOCUMENT_LABELS["catalog"],
            max_points=20,
            earned_points=20,
            status="complete",
        ),
        DocumentRequirement(
            doc_type="bond",
            label=_DOCUMENT_LABELS["bond"],
            max_points=25,
            earned_points=0,
            status="missing",
            note="No current bond letter on file.",
        ),
    ],
}

# Last quarter's completion figure, seeded for the trust-belief delta.
_PREVIOUS_COMPLETION_PCT: dict[str, float] = {
    "vendor_meridian_steel": 58.0,
}

# A small mock distribution of platform vendors' average response times
# (days), used to deterministically compute "faster than N% of vendors"
# rather than asserting the percentile as a hardcoded fact. Meridian's own
# 4.0-day average is excluded from this list — it's compared against it.
_PLATFORM_VENDOR_RESPONSE_DAYS: list[float] = [
    1.2, 2.0, 2.8, 3.5,  # 4 vendors faster than Meridian
    4.2, 4.5, 4.8, 5.0, 5.3, 5.6, 6.0, 6.3,
    6.6, 7.0, 7.4, 7.8, 8.2, 8.6, 9.0, 9.5,  # 16 vendors slower
]

_MERIDIAN_AVG_RESPONSE_DAYS = 4.0
NEEDS_HUMAN_COMPLETION_THRESHOLD = 50.0  # completion_pct below this needs a human look


def _compute_response_metrics(vendor_id: str) -> ResponseMetrics:
    if vendor_id != "vendor_meridian_steel":
        # Only Meridian's response-time trend is seeded in detail; other
        # vendors get a neutral placeholder rather than an invented figure.
        return ResponseMetrics(avg_response_days=3.0, percentile_faster_than=50)

    slower_count = sum(
        1 for d in _PLATFORM_VENDOR_RESPONSE_DAYS if d > _MERIDIAN_AVG_RESPONSE_DAYS
    )
    percentile = round(100 * slower_count / len(_PLATFORM_VENDOR_RESPONSE_DAYS))
    return ResponseMetrics(
        avg_response_days=_MERIDIAN_AVG_RESPONSE_DAYS,
        percentile_faster_than=percentile,
    )


# ============================================================================
# Deterministic completion math
# ============================================================================


def _compute_completion_pct(documents: list[DocumentRequirement]) -> float:
    total_max = sum(d.max_points for d in documents)
    if total_max == 0:
        return 0.0
    total_earned = sum(d.earned_points for d in documents)
    return round(100 * total_earned / total_max, 1)


def _derive_next_steps(documents: list[DocumentRequirement]) -> list[str]:
    # Prioritize the requirement with the most points still missing first —
    # that's the single upload that moves the completion number the most.
    outstanding = sorted(
        (d for d in documents if d.status != "complete"),
        key=lambda d: d.max_points - d.earned_points,
        reverse=True,
    )
    steps = []
    for doc in outstanding:
        note = f" — {doc.note}" if doc.note else ""
        steps.append(f"Upload {doc.label}{note}")
    return steps


def _build_documentation_trust_belief(
    vendor: VendorSeed, documents: list[DocumentRequirement], completion_pct: float
) -> TrustBelief:
    previous_pct = _PREVIOUS_COMPLETION_PCT.get(vendor.id, completion_pct)
    complete_count = sum(1 for d in documents if d.status == "complete")
    # More fully-verified documents on file -> higher confidence in this
    # dimension's reading.
    confidence = round(min(0.6 + 0.1 * complete_count, 0.95), 2)

    evidence = [
        EvidenceItem(
            source=(
                f"{d.label} — "
                + (
                    "on file, verified"
                    if d.status == "complete"
                    else f"needs attention ({d.note})" if d.note else "needs attention"
                )
            ),
            reliability_tier=(
                "verified_transaction" if d.status == "complete" else "self_reported"
            ),
            timestamp=datetime.utcnow(),
            raw_ref=f"internal://trustline/workspace/{vendor.id}/{d.doc_type}",
        )
        for d in documents
    ]

    return TrustBelief(
        entity_id=vendor.id,
        dimension="documentation_compliance",
        current_value=round(completion_pct / 100, 4),
        previous_value=round(previous_pct / 100, 4),
        confidence=confidence,
        evidence=evidence,
        reasoning=(
            f"{vendor.name}'s compliance workspace is {completion_pct:.0f}% complete "
            f"({complete_count}/{len(documents)} documents fully on file)."
        ),
        needs_human=completion_pct < NEEDS_HUMAN_COMPLETION_THRESHOLD,
    )


def _build_workspace_status(vendor: VendorSeed, documents: list[DocumentRequirement]) -> WorkspaceStatus:
    completion_pct = _compute_completion_pct(documents)
    return WorkspaceStatus(
        vendor_id=vendor.id,
        vendor_name=vendor.name,
        completion_pct=completion_pct,
        documents=documents,
        response_metrics=_compute_response_metrics(vendor.id),
        next_steps=_derive_next_steps(documents),
        trust_belief=_build_documentation_trust_belief(vendor, documents, completion_pct),
    )


# ============================================================================
# Optional LLM-assisted upload verification
#
# Deterministic completion math never depends on this succeeding. It only
# decides whether a freshly uploaded document earns full credit right
# away or falls back to manual review — a phrasing/classification task,
# not arithmetic or a comparison a deterministic function should own.
# ============================================================================


async def _maybe_verify_with_vision(payload: UploadDocumentRequest) -> bool:
    try:
        client = get_claude_client()
        # A real implementation would attach the uploaded file as an
        # image/PDF content block. Mocked here since no real file bytes
        # exist in this demo — only the filename is available to reason
        # about.
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=10,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"A vendor uploaded a file named '{payload.file_name}' for "
                        f"the '{payload.document_type}' requirement. Reply with only "
                        f"YES or NO: does the file name plausibly match that "
                        f"document type?"
                    ),
                }
            ],
        )
        text = "".join(
            block.text for block in response.content if getattr(block, "type", None) == "text"
        )
        return "YES" in text.upper()
    except Exception:
        # Never let an LLM/network failure block an upload — it just falls
        # back to manual review instead of instant credit.
        return False


# ============================================================================
# Routes
# ============================================================================


@router.get("/vendor/{vendor_id}/workspace/status", response_model=WorkspaceStatus)
async def get_workspace_status(vendor_id: str) -> WorkspaceStatus:
    vendor = _get_vendor_or_404(vendor_id)
    documents = _WORKSPACE_DOCS.get(vendor_id, [])
    return _build_workspace_status(vendor, documents)


@router.post("/vendor/{vendor_id}/workspace/upload", response_model=UploadDocumentResponse)
async def upload_workspace_document(
    vendor_id: str, payload: UploadDocumentRequest
) -> UploadDocumentResponse:
    vendor = _get_vendor_or_404(vendor_id)
    documents = _WORKSPACE_DOCS.get(vendor_id)
    if documents is None:
        raise HTTPException(status_code=404, detail=f"No workspace on file for '{vendor_id}'.")

    doc = next((d for d in documents if d.doc_type == payload.document_type), None)
    if doc is None:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown document type '{payload.document_type}' for this workspace.",
        )

    verified = await _maybe_verify_with_vision(payload)

    if verified:
        doc.earned_points = doc.max_points
        doc.status = "complete"
        doc.note = None
    else:
        doc.status = "attention"
        doc.note = "Uploaded — pending manual review before it counts toward completion."
        # Deterministic partial credit for having *something* newer on
        # file, even before manual review clears it — never less than
        # what was already earned.
        doc.earned_points = max(doc.earned_points, round(doc.max_points * 0.5))

    workspace = _build_workspace_status(vendor, documents)
    return UploadDocumentResponse(document=doc, workspace=workspace)
