"""
COMPASS — Pre-Mortem Generator
POST /api/compass/pre-mortem

"If this procurement decision fails, how could it fail?"

Architecture, deliberately split in two:

  1. PROBABILITIES are never invented. Each failure category's likelihood is
     computed straight from seeded historical demo data (occurrences /
     sample_size) — see `HISTORICAL_PRECEDENT`. This is the same arithmetic
     for every request; nothing here is an LLM guess.

  2. NARRATIVE (trigger -> failure -> impact -> early warning -> mitigation)
     is what an LLM is used for — turning the structured evidence for a
     category into a concrete, decision-specific scenario description.
     `_generate_scenario_narrative` calls the Anthropic API when
     `ANTHROPIC_API_KEY` is configured; if it isn't (e.g. this sandbox) or
     the call fails, it falls back to a pre-written narrative grounded in
     the same evidence, so the endpoint is always deterministic and
     testable without a live LLM call.

Severity/priority ranking is likewise deterministic (probability x impact
severity), not LLM-scored — see `_rank_scenarios`.
"""

from __future__ import annotations

import json
import os
from enum import Enum

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/compass", tags=["compass"])


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class FailureCategory(str, Enum):
    SUPPLIER = "supplier"
    TECHNICAL = "technical"
    SCHEDULE = "schedule"
    FINANCIAL = "financial"
    LOGISTICS = "logistics"
    COMPLIANCE = "compliance"


class EvidenceType(str, Enum):
    HISTORICAL_RECORD = "historical_record"
    VENDOR_RECORD = "vendor_record"
    FINANCIAL_SIGNAL = "financial_signal"
    PRODUCTION_REPORT = "production_report"
    LOGISTICS_RECORD = "logistics_record"
    COMPLIANCE_RECORD = "compliance_record"


class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


SEVERITY_WEIGHT: dict[Severity, int] = {Severity.LOW: 1, Severity.MEDIUM: 2, Severity.HIGH: 3}


class EvidenceRef(BaseModel):
    type: EvidenceType
    label: str


# ---------------------------------------------------------------------------
# Structured input the generator draws on: current decision, historical
# precedent, vendor evidence, and the project dependencies this decision
# touches. All seeded demo data — no invented numbers at generation time.
# ---------------------------------------------------------------------------

class Decision(BaseModel):
    id: str
    label: str
    vendor_name: str
    package: str
    package_value_usd: float


DECISIONS: dict[str, Decision] = {
    "switchgear_vendor_a": Decision(
        id="switchgear_vendor_a",
        label="Award switchgear package to Vendor A",
        vendor_name="Vantage Switchgear Corp",
        package="Bid Package 07 — Main Switchgear",
        package_value_usd=410_000,
    ),
}

# Historical precedent: (occurrences, sample_size) per failure category,
# drawn from a pool of comparable past orders. Different categories are
# assessed against different sub-populations of that pool (e.g. not every
# order underwent a formal financial review), which is realistic and also
# why the sample sizes differ below.
HISTORICAL_PRECEDENT: dict[FailureCategory, tuple[int, int]] = {
    FailureCategory.SCHEDULE: (9, 42),      # delivery delay
    FailureCategory.SUPPLIER: (5, 42),      # factory capacity crunch
    FailureCategory.TECHNICAL: (3, 38),     # specification mismatch on submittal review
    FailureCategory.FINANCIAL: (2, 33),     # financial distress during contract term
    FailureCategory.LOGISTICS: (4, 40),     # freight/customs delay on import components
    FailureCategory.COMPLIANCE: (3, 44),    # certification/listing coverage gap
}

# Vendor-specific evidence, cited alongside the historical base rate so a
# clicked node shows both "how often this happens generally" and "what we
# actually know about this vendor."
VENDOR_EVIDENCE: dict[FailureCategory, list[EvidenceRef]] = {
    FailureCategory.SCHEDULE: [
        EvidenceRef(type=EvidenceType.HISTORICAL_RECORD, label="9 of last 42 comparable orders shipped late (21%)"),
        EvidenceRef(type=EvidenceType.VENDOR_RECORD, label="Vantage's last delivery to this GC ran 6 days late"),
    ],
    FailureCategory.SUPPLIER: [
        EvidenceRef(type=EvidenceType.HISTORICAL_RECORD, label="5 of 42 comparable orders hit factory capacity delays (12%)"),
        EvidenceRef(type=EvidenceType.PRODUCTION_REPORT, label="Factory utilization report, Q3 2025: 94% average"),
    ],
    FailureCategory.TECHNICAL: [
        EvidenceRef(type=EvidenceType.HISTORICAL_RECORD, label="3 of 38 submittal reviews required rework for rating mismatches (8%)"),
        EvidenceRef(type=EvidenceType.VENDOR_RECORD, label="Standard product line's arc-flash rating differs from spec 26 24 13"),
    ],
    FailureCategory.FINANCIAL: [
        EvidenceRef(type=EvidenceType.HISTORICAL_RECORD, label="2 of 33 vendors with financial review showed distress signs (6%)"),
        EvidenceRef(type=EvidenceType.FINANCIAL_SIGNAL, label="D&B rating: Fair, trending down over the last two quarters"),
    ],
    FailureCategory.LOGISTICS: [
        EvidenceRef(type=EvidenceType.HISTORICAL_RECORD, label="4 of 40 tracked import shipments held at customs (10%)"),
        EvidenceRef(type=EvidenceType.LOGISTICS_RECORD, label="Key breaker components are imported; no pre-cleared customs docs on file"),
    ],
    FailureCategory.COMPLIANCE: [
        EvidenceRef(type=EvidenceType.HISTORICAL_RECORD, label="3 of 44 vendor cert packages flagged incomplete listing coverage (7%)"),
        EvidenceRef(type=EvidenceType.COMPLIANCE_RECORD, label="UL listing on file doesn't confirm this exact configuration"),
    ],
}

PROJECT_DEPENDENCIES: list[str] = [
    "Electrical Rough-In Milestone",
    "Switchgear Room Buildout",
    "Utility Interconnection Application",
]

# Impact + severity, seeded per category (not LLM-generated — these come
# from the same kind of structured estimating data a scheduler/estimator
# would maintain).
IMPACT_SEED: dict[FailureCategory, dict] = {
    FailureCategory.SCHEDULE: {"schedule_days": 14, "cost_usd": None, "severity": Severity.HIGH},
    FailureCategory.SUPPLIER: {"schedule_days": 10, "cost_usd": None, "severity": Severity.MEDIUM},
    FailureCategory.TECHNICAL: {"schedule_days": 5, "cost_usd": 8_000, "severity": Severity.MEDIUM},
    FailureCategory.FINANCIAL: {"schedule_days": 30, "cost_usd": 65_000, "severity": Severity.HIGH},
    FailureCategory.LOGISTICS: {"schedule_days": 9, "cost_usd": 4_000, "severity": Severity.LOW},
    FailureCategory.COMPLIANCE: {"schedule_days": 12, "cost_usd": 6_000, "severity": Severity.MEDIUM},
}

# Fallback narratives — used whenever the LLM call is unavailable/fails.
# Grounded in the same evidence above so the fallback never contradicts it.
NARRATIVE_FALLBACK: dict[FailureCategory, dict[str, str]] = {
    FailureCategory.SUPPLIER: {
        "title": "Factory Capacity Crunch",
        "trigger": "Vendor takes on additional large orders this quarter, straining production capacity.",
        "failure": "Vantage's fabrication line falls behind on this order to prioritize other backlog.",
        "impact": "Up to 10 days of schedule slip on Bid Package 07 delivery.",
        "early_warning": "Factory utilization reports show sustained >90% capacity over two consecutive months.",
        "mitigation": "Lock a firm production slot in the PO with liquidated damages; request monthly capacity attestations.",
    },
    FailureCategory.TECHNICAL: {
        "title": "Specification Mismatch",
        "trigger": "Vendor's standard product line doesn't fully match the arc-flash rating in spec section 26 24 13.",
        "failure": "Submittal is rejected or requires field modification after fabrication has already started.",
        "impact": "5 days rework plus $8,000 in submittal re-engineering costs.",
        "early_warning": "Submittal review flags a deviation request or substitution note on first pass.",
        "mitigation": "Require a pre-submittal technical clarification call before PO issuance; lock spec compliance as a contract exhibit.",
    },
    FailureCategory.SCHEDULE: {
        "title": "Delivery Delay",
        "trigger": "Raw material lead times compound with the vendor's existing backlog.",
        "failure": "Switchgear ships later than the contracted delivery date.",
        "impact": "Up to 14 days of schedule impact to electrical rough-in.",
        "early_warning": "Vendor's confirmed ship date slips during a monthly production check-in call.",
        "mitigation": "Build 10 days of float into the master schedule around this delivery; set a hard escalation trigger at first slip.",
    },
    FailureCategory.FINANCIAL: {
        "title": "Financial Distress",
        "trigger": "Vendor's working capital position tightens due to unrelated project losses.",
        "failure": "Vendor can't fund materials procurement or fabrication labor, stalling the order.",
        "impact": "$65,000 exposure and up to 30 days to re-source and re-award if full replacement is needed.",
        "early_warning": "A UCC filing appears against the vendor, or payment terms shift from net-30 to deposit-required.",
        "mitigation": "Require a payment/performance bond; monitor for UCC filings and D&B rating changes monthly.",
    },
    FailureCategory.LOGISTICS: {
        "title": "Freight & Customs Delay",
        "trigger": "Key components are imported and subject to customs inspection or port congestion.",
        "failure": "Shipment clears customs later than planned, or the carrier reroutes due to capacity constraints.",
        "impact": "9 days of schedule slip; $4,000 in expedite/demurrage fees.",
        "early_warning": "Bill of lading shows an unplanned transshipment port, or the forwarder flags a customs hold.",
        "mitigation": "Pre-clear customs documentation early; add a freight buffer to the delivery milestone.",
    },
    FailureCategory.COMPLIANCE: {
        "title": "Certification Gap",
        "trigger": "Switchgear line's UL/ETL listing doesn't cover the specific configuration ordered for this project.",
        "failure": "Equipment arrives without valid third-party certification for the jurisdiction, blocking inspection sign-off.",
        "impact": "12 days for re-certification/testing; $6,000 in testing costs.",
        "early_warning": "Certification documentation submitted with shop drawings doesn't list the exact model/configuration.",
        "mitigation": "Confirm listing coverage for the exact configuration before PO issuance; request the certificate of compliance upfront.",
    },
}


# ---------------------------------------------------------------------------
# Response schema
# ---------------------------------------------------------------------------

class FailureScenario(BaseModel):
    id: str
    category: FailureCategory
    title: str
    probability_pct: float
    severity: Severity
    risk_score: float
    is_high_priority: bool
    schedule_days_impact: float | None
    cost_usd_impact: float | None
    trigger: str
    failure: str
    impact: str
    early_warning: str
    mitigation: str
    evidence: list[EvidenceRef]
    narrative_source: str  # "llm" | "template_fallback"


class PreMortemSummary(BaseModel):
    scenarios_generated: int
    high_priority_count: int
    highest_probability_category: FailureCategory
    total_schedule_exposure_days: float
    total_cost_exposure_usd: float


class PreMortemRequest(BaseModel):
    decision_id: str = "switchgear_vendor_a"


class PreMortemResponse(BaseModel):
    decision: Decision
    linked_dependencies: list[str]
    scenarios: list[FailureScenario]
    summary: PreMortemSummary
    confidence: float
    reasoning: str


# ---------------------------------------------------------------------------
# Probability — deterministic, from historical demo data only
# ---------------------------------------------------------------------------

def _historical_probability(category: FailureCategory) -> float:
    occurrences, sample_size = HISTORICAL_PRECEDENT[category]
    return round(100 * occurrences / sample_size)


# ---------------------------------------------------------------------------
# Narrative generation — LLM when available, deterministic fallback otherwise
# ---------------------------------------------------------------------------

def _generate_scenario_narrative(
    category: FailureCategory,
    decision: Decision,
    evidence: list[EvidenceRef],
    probability_pct: float,
) -> tuple[dict[str, str], str]:
    """Returns (narrative_dict, source) where source is 'llm' or 'template_fallback'.

    Calls the Anthropic API to turn structured evidence into a concrete,
    decision-specific scenario. Requires ANTHROPIC_API_KEY to be set; if it
    isn't, or the call fails for any reason, falls back to a pre-written
    narrative grounded in the same evidence so the endpoint stays
    deterministic without a live LLM dependency.
    """
    fallback = NARRATIVE_FALLBACK[category]

    if not os.environ.get("ANTHROPIC_API_KEY"):
        return fallback, "template_fallback"

    try:
        import anthropic  # type: ignore[import-not-found]

        client = anthropic.Anthropic()
        evidence_lines = "\n".join(f"- {ref.label}" for ref in evidence)
        prompt = f"""You are helping a construction procurement team run a pre-mortem on a decision.

Decision: {decision.label} ({decision.package}, vendor: {decision.vendor_name})
Failure category: {category.value}
Historical probability of this failure mode: {probability_pct}%
Structured evidence:
{evidence_lines}

Write a concrete, specific failure scenario grounded ONLY in the evidence above
(do not invent new facts). Respond with ONLY a JSON object, no other text, with
exactly these keys: title, trigger, failure, impact, early_warning, mitigation.
Each value should be one concise sentence."""

        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(block.text for block in message.content if block.type == "text")
        parsed = json.loads(text.strip().removeprefix("```json").removeprefix("```").removesuffix("```"))
        required_keys = {"title", "trigger", "failure", "impact", "early_warning", "mitigation"}
        if not required_keys.issubset(parsed.keys()):
            raise ValueError("LLM response missing required keys")
        return parsed, "llm"
    except Exception:
        return fallback, "template_fallback"


# ---------------------------------------------------------------------------
# Priority ranking — deterministic (probability x severity weight)
# ---------------------------------------------------------------------------

def _rank_scenarios(scenarios: list[FailureScenario], top_n: int = 3) -> None:
    """Mutates `is_high_priority` in place based on risk_score rank."""
    ranked = sorted(scenarios, key=lambda s: s.risk_score, reverse=True)
    high_priority_ids = {s.id for s in ranked[:top_n]}
    for scenario in scenarios:
        scenario.is_high_priority = scenario.id in high_priority_ids


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/pre-mortem", response_model=PreMortemResponse)
def run_pre_mortem(request: PreMortemRequest) -> PreMortemResponse:
    decision = DECISIONS.get(request.decision_id)
    if decision is None:
        raise HTTPException(status_code=404, detail=f"Unknown decision_id '{request.decision_id}'")

    scenarios: list[FailureScenario] = []
    for category in FailureCategory:
        probability_pct = _historical_probability(category)
        evidence = VENDOR_EVIDENCE[category]
        impact = IMPACT_SEED[category]
        severity: Severity = impact["severity"]
        risk_score = probability_pct * SEVERITY_WEIGHT[severity]

        narrative, source = _generate_scenario_narrative(category, decision, evidence, probability_pct)

        scenarios.append(
            FailureScenario(
                id=f"failure_{category.value}",
                category=category,
                title=narrative["title"],
                probability_pct=probability_pct,
                severity=severity,
                risk_score=risk_score,
                is_high_priority=False,  # set by _rank_scenarios below
                schedule_days_impact=impact["schedule_days"],
                cost_usd_impact=impact["cost_usd"],
                trigger=narrative["trigger"],
                failure=narrative["failure"],
                impact=narrative["impact"],
                early_warning=narrative["early_warning"],
                mitigation=narrative["mitigation"],
                evidence=evidence,
                narrative_source=source,
            )
        )

    _rank_scenarios(scenarios, top_n=3)

    high_priority = [s for s in scenarios if s.is_high_priority]
    highest_probability = max(scenarios, key=lambda s: s.probability_pct)

    summary = PreMortemSummary(
        scenarios_generated=len(scenarios),
        high_priority_count=len(high_priority),
        highest_probability_category=highest_probability.category,
        total_schedule_exposure_days=sum(s.schedule_days_impact or 0 for s in scenarios),
        total_cost_exposure_usd=sum(s.cost_usd_impact or 0 for s in scenarios),
    )

    reasoning = (
        f"Generated {len(scenarios)} failure scenarios for '{decision.label}' from historical "
        f"precedent across {len(FailureCategory)} categories. {len(high_priority)} scored as "
        f"high priority: {', '.join(s.title for s in high_priority)}. Highest single "
        f"probability: {highest_probability.title} at {highest_probability.probability_pct:.0f}%."
    )

    return PreMortemResponse(
        decision=decision,
        linked_dependencies=PROJECT_DEPENDENCIES,
        scenarios=scenarios,
        summary=summary,
        confidence=0.83,
        reasoning=reasoning,
    )
