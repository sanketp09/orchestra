"""
SENTINEL — Duplicate & Conflicting Order Catcher
POST /sentinel/duplicate-order-check

Deterministic matching lives entirely in plain Python (exact match, a
keyword-overlap heuristic standing in for embedding similarity, delivery
window math, financial impact, and the needs_human threshold). The LLM is
used for exactly one thing: turning the already-computed facts into a
single plain-English recommendation sentence. It never compares numbers,
never decides whether something is a duplicate, and never sees anything
it could use to invent a fact that wasn't already computed.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime
from typing import Literal, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

# Assumed to exist elsewhere in the project per the brief — a thin wrapper
# around the Anthropic SDK client, already authenticated.
from app.core.llm import get_claude_client

router = APIRouter(prefix="/sentinel", tags=["sentinel"])


# ============================================================================
# Base shape every SENTINEL result extends
# ============================================================================


class EvidenceItem(BaseModel):
    source: str
    reliability_tier: Literal[
        "self_reported", "third_party_observed", "verified_transaction"
    ]
    timestamp: datetime
    raw_ref: str


class EvidenceResult(BaseModel):
    confidence: float
    evidence: list[EvidenceItem]
    reasoning: str
    needs_human: bool
    writes_to: list[str]


# ============================================================================
# Request / response models for this endpoint
# ============================================================================


class NewPurchaseOrder(BaseModel):
    item: str
    quantity: float
    quantity_unit: str = "units"
    supplier: str
    project_id: str
    delivery_date: date
    # Not in the brief's enumerated input fields, but both the financial
    # impact figure and (indirectly) the confidence calculation need a
    # dollar value to compare — there's no way to compute
    # financial_impact_estimate without it, so it's required here.
    total_value: float = Field(
        ..., gt=0, description="Total dollar value of this PO line item."
    )


class DuplicateCheckResult(EvidenceResult):
    duplicate_risk: float
    conflicting_order_ids: list[str]
    financial_impact_estimate: float


# ============================================================================
# Mock / seeded reference data — CLEARLY MOCK, stands in for a real
# procurement-records table. In production this becomes a query against
# the project's open purchase orders.
# ============================================================================


class ExistingPurchaseOrder(BaseModel):
    po_id: str
    item: str
    quantity: float
    quantity_unit: str
    supplier: str
    project_id: str
    delivery_date: date
    total_value: float
    status: Literal["open", "closed"]


_MOCK_EXISTING_POS: list[ExistingPurchaseOrder] = [
    # Deliberately phrased differently from the incoming PO in the demo
    # request below ("reinforcing steel rods" vs "reinforcement bars") but
    # both cite the same "rebar, Grade 60" spec — this is the pair the
    # keyword-overlap heuristic is meant to catch.
    ExistingPurchaseOrder(
        po_id="PO-0988",
        item="Reinforcement bars (rebar), Grade 60",
        quantity=16,
        quantity_unit="tons",
        supplier="Apex Rebar Supply",
        project_id="proj-riverside-2",
        delivery_date=date(2026, 4, 5),
        total_value=142_000,
        status="open",
    ),
    # Same supplier as the new PO and a similar quantity, but neither the
    # item name nor the delivery date overlaps — a plausible separate,
    # legitimate order. Included so the demo shows the matcher NOT flagging
    # everything indiscriminately.
    ExistingPurchaseOrder(
        po_id="PO-1025",
        item="Rebar #4, epoxy coated",
        quantity=18,
        quantity_unit="tons",
        supplier="Meridian Steelworks",
        project_id="proj-riverside-2",
        delivery_date=date(2026, 4, 20),
        total_value=151_000,
        status="open",
    ),
    # Unrelated category — noise in the dataset, as a real project's open
    # PO list would have.
    ExistingPurchaseOrder(
        po_id="PO-1010",
        item="Copper wiring, 500ft spool",
        quantity=40,
        quantity_unit="spools",
        supplier="Voltline Electrical",
        project_id="proj-riverside-2",
        delivery_date=date(2026, 4, 10),
        total_value=58_000,
        status="open",
    ),
    ExistingPurchaseOrder(
        po_id="PO-1031",
        item="HVAC ductwork, 24in",
        quantity=12,
        quantity_unit="units",
        supplier="Coastal Mechanical",
        project_id="proj-riverside-2",
        delivery_date=date(2026, 4, 8),
        total_value=76_000,
        status="open",
    ),
]


def _get_open_pos_for_project(project_id: str) -> list[ExistingPurchaseOrder]:
    """Stand-in for a real procurement-records query — mock data only."""
    return [
        po
        for po in _MOCK_EXISTING_POS
        if po.project_id == project_id and po.status == "open"
    ]


# ============================================================================
# Deterministic matching logic — everything below is plain Python. No LLM
# call makes a comparison, a threshold decision, or does arithmetic.
# ============================================================================

# Tunable constants, kept in one place and named so the scoring formula
# below reads like a spec rather than a pile of magic numbers.
WEIGHT_NAME_MATCH = 0.70
WEIGHT_SUPPLIER_DIFFERS = 0.15
WEIGHT_DELIVERY_OVERLAP = 0.15
SEMANTIC_MATCH_THRESHOLD = 0.20  # min Jaccard similarity to count as a name match
MATCH_INCLUSION_THRESHOLD = 0.20  # min score to appear in conflicting_order_ids
DELIVERY_WINDOW_DAYS = 10
NEEDS_HUMAN_THRESHOLD = 0.5

_STOPWORDS = {"the", "a", "an", "of", "and", "for", "with", "to", "in", "on"}
# Longest-first so "reinforcement" strips to the same stem as "reinforcing"
# rather than stopping at a shorter, less specific suffix.
_SUFFIXES = ("ement", "ment", "tion", "ing", "ed")


def _normalize_tokens(text: str) -> set[str]:
    """Lowercase, tokenize, drop stopwords, and apply a light suffix-
    stripping stemmer so close word-forms collapse to the same token
    ('reinforcing' / 'reinforcement' -> 'reinforc')."""
    tokens: set[str] = set()
    for word in re.findall(r"[a-z0-9]+", text.lower()):
        if word in _STOPWORDS or len(word) <= 1:
            continue
        stemmed = word
        for suffix in _SUFFIXES:
            if stemmed.endswith(suffix) and len(stemmed) - len(suffix) >= 3:
                stemmed = stemmed[: -len(suffix)]
                break
        if stemmed.endswith("s") and len(stemmed) > 3:
            stemmed = stemmed[:-1]
        tokens.add(stemmed)
    return tokens


def _keyword_similarity(a: str, b: str) -> float:
    """MOCK — stands in for an embedding cosine-similarity check. No
    embedding model is wired up in this environment, so this tokenizes
    both item names, lightly stems them, and returns Jaccard similarity
    over the resulting token sets. Good enough to catch "reinforcing steel
    rods" vs "reinforcement bars" when both cite a shared spec token like
    "rebar" or "grade 60" — NOT a substitute for real semantic embeddings
    on more divergent phrasing (e.g. no shared vocabulary at all)."""
    tokens_a, tokens_b = _normalize_tokens(a), _normalize_tokens(b)
    if not tokens_a or not tokens_b:
        return 0.0
    return len(tokens_a & tokens_b) / len(tokens_a | tokens_b)


def _delivery_windows_overlap(d1: date, d2: date) -> bool:
    return abs((d1 - d2).days) <= DELIVERY_WINDOW_DAYS


@dataclass
class CandidateMatch:
    po: ExistingPurchaseOrder
    score: float
    exact_name_match: bool
    similarity: float
    supplier_differs: bool
    delivery_overlaps: bool


def _score_candidate(
    new_po: NewPurchaseOrder, existing: ExistingPurchaseOrder
) -> CandidateMatch:
    exact = new_po.item.strip().lower() == existing.item.strip().lower()
    similarity = 1.0 if exact else _keyword_similarity(new_po.item, existing.item)
    name_score = 1.0 if exact else (
        similarity if similarity >= SEMANTIC_MATCH_THRESHOLD else 0.0
    )

    supplier_differs = new_po.supplier.strip().lower() != existing.supplier.strip().lower()
    delivery_overlaps = _delivery_windows_overlap(new_po.delivery_date, existing.delivery_date)

    score = (
        name_score * WEIGHT_NAME_MATCH
        + (WEIGHT_SUPPLIER_DIFFERS if supplier_differs else 0.0)
        + (WEIGHT_DELIVERY_OVERLAP if delivery_overlaps else 0.0)
    )
    # Supplier/delivery signals only count alongside a name-based reason to
    # suspect the same material — otherwise every open PO with a different
    # supplier would pick up 0.15 "for free" regardless of what it's for.
    # This also is where the brief's "same item, overlapping delivery
    # windows, different suppliers" quantity-conflict signal is anchored:
    # it only fires on top of an existing name match, never on its own.
    if name_score == 0.0:
        score = 0.0

    return CandidateMatch(
        po=existing,
        score=round(min(score, 1.0), 4),
        exact_name_match=exact,
        similarity=round(similarity, 4),
        supplier_differs=supplier_differs,
        delivery_overlaps=delivery_overlaps,
    )


def _compute_confidence(best: Optional[CandidateMatch]) -> float:
    """Confidence in SENTINEL's own read of the situation — distinct from
    duplicate_risk, which measures how suspicious the situation itself is.
    More independent corroborating signals -> higher confidence in the
    flag (or in the "nothing found" result)."""
    if best is None:
        return 0.90  # confident there's genuinely nothing to flag
    signal_count = sum(
        [
            best.exact_name_match or best.similarity >= SEMANTIC_MATCH_THRESHOLD,
            best.supplier_differs,
            best.delivery_overlaps,
        ]
    )
    return round(min(0.6 + 0.13 * signal_count, 0.97), 2)


def _build_evidence(
    new_po: NewPurchaseOrder, best: Optional[CandidateMatch]
) -> list[EvidenceItem]:
    now = datetime.utcnow()
    evidence = [
        EvidenceItem(
            source=f"New PO submission — {new_po.item}",
            reliability_tier="self_reported",
            timestamp=now,
            raw_ref="internal://procurement/po-submission-form",
        )
    ]
    if best is None:
        return evidence

    evidence.append(
        EvidenceItem(
            source=f"{best.po.po_id} record — {best.po.supplier}",
            reliability_tier="verified_transaction",
            timestamp=datetime.combine(best.po.delivery_date, datetime.min.time()),
            raw_ref=f"internal://procurement/pos/{best.po.po_id}",
        )
    )
    evidence.append(
        EvidenceItem(
            source=(
                f"Keyword-overlap similarity check: {best.similarity:.0%} token "
                f"overlap with {best.po.po_id}"
            ),
            reliability_tier="third_party_observed",
            timestamp=now,
            raw_ref="internal://sentinel/keyword-similarity-heuristic",
        )
    )
    # Kept as its own evidence item — a separate signal from the pure
    # name-based duplication check above, per the brief.
    if best.delivery_overlaps and best.supplier_differs:
        gap_days = abs((new_po.delivery_date - best.po.delivery_date).days)
        evidence.append(
            EvidenceItem(
                source=(
                    f"Delivery window overlap vs {best.po.po_id}: {gap_days}-day gap, "
                    f"different supplier ({new_po.supplier} vs {best.po.supplier})"
                ),
                reliability_tier="third_party_observed",
                timestamp=now,
                raw_ref="internal://sentinel/delivery-window-check",
            )
        )
    return evidence


def _fallback_reasoning(
    new_po: NewPurchaseOrder,
    matched_po: Optional[ExistingPurchaseOrder],
    duplicate_risk: float,
    financial_impact: float,
) -> str:
    """Deterministic template used if the LLM call fails or is unavailable
    — a safety-relevant check should never go unanswered just because
    phrasing generation had an outage."""
    if matched_po is None:
        return (
            f"No matching or conflicting open PO found for '{new_po.item}' on "
            f"project {new_po.project_id} — safe to proceed."
        )
    return (
        f"{new_po.item} appears to duplicate {matched_po.po_id} "
        f"({matched_po.item}) — risk {duplicate_risk:.0%}, "
        f"${financial_impact:,.0f} at stake if both proceed. Review before releasing payment."
    )


async def _synthesize_reasoning(
    new_po: NewPurchaseOrder,
    matched_po: Optional[ExistingPurchaseOrder],
    duplicate_risk: float,
    financial_impact: float,
) -> str:
    """The one place an LLM is used — purely to phrase the already-
    computed facts into a single recommendation sentence. It is not given
    anything to compare or calculate; every number in the prompt was
    produced by deterministic code above."""
    if matched_po is None:
        return _fallback_reasoning(new_po, matched_po, duplicate_risk, financial_impact)

    prompt = (
        "You are SENTINEL, a procurement auditor assistant. Using ONLY the facts "
        "below, write one plain, direct sentence recommending what the "
        "procurement team should do next. Do not invent numbers or facts that "
        "aren't listed here.\n\n"
        f"New PO: {new_po.item}, {new_po.quantity} {new_po.quantity_unit}, "
        f"supplier {new_po.supplier}, delivery {new_po.delivery_date}.\n"
        f"Matched existing PO: {matched_po.po_id} — {matched_po.item}, "
        f"{matched_po.quantity} {matched_po.quantity_unit}, supplier "
        f"{matched_po.supplier}, delivery {matched_po.delivery_date}.\n"
        f"Computed duplicate risk: {duplicate_risk:.2f} on a 0-1 scale.\n"
        f"Computed financial impact if both proceed: ${financial_impact:,.0f}."
    )

    try:
        client = get_claude_client()
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=120,
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(
            block.text for block in response.content if getattr(block, "type", None) == "text"
        ).strip()
        return text or _fallback_reasoning(new_po, matched_po, duplicate_risk, financial_impact)
    except Exception:
        # Never let an LLM/network failure break a safety-relevant check —
        # fall back to the deterministic template.
        return _fallback_reasoning(new_po, matched_po, duplicate_risk, financial_impact)


# ============================================================================
# Route
# ============================================================================


@router.post("/duplicate-order-check", response_model=DuplicateCheckResult)
async def check_duplicate_order(new_po: NewPurchaseOrder) -> DuplicateCheckResult:
    candidates = [
        _score_candidate(new_po, existing)
        for existing in _get_open_pos_for_project(new_po.project_id)
    ]
    relevant = sorted(
        (c for c in candidates if c.score >= MATCH_INCLUSION_THRESHOLD),
        key=lambda c: c.score,
        reverse=True,
    )
    best = relevant[0] if relevant else None

    duplicate_risk = best.score if best else 0.0
    conflicting_order_ids = [c.po.po_id for c in relevant]
    financial_impact_estimate = (
        min(new_po.total_value, best.po.total_value) if best else 0.0
    )
    needs_human = duplicate_risk > NEEDS_HUMAN_THRESHOLD  # computed, never hardcoded

    reasoning = await _synthesize_reasoning(
        new_po, best.po if best else None, duplicate_risk, financial_impact_estimate
    )

    return DuplicateCheckResult(
        confidence=_compute_confidence(best),
        evidence=_build_evidence(new_po, best),
        reasoning=reasoning,
        needs_human=needs_human,
        writes_to=(
            ["sentinel.duplicate_flags", "procurement.po_review_queue"]
            if conflicting_order_ids
            else ["sentinel.duplicate_flags"]
        ),
        duplicate_risk=duplicate_risk,
        conflicting_order_ids=conflicting_order_ids,
        financial_impact_estimate=financial_impact_estimate,
    )
