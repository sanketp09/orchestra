"""
Deterministic duplicate-order matching. Unlike Feature 1, this is not
multi-step reasoning — no LangGraph needed. It's real comparison logic run
synchronously against the database.

Two detection passes:
  1. Exact SKU match — same sku, different PO, within the last 30 days.
  2. Fuzzy match — cosine similarity on description_embedding > 0.85,
     catching same-item-different-wording cases like "12mm rebar" vs.
     "12mm reinforcement bar".

For every match found, severity is escalated based on whether the two POs
share a project, have overlapping delivery windows, and were raised by
different teams — the combination that indicates two teams unknowingly
ordering the same thing.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone

_UTC = timezone.utc
from typing import Optional

from sqlalchemy.orm import Session

from app.models.inventory import POLineItem, PurchaseOrder
from app.schemas.duplicate_check import DuplicateCheckResult, DuplicateMatch
from app.schemas.evidence import EvidenceResult, EvidenceSeverity

EXACT_SKU_LOOKBACK_DAYS = 30
FUZZY_SIMILARITY_THRESHOLD = 0.85


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    if len(a) != len(b):
        raise ValueError(f"Embedding dimension mismatch: {len(a)} vs {len(b)}")
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


def _windows_overlap(
    a_start: Optional[datetime],
    a_end: Optional[datetime],
    b_start: Optional[datetime],
    b_end: Optional[datetime],
) -> bool:
    """Two delivery windows overlap if neither is missing and they intersect.
    If either PO has no delivery window recorded, we can't confirm overlap —
    treat as non-overlapping rather than assuming the worst."""
    if not all([a_start, a_end, b_start, b_end]):
        return False
    return a_start <= b_end and b_start <= a_end


def _severity_for(
    is_exact_sku: bool,
    same_project: bool,
    overlapping_window: bool,
    different_team: bool,
) -> str:
    strong_context = same_project and overlapping_window and different_team
    if is_exact_sku:
        return "exact_duplicate" if strong_context else "likely_duplicate"
    return "likely_duplicate" if strong_context else "possible_overlap"


def _estimated_savings(new_item: POLineItem, existing_item: POLineItem) -> Optional[float]:
    if new_item.unit_cost is None or existing_item.unit_cost is None:
        return None
    avoidable_qty = min(new_item.expected_qty, existing_item.expected_qty)
    avg_unit_cost = (new_item.unit_cost + existing_item.unit_cost) / 2
    return round(avoidable_qty * avg_unit_cost, 2)


def check_for_duplicates(
    new_line_item: POLineItem,
    db: Session,
    new_embedding: Optional[list[float]] = None,
) -> DuplicateCheckResult:
    """
    Check whether `new_line_item` duplicates or conflicts with any existing
    PO line item.

    Args:
        new_line_item: the line item being created/checked. Must already be
            attached to (or have) a `purchase_order` relationship so project/
            team/window context is available.
        db: active SQLAlchemy session.
        new_embedding: precomputed embedding for `new_line_item`'s
            description. If omitted and `new_line_item.description_embedding`
            is unset, the fuzzy-match pass is skipped (exact-SKU pass still
            runs).

    Returns:
        DuplicateCheckResult with zero or more DuplicateMatch entries,
        sorted with the most severe matches first.
    """
    new_po = new_line_item.purchase_order
    if new_po is None:
        raise ValueError("new_line_item must have a loaded `purchase_order` relationship")

    matches: list[DuplicateMatch] = []
    matched_line_item_ids: set[str] = set()

    # --- Pass 1: exact SKU match -------------------------------------------------
    if new_line_item.sku:
        cutoff = datetime.now(_UTC) - timedelta(days=EXACT_SKU_LOOKBACK_DAYS)
        candidates = (
            db.query(POLineItem)
            .join(PurchaseOrder)
            .filter(
                POLineItem.sku == new_line_item.sku,
                POLineItem.purchase_order_id != new_po.id,
                PurchaseOrder.created_at >= cutoff,
            )
            .all()
        )
        for candidate in candidates:
            existing_po = candidate.purchase_order
            same_project = existing_po.project_id == new_po.project_id
            different_team = existing_po.requesting_team != new_po.requesting_team
            overlapping = _windows_overlap(
                new_po.delivery_window_start,
                new_po.delivery_window_end,
                existing_po.delivery_window_start,
                existing_po.delivery_window_end,
            )
            severity = _severity_for(
                is_exact_sku=True,
                same_project=same_project,
                overlapping_window=overlapping,
                different_team=different_team,
            )
            matches.append(
                DuplicateMatch(
                    existing_po_id=existing_po.id,
                    existing_po_line_item_id=candidate.id,
                    existing_item_name=candidate.item_name,
                    existing_team=existing_po.requesting_team,
                    similarity_score=1.0,
                    severity=severity,
                    estimated_savings_if_merged=_estimated_savings(new_line_item, candidate),
                )
            )
            matched_line_item_ids.add(candidate.id)

    # --- Pass 2: fuzzy match via embedding cosine similarity ---------------------
    embedding = new_embedding if new_embedding is not None else new_line_item.description_embedding
    if embedding:
        candidates = (
            db.query(POLineItem)
            .filter(
                POLineItem.purchase_order_id != new_po.id,
                POLineItem.description_embedding.isnot(None),
            )
            .all()
        )
        for candidate in candidates:
            if candidate.id in matched_line_item_ids:
                continue  # already caught by the exact-SKU pass
            similarity = _cosine_similarity(embedding, candidate.description_embedding)
            if similarity <= FUZZY_SIMILARITY_THRESHOLD:
                continue

            existing_po = candidate.purchase_order
            same_project = existing_po.project_id == new_po.project_id
            different_team = existing_po.requesting_team != new_po.requesting_team
            overlapping = _windows_overlap(
                new_po.delivery_window_start,
                new_po.delivery_window_end,
                existing_po.delivery_window_start,
                existing_po.delivery_window_end,
            )
            severity = _severity_for(
                is_exact_sku=False,
                same_project=same_project,
                overlapping_window=overlapping,
                different_team=different_team,
            )
            matches.append(
                DuplicateMatch(
                    existing_po_id=existing_po.id,
                    existing_po_line_item_id=candidate.id,
                    existing_item_name=candidate.item_name,
                    existing_team=existing_po.requesting_team,
                    similarity_score=round(similarity, 4),
                    severity=severity,
                    estimated_savings_if_merged=_estimated_savings(new_line_item, candidate),
                )
            )

    severity_rank = {"exact_duplicate": 3, "likely_duplicate": 2, "possible_overlap": 1}
    matches.sort(key=lambda m: (severity_rank[m.severity], m.similarity_score), reverse=True)

    if matches:
        top_severity = matches[0].severity
        overall_severity = {
            "exact_duplicate": EvidenceSeverity.CRITICAL,
            "likely_duplicate": EvidenceSeverity.WARNING,
            "possible_overlap": EvidenceSeverity.INFO,
        }[top_severity]
    else:
        overall_severity = EvidenceSeverity.INFO

    writes_to: list[str] = []
    if new_po.vendor_id and any(m.severity in ("exact_duplicate", "likely_duplicate") for m in matches):
        writes_to.append(f"vendor:{new_po.vendor_id}:trust_score")

    summary = EvidenceResult(
        feature="duplicate_checker",
        severity=overall_severity,
        title=f"Duplicate check for '{new_line_item.item_name}'",
        summary=(
            f"Found {len(matches)} potential duplicate/overlapping order(s) "
            f"for '{new_line_item.item_name}'."
            if matches
            else f"No duplicate or overlapping orders found for '{new_line_item.item_name}'."
        ),
        writes_to=writes_to,
        detail={"match_count": len(matches)},
    )

    return DuplicateCheckResult(
        new_po_line_item_id=new_line_item.id,
        new_item_name=new_line_item.item_name,
        matches=matches,
        summary=summary,
    )
