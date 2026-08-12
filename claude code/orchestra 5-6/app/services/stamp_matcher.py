"""
Deterministic comparison against the seeded MillReference table — code decides the
verdict here, not the model. That matters for something safety-critical like material
authentication: the scoring has to be inspectable and reproducible, not a model's opinion.

Returns a third `needs_human` bool beyond the plan's stated (float, str) signature — the
material_auth_graph.py conditional edge uses it to route ambiguous cases to human review
rather than forcing a binary verdict.
"""
from __future__ import annotations

import re

from sqlalchemy.orm import Session

from app.models.materials import MillReference
from app.schemas.materials import ExtractedStampData

AMBIGUOUS_LOW = 0.4
AMBIGUOUS_HIGH = 0.65
VERIFIED_THRESHOLD = 0.65
CONTRADICTED_THRESHOLD = 0.4

# Weights for the three checks that make up match_score. Heat number carries the most
# weight because its format is the hardest signal to fake convincingly.
HEAT_NUMBER_WEIGHT = 0.45
MANUFACTURER_MARK_WEIGHT = 0.4
FONT_SPACING_WEIGHT = 0.15


def match_against_reference(
    extracted: ExtractedStampData,
    claimed_manufacturer: str,
    db: Session,
) -> tuple[float, str, bool]:
    """Returns (match_score, verdict, needs_human)."""
    reference = (
        db.query(MillReference)
        .filter(MillReference.manufacturer_name == claimed_manufacturer)
        .first()
    )

    if reference is None:
        # No reference on file at all — code can't make a determination, always escalate.
        return 0.5, "uncertain", True

    pattern = reference.known_stamp_pattern or {}
    score = 0.0

    # 1. Heat number format check — fast, high-signal.
    heat_regex = pattern.get("heat_number_regex")
    if extracted.heat_number and heat_regex:
        if re.fullmatch(heat_regex, extracted.heat_number):
            score += HEAT_NUMBER_WEIGHT
    elif not extracted.heat_number and not heat_regex:
        # Neither side expects a heat number — neutral, don't penalize or reward.
        score += HEAT_NUMBER_WEIGHT * 0.5

    # 2. Manufacturer mark against known aliases.
    aliases = [a.lower() for a in pattern.get("manufacturer_mark_aliases", [])]
    mark = (extracted.manufacturer_mark or "").strip().lower()
    if mark and any(mark == alias or mark in alias or alias in mark for alias in aliases):
        score += MANUFACTURER_MARK_WEIGHT

    # 3. Font/spacing characteristics — soft signal, simple keyword overlap.
    expected_words = set((pattern.get("font_characteristics") or "").lower().split())
    observed_words = set((extracted.estimated_font_style or "").lower().split())
    if expected_words and observed_words:
        overlap = len(expected_words & observed_words) / len(expected_words)
        score += FONT_SPACING_WEIGHT * overlap

    match_score = round(min(score, 1.0), 3)

    needs_human = AMBIGUOUS_LOW <= match_score <= AMBIGUOUS_HIGH
    if match_score >= VERIFIED_THRESHOLD:
        verdict = "verified"
    elif match_score < CONTRADICTED_THRESHOLD:
        verdict = "contradicted"
    else:
        verdict = "uncertain"

    return match_score, verdict, needs_human
