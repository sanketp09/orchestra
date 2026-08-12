"""
POST /api/compass/procurement-xray

"What problems will this procurement decision create BEFORE I commit to it?"

Pipeline:
- Step 1 (LLM, genuinely needed): semantic extraction only. A vendor
  quote/contract/proposal/scope document arrives as raw text; an LLM pulls out
  structured fields (scope line items, pricing, clauses, vendor identity,
  dependencies, dates) via a Claude tool-call. The LLM never judges whether
  anything is risky — it only reads and structures.
- Step 2 (deterministic): the extracted document is compared against
  centralized ORCHESTRA reference data — project drawings/BOQ, vendor
  history, historical clause-risk library, price benchmarks, and the
  procurement dependency graph — using plain Python comparisons, set
  differences, and numeric thresholds. No LLM arithmetic or comparison logic
  anywhere in this step.
- Step 3: findings are assembled into the shared evidence contract and
  returned, sorted by impact.

Reference/demo data below is the same centralized ORCHESTRA dataset used
across Sentinel and Trustline (Meridian Steel Fabrication as the primary
vendor), extended here with the BOQ/drawing/clause/pricing data specific to
Compass.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


# ---------------------------------------------------------------------------
# Shared evidence contract (same shape used across Sentinel / Trustline)
# ---------------------------------------------------------------------------

class EvidenceItem(BaseModel):
    source: str
    reliability_tier: Literal["self_reported", "third_party_observed", "verified_transaction"]
    timestamp: datetime
    raw_ref: str


class EvidenceResult(BaseModel):
    confidence: float
    evidence: list[EvidenceItem]
    reasoning: str
    needs_human: bool
    writes_to: list[str]


# ---------------------------------------------------------------------------
# Compass-specific finding contract
# ---------------------------------------------------------------------------

FindingType = Literal["scope_gap", "price_anomaly", "clause_risk", "vendor_risk", "dependency_risk"]
Verdict = Literal["confirmed", "likely", "watch"]
Impact = Literal["low", "medium", "high"]


class Finding(EvidenceResult):
    id: str
    type: FindingType
    claim: str
    verdict: Verdict
    impact: Impact
    estimated_cost_usd: Optional[float] = None
    recommendation: str
    layer: Literal["scope", "price", "clauses", "vendor", "history", "dependencies"]
    document_ref: str  # what part of the uploaded doc this ties to


class XRayRequest(BaseModel):
    document_text: str
    document_name: str = "uploaded_document"
    project_id: str = "proj_block_c_foundation"
    vendor_id: Optional[str] = None  # if known; otherwise inferred from extraction


class ExtractedDocument(BaseModel):
    """Structured output of the LLM extraction step."""
    vendor_name: str
    scope_items: list[str]
    pricing: dict[str, float]  # item -> unit price
    clauses: list[str]  # short clause summaries, e.g. "payment terms: net 60"
    dependencies: list[str]  # e.g. "steel delivery tied to foundation pour completion"
    document_dates: list[str]  # ISO dates mentioned


class XRayResult(BaseModel):
    document_name: str
    vendor_id: str
    vendor_name: str
    total_findings: int
    future_disputes_detected: int
    findings: list[Finding]
    layers_scanned: list[str]
    overall_confidence: float
    needs_human: bool


# ---------------------------------------------------------------------------
# Centralized ORCHESTRA demo data
# ---------------------------------------------------------------------------

_NOW = datetime.now(timezone.utc)

_VENDOR_NAMES = {
    "vendor_meridian_steel": "Meridian Steel Fabrication",
    "vendor_titan_fab": "Titan Fabricators",
    "vendor_coastal_bolt": "Coastal Bolt & Fastener",
}

# MOCK/SEEDED: project BOQ (Bill of Quantities) + drawings for Block C
# foundation/structural steel package. This is what an uploaded quote/scope
# doc gets checked against for scope gaps.
_PROJECT_BOQ: dict[str, dict] = {
    "proj_block_c_foundation": {
        "required_scope_items": [
            "structural steel columns",
            "structural steel beams",
            "base plates",
            "anchor bolts",
            "shop primer coating",
            "erection and installation",
        ],
        "drawing_ref": "S-402 Rev C — Block C Structural Steel Package",
    }
}

# MOCK/SEEDED: price benchmark per scope item, drawn from the portfolio's
# historical pricing evidence across comparable projects/vendors.
_PRICE_BENCHMARKS: dict[str, dict] = {
    "structural steel columns": {"benchmark_unit_price": 2850.0, "unit": "per ton"},
    "structural steel beams": {"benchmark_unit_price": 2650.0, "unit": "per ton"},
    "base plates": {"benchmark_unit_price": 410.0, "unit": "per unit"},
    "anchor bolts": {"benchmark_unit_price": 38.0, "unit": "per unit"},
    "shop primer coating": {"benchmark_unit_price": 180.0, "unit": "per ton"},
    "erection and installation": {"benchmark_unit_price": 620.0, "unit": "per ton"},
}

# Threshold above which a price is flagged as anomalous vs. benchmark.
PRICE_ANOMALY_THRESHOLD_PCT = 12.0

# MOCK/SEEDED: historical clause-risk library — clause patterns that have
# previously led to disputes on this portfolio, with the dispute rate that
# clause type has historically produced.
_CLAUSE_RISK_LIBRARY: dict[str, dict] = {
    "payment terms: net 60": {
        "risk_label": "Extended payment terms",
        "historical_dispute_rate": 0.34,
        "typical_impact": "medium",
        "note": "Net-60 terms have preceded a cash-flow-related dispute in 34% of past contracts "
        "carrying this clause on this portfolio.",
    },
    "liquidated damages: uncapped": {
        "risk_label": "Uncapped liquidated damages",
        "historical_dispute_rate": 0.61,
        "typical_impact": "high",
        "note": "Uncapped LD clauses have led to a formal dispute in 61% of prior cases — "
        "the single highest-risk clause pattern in this portfolio's history.",
    },
    "change order markup: unspecified": {
        "risk_label": "Unspecified change-order markup",
        "historical_dispute_rate": 0.28,
        "typical_impact": "medium",
        "note": "Contracts that leave change-order markup unspecified have disputed pricing "
        "on 28% of subsequent change orders.",
    },
}

# MOCK/SEEDED: vendor history evidence — same Meridian Steel story used
# across Sentinel/Trustline (delivery lateness, response time slowdown, UCC
# filing).
_VENDOR_HISTORY: dict[str, dict] = {
    "vendor_meridian_steel": {
        "trust_score": 76,
        "trust_delta": -6,
        "events": [
            {"date": "2026-03-14", "label": "Delivery ticket 6 days late", "tier": "verified_transaction"},
            {"date": "2026-06-20", "label": "UCC filing appeared against entity", "tier": "third_party_observed"},
        ],
        "response_time_days": 4.2,
        "response_time_baseline_days": 1.0,
    },
    "vendor_titan_fab": {"trust_score": 88, "trust_delta": 1, "events": [], "response_time_days": 0.9, "response_time_baseline_days": 1.1},
    "vendor_coastal_bolt": {"trust_score": 54, "trust_delta": -5, "events": [], "response_time_days": 3.1, "response_time_baseline_days": 2.0},
}

# MOCK/SEEDED: procurement dependency graph — what this scope item's timing
# is coupled to elsewhere in the schedule.
_DEPENDENCY_GRAPH: dict[str, dict] = {
    "proj_block_c_foundation": {
        "structural steel erection": {
            "depends_on": "concrete foundation pour (Block C)",
            "scheduled_completion": "2026-08-25",
            "current_status": "delayed 5 days (see Sentinel delay-excuse record)",
        }
    }
}


# ---------------------------------------------------------------------------
# Step 1: LLM extraction (genuinely needed — free text -> structured fields)
# ---------------------------------------------------------------------------

async def _extract_document(document_text: str) -> ExtractedDocument:
    client = get_claude_client()  # assumed to exist elsewhere in the app

    tool = {
        "name": "record_extracted_document",
        "description": (
            "Record the structured scope items, pricing, clauses, vendor identity, dependencies, "
            "and dates found in a procurement document (vendor quote, draft contract, proposal, or "
            "scope document)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "vendor_name": {"type": "string"},
                "scope_items": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Each distinct scope-of-work line item mentioned, in plain lowercase phrases.",
                },
                "pricing": {
                    "type": "object",
                    "description": "Map of scope item (matching scope_items phrasing) to unit price in USD.",
                    "additionalProperties": {"type": "number"},
                },
                "clauses": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Short normalized clause summaries, e.g. 'payment terms: net 60'.",
                },
                "dependencies": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Any scheduling/procurement dependencies mentioned.",
                },
                "document_dates": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "ISO 8601 dates (YYYY-MM-DD) mentioned in the document.",
                },
            },
            "required": ["vendor_name", "scope_items", "pricing", "clauses", "dependencies", "document_dates"],
        },
    }

    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1200,
        tools=[tool],
        tool_choice={"type": "tool", "name": "record_extracted_document"},
        messages=[
            {
                "role": "user",
                "content": (
                    "Extract structured procurement fields from this document. Normalize scope item "
                    "phrasing to lowercase where possible (e.g. 'structural steel columns'), and normalize "
                    "clause summaries to short 'category: value' phrases (e.g. 'payment terms: net 60').\n\n"
                    f"Document:\n{document_text}"
                ),
            }
        ],
    )

    tool_use_block = next(b for b in response.content if b.type == "tool_use")
    parsed = tool_use_block.input
    return ExtractedDocument(**parsed)


# ---------------------------------------------------------------------------
# Step 2: deterministic comparison — scope, price, clause, vendor, dependency
# ---------------------------------------------------------------------------

def _find_scope_gaps(extracted: ExtractedDocument, project_id: str) -> list[Finding]:
    boq = _PROJECT_BOQ.get(project_id)
    if boq is None:
        return []

    doc_items = {s.lower() for s in extracted.scope_items}
    required = boq["required_scope_items"]
    missing = [item for item in required if item not in doc_items]

    findings: list[Finding] = []
    for item in missing:
        findings.append(
            Finding(
                id=f"finding_scope_{item.replace(' ', '_')}",
                type="scope_gap",
                claim=f"'{item}' is missing from the submitted scope.",
                verdict="confirmed",
                confidence=0.94,
                impact="high" if item in ("anchor bolts", "base plates") else "medium",
                estimated_cost_usd=_PRICE_BENCHMARKS.get(item, {}).get("benchmark_unit_price"),
                recommendation=f"Request the vendor confirm '{item}' is included or issue a scope clarification before award.",
                layer="scope",
                document_ref=f"Compared against {boq['drawing_ref']}",
                evidence=[
                    EvidenceItem(
                        source="project_boq",
                        reliability_tier="verified_transaction",
                        timestamp=_NOW,
                        raw_ref=f"{boq['drawing_ref']}: required item '{item}' not found in submitted scope",
                    )
                ],
                reasoning=f"The project BOQ ({boq['drawing_ref']}) requires '{item}', but it does not appear "
                f"anywhere in the submitted document's extracted scope items.",
                needs_human=False,
                writes_to=["compass.findings", "procurement.scope_review"],
            )
        )
    return findings


def _find_price_anomalies(extracted: ExtractedDocument) -> list[Finding]:
    findings: list[Finding] = []
    for item, quoted_price in extracted.pricing.items():
        benchmark = _PRICE_BENCHMARKS.get(item.lower())
        if benchmark is None:
            continue
        benchmark_price = benchmark["benchmark_unit_price"]
        if benchmark_price <= 0:
            continue
        deviation_pct = ((quoted_price - benchmark_price) / benchmark_price) * 100

        if abs(deviation_pct) < PRICE_ANOMALY_THRESHOLD_PCT:
            continue

        direction = "above" if deviation_pct > 0 else "below"
        findings.append(
            Finding(
                id=f"finding_price_{item.replace(' ', '_')}",
                type="price_anomaly",
                claim=f"'{item}' is quoted {abs(deviation_pct):.1f}% {direction} the portfolio benchmark.",
                verdict="confirmed",
                confidence=0.9,
                impact="high" if abs(deviation_pct) >= 20 else "medium",
                estimated_cost_usd=round(quoted_price - benchmark_price, 2),
                recommendation=(
                    "Request pricing justification or benchmark against a second bid before proceeding."
                    if deviation_pct > 0
                    else "Verify scope completeness — unusually low pricing sometimes signals an omission."
                ),
                layer="price",
                document_ref=f"Quoted unit price: ${quoted_price:,.2f} {benchmark.get('unit', '')}",
                evidence=[
                    EvidenceItem(
                        source="portfolio_price_benchmark",
                        reliability_tier="verified_transaction",
                        timestamp=_NOW,
                        raw_ref=f"Benchmark for '{item}': ${benchmark_price:,.2f} {benchmark.get('unit', '')}",
                    )
                ],
                reasoning=f"Quoted price of ${quoted_price:,.2f} deviates {deviation_pct:+.1f}% from the "
                f"${benchmark_price:,.2f} portfolio benchmark for '{item}', exceeding the "
                f"{PRICE_ANOMALY_THRESHOLD_PCT}% anomaly threshold.",
                needs_human=abs(deviation_pct) >= 20,
                writes_to=["compass.findings", "procurement.price_review"],
            )
        )
    return findings


def _find_clause_risks(extracted: ExtractedDocument) -> list[Finding]:
    findings: list[Finding] = []
    for clause in extracted.clauses:
        risk = _CLAUSE_RISK_LIBRARY.get(clause.lower())
        if risk is None:
            continue
        findings.append(
            Finding(
                id=f"finding_clause_{clause.replace(' ', '_').replace(':', '')}",
                type="clause_risk",
                claim=f"{risk['risk_label']} clause detected.",
                verdict="likely",
                confidence=round(0.6 + risk["historical_dispute_rate"] * 0.35, 2),
                impact=risk["typical_impact"],
                estimated_cost_usd=None,
                recommendation="Negotiate this clause or flag it for legal review before signing.",
                layer="clauses",
                document_ref=f"Clause: \"{clause}\"",
                evidence=[
                    EvidenceItem(
                        source="historical_clause_risk_library",
                        reliability_tier="verified_transaction",
                        timestamp=_NOW,
                        raw_ref=f"{risk['historical_dispute_rate']*100:.0f}% historical dispute rate for this clause pattern",
                    )
                ],
                reasoning=risk["note"],
                needs_human=risk["historical_dispute_rate"] >= 0.5,
                writes_to=["compass.findings", "procurement.clause_review"],
            )
        )
    return findings


def _find_vendor_risks(vendor_id: str, vendor_name: str) -> list[Finding]:
    history = _VENDOR_HISTORY.get(vendor_id)
    if history is None:
        return []

    findings: list[Finding] = []

    if history["trust_delta"] < 0:
        findings.append(
            Finding(
                id=f"finding_vendor_trust_decline_{vendor_id}",
                type="vendor_risk",
                claim=f"{vendor_name}'s trust score has dropped {abs(history['trust_delta'])} points recently.",
                verdict="confirmed",
                confidence=0.88,
                impact="medium",
                estimated_cost_usd=None,
                recommendation="Review the vendor's Trustline profile before proceeding; consider a comparison bid.",
                layer="vendor",
                document_ref=f"Vendor: {vendor_name}",
                evidence=[
                    EvidenceItem(
                        source="trustline_vendor_profile",
                        reliability_tier="third_party_observed",
                        timestamp=_NOW,
                        raw_ref=f"Trust score {history['trust_score']}, delta {history['trust_delta']}",
                    )
                ]
                + [
                    EvidenceItem(
                        source="trustline_evidence_event",
                        reliability_tier=e["tier"],
                        timestamp=datetime.fromisoformat(e["date"]).replace(tzinfo=timezone.utc),
                        raw_ref=e["label"],
                    )
                    for e in history["events"]
                ],
                reasoning=f"{vendor_name}'s trust score fell from a recent high, coinciding with "
                + "; ".join(e["label"] for e in history["events"])
                + ".",
                needs_human=False,
                writes_to=["compass.findings", "vendor.risk_review"],
            )
        )

    if history["response_time_days"] > history["response_time_baseline_days"] * 2:
        findings.append(
            Finding(
                id=f"finding_vendor_responsiveness_{vendor_id}",
                type="vendor_risk",
                claim=f"{vendor_name}'s response time has more than doubled recently.",
                verdict="confirmed",
                confidence=0.85,
                impact="medium",
                estimated_cost_usd=None,
                recommendation="Confirm current point-of-contact and escalation path before award.",
                layer="history",
                document_ref=f"Vendor: {vendor_name}",
                evidence=[
                    EvidenceItem(
                        source="trustline_responsiveness_log",
                        reliability_tier="verified_transaction",
                        timestamp=_NOW,
                        raw_ref=f"Response time {history['response_time_days']}d vs baseline {history['response_time_baseline_days']}d",
                    )
                ],
                reasoning=f"Average response time is now {history['response_time_days']} days, up from a "
                f"{history['response_time_baseline_days']}-day baseline — a pattern historically correlated "
                "with schedule slippage on this portfolio.",
                needs_human=False,
                writes_to=["compass.findings", "vendor.risk_review"],
            )
        )

    return findings


def _find_dependency_risks(extracted: ExtractedDocument, project_id: str) -> list[Finding]:
    graph = _DEPENDENCY_GRAPH.get(project_id, {})
    findings: list[Finding] = []

    for scope_item, dep in graph.items():
        mentioned = any(scope_item in s.lower() or scope_item in d.lower() for s in extracted.scope_items for d in extracted.dependencies) or \
            any(scope_item in d.lower() for d in extracted.dependencies)
        if not mentioned:
            continue
        if "delayed" not in dep["current_status"]:
            continue
        findings.append(
            Finding(
                id=f"finding_dependency_{scope_item.replace(' ', '_')}",
                type="dependency_risk",
                claim=f"'{scope_item}' is dependent on '{dep['depends_on']}', which is currently {dep['current_status']}.",
                verdict="likely",
                confidence=0.82,
                impact="high",
                estimated_cost_usd=None,
                recommendation="Adjust the delivery schedule for this line item or negotiate a float buffer before committing.",
                layer="dependencies",
                document_ref=f"Dependency: {scope_item} → {dep['depends_on']}",
                evidence=[
                    EvidenceItem(
                        source="procurement_dependency_graph",
                        reliability_tier="third_party_observed",
                        timestamp=_NOW,
                        raw_ref=f"{dep['depends_on']}: {dep['current_status']} (scheduled {dep['scheduled_completion']})",
                    )
                ],
                reasoning=f"'{scope_item}' cannot proceed on schedule until '{dep['depends_on']}' completes, "
                f"and that dependency is currently {dep['current_status']}.",
                needs_human=True,
                writes_to=["compass.findings", "procurement.dependency_review"],
            )
        )
    return findings


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.post("/api/compass/procurement-xray", response_model=XRayResult)
async def procurement_xray(payload: XRayRequest) -> XRayResult:
    if not payload.document_text.strip():
        raise HTTPException(status_code=400, detail="document_text must not be empty.")

    # Step 1: LLM extraction only
    extracted = await _extract_document(payload.document_text)

    vendor_id = payload.vendor_id
    if vendor_id is None:
        # Deterministic name match against the known vendor roster — not an LLM judgment call.
        vendor_id = next(
            (vid for vid, name in _VENDOR_NAMES.items() if name.lower() == extracted.vendor_name.lower()),
            "vendor_meridian_steel",  # fallback to primary demo vendor
        )
    vendor_name = _VENDOR_NAMES.get(vendor_id, extracted.vendor_name)

    # Step 2: deterministic comparisons across all layers
    findings: list[Finding] = []
    findings += _find_scope_gaps(extracted, payload.project_id)
    findings += _find_price_anomalies(extracted)
    findings += _find_clause_risks(extracted)
    findings += _find_vendor_risks(vendor_id, vendor_name)
    findings += _find_dependency_risks(extracted, payload.project_id)

    impact_rank = {"high": 0, "medium": 1, "low": 2}
    findings.sort(key=lambda f: impact_rank[f.impact])

    future_disputes = sum(1 for f in findings if f.impact == "high" or (f.type == "clause_risk" and f.needs_human))
    overall_confidence = round(sum(f.confidence for f in findings) / len(findings), 2) if findings else 0.5
    needs_human = any(f.needs_human for f in findings)

    return XRayResult(
        document_name=payload.document_name,
        vendor_id=vendor_id,
        vendor_name=vendor_name,
        total_findings=len(findings),
        future_disputes_detected=future_disputes,
        findings=findings,
        layers_scanned=["scope", "price", "clauses", "vendor", "history", "dependencies"],
        overall_confidence=overall_confidence,
        needs_human=needs_human,
    )
