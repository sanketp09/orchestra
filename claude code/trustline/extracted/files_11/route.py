"""
TRUSTLINE — Financial Distress Watch
-------------------------------------
Pure deterministic — no LLM calls in this file. Reads/writes the shared
TrustBelief model and reuses the same EvidenceItem shape as Sentinel so
evidence is comparable across the two systems.

Endpoint:
    GET /trustline/vendor/{vendor_id}/financial-distress
"""

from datetime import date, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


# ---------------------------------------------------------------------------
# Shared evidence / belief shapes (same EvidenceItem shape as Sentinel's)
# ---------------------------------------------------------------------------

class EvidenceItem(BaseModel):
    source: str
    reliability_tier: Literal["self_reported", "third_party_observed", "verified_transaction"]
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


class FinancialDistressResult(TrustBelief):
    risk_level: Literal["low", "medium", "high", "critical"]
    active_filings_count: int
    total_exposure: float
    filings: list[dict]


# ---------------------------------------------------------------------------
# Centralized demo data — MOCK, identical IDs/numbers to every other
# Trustline file so cross-endpoint results agree.
# ---------------------------------------------------------------------------

VENDORS: dict[str, dict] = {
    "vendor_meridian_steel": {
        "name": "Meridian Steel Fabrication",
        "trade": "Structural Steel",
        "location": "Houston, TX",
        "trust_today": 76,
    },
    "vendor_titan_fab": {
        "name": "Titan Fabricators",
        "trade": "Structural Steel",
        "location": "Houston, TX",
        "trust_today": 88,
    },
    "vendor_coastal_bolt": {
        "name": "Coastal Bolt & Fastener",
        "trade": "Fasteners & Hardware",
        "location": "Corpus Christi, TX",
        "trust_today": 54,
    },
}

# Seeded filings — MOCK data standing in for a UCC/lien registry feed.
# Meridian Steel gets exactly one UCC filing (matches the central dataset:
# "a UCC filing appearing against them (Jun 20)"). Coastal Bolt gets three,
# two of which fall inside the last 6 months, to make it the clearly
# distressed demo vendor.
FILINGS: list[dict] = [
    {
        "filing_id": "filing_meridian_ucc_1",
        "vendor_id": "vendor_meridian_steel",
        "type": "ucc_filing",
        "date": date(2026, 6, 20),
        "amount": 150_000.0,
        "description": "UCC-1 financing statement filed against equipment",
    },
    {
        "filing_id": "filing_coastal_ucc_1",
        "vendor_id": "vendor_coastal_bolt",
        "type": "ucc_filing",
        "date": date(2026, 1, 10),
        "amount": 210_000.0,
        "description": "UCC-1 financing statement — inventory & receivables",
    },
    {
        "filing_id": "filing_coastal_lien_1",
        "vendor_id": "vendor_coastal_bolt",
        "type": "mechanics_lien",
        "date": date(2026, 6, 15),
        "amount": 95_000.0,
        "description": "Mechanic's lien filed by subcontractor for unpaid work",
    },
    {
        "filing_id": "filing_coastal_ucc_2",
        "vendor_id": "vendor_coastal_bolt",
        "type": "ucc_filing",
        "date": date(2026, 7, 20),
        "amount": 130_000.0,
        "description": "UCC-1 financing statement — accounts receivable",
    },
]

RECENCY_WINDOW_DAYS = 182  # ~6 months — the recency threshold for risk scoring


# ---------------------------------------------------------------------------
# Deterministic helpers — plain Python comparisons/statistics, no LLM
# ---------------------------------------------------------------------------

def _vendor_filings(vendor_id: str) -> list[dict]:
    return sorted(
        (f for f in FILINGS if f["vendor_id"] == vendor_id),
        key=lambda f: f["date"],
    )


def _risk_level_from_filings(filings: list[dict], today: date) -> Literal["low", "medium", "high", "critical"]:
    # Deterministic threshold rule: risk is driven by how many filings are
    # recent (within RECENCY_WINDOW_DAYS), not just the raw count.
    cutoff = today - timedelta(days=RECENCY_WINDOW_DAYS)
    recent_count = sum(1 for f in filings if f["date"] >= cutoff)

    if recent_count >= 3:
        return "critical"
    if recent_count >= 2:
        return "high"
    if recent_count >= 1 or len(filings) >= 2:
        return "medium"
    return "low"


def _needs_human(risk_level: str) -> bool:
    return risk_level in ("high", "critical")


def _current_value_for(risk_level: str) -> float:
    # financial_stability dimension: inverse of risk, 0-1 scale, deterministic mapping
    return {"low": 0.9, "medium": 0.65, "high": 0.35, "critical": 0.15}[risk_level]


def _previous_value_for(vendor_id: str) -> float:
    # MOCK — prior-period value from the centralized trust trajectory,
    # normalized to 0-1 (trust score / 100).
    prior_trust = {
        "vendor_meridian_steel": 0.82,  # 2025 value
        "vendor_titan_fab": 0.87,
        "vendor_coastal_bolt": 0.60,  # 2025 value
    }
    return prior_trust.get(vendor_id, 0.5)


def _confidence_for(filings: list[dict]) -> float:
    # More corroborating filings -> higher confidence in the risk read.
    # Deterministic, not a model judgment.
    if not filings:
        return 0.4
    return min(0.98, 0.7 + 0.08 * len(filings))


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get(
    "/trustline/vendor/{vendor_id}/financial-distress",
    response_model=FinancialDistressResult,
)
def get_financial_distress(vendor_id: str) -> FinancialDistressResult:
    """
    Compute a vendor's financial distress read from seeded filing records.

    risk_level is derived from filing count + recency (2+ filings in the
    last ~6 months pushes a vendor to High; 3+ to Critical). All comparisons
    and the exposure total are plain deterministic Python — no LLM involved.
    """
    if vendor_id not in VENDORS:
        raise HTTPException(status_code=404, detail=f"Unknown vendor_id '{vendor_id}'")

    vendor = VENDORS[vendor_id]
    filings = _vendor_filings(vendor_id)
    today = date(2026, 8, 11)

    risk_level = _risk_level_from_filings(filings, today)
    total_exposure = sum(f["amount"] for f in filings)
    active_filings_count = len(filings)

    cutoff = today - timedelta(days=RECENCY_WINDOW_DAYS)
    recent_count = sum(1 for f in filings if f["date"] >= cutoff)

    reasoning = (
        f"{vendor['name']} has {active_filings_count} filing(s) on record, "
        f"{recent_count} of which fall within the last {RECENCY_WINDOW_DAYS} days "
        f"(cutoff {cutoff.isoformat()}). Total exposure across filings is "
        f"${total_exposure:,.0f}. Classified '{risk_level}' by threshold rule "
        f"(critical: 3+ recent filings, high: 2+ recent, medium: 1+ recent or "
        f"2+ total, low: otherwise)."
    )

    evidence = [
        EvidenceItem(
            source="ucc_lien_registry_feed",
            reliability_tier="verified_transaction",
            timestamp=datetime.combine(f["date"], datetime.min.time()),
            raw_ref=f"{f['filing_id']}:{f['type']}:${f['amount']:,.0f}",
        )
        for f in filings
    ]

    return FinancialDistressResult(
        entity_id=vendor_id,
        dimension="financial_stability",
        current_value=_current_value_for(risk_level),
        previous_value=_previous_value_for(vendor_id),
        confidence=_confidence_for(filings),
        evidence=evidence,
        reasoning=reasoning,
        needs_human=_needs_human(risk_level),
        risk_level=risk_level,
        active_filings_count=active_filings_count,
        total_exposure=total_exposure,
        filings=[
            {
                "filing_id": f["filing_id"],
                "type": f["type"],
                "date": f["date"].isoformat(),
                "amount": f["amount"],
                "description": f["description"],
            }
            for f in filings
        ],
    )
