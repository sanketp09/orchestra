"""
LangGraph StateGraph for the AI Site Walk feature.

Node flow:
  load_po_context -> sample_frames -> detect_per_frame -> deduplicate
    -> match_against_po -> [conditional] -> flag_for_review -> finalize
                                          -> finalize
"""

from __future__ import annotations

import operator
import uuid
from typing import Annotated, Any, Literal, TypedDict

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from sqlalchemy.orm import Session

from app.models.inventory import DetectedItem as DetectedItemModel
from app.models.inventory import POLineItem, PurchaseOrder, SiteWalkSession
from app.schemas.evidence import EvidenceResult, EvidenceSeverity
from app.schemas.site_walk import DetectedItem, POMatch, SiteWalkResult
from app.services import vision_detector
from app.services.video_processor import extract_frames

# Detections within this many seconds of each other, in the same category, are
# treated as the same physical item re-observed in consecutive frames.
DEDUPLICATION_WINDOW_SECONDS = 3.0
LOW_CONFIDENCE_THRESHOLD = 0.6


class SiteWalkState(TypedDict, total=False):
    video_path: str
    session_id: str
    po_line_items: list[dict]
    frames: list[Any]
    raw_detections: Annotated[list[DetectedItem], operator.add]
    deduplicated: list[DetectedItem]
    matched: SiteWalkResult
    needs_review: bool


def _load_po_context(db: Session):
    """Return a node function bound to a db session (dependency-injected for testability)."""

    def node(state: SiteWalkState) -> dict:
        session_id = state["session_id"]
        session = db.get(SiteWalkSession, session_id)
        if session is None:
            raise ValueError(f"SiteWalkSession {session_id} not found")

        line_items = (
            db.query(POLineItem)
            .join(PurchaseOrder)
            .filter(PurchaseOrder.project_id == session.project_id)
            .all()
        )
        po_line_items = [
            {
                "id": li.id,
                "item_name": li.item_name,
                "sku": li.sku,
                "expected_qty": li.expected_qty,
                "unit": li.unit,
                # naive category derivation from item name; a real taxonomy
                # table would replace this once one exists.
                "category": li.item_name.lower(),
            }
            for li in line_items
        ]
        return {"po_line_items": po_line_items}

    return node


def _sample_frames(state: SiteWalkState) -> dict:
    frames = extract_frames(state["video_path"], interval_seconds=2.0, max_frames=20)
    return {"frames": frames}


def _detect_per_frame(state: SiteWalkState) -> dict:
    taxonomy = sorted({item["category"] for item in state["po_line_items"]})
    if not taxonomy:
        # No PO context to ground detection against — nothing to detect.
        return {"raw_detections": []}

    all_detections: list[DetectedItem] = []
    for frame in state["frames"]:
        detections = vision_detector.detect_items_in_frame(frame, taxonomy)
        all_detections.extend(detections)

    return {"raw_detections": all_detections}

def _deduplicate(state: SiteWalkState) -> dict:
    """
    Merge detections of the same item across consecutive frames. Heuristic:
    same category detected within DEDUPLICATION_WINDOW_SECONDS = same
    physical item, keep the highest-confidence observation and sum distinct
    quantity observations conservatively (take the max rather than summing,
    since the same physical items are likely being re-observed, not new ones).
    """
    detections = sorted(state["raw_detections"], key=lambda d: d.frame_timestamp)

    clusters: list[list[DetectedItem]] = []
    for det in detections:
        placed = False
        for cluster in clusters:
            last = cluster[-1]
            if (
                last.category == det.category
                and (det.frame_timestamp - last.frame_timestamp) <= DEDUPLICATION_WINDOW_SECONDS
            ):
                cluster.append(det)
                placed = True
                break
        if not placed:
            clusters.append([det])

    deduplicated: list[DetectedItem] = []
    for cluster in clusters:
        best = max(cluster, key=lambda d: d.confidence)
        # Prefer "damaged" if any observation in the cluster flagged damage —
        # damage shouldn't get averaged away.
        condition = "damaged" if any(d.condition == "damaged" for d in cluster) else best.condition
        merged_qty = max(d.estimated_qty for d in cluster)
        deduplicated.append(
            DetectedItem(
                name=best.name,
                category=best.category,
                estimated_qty=merged_qty,
                condition=condition,
                confidence=best.confidence,
                bounding_box=best.bounding_box,
                frame_number=best.frame_number,
                frame_timestamp=best.frame_timestamp,
            )
        )

    return {"deduplicated": deduplicated}


def _match_against_po(state: SiteWalkState) -> dict:
    po_matches: list[POMatch] = []
    missing_items: list[str] = []
    damaged_items: list[DetectedItem] = []
    needs_review = False

    for line in state["po_line_items"]:
        matching = [d for d in state["deduplicated"] if d.category == line["category"]]
        detected_qty = sum(d.estimated_qty for d in matching)
        delta = line["expected_qty"] - detected_qty

        po_matches.append(
            POMatch(
                po_line_item_id=line["id"],
                item_name=line["item_name"],
                sku=line.get("sku"),
                expected_qty=line["expected_qty"],
                detected_qty=detected_qty,
                delta=delta,
                unit=line["unit"],
            )
        )

        if detected_qty == 0:
            missing_items.append(line["item_name"])

        for d in matching:
            if d.condition == "damaged":
                damaged_items.append(d)
            if d.confidence < LOW_CONFIDENCE_THRESHOLD:
                needs_review = True

    if damaged_items:
        needs_review = True

    result_stub = {
        "po_matches": [m.model_dump() for m in po_matches],
        "missing_items": missing_items,
        "damaged_items": [d.model_dump() for d in damaged_items],
    }

    return {
        "matched": result_stub,  # finalized into a real SiteWalkResult in `finalize`
        "needs_review": needs_review,
    }


def _route_after_matching(state: SiteWalkState) -> Literal["flag_for_review", "finalize"]:
    return "flag_for_review" if state.get("needs_review") else "finalize"


def _flag_for_review(state: SiteWalkState) -> dict:
    # No state mutation needed beyond what's already set — this node exists so
    # the graph run is inspectable (via the checkpointer) as having gone
    # through an explicit review-flagging step, e.g. for audit/logging hooks.
    return {}

def _finalize(db: Session, vendor_lookup: dict[str, str] | None = None):
    """Return a node function bound to a db session (dependency-injected)."""

    vendor_lookup = vendor_lookup or {}

    def node(state: SiteWalkState) -> dict:
        session_id = state["session_id"]
        matched = state["matched"]
        damaged_items = [DetectedItem(**d) for d in matched["damaged_items"]]
        po_matches = [POMatch(**m) for m in matched["po_matches"]]
        missing_items = matched["missing_items"]

        shortages = [m for m in po_matches if m.delta > 0]
        severity = EvidenceSeverity.INFO
        if damaged_items or any(m.delta > 0 for m in shortages):
            severity = EvidenceSeverity.WARNING
        if any(m.delta > 0 and m.expected_qty > 0 and m.detected_qty == 0 for m in shortages):
            severity = EvidenceSeverity.CRITICAL

        writes_to: list[str] = []
        vendor_id = vendor_lookup.get(session_id)
        if vendor_id and (shortages or damaged_items):
            writes_to.append(f"vendor:{vendor_id}:trust_score")

        summary = EvidenceResult(
            feature="site_walk",
            severity=severity,
            title=f"Site walk for session {session_id}",
            summary=(
                f"Detected {len(state['deduplicated'])} distinct items across "
                f"{len(state['frames'])} sampled frames. "
                f"{len(missing_items)} PO line item(s) missing entirely, "
                f"{len(damaged_items)} item(s) flagged damaged."
            ),
            writes_to=writes_to,
            detail={
                "missing_items": missing_items,
                "damaged_item_count": len(damaged_items),
                "shortage_count": len(shortages),
            },
        )

        result = SiteWalkResult(
            session_id=session_id,
            detected_items=state["deduplicated"],
            po_matches=po_matches,
            missing_items=missing_items,
            damaged_items=damaged_items,
            summary=summary,
        )

        db_session = db.get(SiteWalkSession, session_id)
        if db_session is not None:
            db_session.status = "complete"
            db_session.result = result.model_dump(mode="json")
            for item in state["deduplicated"]:
                db.add(
                    DetectedItemModel(
                        id=str(uuid.uuid4()),
                        session_id=session_id,
                        name=item.name,
                        category=item.category,
                        detected_qty=item.estimated_qty,
                        condition=item.condition,
                        confidence=item.confidence,
                        frame_timestamp=item.frame_timestamp,
                        bounding_box=item.bounding_box,
                    )
                )
            db.commit()

        return {"matched": result}

    return node


def build_site_walk_graph(db: Session, vendor_lookup: dict[str, str] | None = None):
    """
    Construct and compile the Site Walk LangGraph, with nodes bound to a real
    db session so the graph can be exercised in tests against an in-memory or
    real Postgres session interchangeably.
    """
    graph = StateGraph(SiteWalkState)

    graph.add_node("load_po_context", _load_po_context(db))
    graph.add_node("sample_frames", _sample_frames)
    graph.add_node("detect_per_frame", _detect_per_frame)
    graph.add_node("deduplicate", _deduplicate)
    graph.add_node("match_against_po", _match_against_po)
    graph.add_node("flag_for_review", _flag_for_review)
    graph.add_node("finalize", _finalize(db, vendor_lookup))

    graph.set_entry_point("load_po_context")
    graph.add_edge("load_po_context", "sample_frames")
    graph.add_edge("sample_frames", "detect_per_frame")
    graph.add_edge("detect_per_frame", "deduplicate")
    graph.add_edge("deduplicate", "match_against_po")
    graph.add_conditional_edges(
        "match_against_po",
        _route_after_matching,
        {"flag_for_review": "flag_for_review", "finalize": "finalize"},
    )
    graph.add_edge("flag_for_review", "finalize")
    graph.add_edge("finalize", END)

    checkpointer = MemorySaver()
    return graph.compile(checkpointer=checkpointer)
