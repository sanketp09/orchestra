"""
POST /api/compass/company-pattern-break

"Does this decision break a pattern in how our company normally makes this
trade-off?"

Pipeline:
- Step 1 (LLM, genuinely needed): a free-text description of the current
  decision (e.g. an approval memo, a Slack summary, a procurement
  recommendation) is parsed into structured trade-off weights across four
  factors (cost, schedule, quality, risk), a dominant "prioritized" factor,
  whether the underlying project is mission-critical, and a trade-off type
  category. This is semantic extraction only — the LLM never decides whether
  the decision is a pattern break.
- Step 2 (deterministic): the current decision is compared against a
  historical decision record set, filtered to the same "situation shape"
  (same trade_off_type + same mission_critical flag) — this is the
  comparison cohort. Plain Python then computes:
    - the historical pattern (which factor comparable decisions most often
      prioritized, and what share of the cohort that represents)
    - a deviation score (Euclidean distance between the current decision's
      weight vector and the cohort centroid, normalized to 0-1)
    - the supporting decisions that make up the historical pattern
  No LLM arithmetic or clustering logic is used anywhere in this step.
"""

from __future__ import annotations

import math
from datetime import date, datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


# ---------------------------------------------------------------------------
# Shared evidence contract (same shape used across Sentinel / Trustline / Compass)
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
# Domain models
# ---------------------------------------------------------------------------

Factor = Literal["cost", "schedule", "quality", "risk"]
DeviationLabel = Literal["low", "medium", "high"]


class DecisionWeights(BaseModel):
    cost: float
    schedule: float
    quality: float
    risk: float

    def as_vector(self) -> tuple[float, float, float, float]:
        return (self.cost, self.schedule, self.quality, self.risk)


class HistoricalDecision(BaseModel):
    id: str
    project: str
    decided_on: date
    mission_critical: bool
    trade_off_type: str
    weights: DecisionWeights
    prioritized: Factor
    narrative: str


class CurrentDecisionRequest(BaseModel):
    decision_text: str
    project_name: Optional[str] = None


class ExtractedDecision(BaseModel):
    """Structured output of the LLM extraction step."""
    project_name: str
    mission_critical: bool
    trade_off_type: str
    weights: DecisionWeights
    prioritized: Factor
    summary: str


class HistoricalPattern(BaseModel):
    dominant_factor: Factor
    dominant_factor_share: float  # 0-1
    comparable_decision_count: int
    centroid: DecisionWeights


class PatternBreakResult(EvidenceResult):
    historical_pattern: HistoricalPattern
    current_decision: ExtractedDecision
    deviation_score: float  # 0-1
    deviation_label: DeviationLabel
    supporting_decisions: list[HistoricalDecision]
    pattern_broken: bool


# ---------------------------------------------------------------------------
# Centralized ORCHESTRA demo data — historical decision record set
# ---------------------------------------------------------------------------

# MOCK/SEEDED: 9 comparable mission-critical cost/quality trade-off decisions
# (the cohort the brief's "78% prioritized schedule certainty" / "7 of 9"
# example is drawn from), plus a handful of decisions from other situation
# shapes to prove the filtering actually discriminates.
_HISTORICAL_DECISIONS: list[HistoricalDecision] = [
    HistoricalDecision(
        id="dec_001", project="Riverside Tower — Curtain Wall", decided_on=date(2024, 2, 10),
        mission_critical=True, trade_off_type="cost_vs_quality",
        weights=DecisionWeights(cost=0.15, schedule=0.55, quality=0.25, risk=0.05),
        prioritized="schedule", narrative="Retained certified glazing vendor despite an 8% premium to protect the tower delivery date.",
    ),
    HistoricalDecision(
        id="dec_002", project="Harbor Point — MEP Package", decided_on=date(2024, 5, 22),
        mission_critical=True, trade_off_type="cost_vs_quality",
        weights=DecisionWeights(cost=0.10, schedule=0.60, quality=0.25, risk=0.05),
        prioritized="schedule", narrative="Declined a 6% cheaper subcontractor with a longer lead time to hold the commissioning schedule.",
    ),
    HistoricalDecision(
        id="dec_003", project="Delta Logistics Hub — Structural Steel", decided_on=date(2024, 7, 3),
        mission_critical=True, trade_off_type="cost_vs_quality",
        weights=DecisionWeights(cost=0.10, schedule=0.20, quality=0.65, risk=0.05),
        prioritized="quality", narrative="Selected a higher-cost fabricator with a stronger QA record for primary load-bearing members.",
    ),
    HistoricalDecision(
        id="dec_004", project="Northgate Data Center — Cooling Systems", decided_on=date(2024, 9, 14),
        mission_critical=True, trade_off_type="cost_vs_quality",
        weights=DecisionWeights(cost=0.12, schedule=0.58, quality=0.24, risk=0.06),
        prioritized="schedule", narrative="Paid a premium to secure a vendor slot ahead of a competing project to avoid a commissioning slip.",
    ),
    HistoricalDecision(
        id="dec_005", project="Summit Ridge — Elevator Package", decided_on=date(2024, 11, 2),
        mission_critical=True, trade_off_type="cost_vs_quality",
        weights=DecisionWeights(cost=0.14, schedule=0.56, quality=0.25, risk=0.05),
        prioritized="schedule", narrative="Chose the incumbent vendor over a cheaper new entrant to avoid re-qualification delays.",
    ),
    HistoricalDecision(
        id="dec_006", project="Coastal Bridge Retrofit — Bearings", decided_on=date(2025, 1, 18),
        mission_critical=True, trade_off_type="cost_vs_quality",
        weights=DecisionWeights(cost=0.13, schedule=0.57, quality=0.24, risk=0.06),
        prioritized="schedule", narrative="Held the original vendor to protect the lane-closure schedule despite a cheaper alternative bid.",
    ),
    HistoricalDecision(
        id="dec_007", project="Ashford Campus — Fire Suppression", decided_on=date(2025, 3, 27),
        mission_critical=True, trade_off_type="cost_vs_quality",
        weights=DecisionWeights(cost=0.11, schedule=0.59, quality=0.24, risk=0.06),
        prioritized="schedule", narrative="Accepted a 5% premium to lock a fabrication slot before a seasonal capacity crunch.",
    ),
    HistoricalDecision(
        id="dec_008", project="Meridian Yards — Precast Facade", decided_on=date(2025, 6, 9),
        mission_critical=True, trade_off_type="cost_vs_quality",
        weights=DecisionWeights(cost=0.09, schedule=0.19, quality=0.66, risk=0.06),
        prioritized="quality", narrative="Rejected the lowest bid over documented QC failures on a comparable prior project.",
    ),
    HistoricalDecision(
        id="dec_009", project="Union Terminal — Roofing System", decided_on=date(2025, 8, 1),
        mission_critical=True, trade_off_type="cost_vs_quality",
        weights=DecisionWeights(cost=0.13, schedule=0.55, quality=0.26, risk=0.06),
        prioritized="schedule", narrative="Kept the qualified vendor to avoid a re-bid cycle ahead of the winter weather window.",
    ),
    # Different situation shapes — included to prove filtering discriminates.
    HistoricalDecision(
        id="dec_010", project="Lakeside Retail — Interior Finishes", decided_on=date(2025, 2, 4),
        mission_critical=False, trade_off_type="cost_vs_quality",
        weights=DecisionWeights(cost=0.55, schedule=0.15, quality=0.20, risk=0.10),
        prioritized="cost", narrative="Took the lowest bid on a non-critical finish package to protect budget.",
    ),
    HistoricalDecision(
        id="dec_011", project="Pinegrove Warehouse — Site Logistics", decided_on=date(2025, 4, 11),
        mission_critical=True, trade_off_type="schedule_vs_risk",
        weights=DecisionWeights(cost=0.10, schedule=0.35, quality=0.10, risk=0.45),
        prioritized="risk", narrative="Added a redundant crane path to de-risk a single-point-of-failure lift sequence.",
    ),
]


# ---------------------------------------------------------------------------
# Step 1: LLM extraction (genuinely needed — free text -> structured fields)
# ---------------------------------------------------------------------------

async def _extract_decision(decision_text: str, project_hint: Optional[str]) -> ExtractedDecision:
    client = get_claude_client()  # assumed to exist elsewhere in the app

    tool = {
        "name": "record_extracted_decision",
        "description": (
            "Record the structured trade-off weights, dominant priority, mission-criticality, and "
            "trade-off category found in a description of a procurement or project decision."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "project_name": {"type": "string"},
                "mission_critical": {
                    "type": "boolean",
                    "description": "Whether the underlying project is described as mission-critical / high-stakes.",
                },
                "trade_off_type": {
                    "type": "string",
                    "description": "Short category label for the trade-off, e.g. 'cost_vs_quality', 'schedule_vs_risk'.",
                },
                "weights": {
                    "type": "object",
                    "description": "Relative emphasis (0-1 each, roughly summing to 1) placed on each factor by this decision.",
                    "properties": {
                        "cost": {"type": "number"},
                        "schedule": {"type": "number"},
                        "quality": {"type": "number"},
                        "risk": {"type": "number"},
                    },
                    "required": ["cost", "schedule", "quality", "risk"],
                },
                "prioritized": {
                    "type": "string",
                    "enum": ["cost", "schedule", "quality", "risk"],
                    "description": "The single factor this decision most clearly prioritized.",
                },
                "summary": {"type": "string", "description": "One-sentence neutral summary of the decision."},
            },
            "required": ["project_name", "mission_critical", "trade_off_type", "weights", "prioritized", "summary"],
        },
    }

    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=600,
        tools=[tool],
        tool_choice={"type": "tool", "name": "record_extracted_decision"},
        messages=[
            {
                "role": "user",
                "content": (
                    "Extract the structured trade-off shape of this decision. "
                    + (f"Project name hint: {project_hint}. " if project_hint else "")
                    + f"\n\nDecision description:\n{decision_text}"
                ),
            }
        ],
    )

    tool_use_block = next(b for b in response.content if b.type == "tool_use")
    parsed = tool_use_block.input
    return ExtractedDecision(**parsed)


# ---------------------------------------------------------------------------
# Step 2: deterministic comparison — cohort filter, pattern, deviation
# ---------------------------------------------------------------------------

def _comparable_cohort(current: ExtractedDecision) -> list[HistoricalDecision]:
    """Filter by 'situation shape': same trade-off type, same mission-criticality."""
    return [
        d
        for d in _HISTORICAL_DECISIONS
        if d.trade_off_type == current.trade_off_type and d.mission_critical == current.mission_critical
    ]


def _compute_centroid(cohort: list[HistoricalDecision]) -> DecisionWeights:
    n = len(cohort)
    return DecisionWeights(
        cost=sum(d.weights.cost for d in cohort) / n,
        schedule=sum(d.weights.schedule for d in cohort) / n,
        quality=sum(d.weights.quality for d in cohort) / n,
        risk=sum(d.weights.risk for d in cohort) / n,
    )


def _dominant_factor(cohort: list[HistoricalDecision]) -> tuple[Factor, float]:
    counts: dict[str, int] = {"cost": 0, "schedule": 0, "quality": 0, "risk": 0}
    for d in cohort:
        counts[d.prioritized] += 1
    dominant = max(counts, key=lambda k: counts[k])
    share = counts[dominant] / len(cohort)
    return dominant, share  # type: ignore[return-value]


def _euclidean_distance(a: DecisionWeights, b: DecisionWeights) -> float:
    va, vb = a.as_vector(), b.as_vector()
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(va, vb)))


# Max possible distance between two weight vectors bounded in [0,1]^4.
_MAX_DISTANCE = math.sqrt(4.0)

DEVIATION_HIGH_THRESHOLD = 0.35
DEVIATION_MEDIUM_THRESHOLD = 0.18


def _deviation_label(score: float) -> DeviationLabel:
    if score >= DEVIATION_HIGH_THRESHOLD:
        return "high"
    if score >= DEVIATION_MEDIUM_THRESHOLD:
        return "medium"
    return "low"


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.post("/api/compass/company-pattern-break", response_model=PatternBreakResult)
async def company_pattern_break(payload: CurrentDecisionRequest) -> PatternBreakResult:
    if not payload.decision_text.strip():
        raise HTTPException(status_code=400, detail="decision_text must not be empty.")

    # Step 1: LLM extraction only
    current = await _extract_decision(payload.decision_text, payload.project_name)

    # Step 2: deterministic cohort filtering + comparison
    cohort = _comparable_cohort(current)
    if not cohort:
        raise HTTPException(
            status_code=422,
            detail=f"No historical decisions found matching trade_off_type='{current.trade_off_type}' "
            f"and mission_critical={current.mission_critical}.",
        )

    centroid = _compute_centroid(cohort)
    dominant_factor, dominant_share = _dominant_factor(cohort)

    raw_distance = _euclidean_distance(current.weights, centroid)
    deviation_score = round(min(1.0, raw_distance / _MAX_DISTANCE * 2), 3)  # scaled so typical deviations read meaningfully
    deviation_label = _deviation_label(deviation_score)
    pattern_broken = current.prioritized != dominant_factor and deviation_label != "low"

    supporting_decisions = [d for d in cohort if d.prioritized == dominant_factor]

    reasoning = (
        f"{len(supporting_decisions)} of {len(cohort)} comparable decisions "
        f"({dominant_share*100:.0f}%) prioritized {dominant_factor}. "
        f"The current decision prioritizes {current.prioritized}, "
        f"placing it {deviation_score:.2f} (normalized) from the cohort centroid — "
        f"a {deviation_label} deviation."
    )
    if pattern_broken:
        reasoning += " This decision breaks the company's established pattern for this type of trade-off."

    needs_human = deviation_label == "high" or pattern_broken

    evidence = [
        EvidenceItem(
            source="historical_decision_record",
            reliability_tier="verified_transaction",
            timestamp=datetime.combine(d.decided_on, datetime.min.time(), tzinfo=timezone.utc),
            raw_ref=f"{d.id} · {d.project} · prioritized {d.prioritized}",
        )
        for d in supporting_decisions
    ]

    return PatternBreakResult(
        confidence=0.85 if len(cohort) >= 5 else 0.6,
        evidence=evidence,
        reasoning=reasoning,
        needs_human=needs_human,
        writes_to=["compass.findings", "governance.decision_log"],
        historical_pattern=HistoricalPattern(
            dominant_factor=dominant_factor,
            dominant_factor_share=round(dominant_share, 3),
            comparable_decision_count=len(cohort),
            centroid=centroid,
        ),
        current_decision=current,
        deviation_score=deviation_score,
        deviation_label=deviation_label,
        supporting_decisions=supporting_decisions,
        pattern_broken=pattern_broken,
    )
