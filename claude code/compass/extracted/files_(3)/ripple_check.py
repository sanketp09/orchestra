"""
COMPASS — Ripple Check
POST /api/compass/ripple-check

"What else does this decision affect?"

Builds a dependency graph for a proposed procurement decision (e.g. swapping
one transformer spec for another) and traverses it to compute the blast
radius: how many concrete dependencies it touches, how many trade packages
and milestones sit on the affected path, and the aggregate cost/schedule
exposure.

Deterministic — no LLM. Only the raw graph (nodes, edges, per-node cost and
schedule deltas) is seeded; everything in `impact_summary` is computed by
traversing that graph, not hardcoded.
"""

from __future__ import annotations

from enum import Enum

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/compass", tags=["compass"])


# ---------------------------------------------------------------------------
# Graph schema
# ---------------------------------------------------------------------------

class NodeCategory(str, Enum):
    DECISION = "decision"
    SPEC = "spec"
    TRADE = "trade"
    MATERIAL = "material"
    SCHEDULE = "schedule"
    COST = "cost"
    COMMISSIONING = "commissioning"
    MILESTONE = "milestone"


class Relationship(str, Enum):
    REFERENCES = "references"
    DEPENDS_ON = "depends_on"
    BLOCKS = "blocks"
    SCHEDULED_BEFORE = "scheduled_before"


class EvidenceType(str, Enum):
    DRAWING = "drawing"
    SPECIFICATION = "specification"
    SCHEDULE = "schedule"
    PURCHASE_PACKAGE = "purchase_package"


class EvidenceRef(BaseModel):
    type: EvidenceType
    label: str


class GraphNodeSeed(BaseModel):
    """Raw seeded node. Aggregate cost/schedule values are computed by
    traversal in `_traverse_and_score`, not stored here directly (except for
    the leaf-level deltas the rollups are built from)."""

    id: str
    label: str
    category: NodeCategory
    parent_id: str | None
    relationship: Relationship | None  # edge label FROM parent TO this node
    description: str
    evidence: list[EvidenceRef] = Field(default_factory=list)
    cost_usd_delta: float = 0
    schedule_days_delta: float = 0
    on_critical_path: bool = False


# ---------------------------------------------------------------------------
# Response schema
# ---------------------------------------------------------------------------

class RippleNode(BaseModel):
    id: str
    label: str
    category: NodeCategory
    tier: int  # 0 decision, 1 direct impact, 2 secondary impact, 3 project impact
    description: str
    evidence: list[EvidenceRef]
    cost_usd_impact: float
    schedule_days_impact: float
    on_critical_path: bool


class RippleEdge(BaseModel):
    source: str
    target: str
    relationship: Relationship


class ImpactSummary(BaseModel):
    dependencies_found: int  # count of tier-2 (secondary/leaf) items
    direct_dependencies: int  # count of tier-1 category nodes actually touched
    secondary_dependencies: int  # same population as dependencies_found, named
    # separately since the two ripple tiers are conceptually distinct
    affected_trades: int
    affected_milestones: int
    cost_impact_usd: float
    schedule_impact_days: float


class RippleCheckRequest(BaseModel):
    decision_id: str
    decision_label: str | None = None


class RippleCheckResponse(BaseModel):
    decision_id: str
    decision_label: str
    nodes: list[RippleNode]
    edges: list[RippleEdge]
    impact_summary: ImpactSummary
    evidence: list[EvidenceRef]  # deduplicated evidence across the whole graph
    confidence: float
    reasoning: str


# ---------------------------------------------------------------------------
# Seeded demo data — two decision options for the same underlying problem,
# so switching between them ("Change Decision") demonstrates a genuinely
# different blast radius rather than reshuffling the same numbers.
# ---------------------------------------------------------------------------

_TRANSFORMER_B_SEEDS: list[GraphNodeSeed] = [
    GraphNodeSeed(
        id="decision",
        label="Replace Transformer A → Transformer B (2500kVA Dry-Type, ElectroCorp)",
        category=NodeCategory.DECISION,
        parent_id=None,
        relationship=None,
        description="Proposed substitution of the specified dry-type transformer for an equivalent unit from a different manufacturer.",
        evidence=[EvidenceRef(type=EvidenceType.PURCHASE_PACKAGE, label="PO-3381 — Transformer A")],
    ),
    # --- Direct impact: category nodes ---
    GraphNodeSeed(
        id="cat_spec", label="Specification", category=NodeCategory.SPEC,
        parent_id="decision", relationship=Relationship.REFERENCES,
        description="Electrical equipment specification governing transformer selection.",
    ),
    GraphNodeSeed(
        id="cat_trade", label="Trade Packages", category=NodeCategory.TRADE,
        parent_id="decision", relationship=Relationship.DEPENDS_ON,
        description="Subcontractor packages whose scope depends on the installed transformer.",
    ),
    GraphNodeSeed(
        id="cat_material", label="Material", category=NodeCategory.MATERIAL,
        parent_id="decision", relationship=Relationship.DEPENDS_ON,
        description="Materials sized or selected around the transformer's electrical characteristics.",
    ),
    GraphNodeSeed(
        id="cat_schedule", label="Schedule", category=NodeCategory.SCHEDULE,
        parent_id="decision", relationship=Relationship.BLOCKS,
        description="Installation sequencing tied to transformer delivery and footprint.",
    ),
    GraphNodeSeed(
        id="cat_cost", label="Cost", category=NodeCategory.COST,
        parent_id="decision", relationship=Relationship.DEPENDS_ON,
        description="Aggregate cost exposure rolled up from every affected dependency.",
    ),
    GraphNodeSeed(
        id="cat_commissioning", label="Commissioning", category=NodeCategory.COMMISSIONING,
        parent_id="decision", relationship=Relationship.BLOCKS,
        description="Test and turnover plan tied to the installed equipment's specifications.",
    ),
    # --- Secondary impact: concrete leaf items ---
    GraphNodeSeed(
        id="spec_1", label="Electrical Spec — Section 26 05 00", category=NodeCategory.SPEC,
        parent_id="cat_spec", relationship=Relationship.REFERENCES,
        description="Base spec section references Transformer A by model number; needs a substitution addendum.",
        evidence=[EvidenceRef(type=EvidenceType.SPECIFICATION, label="Spec Section 26 05 00, Rev 3")],
        cost_usd_delta=500,
    ),
    GraphNodeSeed(
        id="trade_1", label="Electrical Package — ABC Electric Co.", category=NodeCategory.TRADE,
        parent_id="cat_trade", relationship=Relationship.DEPENDS_ON,
        description="Termination and conduit rough-in sized to Transformer A's connection points.",
        evidence=[EvidenceRef(type=EvidenceType.PURCHASE_PACKAGE, label="Subcontract SC-114 — ABC Electric")],
        cost_usd_delta=9000,
    ),
    GraphNodeSeed(
        id="trade_2", label="Low-Voltage Controls — XYZ Systems", category=NodeCategory.TRADE,
        parent_id="cat_trade", relationship=Relationship.SCHEDULED_BEFORE,
        description="Controls integration is sequenced immediately after transformer energization.",
        evidence=[EvidenceRef(type=EvidenceType.SCHEDULE, label="Look-Ahead Schedule, Week 34")],
        cost_usd_delta=6000,
    ),
    GraphNodeSeed(
        id="trade_3", label="Concrete Foundation Package — Foundation Co.", category=NodeCategory.TRADE,
        parent_id="cat_trade", relationship=Relationship.DEPENDS_ON,
        description="Pad dimensions and anchor layout are specific to Transformer A's footprint and weight.",
        evidence=[EvidenceRef(type=EvidenceType.DRAWING, label="Dwg E-501 — Transformer Pad Detail")],
        cost_usd_delta=12500, schedule_days_delta=3, on_critical_path=False,
    ),
    GraphNodeSeed(
        id="material_1", label="500 MCM Feeder Cable — Reorder Required", category=NodeCategory.MATERIAL,
        parent_id="cat_material", relationship=Relationship.DEPENDS_ON,
        description="Transformer B's terminal lugs require a different feeder gauge than what's already on order.",
        evidence=[EvidenceRef(type=EvidenceType.PURCHASE_PACKAGE, label="PO-3402 — Feeder Cable")],
        cost_usd_delta=11000, schedule_days_delta=3, on_critical_path=True,
    ),
    GraphNodeSeed(
        id="schedule_1", label="Substation Rough-In Sequence", category=NodeCategory.SCHEDULE,
        parent_id="cat_schedule", relationship=Relationship.BLOCKS,
        description="Rough-in sequence assumes Transformer A's delivery window and dimensions.",
        evidence=[EvidenceRef(type=EvidenceType.SCHEDULE, label="Master Schedule, Activity A-2201")],
        cost_usd_delta=2000, schedule_days_delta=2, on_critical_path=True,
    ),
    GraphNodeSeed(
        id="commissioning_1", label="Commissioning Test Plan Revision", category=NodeCategory.COMMISSIONING,
        parent_id="cat_commissioning", relationship=Relationship.SCHEDULED_BEFORE,
        description="Factory and field test procedures are written against Transformer A's technical data sheet.",
        evidence=[EvidenceRef(type=EvidenceType.SPECIFICATION, label="Commissioning Plan, Section 4.2")],
        cost_usd_delta=1000, schedule_days_delta=1, on_critical_path=True,
    ),
    # --- Project impact: milestones ---
    GraphNodeSeed(
        id="milestone_1", label="Substation Energization Milestone", category=NodeCategory.MILESTONE,
        parent_id="schedule_1", relationship=Relationship.BLOCKS,
        description="Cannot energize the substation until the installed transformer and its documentation reconcile.",
        evidence=[EvidenceRef(type=EvidenceType.SCHEDULE, label="Master Schedule, Milestone M-14")],
    ),
    GraphNodeSeed(
        id="milestone_2", label="Building Turnover Milestone", category=NodeCategory.MILESTONE,
        parent_id="milestone_1", relationship=Relationship.SCHEDULED_BEFORE,
        description="Turnover is sequenced after substation energization.",
        evidence=[EvidenceRef(type=EvidenceType.SCHEDULE, label="Master Schedule, Milestone M-19")],
    ),
]

# Same underlying problem, a lower-risk alternative: oil-filled unit that
# keeps Transformer A's footprint and feeder gauge, so Material never gets
# touched and one fewer trade/milestone sits on the affected path.
_TRANSFORMER_C_SEEDS: list[GraphNodeSeed] = [
    GraphNodeSeed(
        id="decision",
        label="Replace Transformer A → Transformer C (2500kVA Oil-Filled, PowerTech)",
        category=NodeCategory.DECISION,
        parent_id=None,
        relationship=None,
        description="Alternate substitution that preserves Transformer A's footprint and feeder termination.",
        evidence=[EvidenceRef(type=EvidenceType.PURCHASE_PACKAGE, label="PO-3381 — Transformer A")],
    ),
    GraphNodeSeed(
        id="cat_spec", label="Specification", category=NodeCategory.SPEC,
        parent_id="decision", relationship=Relationship.REFERENCES,
        description="Electrical equipment specification governing transformer selection.",
    ),
    GraphNodeSeed(
        id="cat_trade", label="Trade Packages", category=NodeCategory.TRADE,
        parent_id="decision", relationship=Relationship.DEPENDS_ON,
        description="Subcontractor packages whose scope depends on the installed transformer.",
    ),
    GraphNodeSeed(
        id="cat_material", label="Material", category=NodeCategory.MATERIAL,
        parent_id="decision", relationship=Relationship.DEPENDS_ON,
        description="Materials sized or selected around the transformer's electrical characteristics. "
        "Not triggered for this option — same footprint and feeder termination as Transformer A.",
    ),
    GraphNodeSeed(
        id="cat_schedule", label="Schedule", category=NodeCategory.SCHEDULE,
        parent_id="decision", relationship=Relationship.BLOCKS,
        description="Installation sequencing tied to transformer delivery and footprint.",
    ),
    GraphNodeSeed(
        id="cat_cost", label="Cost", category=NodeCategory.COST,
        parent_id="decision", relationship=Relationship.DEPENDS_ON,
        description="Aggregate cost exposure rolled up from every affected dependency.",
    ),
    GraphNodeSeed(
        id="cat_commissioning", label="Commissioning", category=NodeCategory.COMMISSIONING,
        parent_id="decision", relationship=Relationship.BLOCKS,
        description="Test and turnover plan tied to the installed equipment's specifications.",
    ),
    GraphNodeSeed(
        id="spec_1", label="Electrical Spec — Section 26 05 00", category=NodeCategory.SPEC,
        parent_id="cat_spec", relationship=Relationship.REFERENCES,
        description="Base spec section references Transformer A by model number; needs a substitution addendum.",
        evidence=[EvidenceRef(type=EvidenceType.SPECIFICATION, label="Spec Section 26 05 00, Rev 3")],
        cost_usd_delta=500,
    ),
    GraphNodeSeed(
        id="trade_1", label="Electrical Package — ABC Electric Co.", category=NodeCategory.TRADE,
        parent_id="cat_trade", relationship=Relationship.DEPENDS_ON,
        description="Termination points are compatible, but oil-filled clearance code requires a minor conduit revision.",
        evidence=[EvidenceRef(type=EvidenceType.PURCHASE_PACKAGE, label="Subcontract SC-114 — ABC Electric")],
        cost_usd_delta=6000,
    ),
    GraphNodeSeed(
        id="trade_2", label="Low-Voltage Controls — XYZ Systems", category=NodeCategory.TRADE,
        parent_id="cat_trade", relationship=Relationship.SCHEDULED_BEFORE,
        description="Controls integration is sequenced immediately after transformer energization.",
        evidence=[EvidenceRef(type=EvidenceType.SCHEDULE, label="Look-Ahead Schedule, Week 34")],
        cost_usd_delta=4500,
    ),
    GraphNodeSeed(
        id="schedule_1", label="Substation Rough-In Sequence", category=NodeCategory.SCHEDULE,
        parent_id="cat_schedule", relationship=Relationship.BLOCKS,
        description="Rough-in sequence assumes Transformer A's delivery window; footprint is unchanged for this option.",
        evidence=[EvidenceRef(type=EvidenceType.SCHEDULE, label="Master Schedule, Activity A-2201")],
        cost_usd_delta=2000, schedule_days_delta=2, on_critical_path=True,
    ),
    GraphNodeSeed(
        id="commissioning_1", label="Commissioning Test Plan Revision", category=NodeCategory.COMMISSIONING,
        parent_id="cat_commissioning", relationship=Relationship.SCHEDULED_BEFORE,
        description="Factory and field test procedures are written against Transformer A's technical data sheet.",
        evidence=[EvidenceRef(type=EvidenceType.SPECIFICATION, label="Commissioning Plan, Section 4.2")],
        cost_usd_delta=1000, schedule_days_delta=1, on_critical_path=True,
    ),
    GraphNodeSeed(
        id="milestone_1", label="Substation Energization Milestone", category=NodeCategory.MILESTONE,
        parent_id="schedule_1", relationship=Relationship.BLOCKS,
        description="Cannot energize the substation until the installed transformer and its documentation reconcile.",
        evidence=[EvidenceRef(type=EvidenceType.SCHEDULE, label="Master Schedule, Milestone M-14")],
    ),
]

DECISIONS: dict[str, list[GraphNodeSeed]] = {
    "transformer_b": _TRANSFORMER_B_SEEDS,
    "transformer_c": _TRANSFORMER_C_SEEDS,
}


# ---------------------------------------------------------------------------
# Deterministic graph traversal
# ---------------------------------------------------------------------------

def _children_map(seeds: list[GraphNodeSeed]) -> dict[str, list[str]]:
    children: dict[str, list[str]] = {}
    for node in seeds:
        if node.parent_id is not None:
            children.setdefault(node.parent_id, []).append(node.id)
    return children


def _assign_tiers(seeds: list[GraphNodeSeed]) -> dict[str, int]:
    """BFS from the decision node — a node's tier is its hop distance."""
    children = _children_map(seeds)
    tiers: dict[str, int] = {"decision": 0}
    frontier = ["decision"]
    depth = 0
    while frontier:
        depth += 1
        next_frontier: list[str] = []
        for node_id in frontier:
            for child_id in children.get(node_id, []):
                tiers[child_id] = depth
                next_frontier.append(child_id)
        frontier = next_frontier
    return tiers


def _subtree_ids(seeds: list[GraphNodeSeed], root_id: str) -> list[str]:
    """All descendant ids under root_id (root excluded), via BFS."""
    children = _children_map(seeds)
    result: list[str] = []
    frontier = [root_id]
    while frontier:
        next_frontier: list[str] = []
        for node_id in frontier:
            for child_id in children.get(node_id, []):
                result.append(child_id)
                next_frontier.append(child_id)
        frontier = next_frontier
    return result


def _traverse_and_score(decision_id: str, label_override: str | None) -> RippleCheckResponse:
    seeds = DECISIONS.get(decision_id)
    if seeds is None:
        raise HTTPException(status_code=404, detail=f"Unknown decision_id '{decision_id}'")

    by_id = {node.id: node for node in seeds}
    tiers = _assign_tiers(seeds)
    decision_label = label_override or by_id["decision"].label

    # Milestones are conceptually one ripple wave ("project impact") even
    # when they're chained sequentially (energization -> turnover), so pin
    # every milestone node to tier 3 rather than letting BFS depth push
    # later milestones in the chain past it.
    for node_id, node in by_id.items():
        if node.category == NodeCategory.MILESTONE:
            tiers[node_id] = 3

    leaf_ids = [node_id for node_id, tier in tiers.items() if tier == 2]
    milestone_ids = [node_id for node_id, node in by_id.items() if node.category == NodeCategory.MILESTONE]
    direct_category_ids = [node_id for node_id, tier in tiers.items() if tier == 1]
    trade_leaf_ids = [nid for nid in leaf_ids if by_id[nid].category == NodeCategory.TRADE]

    # Cost rolls up regardless of scheduling parallelism; schedule only rolls
    # up nodes explicitly flagged as being on the critical path (parallel
    # work that's absorbed within a longer concurrent lead time doesn't add
    # net days — see e.g. the foundation pad vs. feeder cable lead time in
    # the Transformer B scenario).
    total_cost = sum(by_id[nid].cost_usd_delta for nid in leaf_ids)
    total_critical_days = sum(
        by_id[nid].schedule_days_delta for nid in leaf_ids if by_id[nid].on_critical_path
    )

    def subtree_cost(root_id: str) -> float:
        return sum(by_id[nid].cost_usd_delta for nid in _subtree_ids(seeds, root_id))

    def subtree_critical_days(root_id: str) -> float:
        return sum(
            by_id[nid].schedule_days_delta
            for nid in _subtree_ids(seeds, root_id)
            if by_id[nid].on_critical_path
        )

    nodes: list[RippleNode] = []
    for node in seeds:
        tier = tiers[node.id]
        if node.id == "cat_cost":
            # Cost is a cross-cutting rollup of every leaf, not just its own
            # (otherwise empty) subtree.
            cost_value, days_value = total_cost, 0.0
        elif tier in (0, 1):
            cost_value, days_value = subtree_cost(node.id), subtree_critical_days(node.id)
        else:
            cost_value, days_value = node.cost_usd_delta, node.schedule_days_delta

        nodes.append(
            RippleNode(
                id=node.id, label=node.label, category=node.category, tier=tier,
                description=node.description, evidence=node.evidence,
                cost_usd_impact=cost_value, schedule_days_impact=days_value,
                on_critical_path=node.on_critical_path,
            )
        )

    edges = [
        RippleEdge(source=node.parent_id, target=node.id, relationship=node.relationship)
        for node in seeds
        if node.parent_id is not None and node.relationship is not None
    ]

    # Deduplicated evidence across the whole graph, for a top-level "sources"
    # summary distinct from the per-node evidence used in the click panel.
    seen: set[tuple[str, str]] = set()
    all_evidence: list[EvidenceRef] = []
    for node in seeds:
        for ref in node.evidence:
            key = (ref.type.value, ref.label)
            if key not in seen:
                seen.add(key)
                all_evidence.append(ref)

    impact_summary = ImpactSummary(
        dependencies_found=len(leaf_ids),
        direct_dependencies=len(direct_category_ids),
        secondary_dependencies=len(leaf_ids),
        affected_trades=len(trade_leaf_ids),
        affected_milestones=len(milestone_ids),
        cost_impact_usd=total_cost,
        schedule_impact_days=total_critical_days,
    )

    reasoning = (
        f"Traversed {len(direct_category_ids)} direct dependency categories and "
        f"{len(leaf_ids)} concrete downstream items from '{decision_label}'. "
        f"{len(trade_leaf_ids)} trade package(s) and {len(milestone_ids)} milestone(s) sit on "
        f"the affected path; critical-path schedule exposure is {total_critical_days:.0f} day(s), "
        f"total cost exposure ${total_cost:,.0f}."
    )

    # Confidence reflects how directly the underlying evidence ties to the
    # decision (drawings/specs/POs vs. inferred relationships) — kept as a
    # fixed, explainable value here since there's no LLM doing the tying.
    confidence = 0.86

    return RippleCheckResponse(
        decision_id=decision_id, decision_label=decision_label, nodes=nodes, edges=edges,
        impact_summary=impact_summary, evidence=all_evidence, confidence=confidence,
        reasoning=reasoning,
    )


@router.post("/ripple-check", response_model=RippleCheckResponse)
def ripple_check(request: RippleCheckRequest) -> RippleCheckResponse:
    return _traverse_and_score(request.decision_id, request.decision_label)
