"""
SENTINEL — Pay Application & Installation Proof
POST /sentinel/pay-application-check

Design notes:
- The ONLY place an LLM is used is to look at the submitted site photo and
  estimate a completion percentage against the stated scope of work — that
  requires real visual judgment a deterministic function cannot do.
- Everything downstream of that estimate (comparing it to the claimed
  percent, thresholding, building the payment recommendation sentence,
  deciding needs_human) is plain, auditable Python.
- Reference data (SCOPE_BENCHMARKS) is seeded/mocked and clearly commented —
  it is only ever appended as grounding context into the vision prompt, it
  never participates in the comparison math itself.
"""

from __future__ import annotations

import base64
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, File, Form, UploadFile
from pydantic import BaseModel, Field

# from anthropic_client import get_claude_client  # assumed to exist per project convention

router = APIRouter()


# ---------------------------------------------------------------------------
# Base evidence shape
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
# Route-specific extension
# ---------------------------------------------------------------------------

class PayApplicationResult(EvidenceResult):
    claimed_progress: float
    verified_progress: float
    difference: float
    payment_recommendation: str


# ---------------------------------------------------------------------------
# Deterministic policy constants
# ---------------------------------------------------------------------------

# Points of gap between claimed and vision-verified completion that trigger
# a flag for human review. This is the single stated threshold behind
# needs_human — nothing about it is hardcoded per-request.
DIFFERENCE_THRESHOLD_POINTS = 15.0


# ---------------------------------------------------------------------------
# SEEDED / MOCK REFERENCE DATA
# Typical milestone benchmarks per trade, used only as grounding context we
# hand the vision model alongside the photo (e.g. "electrical rough-in at
# this stage usually looks like X"). Purely descriptive — never used in the
# deterministic comparison math below.
# ---------------------------------------------------------------------------

SCOPE_BENCHMARKS: dict[str, str] = {
    "electrical": (
        "0-30%: conduit and boxes roughed in, no devices. 30-60%: wire pulled, "
        "panels mounted but not energized. 60-85%: devices and fixtures installed, "
        "panel labeled. 85-100%: energized, tested, covers on."
    ),
    "drywall": (
        "0-30%: studs exposed, no board hung. 30-60%: board hung, unfinished seams. "
        "60-85%: taped and mudded, sanding in progress. 85-100%: primed, ready for paint."
    ),
    "concrete": (
        "0-30%: formwork and rebar placement. 30-60%: pour in progress or freshly poured. "
        "60-85%: cured, forms stripped. 85-100%: finished surface, control joints cut."
    ),
    "hvac": (
        "0-30%: layout marked, no ductwork. 30-60%: main trunk lines hung. "
        "60-85%: branch runs and registers installed. 85-100%: connected to units, tested."
    ),
    "plumbing": (
        "0-30%: rough-in layout marked. 30-60%: supply/drain lines run. "
        "60-85%: fixtures set but not connected. 85-100%: connected, pressure tested."
    ),
}


def _benchmark_context(scope_description: str) -> str:
    """Pick the closest seeded benchmark note by simple keyword match."""
    lowered = scope_description.lower()
    for trade, note in SCOPE_BENCHMARKS.items():
        if trade in lowered:
            return f"Reference milestone guide for {trade}: {note}"
    return "No specific milestone guide on file for this trade — judge general visual completeness."


# ---------------------------------------------------------------------------
# LLM step — vision estimate (genuinely needs judgment, not arithmetic)
# ---------------------------------------------------------------------------

COMPLETION_ESTIMATE_TOOL = {
    "name": "report_completion_estimate",
    "description": "Report an estimated construction completion percentage based on a site photo and scope description.",
    "input_schema": {
        "type": "object",
        "properties": {
            "estimated_completion_percent": {
                "type": "number",
                "description": "Best estimate of completion percent (0-100) for the described scope, based only on visible evidence in the photo.",
            },
            "visual_reasoning": {
                "type": "string",
                "description": "1-3 sentences on what is and isn't visible in the photo that supports this estimate.",
            },
            "estimate_confidence": {
                "type": "number",
                "description": "0-1 confidence in this estimate, lower if the photo is unclear, poorly lit, or doesn't show the full scope.",
            },
        },
        "required": ["estimated_completion_percent", "visual_reasoning", "estimate_confidence"],
    },
}


async def _estimate_completion_from_photo(
    image_bytes: bytes, media_type: str, scope_description: str
) -> dict:
    """
    The only LLM call in this route. Claude looks at the photo and produces
    a structured completion estimate via forced tool-call output — we never
    ask it to do the claimed-vs-verified comparison itself.
    """
    client = get_claude_client()
    benchmark_note = _benchmark_context(scope_description)

    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=500,
        tools=[COMPLETION_ESTIMATE_TOOL],
        tool_choice={"type": "tool", "name": "report_completion_estimate"},
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": base64.b64encode(image_bytes).decode("utf-8"),
                        },
                    },
                    {
                        "type": "text",
                        "text": (
                            f"Scope of work claimed to be in progress: {scope_description}\n\n"
                            f"{benchmark_note}\n\n"
                            "Based only on what is visible in this photo, estimate the completion "
                            "percentage of the described scope. Do not assume work exists outside "
                            "the frame."
                        ),
                    },
                ],
            }
        ],
    )

    for block in response.content:
        if getattr(block, "type", None) == "tool_use" and block.name == "report_completion_estimate":
            return block.input

    raise RuntimeError("Vision model did not return a completion estimate tool call.")


# ---------------------------------------------------------------------------
# Deterministic step — comparison, thresholding, recommendation
# ---------------------------------------------------------------------------

def _build_payment_recommendation(claimed: float, verified: float, difference: float) -> str:
    if difference > DIFFERENCE_THRESHOLD_POINTS:
        return (
            f"Recommend approving {verified:.0f}%, not the claimed {claimed:.0f}%, "
            f"pending review — visual evidence supports {difference:.0f} points less progress than claimed."
        )
    if difference < -DIFFERENCE_THRESHOLD_POINTS:
        return (
            f"Claimed {claimed:.0f}% is more conservative than the visually verified {verified:.0f}%. "
            f"Recommend approving the claimed {claimed:.0f}% — no overclaim risk detected."
        )
    return (
        f"Claimed {claimed:.0f}% is within tolerance of the visually verified {verified:.0f}% "
        f"(±{DIFFERENCE_THRESHOLD_POINTS:.0f} points). Recommend approving the claimed {claimed:.0f}%."
    )


def _evaluate(
    claimed_percent: float,
    verified_percent: float,
    visual_reasoning: str,
    estimate_confidence: float,
    photo_filename: str,
) -> PayApplicationResult:
    # Deterministic arithmetic — no LLM involved from here down.
    difference = round(claimed_percent - verified_percent, 1)
    needs_human = abs(difference) > DIFFERENCE_THRESHOLD_POINTS

    recommendation = _build_payment_recommendation(claimed_percent, verified_percent, difference)

    reasoning = (
        f"Vision estimate: {visual_reasoning} "
        f"Deterministic check: claimed {claimed_percent:.1f}% vs. verified {verified_percent:.1f}% "
        f"is a {abs(difference):.1f}-point gap, threshold is {DIFFERENCE_THRESHOLD_POINTS:.0f} points, "
        f"so needs_human={needs_human}."
    )

    evidence = [
        EvidenceItem(
            source="contractor_pay_application",
            reliability_tier="self_reported",
            timestamp=datetime.now(timezone.utc),
            raw_ref=f"claimed_percent={claimed_percent}",
        ),
        EvidenceItem(
            source="site_photo_vision_analysis",
            reliability_tier="third_party_observed",
            timestamp=datetime.now(timezone.utc),
            raw_ref=photo_filename,
        ),
    ]

    return PayApplicationResult(
        confidence=round(float(estimate_confidence), 2),
        evidence=evidence,
        reasoning=reasoning,
        needs_human=needs_human,
        writes_to=["pay_applications.review_queue", "finance_dashboard.pending_approvals"],
        claimed_progress=round(claimed_percent, 1),
        verified_progress=round(verified_percent, 1),
        difference=difference,
        payment_recommendation=recommendation,
    )


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.post("/sentinel/pay-application-check", response_model=PayApplicationResult)
async def pay_application_check(
    photo: UploadFile = File(...),
    claimed_percent: float = Form(...),
    scope_description: str = Form(...),
) -> PayApplicationResult:
    """
    LLM is used once, for the part that genuinely needs visual judgment:
    estimating completion percent from the photo. The claimed-vs-verified
    comparison, thresholding, and recommendation text are all deterministic.
    """
    image_bytes = await photo.read()
    media_type = photo.content_type or "image/jpeg"

    estimate = await _estimate_completion_from_photo(image_bytes, media_type, scope_description)

    return _evaluate(
        claimed_percent=claimed_percent,
        verified_percent=float(estimate["estimated_completion_percent"]),
        visual_reasoning=str(estimate["visual_reasoning"]),
        estimate_confidence=float(estimate["estimate_confidence"]),
        photo_filename=photo.filename or "site_photo",
    )
