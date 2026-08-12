"""
SENTINEL — Bid Integrity & Collusion Check
POST /sentinel/bid-integrity-check

Design:
  - All comparisons, statistics, and date-math are plain deterministic Python
    (numpy/scipy + stdlib). The LLM never computes a verdict.
  - The LLM is called exactly once, at the end, only to turn the already-computed
    findings into a human-readable `reasoning` string.
  - `needs_human` is a real boolean computed from a stated fairness-score
    threshold (NEEDS_HUMAN_FAIRNESS_THRESHOLD) OR the presence of any fired
    check — never hardcoded.
"""

from __future__ import annotations

import difflib
import statistics
from datetime import datetime, timedelta
from typing import Literal

import numpy as np
from fastapi import APIRouter
from pydantic import BaseModel, Field
from scipy import stats as scipy_stats

router = APIRouter()

# --------------------------------------------------------------------------
# Base evidence contract (shared shape every SENTINEL result extends)
# --------------------------------------------------------------------------


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


# --------------------------------------------------------------------------
# Domain models
# --------------------------------------------------------------------------


class LineItem(BaseModel):
    item: str
    price: float


class Bid(BaseModel):
    vendor_id: str
    registered_address: str
    registered_officer: str
    submitted_at: datetime
    line_items: list[LineItem]


class SuspiciousBid(BaseModel):
    vendor_id: str
    reason: str


class BidIntegrityResult(EvidenceResult):
    fairness_score: float = Field(..., ge=0, le=100)
    suspicious_bids: list[SuspiciousBid]
    collusion_indicators: list[str]


# --------------------------------------------------------------------------
# Thresholds — named constants, not magic numbers buried in logic
# --------------------------------------------------------------------------

Z_SCORE_OUTLIER_THRESHOLD = 2.0            # per-line-item price z-score
UNBALANCED_EARLY_Z_THRESHOLD = 1.5         # front-loaded pricing signal
UNBALANCED_LATE_Z_THRESHOLD = -1.0         # back-loaded (below-cost) signal
SYNCHRONIZATION_WINDOW_SECONDS = 300       # 5 minutes between submissions
ROUND_NUMBER_MODULUS = 50                  # price divisible by this = "round"
ROUND_NUMBER_MATCH_RATIO = 0.66            # >= 4/6 line items round -> flagged
ADDRESS_FUZZY_MATCH_RATIO = 0.92           # difflib.SequenceMatcher ratio
OFFICER_FUZZY_MATCH_RATIO = 0.90

NEEDS_HUMAN_FAIRNESS_THRESHOLD = 90.0      # score below this alone triggers review

PENALTY_PRICE_OUTLIER = 12.0
PENALTY_UNBALANCED_BID = 20.0
PENALTY_SYNCHRONIZATION = 15.0
PENALTY_SHARED_ENTITY = 25.0

RELIABILITY_WEIGHT = {
    "self_reported": 0.5,
    "third_party_observed": 0.75,
    "verified_transaction": 1.0,
}


# --------------------------------------------------------------------------
# Mock / seeded reference data
# NOTE: This block simulates what would otherwise come from the procurement
# system's bid ledger and a business-registry lookup. It is here only so the
# route is runnable/testable standalone — replace with real ingestion.
# --------------------------------------------------------------------------


def seeded_mock_bids() -> list[Bid]:
    base_time = datetime(2026, 8, 4, 14, 0, 0)
    return [
        Bid(
            vendor_id="SteelCo Industries",
            registered_address="4471 Foundry Lane, Unit 12B, Newark, NJ",
            registered_officer="R. Halvorsen",
            submitted_at=base_time,
            line_items=[
                LineItem(item="Mobilization", price=42000),
                LineItem(item="Excavation", price=88000),
                LineItem(item="Structural Steel", price=410000),
                LineItem(item="Concrete Pour", price=265000),
                LineItem(item="Electrical", price=140000),
                LineItem(item="Finishing / Punch List", price=38000),
            ],
        ),
        Bid(
            vendor_id="MetroFab Construction",
            registered_address="4471 Foundry Lane, Unit 12B, Newark, NJ",
            registered_officer="R. Halvorsen",
            # 47 seconds after SteelCo — well inside the sync window
            submitted_at=base_time + timedelta(seconds=47),
            line_items=[
                LineItem(item="Mobilization", price=44000),
                LineItem(item="Excavation", price=91000),
                LineItem(item="Structural Steel", price=400000),
                LineItem(item="Concrete Pour", price=270000),
                LineItem(item="Electrical", price=145000),
                LineItem(item="Finishing / Punch List", price=40000),
            ],
        ),
        Bid(
            # Genuine anomaly: heavily front-loaded (unbalanced) bid — prices
            # inflated on early line items, suspiciously low on late ones.
            vendor_id="Apex Builders",
            registered_address="19 Harrow Industrial Park, Bldg C, Trenton, NJ",
            registered_officer="D. Okafor",
            submitted_at=base_time + timedelta(hours=6, minutes=12),
            line_items=[
                LineItem(item="Mobilization", price=185000),   # extreme high
                LineItem(item="Excavation", price=210000),     # extreme high
                LineItem(item="Structural Steel", price=395000),
                LineItem(item="Concrete Pour", price=255000),
                LineItem(item="Electrical", price=62000),      # extreme low
                LineItem(item="Finishing / Punch List", price=9000),  # extreme low
            ],
        ),
        Bid(
            vendor_id="Horizon Infrastructure",
            registered_address="880 Delancey Court, Suite 4, Jersey City, NJ",
            registered_officer="M. Petrossian",
            submitted_at=base_time + timedelta(days=1, hours=2),
            line_items=[
                LineItem(item="Mobilization", price=39500),
                LineItem(item="Excavation", price=84000),
                LineItem(item="Structural Steel", price=418000),
                LineItem(item="Concrete Pour", price=258000),
                LineItem(item="Electrical", price=137500),
                LineItem(item="Finishing / Punch List", price=41200),
            ],
        ),
        Bid(
            vendor_id="Continental Paving Co.",
            registered_address="27 Route 9 South, Woodbridge, NJ",
            registered_officer="L. Marsh",
            submitted_at=base_time + timedelta(days=1, hours=5, minutes=30),
            line_items=[
                LineItem(item="Mobilization", price=41000),
                LineItem(item="Excavation", price=86500),
                LineItem(item="Structural Steel", price=405000),
                LineItem(item="Concrete Pour", price=261000),
                LineItem(item="Electrical", price=142000),
                LineItem(item="Finishing / Punch List", price=39500),
            ],
        ),
    ]


# --------------------------------------------------------------------------
# Check 1 — price outlier / unbalanced-bid detection (numpy/scipy, no LLM)
# --------------------------------------------------------------------------


def check_price_outliers(bids: list[Bid]) -> tuple[list[SuspiciousBid], dict]:
    """Per-line-item z-score across vendors, plus a front-loaded /
    back-loaded ('unbalanced bid') pattern check on each vendor's own
    z-scores across the item sequence."""
    item_names = [li.item for li in bids[0].line_items]
    # matrix: rows = vendors, cols = items, in submitted sequence order
    price_matrix = np.array([[li.price for li in b.line_items] for b in bids], dtype=float)

    # z-score per column (per line item, across vendors), population std
    z_matrix = scipy_stats.zscore(price_matrix, axis=0, ddof=0)
    z_matrix = np.nan_to_num(z_matrix, nan=0.0)  # guard against zero-variance columns

    flagged: list[SuspiciousBid] = []
    per_vendor_outlier_items: dict[str, list[str]] = {}

    n_items = len(item_names)
    early_idx = list(range(0, max(1, n_items // 3)))          # first third of items
    late_idx = list(range(n_items - max(1, n_items // 3), n_items))  # last third

    for row_idx, bid in enumerate(bids):
        row_z = z_matrix[row_idx]
        outlier_items = [item_names[c] for c in range(n_items) if abs(row_z[c]) >= Z_SCORE_OUTLIER_THRESHOLD]
        if outlier_items:
            per_vendor_outlier_items[bid.vendor_id] = outlier_items
            flagged.append(
                SuspiciousBid(
                    vendor_id=bid.vendor_id,
                    reason=(
                        f"Statistically significant price deviation (|z| >= {Z_SCORE_OUTLIER_THRESHOLD}) "
                        f"on: {', '.join(outlier_items)}"
                    ),
                )
            )

        early_z_max = max((row_z[i] for i in early_idx), default=0.0)
        late_z_min = min((row_z[i] for i in late_idx), default=0.0)
        if early_z_max >= UNBALANCED_EARLY_Z_THRESHOLD and late_z_min <= UNBALANCED_LATE_Z_THRESHOLD:
            flagged.append(
                SuspiciousBid(
                    vendor_id=bid.vendor_id,
                    reason=(
                        "Unbalanced bid pattern: early line items priced well above the vendor "
                        f"median (z={early_z_max:.2f}) while later line items are priced below "
                        f"cost relative to peers (z={late_z_min:.2f}) — consistent with front-loading "
                        "to profit from anticipated quantity overruns."
                    ),
                )
            )

    stats_summary = {
        "item_names": item_names,
        "z_matrix": z_matrix.round(2).tolist(),
        "per_vendor_outlier_items": per_vendor_outlier_items,
    }
    return flagged, stats_summary


# --------------------------------------------------------------------------
# Check 2 — submission synchronization + rounding-pattern correlation
# --------------------------------------------------------------------------


def _is_round_price(price: float) -> bool:
    return price % ROUND_NUMBER_MODULUS == 0


def check_synchronization(bids: list[Bid]) -> tuple[list[str], dict]:
    indicators: list[str] = []
    details: dict = {"pairs_checked": 0, "sync_pairs": []}

    for i in range(len(bids)):
        for j in range(i + 1, len(bids)):
            a, b = bids[i], bids[j]
            details["pairs_checked"] += 1
            delta = abs((a.submitted_at - b.submitted_at).total_seconds())
            if delta > SYNCHRONIZATION_WINDOW_SECONDS:
                continue

            a_round_ratio = statistics.mean(_is_round_price(li.price) for li in a.line_items)
            b_round_ratio = statistics.mean(_is_round_price(li.price) for li in b.line_items)
            rounding_aligned = a_round_ratio >= ROUND_NUMBER_MATCH_RATIO and b_round_ratio >= ROUND_NUMBER_MATCH_RATIO

            indicator = (
                f"{a.vendor_id} and {b.vendor_id} bids submitted {delta:.0f} seconds apart"
                + (
                    f", both with {round(a_round_ratio * len(a.line_items))}/"
                    f"{len(a.line_items)} and {round(b_round_ratio * len(b.line_items))}/"
                    f"{len(b.line_items)} line items on round ${ROUND_NUMBER_MODULUS} increments"
                    if rounding_aligned
                    else ""
                )
            )
            indicators.append(indicator)
            details["sync_pairs"].append(
                {"pair": (a.vendor_id, b.vendor_id), "delta_seconds": delta, "rounding_aligned": rounding_aligned}
            )

    return indicators, details


# --------------------------------------------------------------------------
# Check 3 — shared entity (exact / fuzzy match on address & officer)
# --------------------------------------------------------------------------


def _normalize(s: str) -> str:
    return " ".join(s.lower().replace(",", " ").replace(".", " ").split())


def check_shared_entity(bids: list[Bid]) -> tuple[list[str], dict]:
    indicators: list[str] = []
    details: dict = {"pairs_checked": 0, "matches": []}

    for i in range(len(bids)):
        for j in range(i + 1, len(bids)):
            a, b = bids[i], bids[j]
            details["pairs_checked"] += 1

            addr_ratio = difflib.SequenceMatcher(None, _normalize(a.registered_address), _normalize(b.registered_address)).ratio()
            officer_ratio = difflib.SequenceMatcher(None, _normalize(a.registered_officer), _normalize(b.registered_officer)).ratio()

            if addr_ratio >= ADDRESS_FUZZY_MATCH_RATIO:
                indicators.append(
                    f"{a.vendor_id} and {b.vendor_id} share registered address: {a.registered_address} "
                    f"(match {addr_ratio:.0%})"
                )
                details["matches"].append({"pair": (a.vendor_id, b.vendor_id), "field": "address", "ratio": addr_ratio})

            if officer_ratio >= OFFICER_FUZZY_MATCH_RATIO:
                indicators.append(
                    f"{a.vendor_id} and {b.vendor_id} list the same registered officer: "
                    f"{a.registered_officer} (match {officer_ratio:.0%})"
                )
                details["matches"].append({"pair": (a.vendor_id, b.vendor_id), "field": "officer", "ratio": officer_ratio})

    return indicators, details


# --------------------------------------------------------------------------
# Fairness score — deterministic penalty roll-up (never LLM-computed)
# --------------------------------------------------------------------------


def compute_fairness_score(
    price_flags: list[SuspiciousBid],
    unbalanced_flags: int,
    sync_indicator_count: int,
    shared_entity_indicator_count: int,
) -> float:
    score = 100.0
    score -= len(price_flags) * PENALTY_PRICE_OUTLIER
    score -= unbalanced_flags * PENALTY_UNBALANCED_BID
    score -= sync_indicator_count * PENALTY_SYNCHRONIZATION
    score -= shared_entity_indicator_count * PENALTY_SHARED_ENTITY
    return round(max(0.0, min(100.0, score)), 1)


def compute_confidence(evidence: list[EvidenceItem]) -> float:
    """Deterministic confidence: weighted average of evidence reliability tiers."""
    if not evidence:
        return 0.0
    weights = [RELIABILITY_WEIGHT[e.reliability_tier] for e in evidence]
    return round(sum(weights) / len(weights), 2)


# --------------------------------------------------------------------------
# LLM call — synthesis of `reasoning` ONLY, never the verdict itself
# --------------------------------------------------------------------------


async def synthesize_reasoning(
    fairness_score: float,
    suspicious_bids: list[SuspiciousBid],
    collusion_indicators: list[str],
) -> str:
    """The LLM is handed the already-computed findings and asked only to
    write a clear auditor-style narrative. It performs no arithmetic and no
    comparison logic — those are all done above in plain Python."""
    client = get_claude_client()  # assumed to exist in this codebase

    findings_block = (
        f"Fairness score (already computed, 0-100, do not recompute): {fairness_score}\n\n"
        "Suspicious bids (already computed):\n"
        + ("\n".join(f"- {sb.vendor_id}: {sb.reason}" for sb in suspicious_bids) or "- none")
        + "\n\nCollusion indicators (already computed):\n"
        + ("\n".join(f"- {c}" for c in collusion_indicators) or "- none")
    )

    system_prompt = (
        "You are SENTINEL, a procurement audit assistant. You are given findings that "
        "have ALREADY been computed by deterministic statistical checks. Do not perform "
        "any new arithmetic, statistics, or comparisons, and do not change any figures. "
        "Your only job is to write a concise (3-5 sentence) auditor-style `reasoning` "
        "narrative synthesizing why the bid set received this fairness score, referencing "
        "the specific flagged vendors and indicators by name. Write plain prose, no lists."
    )

    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=400,
        system=system_prompt,
        messages=[{"role": "user", "content": findings_block}],
    )

    text_blocks = [block.text for block in response.content if getattr(block, "type", None) == "text"]
    reasoning = "\n".join(text_blocks).strip()
    return reasoning or "No reasoning text returned by the model."


# --------------------------------------------------------------------------
# Route
# --------------------------------------------------------------------------


@router.post("/sentinel/bid-integrity-check", response_model=BidIntegrityResult)
async def bid_integrity_check(bids: list[Bid] | None = None) -> BidIntegrityResult:
    # If no bids are posted, fall back to seeded mock data so the route is
    # exercisable standalone (e.g. in a demo or the paired frontend).
    if not bids:
        bids = seeded_mock_bids()

    now = datetime.utcnow()

    # --- 1. price outliers / unbalanced bids ---
    price_flags, price_stats = check_price_outliers(bids)
    unbalanced_flag_count = sum(1 for f in price_flags if "Unbalanced bid pattern" in f.reason)
    outlier_flag_count = len(price_flags) - unbalanced_flag_count

    # --- 2. synchronization ---
    sync_indicators, sync_details = check_synchronization(bids)

    # --- 3. shared entity ---
    entity_indicators, entity_details = check_shared_entity(bids)

    collusion_indicators = sync_indicators + entity_indicators

    # Merge shared-entity vendors into suspicious_bids too (a vendor sharing
    # an address/officer is itself a suspicious bid, not just a "collusion
    # indicator" line item).
    suspicious_bids: list[SuspiciousBid] = list(price_flags)
    flagged_vendor_ids = {sb.vendor_id for sb in suspicious_bids}
    for match in entity_details["matches"]:
        for vendor_id in match["pair"]:
            if vendor_id not in flagged_vendor_ids:
                field = match["field"]
                suspicious_bids.append(
                    SuspiciousBid(
                        vendor_id=vendor_id,
                        reason=f"Shares registered {field} with another bidder in this solicitation "
                        f"(match {match['ratio']:.0%}) — see Collusion Indicators.",
                    )
                )
                flagged_vendor_ids.add(vendor_id)

    fairness_score = compute_fairness_score(
        price_flags=price_flags,
        unbalanced_flags=unbalanced_flag_count,
        sync_indicator_count=len(sync_indicators),
        shared_entity_indicator_count=len(entity_indicators),
    )

    needs_human = fairness_score < NEEDS_HUMAN_FAIRNESS_THRESHOLD or bool(suspicious_bids or collusion_indicators)

    evidence = [
        EvidenceItem(
            source="internal_bid_ledger.line_items",
            reliability_tier="verified_transaction",
            timestamp=now,
            raw_ref=f"z_score_matrix(items={price_stats['item_names']}, threshold={Z_SCORE_OUTLIER_THRESHOLD})",
        ),
        EvidenceItem(
            source="internal_bid_ledger.submitted_at",
            reliability_tier="verified_transaction",
            timestamp=now,
            raw_ref=f"submission_timestamp_diff(window_s={SYNCHRONIZATION_WINDOW_SECONDS}, pairs={sync_details['pairs_checked']})",
        ),
        EvidenceItem(
            source="business_registry.address_officer_lookup",
            reliability_tier="third_party_observed",
            timestamp=now,
            raw_ref=f"fuzzy_match(address_ratio>={ADDRESS_FUZZY_MATCH_RATIO}, officer_ratio>={OFFICER_FUZZY_MATCH_RATIO}, pairs={entity_details['pairs_checked']})",
        ),
    ]

    reasoning = await synthesize_reasoning(fairness_score, suspicious_bids, collusion_indicators)

    return BidIntegrityResult(
        confidence=compute_confidence(evidence),
        evidence=evidence,
        reasoning=reasoning,
        needs_human=needs_human,
        writes_to=["procurement_audit_log", "vendor_flag_registry"],
        fairness_score=fairness_score,
        suspicious_bids=suspicious_bids,
        collusion_indicators=collusion_indicators,
    )
