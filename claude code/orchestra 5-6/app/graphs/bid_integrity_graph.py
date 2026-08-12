"""
Three deterministic analytical nodes feeding one LLM synthesis node. The LLM never does
the statistics — it only explains findings the deterministic nodes already produced.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import TypedDict

from langgraph.graph import END, StateGraph
from sqlalchemy.orm import Session

from app.core.evidence import write_evidence
from app.core.llm import call_claude_structured
from app.models.bids import Bid, BidLineItem
from app.schemas.bids import (
    BidIntegrityResult,
    PriceOutlier,
    SharedEntityMatch,
    SynchronizationSignal,
)
from app.schemas.shared import EvidenceResult
from app.services.price_outlier import detect_price_outliers
from app.services.shared_entity_checker import find_shared_entities
from app.services.synchronization_detector import detect_synchronization

HISTORICAL_WINDOW_DAYS = 365

SYNTHESIS_SYSTEM_PROMPT = (
    "You are writing the human-readable explanation for a bid integrity check. You are "
    "given the exact findings three deterministic detectors already produced: statistical "
    "price outliers, historical pricing-synchronization signals, and shared-registration "
    "matches between vendors. Do not invent new findings or recompute anything yourself — "
    "only explain what is here, in plain language a procurement officer can act on, and "
    "assign an overall verdict and confidence based on how strong the combined evidence is. "
    "An isolated weak signal should read as 'needs_review', not 'flagged'; multiple "
    "independent signals corroborating each other should read as 'flagged'; no signals at "
    "all should read as 'clear'."
)

SYNTHESIS_TOOL_SCHEMA = {
    "type": "object",
    "properties": {
        "reasoning": {"type": "string"},
        "verdict": {"type": "string", "enum": ["flagged", "clear", "needs_review"]},
        "confidence": {"type": "number"},
    },
    "required": ["reasoning", "verdict", "confidence"],
}


class BidIntegrityState(TypedDict):
    package_id: str
    db: Session
    bids: list[Bid]
    line_items: list[BidLineItem]
    historical_bids: list[Bid]
    historical_line_items: list[BidLineItem]
    price_outliers: list[PriceOutlier]
    sync_signals: list[SynchronizationSignal]
    shared_entities: list[SharedEntityMatch]
    result: BidIntegrityResult


def load_bid_context(state: BidIntegrityState) -> BidIntegrityState:
    db = state["db"]
    package_id = state["package_id"]

    bids = db.query(Bid).filter(Bid.package_id == package_id).all()
    bid_ids = [b.id for b in bids]
    line_items = (
        db.query(BidLineItem).filter(BidLineItem.bid_id.in_(bid_ids)).all() if bid_ids else []
    )

    vendor_ids = [b.vendor_id for b in bids]
    cutoff = datetime.utcnow() - timedelta(days=HISTORICAL_WINDOW_DAYS)
    historical_bids = (
        db.query(Bid).filter(Bid.vendor_id.in_(vendor_ids), Bid.submitted_at >= cutoff).all()
        if vendor_ids
        else []
    )
    hist_bid_ids = [b.id for b in historical_bids]
    historical_line_items = (
        db.query(BidLineItem).filter(BidLineItem.bid_id.in_(hist_bid_ids)).all()
        if hist_bid_ids
        else []
    )

    return {
        **state,
        "bids": bids,
        "line_items": line_items,
        "historical_bids": historical_bids,
        "historical_line_items": historical_line_items,
    }


def price_outlier_node(state: BidIntegrityState) -> BidIntegrityState:
    outliers = detect_price_outliers(state["bids"], state["line_items"])
    return {**state, "price_outliers": outliers}


def synchronization_node(state: BidIntegrityState) -> BidIntegrityState:
    signals = detect_synchronization(state["historical_bids"], state["historical_line_items"])
    return {**state, "sync_signals": signals}


def shared_entity_node(state: BidIntegrityState) -> BidIntegrityState:
    vendor_ids = [b.vendor_id for b in state["bids"]]
    matches = find_shared_entities(vendor_ids, state["db"])
    return {**state, "shared_entities": matches}


async def synthesis_node(state: BidIntegrityState) -> BidIntegrityState:
    findings = {
        "price_outliers": [o.model_dump() for o in state["price_outliers"] if o.flagged],
        "synchronization_signals": [s.model_dump() for s in state["sync_signals"]],
        "shared_entities": [m.model_dump() for m in state["shared_entities"]],
    }

    output = await call_claude_structured(
        system=SYNTHESIS_SYSTEM_PROMPT,
        user_content=str(findings),
        tool_schema=SYNTHESIS_TOOL_SCHEMA,
        tool_name="submit_bid_integrity_summary",
    )
    summary = EvidenceResult(**output)

    result = BidIntegrityResult(
        package_id=state["package_id"],
        price_outliers=state["price_outliers"],
        synchronization_signals=state["sync_signals"],
        shared_entities=state["shared_entities"],
        summary=summary,
    )
    return {**state, "result": result}


def finalize_node(state: BidIntegrityState) -> BidIntegrityState:
    result = state["result"]
    bids_by_id = {b.id: b for b in state["bids"]}

    flagged_vendor_ids: set[str] = set()
    for outlier in result.price_outliers:
        if outlier.flagged and (bid := bids_by_id.get(outlier.bid_id)):
            flagged_vendor_ids.add(bid.vendor_id)
    for signal in result.synchronization_signals:
        flagged_vendor_ids.update([signal.vendor_a, signal.vendor_b])
    for match in result.shared_entities:
        flagged_vendor_ids.update([match.vendor_a, match.vendor_b])

    writes_to = [f"vendor:{vendor_id}:trust_score" for vendor_id in flagged_vendor_ids]
    write_evidence(writes_to, result.model_dump())

    # Persist to Postgres here, e.g.:
    #   db.add(BidIntegrityRecord(**result.model_dump())); db.commit()
    # Left out since the concrete insert pattern should match whatever the rest of the
    # app already uses for persisting feature results.

    return {**state, "result": result}


def build_bid_integrity_graph():
    graph = StateGraph(BidIntegrityState)
    graph.add_node("load_bid_context", load_bid_context)
    graph.add_node("price_outlier_node", price_outlier_node)
    graph.add_node("synchronization_node", synchronization_node)
    graph.add_node("shared_entity_node", shared_entity_node)
    graph.add_node("synthesis_node", synthesis_node)
    graph.add_node("finalize_node", finalize_node)

    graph.set_entry_point("load_bid_context")
    graph.add_edge("load_bid_context", "price_outlier_node")
    graph.add_edge("price_outlier_node", "synchronization_node")
    graph.add_edge("synchronization_node", "shared_entity_node")
    graph.add_edge("shared_entity_node", "synthesis_node")
    graph.add_edge("synthesis_node", "finalize_node")
    graph.add_edge("finalize_node", END)

    return graph.compile()
