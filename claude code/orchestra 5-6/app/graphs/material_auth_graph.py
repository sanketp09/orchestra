"""
Optional confidence-escalation graph for Material Authentication:

    extract_stamp -> match_against_reference -> conditional edge -> finalize | flag_for_human_review

This feature's logic is simple enough that a plain FastAPI route calling both service
functions in sequence would be a completely defensible choice instead. This graph is
included because the escalation-branch pattern is worth having in the codebase once —
Trustline's Hidden Ownership Detector will want the same shape.
"""
from __future__ import annotations

from typing import Literal, Optional, TypedDict

from langgraph.graph import END, StateGraph
from sqlalchemy.orm import Session

from app.core.evidence import write_evidence
from app.schemas.materials import ExtractedStampData, MaterialAuthResult
from app.schemas.shared import EvidenceResult
from app.services.stamp_extractor import extract_stamp_data
from app.services.stamp_matcher import match_against_reference


class MaterialAuthState(TypedDict):
    photo_path: str
    claimed_manufacturer: str
    po_line_item_id: Optional[str]
    db: Session
    extracted: ExtractedStampData
    match_score: float
    verdict: Literal["verified", "contradicted", "uncertain"]
    needs_human: bool
    result: MaterialAuthResult


async def extract_stamp_node(state: MaterialAuthState) -> MaterialAuthState:
    extracted = await extract_stamp_data(state["photo_path"])
    return {**state, "extracted": extracted}


def match_node(state: MaterialAuthState) -> MaterialAuthState:
    score, verdict, needs_human = match_against_reference(
        state["extracted"], state["claimed_manufacturer"], state["db"]
    )
    return {**state, "match_score": score, "verdict": verdict, "needs_human": needs_human}


def _route_on_confidence(state: MaterialAuthState) -> str:
    return "flag_for_human_review" if state["needs_human"] else "finalize"


def _build_result(state: MaterialAuthState, reasoning_suffix: str) -> MaterialAuthResult:
    summary = EvidenceResult(
        reasoning=(
            f"Extracted stamp compared against {state['claimed_manufacturer']}'s reference "
            f"pattern with a match score of {state['match_score']}. {reasoning_suffix}"
        ),
        verdict="needs_review"
        if state["needs_human"]
        else ("clear" if state["verdict"] == "verified" else "flagged"),
        confidence=state["match_score"],
    )
    return MaterialAuthResult(
        claimed_manufacturer=state["claimed_manufacturer"],
        extracted=state["extracted"],
        match_score=state["match_score"],
        verdict=state["verdict"],
        summary=summary,
    )


def _persist(state: MaterialAuthState, result: MaterialAuthResult) -> None:
    writes_to = [f"vendor:{state['claimed_manufacturer']}:material_trust"]
    # Stretch goal from the plan: pattern drift per mill feeds Trustline as a supply-chain
    # risk signal, not just a one-off inspection result.
    writes_to.append(f"mill:{state['claimed_manufacturer']}:reliability")
    write_evidence(writes_to, result.model_dump())
    # Persist a MaterialInspection row here via state["db"]; omitted since the concrete
    # insert pattern should match whatever the rest of the app already uses.


def finalize_node(state: MaterialAuthState) -> MaterialAuthState:
    result = _build_result(state, "Confidence was clear enough to resolve automatically.")
    _persist(state, result)
    return {**state, "result": result}


def flag_for_human_review_node(state: MaterialAuthState) -> MaterialAuthState:
    result = _build_result(
        state,
        "Match score fell in the ambiguous band — routed to human review rather than "
        "forcing a verdict.",
    )
    _persist(state, result)
    return {**state, "result": result}


def build_material_auth_graph():
    graph = StateGraph(MaterialAuthState)
    graph.add_node("extract_stamp", extract_stamp_node)
    graph.add_node("match_against_reference", match_node)
    graph.add_node("finalize", finalize_node)
    graph.add_node("flag_for_human_review", flag_for_human_review_node)

    graph.set_entry_point("extract_stamp")
    graph.add_edge("extract_stamp", "match_against_reference")
    graph.add_conditional_edges(
        "match_against_reference",
        _route_on_confidence,
        {"finalize": "finalize", "flag_for_human_review": "flag_for_human_review"},
    )
    graph.add_edge("finalize", END)
    graph.add_edge("flag_for_human_review", END)

    return graph.compile()
