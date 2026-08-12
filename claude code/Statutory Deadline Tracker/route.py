"""
SENTINEL — Statutory Deadline Check
------------------------------------
Pure deterministic date math. Zero LLM calls in this file — deadline
computation is comparison/date-math and must never be delegated to a model.

Endpoints:
    POST /sentinel/statutory-deadline-check   — check one claim against its
                                                 statutory response window
    GET  /sentinel/statutory-deadlines/active — list all tracked active
                                                 claims, sorted by urgency
"""

from datetime import date, datetime
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()


# ---------------------------------------------------------------------------
# Shared evidence base shape
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


class DeadlineEvidenceResult(EvidenceResult):
    deadline: date
    days_remaining: int
    priority_level: Literal["low", "medium", "high", "critical"]
    required_action: str


# ---------------------------------------------------------------------------
# Seeded reference data (MOCK — stand-in for a maintained statutory rules
# table; in production this would live in a versioned reference DB with
# citations reviewed by counsel).
# ---------------------------------------------------------------------------

# (state, claim_type) -> number of calendar days from filing date to respond
RESPONSE_WINDOWS: dict[tuple[str, str], int] = {
    ("TX", "notice_of_intent_to_lien"): 70,   # Tex. Prop. Code § 53.056
    ("TX", "mechanics_lien"): 120,             # Tex. Prop. Code § 53.052
    ("CA", "prompt_payment_demand"): 22,       # Cal. Civ. Code § 8800
    ("CA", "stop_payment_notice"): 20,         # Cal. Civ. Code § 8506
    ("NY", "mechanics_lien"): 80,              # N.Y. Lien Law § 10
    ("FL", "notice_to_owner"): 45,             # Fla. Stat. § 713.06
    ("FL", "notice_of_nonpayment"): 90,        # Fla. Stat. § 713.06(2)
}

STATUTE_REFERENCE: dict[tuple[str, str], str] = {
    ("TX", "notice_of_intent_to_lien"): "Tex. Prop. Code § 53.056",
    ("TX", "mechanics_lien"): "Tex. Prop. Code § 53.052",
    ("CA", "prompt_payment_demand"): "Cal. Civ. Code § 8800",
    ("CA", "stop_payment_notice"): "Cal. Civ. Code § 8506",
    ("NY", "mechanics_lien"): "N.Y. Lien Law § 10",
    ("FL", "notice_to_owner"): "Fla. Stat. § 713.06",
    ("FL", "notice_of_nonpayment"): "Fla. Stat. § 713.06(2)",
}

REQUIRED_ACTION_BY_PRIORITY: dict[str, str] = {
    "critical": "File or escalate immediately — statutory window is at or past expiry",
    "high": "Prepare and send required filing within the next few days",
    "medium": "Begin drafting response; confirm delivery method and recipient",
    "low": "No action required yet — monitor for status changes",
}

# MOCK seeded active claims for the GET /active listing endpoint.
SEEDED_ACTIVE_CLAIMS: list[dict] = [
    {
        "claim_id": "dl-1042",
        "claimant": "Meridian Steel Fabricators",
        "state": "TX",
        "claim_type": "notice_of_intent_to_lien",
        "filing_date": date(2026, 6, 2),
        "source": "county_filing_index",
    },
    {
        "claim_id": "dl-1039",
        "claimant": "Ironclad Concrete Pumping",
        "state": "CA",
        "claim_type": "prompt_payment_demand",
        "filing_date": date(2026, 7, 22),
        "source": "internal_ar_ledger",
    },
    {
        "claim_id": "dl-1051",
        "claimant": "Bayview Electrical Co.",
        "state": "CA",
        "claim_type": "stop_payment_notice",
        "filing_date": date(2026, 7, 30),
        "source": "internal_ar_ledger",
    },
    {
        "claim_id": "dl-1028",
        "claimant": "Harrow & Doyle Site Logistics",
        "state": "NY",
        "claim_type": "mechanics_lien",
        "filing_date": date(2026, 5, 14),
        "source": "county_filing_index",
    },
]


# ---------------------------------------------------------------------------
# Deterministic helpers — plain Python date math only, no LLM involvement
# ---------------------------------------------------------------------------

def _lookup_window(state: str, claim_type: str) -> int:
    key = (state.upper(), claim_type.lower())
    if key not in RESPONSE_WINDOWS:
        raise HTTPException(
            status_code=422,
            detail=(
                f"No statutory response window is seeded for state='{state}' "
                f"claim_type='{claim_type}'. Known combinations: "
                f"{sorted(RESPONSE_WINDOWS.keys())}"
            ),
        )
    return RESPONSE_WINDOWS[key]


def _priority_from_days_remaining(days_remaining: int) -> Literal["low", "medium", "high", "critical"]:
    # Deterministic thresholds — never inferred by a model.
    if days_remaining < 0:
        return "critical"
    if days_remaining < 3:
        return "high"
    if days_remaining < 7:
        return "medium"
    return "low"


def _needs_human(priority_level: str) -> bool:
    return priority_level in ("high", "critical")


def _confidence_for(state: str, claim_type: str) -> float:
    # Confidence reflects how well-established the seeded reference window is.
    # Deterministic lookup, not a model judgment.
    return 0.97 if (state.upper(), claim_type.lower()) in STATUTE_REFERENCE else 0.5


def _build_result(
    claim_id: str,
    claimant: str,
    state: str,
    claim_type: str,
    filing_date: date,
    source: str,
) -> DeadlineEvidenceResult:
    window_days = _lookup_window(state, claim_type)
    deadline_date = filing_date.fromordinal(filing_date.toordinal() + window_days)

    today = date.today()
    days_elapsed = (today - filing_date).days
    days_remaining = (deadline_date - today).days

    priority_level = _priority_from_days_remaining(days_remaining)
    required_action = REQUIRED_ACTION_BY_PRIORITY[priority_level]
    statute_ref = STATUTE_REFERENCE.get((state.upper(), claim_type.lower()), "unspecified")

    reasoning = (
        f"Filing date {filing_date.isoformat()} plus statutory window of {window_days} days "
        f"({statute_ref}) for {state.upper()}/{claim_type} yields deadline "
        f"{deadline_date.isoformat()}. {days_elapsed} days elapsed since filing; "
        f"{days_remaining} days remaining as of {today.isoformat()}, "
        f"classified '{priority_level}' by threshold rule "
        f"(critical: <0, high: <3, medium: <7, low: >=7)."
    )

    evidence = [
        EvidenceItem(
            source=source,
            reliability_tier="verified_transaction" if source == "county_filing_index" else "third_party_observed",
            timestamp=datetime.combine(filing_date, datetime.min.time()),
            raw_ref=f"{claim_id}:{state.upper()}:{claim_type}",
        ),
        EvidenceItem(
            source="statutory_response_windows_table",
            reliability_tier="verified_transaction",
            timestamp=datetime.utcnow(),
            raw_ref=f"RESPONSE_WINDOWS[({state.upper()!r}, {claim_type.lower()!r})]={window_days}",
        ),
    ]

    return DeadlineEvidenceResult(
        confidence=_confidence_for(state, claim_type),
        evidence=evidence,
        reasoning=reasoning,
        needs_human=_needs_human(priority_level),
        writes_to=["deadline_tracker.active_claims", "compliance_log"],
        deadline=deadline_date,
        days_remaining=days_remaining,
        priority_level=priority_level,
        required_action=required_action,
    )


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class StatutoryDeadlineCheckRequest(BaseModel):
    claim_id: str = Field(..., description="Internal identifier for this claim")
    claimant: str
    state: str = Field(..., description="Two-letter state code, e.g. 'TX'")
    claim_type: str = Field(
        ..., description="Claim type key, e.g. 'notice_of_intent_to_lien', 'mechanics_lien'"
    )
    filing_date: date
    source: str = Field(
        default="user_submitted",
        description="Provenance of the filing_date fact, used for evidence reliability tiering",
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/sentinel/statutory-deadline-check", response_model=DeadlineEvidenceResult)
def statutory_deadline_check(payload: StatutoryDeadlineCheckRequest) -> DeadlineEvidenceResult:
    """
    Check a single claim's statutory response deadline.

    Think like a compliance officer: identify the applicable window for this
    jurisdiction/claim type, compute the deadline from the filing date, and
    flag near or missed deadlines. All date math is deterministic; nothing
    here is inferred by a model.
    """
    return _build_result(
        claim_id=payload.claim_id,
        claimant=payload.claimant,
        state=payload.state,
        claim_type=payload.claim_type,
        filing_date=payload.filing_date,
        source=payload.source,
    )


@router.get("/sentinel/statutory-deadlines/active", response_model=list[DeadlineEvidenceResult])
def list_active_statutory_deadlines() -> list[DeadlineEvidenceResult]:
    """
    List all tracked active claims, sorted most-urgent first
    (by days_remaining ascending — overdue and near-term deadlines surface first).
    """
    results = [
        _build_result(
            claim_id=c["claim_id"],
            claimant=c["claimant"],
            state=c["state"],
            claim_type=c["claim_type"],
            filing_date=c["filing_date"],
            source=c["source"],
        )
        for c in SEEDED_ACTIVE_CLAIMS
    ]
    results.sort(key=lambda r: r.days_remaining)
    return results
