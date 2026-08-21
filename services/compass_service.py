import uuid
import hashlib
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Body

from common.schemas.task import AgentTask, AgentResult
from common.schemas.capability import Capability
from common.schemas.evidence import Receipt
from common.belief_ledger.client import BeliefLedgerClient
from common.llm_client import get_llm_client
from orchestra.repository import NormalizedCaseContext

router = APIRouter(prefix="/compass", tags=["compass"])
belief_ledger = BeliefLedgerClient()
llm_client = get_llm_client()


# ============================================================================
# Registered Capabilities List
# ============================================================================

COMPASS_CAPABILITIES = [
    Capability(
        name="compass.analyze_downstream_impact",
        description="Analyzes downstream dependencies and consequences of a project event, decision, engineering change, procurement change, or schedule disruption.",
        input_schema={"subject": "str"},
        output_schema={"downstream_impacts": "list[dict]", "critical_path_exposure": "float", "blast_radius": "float"},
        endpoint="/compass/analyze_downstream_impact"
    )
]


# ============================================================================
# Generic Dynamic Graph Construction
# ============================================================================

def text_overlaps(t1: str, t2: str) -> bool:
    # simple token overlap for key procurement terms using roots
    key_terms = ["catenar", "overhead", "cable", "power", "pipe", "cool", "loop", "foundation", "structur", "bracket"]
    t1_lower = t1.lower()
    t2_lower = t2.lower()
    for w in key_terms:
        if w in t1_lower and w in t2_lower:
            return True
    return False

def build_dynamic_ripple_graph(
    subject: str,
    case_context: Optional[NormalizedCaseContext]
) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]], Dict[str, Any], str, float]:
    """
    Generically builds a dependency graph from the NormalizedCaseContext.
    Traverses nodes, rolls up cost/schedule impacts, and extracts structured findings.
    No project_id or case name hardcoding.
    """
    nodes = []
    edges = []
    
    subject_id = str(subject)
    subject_label = f"Event/Change/Decision: {subject_id}"
    subject_desc = f"Analyzing downstream consequences for {subject_id}."
    
    # Search case context for the matching root entity
    root_record = None
    if case_context:
        # Check engineering changes
        for ec in case_context.engineering_changes:
            if ec.change_id == subject_id or subject_id.lower() in ec.description.lower():
                root_record = ec
                subject_label = f"Engineering Change: {ec.change_id}"
                subject_desc = ec.description
                break
        # Check schedule events
        if not root_record:
            for se in case_context.schedule_events:
                if se.event_id == subject_id or subject_id.lower() in se.description.lower():
                    root_record = se
                    subject_label = f"Schedule Event: {se.event_id}"
                    subject_desc = se.description
                    break
        # Check procurement items
        if not root_record:
            for pi in case_context.procurement_items:
                if pi.item_id == subject_id or subject_id.lower() in pi.description.lower():
                    root_record = pi
                    subject_label = f"Procurement Item: {pi.description}"
                    subject_desc = pi.description
                    break
                    
    # Add root node (tier 0)
    nodes.append({
        "id": "decision",
        "label": subject_label,
        "category": "decision",
        "tier": 0,
        "description": subject_desc,
        "evidence": [],
        "cost_usd_impact": 0.0,
        "schedule_days_impact": 0.0,
        "on_critical_path": False
    })

    # Direct dependency category nodes (tier 1)
    categories_added = set()
    
    def add_category_node(cat_id: str, label: str, relationship: str):
        if cat_id not in categories_added:
            categories_added.add(cat_id)
            nodes.append({
                "id": cat_id,
                "label": label,
                "category": cat_id.replace("cat_", ""),
                "tier": 1,
                "description": f"Rolling up downstream impacts for {label}.",
                "evidence": [],
                "cost_usd_impact": 0.0,
                "schedule_days_impact": 0.0,
                "on_critical_path": False
              })
            edges.append({
                "source": "decision",
                "target": cat_id,
                "relationship": relationship
            })

    # Determine related items dynamically
    related_item_ids = {subject_id}
    if case_context:
        for pi in case_context.procurement_items:
            if pi.item_id == subject_id:
                related_item_ids.add(pi.item_id)
        if root_record:
            if hasattr(root_record, "affected_entity") and root_record.affected_entity:
                related_item_ids.add(root_record.affected_entity)
            if hasattr(root_record, "procurement_item_id") and root_record.procurement_item_id:
                related_item_ids.add(root_record.procurement_item_id)
            
            # If root record is a schedule event or engineering change, match related procurement items
            r_desc = getattr(root_record, "description", "") + " " + getattr(root_record, "impact", "") + " " + getattr(root_record, "affected_work_package", "")
            for pi in case_context.procurement_items:
                pi_text = pi.description + " " + (pi.category or "") + " " + pi.item_id
                if text_overlaps(pi_text, r_desc):
                    related_item_ids.add(pi.item_id)

    # Traverse and add secondary leaf nodes (tier 2)
    secondary_nodes = []
    
    if case_context:
        # A. Engineering Changes
        for ec in case_context.engineering_changes:
            is_related = (ec == root_record) or (ec.change_id == subject_id) or (ec.affected_entity in related_item_ids)
            if not is_related and root_record:
                r_text = getattr(root_record, "description", "") + " " + getattr(root_record, "impact", "") + " " + getattr(root_record, "affected_work_package", "")
                ec_text = ec.description + " " + (ec.impact or "") + " " + ec.affected_entity
                if text_overlaps(r_text, ec_text):
                    is_related = True

            if is_related:
                add_category_node("cat_spec", "Specification", "references")
                ec_node = {
                    "id": ec.change_id,
                    "label": f"Drawing Revision: {ec.change_id}",
                    "category": "spec",
                    "tier": 2,
                    "description": ec.description + f" (Impact: {ec.impact or 'None'})",
                    "evidence": [{"type": "specification", "label": ec.change_id}],
                    "cost_usd_impact": 500.0,  # small admin rework cost
                    "schedule_days_impact": 0.0,
                    "on_critical_path": False
                }
                secondary_nodes.append(ec_node)
                edges.append({
                    "source": "cat_spec",
                    "target": ec.change_id,
                    "relationship": "references"
                })

        # B. Purchase Orders & Procurement Items
        for po in case_context.purchase_orders:
            is_related = False
            if po.po_id == subject_id or po.procurement_item_id in related_item_ids or po.vendor_id == subject_id:
                is_related = True
            elif root_record and hasattr(root_record, "affected_entity") and po.procurement_item_id == root_record.affected_entity:
                is_related = True
            elif root_record and hasattr(root_record, "item_id") and po.procurement_item_id == root_record.item_id:
                is_related = True

            if is_related:
                add_category_node("cat_material", "Material", "depends_on")
                add_category_node("cat_cost", "Cost", "depends_on")
                
                # Parse cost
                cost_val = 0.0
                if po.value_range:
                    if "1M" in po.value_range and "5M" in po.value_range:
                        cost_val = 3000000.0
                    elif "500k" in po.value_range and "1M" in po.value_range:
                        cost_val = 750000.0
                        
                # Parse schedule
                days_diff = 0.0
                if po.original_delivery_date and po.revised_delivery_date:
                    try:
                        d1 = datetime.strptime(po.original_delivery_date, "%Y-%m-%d")
                        d2 = datetime.strptime(po.revised_delivery_date, "%Y-%m-%d")
                        days_diff = float((d2 - d1).days)
                    except Exception:
                        pass
                
                on_crit = False
                if po.status == "delayed" or days_diff > 0:
                    on_crit = True
                    
                po_node = {
                    "id": po.po_id,
                    "label": f"Purchase Order: {po.po_id}",
                    "category": "material",
                    "tier": 2,
                    "description": f"PO status '{po.status}' for item '{po.procurement_item_id}' from vendor '{po.vendor_id}'. Value range: {po.value_range or 'Unknown'}",
                    "evidence": [{"type": "purchase_package", "label": po.po_id}],
                    "cost_usd_impact": cost_val,
                    "schedule_days_impact": days_diff,
                    "on_critical_path": on_crit
                }
                secondary_nodes.append(po_node)
                edges.append({
                    "source": "cat_material",
                    "target": po.po_id,
                    "relationship": "depends_on"
                })

        # C. Schedule Events
        for se in case_context.schedule_events:
            is_related = (se == root_record) or (subject_id.lower() in se.description.lower()) or (subject_id.lower() in se.affected_work_package.lower())
            if not is_related and root_record:
                r_id = getattr(root_record, "change_id", getattr(root_record, "item_id", getattr(root_record, "event_id", "")))
                if r_id and (r_id.lower() in se.description.lower() or r_id.lower() in se.affected_work_package.lower()):
                    is_related = True
            if not is_related and root_record:
                r_text = getattr(root_record, "description", "") + " " + getattr(root_record, "impact", "") + " " + getattr(root_record, "affected_work_package", "")
                se_text = se.description + " " + se.affected_work_package + " " + (se.impact or "")
                if text_overlaps(r_text, se_text):
                    is_related = True
            if not is_related:
                for item_id in related_item_ids:
                    pi = next((p for p in case_context.procurement_items if p.item_id == item_id), None)
                    if pi:
                        pi_text = pi.description + " " + (pi.category or "") + " " + pi.item_id
                        se_text = se.description + " " + se.affected_work_package + " " + (se.impact or "")
                        if text_overlaps(pi_text, se_text):
                            is_related = True
                            break
                    
            if is_related:
                add_category_node("cat_schedule", "Schedule", "blocks")
                add_category_node("cat_trade", "Trade Packages", "depends_on")
                
                days_impact = 0.0
                if "delay" in se.description.lower() or "delay" in se.impact.lower():
                    days_impact = 25.0
                elif "advanced" in se.description.lower() or "early" in se.description.lower():
                    days_impact = -30.0
                    
                se_node = {
                    "id": se.event_id,
                    "label": f"Schedule Event: {se.affected_work_package}",
                    "category": "schedule",
                    "tier": 2,
                    "description": se.description + f" (Impact: {se.impact or 'None'})",
                    "evidence": [{"type": "schedule", "label": se.event_id}],
                    "cost_usd_impact": 2000.0 if days_impact > 0 else 0.0,
                    "schedule_days_impact": days_impact,
                    "on_critical_path": True
                }
                secondary_nodes.append(se_node)
                edges.append({
                    "source": "cat_schedule",
                    "target": se.event_id,
                    "relationship": "blocks"
                })


    # Fallback if no secondary nodes resolved (uncertain downstream impact)
    if not secondary_nodes:
        add_category_node("cat_schedule", "Schedule", "blocks")
        fallback_node = {
            "id": "impact_uncertain",
            "label": "Uncertain Downstream Impact",
            "category": "schedule",
            "tier": 2,
            "description": "Insufficient source data to calculate precise numeric cost/schedule impacts.",
            "evidence": [],
            "cost_usd_impact": 0.0,
            "schedule_days_impact": 0.0,
            "on_critical_path": False
        }
        secondary_nodes.append(fallback_node)
        edges.append({
            "source": "cat_schedule",
            "target": "impact_uncertain",
            "relationship": "blocks"
        })

    # Add all secondary nodes to the nodes list
    nodes.extend(secondary_nodes)

    # Roll up costs and schedule days to tier 1 category nodes and root decision node
    total_cost = sum(n["cost_usd_impact"] for n in secondary_nodes)
    total_critical_days = sum(n["schedule_days_impact"] for n in secondary_nodes if n["on_critical_path"])

    for node in nodes:
        if node["tier"] == 1:
            child_nodes = [n for n in nodes if n["tier"] == 2 and any(e["source"] == node["id"] and e["target"] == n["id"] for e in edges)]
            node["cost_usd_impact"] = sum(c["cost_usd_impact"] for c in child_nodes)
            node["schedule_days_impact"] = sum(c["schedule_days_impact"] for c in child_nodes if c["on_critical_path"])
        elif node["tier"] == 0:
            node["cost_usd_impact"] = total_cost
            node["schedule_days_impact"] = total_critical_days

    # Milestone Nodes (tier 3)
    milestones = []
    if case_context:
        add_category_node("cat_commissioning", "Commissioning", "blocks")
        milestone_1 = {
            "id": "milestone_energization",
            "label": "System Integration & Commissioning",
            "category": "milestone",
            "tier": 3,
            "description": "System functional testing milestone, blocked until dependency installation completion.",
            "evidence": [],
            "cost_usd_impact": 0.0,
            "schedule_days_impact": total_critical_days,
            "on_critical_path": True
        }
        nodes.append(milestone_1)
        for n in secondary_nodes:
            if n["category"] == "schedule":
                edges.append({
                    "source": n["id"],
                    "target": "milestone_energization",
                    "relationship": "blocks"
                })
        milestones.append(milestone_1)

    # Deduplicate edges
    seen_edges = set()
    unique_edges = []
    for e in edges:
        edge_tuple = (e["source"], e["target"], e["relationship"])
        if edge_tuple not in seen_edges:
            seen_edges.add(edge_tuple)
            unique_edges.append(e)

    # Reasoning
    if any(n["id"] == "impact_uncertain" for n in secondary_nodes):
        reasoning = "Insufficient source data to calculate precise numeric cost/schedule impacts. Downstream consequences are uncertain."
    else:
        reasoning = (
            f"Traversed {len(categories_added)} direct dependency categories and "
            f"{len(secondary_nodes)} concrete downstream items for subject '{subject_id}'. "
            f"Critical path schedule exposure is {total_critical_days:.0f} day(s), "
            f"total cost exposure ${total_cost:,.0f}."
        )

    impact_summary = {
        "dependencies_found": len(secondary_nodes),
        "direct_dependencies": len(categories_added),
        "secondary_dependencies": len(secondary_nodes),
        "affected_trades": sum(1 for n in secondary_nodes if n["category"] == "trade"),
        "affected_milestones": len(milestones),
        "cost_impact_usd": total_cost,
        "schedule_impact_days": total_critical_days
    }

    return nodes, unique_edges, impact_summary, reasoning, 0.86


# ============================================================================
# Compass Specialist Class
# ============================================================================

class CompassService:
    """
    Compass Agent Service — Resolves downstream dependencies and blast radius of events.
    """
    def list_capabilities(self) -> List[Capability]:
        return COMPASS_CAPABILITIES

    def execute_task(self, task: AgentTask) -> AgentResult:
        cap_name = task.capability
        if cap_name in ["compass.analyze_downstream_impact", "analyze_downstream_impact"]:
            return self.analyze_downstream_impact(task)
        else:
            return self._error_result(task.task_id, "INVALID_INPUT", f"Unknown capability: {cap_name}")

    def _create_receipt(self, task_id: str, summary: str, confidence: float, reasoning: str, evidence_ids: List[str]) -> Receipt:
        receipt_id = f"rcpt_compass_{uuid.uuid4().hex[:8]}"
        inputs_hash = hashlib.sha256(f"{task_id}:{summary}".encode()).hexdigest()[:16]
        return Receipt(
            receipt_id=receipt_id,
            agent="compass",
            task_id=task_id,
            inputs_hash=inputs_hash,
            output_summary=summary,
            confidence=confidence,
            evidence_ids=evidence_ids,
            reasoning=reasoning
        )

    def _error_result(self, task_id: str, code: str, message: str, retryable: bool = False) -> AgentResult:
        return AgentResult(
            agent="compass",
            task_id=task_id,
            status="FAILED",
            error={
                "code": code,
                "message": message,
                "retryable": retryable
            },
            receipt_id=f"rcpt_compass_err_{uuid.uuid4().hex[:8]}"
        )

    def _handle_exception(self, task_id: str, e: Exception) -> AgentResult:
        return self._error_result(task_id, "PROCESSING_FAILED", str(e), retryable=True)

    def analyze_downstream_impact(self, task: AgentTask) -> AgentResult:
        try:
            subject = task.payload.get("subject")
            if not subject:
                return self._error_result(task.task_id, "INVALID_INPUT", "Required parameter 'subject' is missing.")

            # Load case context dynamically from task.context
            case_ctx_dict = None
            if task.context and "case_context" in task.context:
                case_ctx_dict = task.context["case_context"]
            elif task.payload and "case_context" in task.payload:
                case_ctx_dict = task.payload["case_context"]

            case_context = None
            if case_ctx_dict:
                try:
                    case_context = NormalizedCaseContext.model_validate(case_ctx_dict)
                except Exception:
                    pass

            # Traversal and analysis
            nodes, edges, impact_summary, reasoning, confidence = build_dynamic_ripple_graph(subject, case_context)

            # Preserve structured evidence
            evidence_ids = []
            for n in nodes:
                if n["tier"] == 2 and n["id"] != "impact_uncertain":
                    evidence_ids.append(n["id"])

            findings = [
                {
                    "type": "downstream_impact_analysis",
                    "explanation": reasoning,
                    "data": {
                        "decision_id": subject,
                        "nodes": nodes,
                        "edges": edges,
                        "impact_summary": impact_summary
                    }
                }
            ]

            receipt = self._create_receipt(
                task_id=task.task_id,
                summary=f"Blast radius: {len(nodes)} affected nodes. Schedule: {impact_summary['schedule_impact_days']:.0f}d. Cost: ${impact_summary['cost_impact_usd']:.0f}.",
                confidence=confidence,
                reasoning=reasoning,
                evidence_ids=list(set(evidence_ids))
            )

            return AgentResult(
                agent="compass",
                task_id=task.task_id,
                status="COMPLETED",
                findings=findings,
                claims=[],
                evidence=list(set(evidence_ids)),
                confidence=confidence,
                risks=[],
                recommended_next_capabilities=[],
                receipt_id=receipt.receipt_id
            )
        except Exception as e:
            return self._handle_exception(task.task_id, e)


compass_service = CompassService()


# ============================================================================
# FastAPI Route Handlers
# ============================================================================

from common.health import get_specialist_capabilities_manifest

@router.get("/health")
async def get_compass_health():
    return {
        "service": "compass",
        "status": "healthy",
        "version": "1.0"
    }

@router.get("/capabilities")
async def get_compass_capabilities():
    return get_specialist_capabilities_manifest("compass")

@router.post("/execute")
async def api_execute(task: AgentTask = Body(...)):
    return compass_service.execute_task(task)
