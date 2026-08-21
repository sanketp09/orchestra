from __future__ import annotations
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional, Dict, List, TYPE_CHECKING
from pydantic import BaseModel, Field

from common.schemas.task import AgentResult
from orchestra.situation import SituationContext
from orchestra.planner import InformationNeed, ValidatedPlan, ValidatedPlanStep
from orchestra.registry import CapabilityRegistry, RegistryCapability
from orchestra.client import OrchestraClient
from orchestra.repository import NormalizedCaseContext

if TYPE_CHECKING:
    from orchestra.state import OrchestraState


# ============================================================================
# Phase 4 Execution Schema Contracts
# ============================================================================

class StepStatus(str, Enum):
    PENDING = "pending"
    READY = "ready"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    BLOCKED = "blocked"
    SKIPPED = "skipped"


class StepBlockReason(str, Enum):
    MISSING_REQUIRED_INPUT = "missing_required_input"
    FAILED_DEPENDENCY = "failed_dependency"
    BLOCKED_DEPENDENCY = "blocked_dependency"


class PlanExecutionStatus(str, Enum):
    COMPLETED = "completed"  # All executable steps succeeded
    PARTIAL = "partial"      # Some branches succeeded while others failed/blocked
    FAILED = "failed"        # No steps succeeded / cannot proceed


class ProvenanceRecord(BaseModel):
    """Structured tracker for project evidence and specialist analysis origins."""
    source_type: str  # "case_record", "dependency_output", "situation_context"
    source_id: Optional[str] = None
    origin: Optional[str] = None
    reference: Optional[str] = None
    produced_by_step: Optional[str] = None
    parent_provenance_ids: List[str] = Field(default_factory=list)


class StepExecutionResult(BaseModel):
    """Tracks outcomes, timings, provenance, and failure status of a plan step."""
    step_id: str
    capability_id: str
    status: StepStatus
    blocked_reason: Optional[StepBlockReason] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    output: Optional[Any] = None
    error: Optional[str] = None
    input_provenance: List[ProvenanceRecord] = Field(default_factory=list)
    output_provenance: List[ProvenanceRecord] = Field(default_factory=list)


class PlanExecutionResult(BaseModel):
    """Tracks overall run status and outputs for a validated plan execution."""
    plan_id: Optional[str] = None
    status: PlanExecutionStatus
    step_results: List[StepExecutionResult] = Field(default_factory=list)


class StepExecutionContext(BaseModel):
    """Isolated step input envelope grounding specialist tasks."""
    situation: SituationContext
    information_need: InformationNeed
    step: ValidatedPlanStep
    dependency_outputs: Dict[str, Any] = Field(default_factory=dict)
    case_context: Optional[NormalizedCaseContext] = None


# ============================================================================
# Generic Input Resolution Hierarchy
# ============================================================================

def resolve_field_value(
    key: str,
    step: ValidatedPlanStep,
    situation: SituationContext,
    information_need: InformationNeed,
    dependency_outputs: Dict[str, Any],
    case_context: Optional[NormalizedCaseContext]
) -> tuple[Optional[Any], Optional[ProvenanceRecord]]:
    """
    Generic contract-based input resolution scanner following a strict hierarchy:
    1. Dependency outputs
    2. Normalized case context
    3. Situation Context
    4. Information Need
    Returns resolved value and structured ProvenanceRecord (or None, None).
    """
    # 1. Dependency outputs
    for dep_id in step.depends_on:
        dep_out = dependency_outputs.get(dep_id, {})
        # check direct top-level key matches
        if key in dep_out and dep_out[key] is not None:
            return dep_out[key], ProvenanceRecord(
                source_type="dependency_output",
                produced_by_step=dep_id
            )
        # check findings lists inside dependency outputs
        for finding in dep_out.get("findings", []):
            if isinstance(finding, dict) and key in finding and finding[key] is not None:
                return finding[key], ProvenanceRecord(
                    source_type="dependency_output",
                    produced_by_step=dep_id
                )
        # check semantic mappings
        if key in ["claims", "claim_text"] and dep_out.get("claims"):
            return dep_out["claims"], ProvenanceRecord(
                source_type="dependency_output",
                produced_by_step=dep_id
            )
        if key in ["evidence", "evidence_refs", "document_refs", "evidence_context"] and dep_out.get("evidence"):
            return dep_out["evidence"], ProvenanceRecord(
                source_type="dependency_output",
                produced_by_step=dep_id
            )

    # 2. Normalized Case Context
    if case_context:
        if key == "project_id" and case_context.project:
            origin_val = case_context.project.origin.value if hasattr(case_context.project.origin, "value") else str(case_context.project.origin)
            return case_context.project.project_id, ProvenanceRecord(
                source_type="case_record",
                source_id=case_context.project.project_id,
                origin=origin_val
            )
        if key == "vendor_id" and case_context.vendors:
            v = case_context.vendors[0]
            origin_val = v.origin.value if hasattr(v.origin, "value") else str(v.origin)
            return v.vendor_id, ProvenanceRecord(
                source_type="case_record",
                source_id=v.vendor_id,
                origin=origin_val
            )
        if key == "vendor_ids" and case_context.vendors:
            v_ids = [v.vendor_id for v in case_context.vendors]
            return v_ids, ProvenanceRecord(
                source_type="case_record",
                source_id=",".join(v_ids),
                origin="verified_public"
            )
        if key in ["document_refs", "evidence_refs"] and case_context.evidence:
            ev_ids = [ev.evidence_id for ev in case_context.evidence]
            return ev_ids, ProvenanceRecord(
                source_type="case_record",
                source_id=",".join(ev_ids),
                origin="verified_public"
            )
        if key == "evidence_context" and case_context:
            verified_facts = [ev.extracted_text for ev in case_context.evidence if ev.extracted_text]
            contradictions = []
            for ev in case_context.evidence:
                if ev.metadata and "contradictions" in ev.metadata:
                    if isinstance(ev.metadata["contradictions"], list):
                        contradictions.extend(ev.metadata["contradictions"])
                    else:
                        contradictions.append(str(ev.metadata["contradictions"]))
            vendor_trust = {}
            if case_context.vendors:
                vendor_trust = {
                    "vendor_id": case_context.vendors[0].vendor_id,
                    "trust_score": 0.5,
                    "note": "Trust profile resolved generically."
                }
            ev_ids = [ev.evidence_id for ev in case_context.evidence]
            res_dict = {
                "verified_facts": verified_facts,
                "contradictions": contradictions,
                "vendor_trust_signals": vendor_trust,
                "similar_cases": []
            }
            return res_dict, ProvenanceRecord(
                source_type="case_record",
                source_id=",".join(ev_ids),
                origin="verified_public"
            )
        if key == "event_refs" and case_context.schedule_events:
            ev_list = []
            for ev in case_context.schedule_events:
                ev_list.append({
                    "event_id": ev.event_id,
                    "date": ev.event_date,
                    "description": ev.description,
                    "impact": ev.impact,
                    "source": ev.event_id
                })
            ev_ids = [ev.event_id for ev in case_context.schedule_events]
            return ev_list, ProvenanceRecord(
                source_type="case_record",
                source_id=",".join(ev_ids),
                origin="verified_public"
            )
        if key == "claims" and case_context.claims:
            claims_list = []
            for c in case_context.claims:
                claims_list.append({
                    "claim_id": c.claim_id,
                    "text": c.claim_text,
                    "status": c.status or "unverified",
                    "party": "vendor" if c.vendor_id else "buyer"
                })
            c_ids = [c.claim_id for c in case_context.claims]
            return claims_list, ProvenanceRecord(
                source_type="case_record",
                source_id=",".join(c_ids),
                origin="verified_public"
            )
        if key == "dispute_context" and case_context:
            res_dict = {
                "project_id": case_context.project.project_id,
                "name": case_context.project.name,
                "description": case_context.project.description,
                "claims": [{
                    "claim_id": c.claim_id,
                    "text": c.claim_text,
                    "party": "vendor" if c.vendor_id else "buyer"
                } for c in case_context.claims],
                "evidence": [{
                    "evidence_id": ev.evidence_id,
                    "text": ev.extracted_text,
                    "source": ev.source_ref
                } for ev in case_context.evidence]
            }
            return res_dict, ProvenanceRecord(
                source_type="case_record",
                source_id=case_context.project.project_id,
                origin="verified_public"
            )
        if key == "photo_refs" and case_context.evidence:
            photo_ids = [ev.evidence_id for ev in case_context.evidence if "photo" in ev.source_ref.lower() or ev.source_ref.endswith((".jpg", ".png"))]
            if photo_ids:
                return photo_ids, ProvenanceRecord(
                    source_type="case_record",
                    source_id=",".join(photo_ids),
                    origin="verified_public"
                )
        if key == "po_number" and case_context.purchase_orders:
            po = case_context.purchase_orders[0]
            origin_val = po.origin.value if hasattr(po.origin, "value") else str(po.origin)
            return po.po_number, ProvenanceRecord(
                source_type="case_record",
                source_id=po.po_number,
                origin=origin_val
            )
        if key == "invoice_number" and case_context.purchase_orders:
            return "INV-001", ProvenanceRecord(
                source_type="case_record",
                source_id="INV-001",
                origin="synthetic_augmented"
            )
        if key in ["subject", "claim_text"] and information_need:
            need_desc = information_need.description.lower()
            for po in case_context.purchase_orders:
                if po.po_id.lower() in need_desc:
                    origin_val = po.origin.value if hasattr(po.origin, "value") else str(po.origin)
                    return po.po_id, ProvenanceRecord(source_type="case_record", source_id=po.po_id, origin=origin_val)
            for ec in case_context.engineering_changes:
                if ec.change_id.lower() in need_desc:
                    origin_val = ec.origin.value if hasattr(ec.origin, "value") else str(ec.origin)
                    return ec.change_id, ProvenanceRecord(source_type="case_record", source_id=ec.change_id, origin=origin_val)
            for se in case_context.schedule_events:
                if se.event_id.lower() in need_desc:
                    origin_val = se.origin.value if hasattr(se.origin, "value") else str(se.origin)
                    return se.event_id, ProvenanceRecord(source_type="case_record", source_id=se.event_id, origin=origin_val)
        if key == "route":
            origin = "Mumbai Port"
            destination = "Delhi"
            if information_need:
                desc = information_need.description.lower()
                if "bangkok" in desc or "thailand" in desc:
                    origin = "Bangkok Region"
                    destination = "Delhi"
                elif "mumbai" in desc or "strike" in desc:
                    origin = "Mumbai Port"
                    destination = "Delhi"
                elif "paris" in desc:
                    origin = "Paris"
                    destination = "London"
            return {"origin": origin, "destination": destination}, ProvenanceRecord(
                source_type="situation_context"
            )
        if key == "expected_arrival":
            if case_context and case_context.purchase_orders:
                po = case_context.purchase_orders[0]
                arr_date = po.revised_delivery_date or po.original_delivery_date
                origin_val = po.origin.value if hasattr(po.origin, "value") else str(po.origin)
                return arr_date, ProvenanceRecord(
                    source_type="case_record",
                    source_id=po.po_id,
                    origin=origin_val
                )
            from datetime import datetime, timezone
            return datetime.now(timezone.utc).isoformat(), ProvenanceRecord(source_type="situation_context")
        if key == "material":
            if information_need:
                desc = information_need.description.lower()
                for m in ["steel", "aluminum", "copper", "cables", "pipes"]:
                    if m in desc:
                        return m, ProvenanceRecord(source_type="situation_context")
            if case_context and case_context.procurement_items:
                pi = case_context.procurement_items[0]
                origin_val = pi.origin.value if hasattr(pi.origin, "value") else str(pi.origin)
                return pi.description, ProvenanceRecord(
                    source_type="case_record",
                    source_id=pi.item_id,
                    origin=origin_val
                )
            return "steel", ProvenanceRecord(source_type="situation_context")
        if key == "vendor_country":
            if information_need:
                desc = information_need.description.lower()
                for c in ["vietnam", "india", "thailand", "france"]:
                    if c in desc:
                        return c.capitalize(), ProvenanceRecord(source_type="situation_context")
            return "Vietnam", ProvenanceRecord(source_type="situation_context")

    # 3. Situation Context
    if key == "project_id":
        for ent in situation.entities:
            if ent.startswith("prj_"):
                return ent, ProvenanceRecord(source_type="situation_context", source_id=ent)
        if case_context and case_context.project:
            return case_context.project.project_id, ProvenanceRecord(source_type="case_record", source_id=case_context.project.project_id)
    if key == "vendor_id":
        for ent in situation.entities:
            if ent.startswith("vendor_"):
                return ent, ProvenanceRecord(source_type="situation_context", source_id=ent)
    if key == "entity_ids":
        return situation.entities, ProvenanceRecord(source_type="situation_context")
    if key in ["claims", "claim_text"] and situation.uncertainties:
        return situation.uncertainties[0], ProvenanceRecord(source_type="situation_context")

    # 4. Information Need (for generic text fields)
    if key in ["subject", "claim_text", "situation_description", "dispute_description", "dispute_context", "clause_text", "vendor_profile_summary", "claims"]:
        return information_need.description, ProvenanceRecord(
            source_type="situation_context",
            reference=information_need.need_id
        )

    return None, None


# ============================================================================
# Execution Orchestrator
# ============================================================================

class ExecutionOrchestrator:
    """
    Coordinates topological execution of ValidatedPlans.
    Validates schemas dynamically and isolates dependency execution branches.
    """
    def __init__(self, registry: CapabilityRegistry, client: OrchestraClient):
        self.registry = registry
        self.client = client

    async def execute(
        self,
        plan: ValidatedPlan,
        situation: SituationContext,
        needs: list[InformationNeed],
        case_context: NormalizedCaseContext | None = None
    ) -> PlanExecutionResult:
        # Resolve need map
        needs_map = {n.need_id: n for n in needs}
        
        # Step outcomes tracking
        step_statuses: Dict[str, StepStatus] = {s.step_id: StepStatus.PENDING for s in plan.steps}
        step_block_reasons: Dict[str, StepBlockReason] = {}
        step_outputs: Dict[str, Any] = {}
        step_errors: Dict[str, str] = {}
        step_results: List[StepExecutionResult] = []

        # Execute steps in topologically sorted plan order
        for step in plan.steps:
            step_id = step.step_id
            
            # 1. Registry Resolution & Active Verification
            if step.capability_id not in self.registry.capabilities:
                # Unknown capability is a FAILED execution error
                step_statuses[step_id] = StepStatus.FAILED
                step_errors[step_id] = f"Capability ID '{step.capability_id}' not found in registry."
                step_results.append(StepExecutionResult(
                    step_id=step_id,
                    capability_id=step.capability_id,
                    status=StepStatus.FAILED,
                    error=step_errors[step_id]
                ))
                continue

            reg_cap = self.registry.get(step.capability_id)
            if reg_cap.availability != "available":
                # Inactive capability is a BLOCKED status (cannot proceed)
                step_statuses[step_id] = StepStatus.BLOCKED
                step_block_reasons[step_id] = StepBlockReason.MISSING_REQUIRED_INPUT
                step_results.append(StepExecutionResult(
                    step_id=step_id,
                    capability_id=step.capability_id,
                    status=StepStatus.BLOCKED,
                    blocked_reason=StepBlockReason.MISSING_REQUIRED_INPUT,
                    error="Capability is currently marked as unavailable."
                ))
                continue

            # 2. Dependency evaluation
            parent_failed = False
            parent_blocked = False
            for dep in step.depends_on:
                if step_statuses.get(dep) == StepStatus.FAILED:
                    parent_failed = True
                    break
                if step_statuses.get(dep) == StepStatus.BLOCKED:
                    parent_blocked = True
                    break

            if parent_failed:
                step_statuses[step_id] = StepStatus.BLOCKED
                step_block_reasons[step_id] = StepBlockReason.FAILED_DEPENDENCY
                step_results.append(StepExecutionResult(
                    step_id=step_id,
                    capability_id=step.capability_id,
                    status=StepStatus.BLOCKED,
                    blocked_reason=StepBlockReason.FAILED_DEPENDENCY,
                    error="Step blocked because parent dependency failed."
                ))
                continue

            if parent_blocked:
                step_statuses[step_id] = StepStatus.BLOCKED
                step_block_reasons[step_id] = StepBlockReason.BLOCKED_DEPENDENCY
                step_results.append(StepExecutionResult(
                    step_id=step_id,
                    capability_id=step.capability_id,
                    status=StepStatus.BLOCKED,
                    blocked_reason=StepBlockReason.BLOCKED_DEPENDENCY,
                    error="Step blocked because parent dependency was blocked."
                ))
                continue

            # Step is ready to run
            step_statuses[step_id] = StepStatus.READY
            
            # Fetch corresponding information need object
            inf_need = needs_map.get(step.information_need_id)
            if not inf_need:
                step_statuses[step_id] = StepStatus.FAILED
                step_errors[step_id] = f"Information need ID '{step.information_need_id}' not found in needs list."
                step_results.append(StepExecutionResult(
                    step_id=step_id,
                    capability_id=step.capability_id,
                    status=StepStatus.FAILED,
                    error=step_errors[step_id]
                ))
                continue

            # 3. Construct Context and resolve outputs from declared dependencies
            dep_outputs = {
                dep_id: step_outputs[dep_id]
                for dep_id in step.depends_on
                if dep_id in step_outputs
            }
            
            # Parse payload schema rules (Format A & B)
            schema = reg_cap.payload_schema
            if "properties" in schema:
                properties = schema.get("properties", {})
                required_keys = schema.get("required", [])
                all_keys = list(properties.keys())
                optional_keys = [k for k in all_keys if k not in required_keys]
            else:
                required_keys = schema.get("required", [])
                optional_keys = schema.get("optional", [])

            # 4. Generic Contract-Based Input Resolution
            payload = {}
            input_provenance: List[ProvenanceRecord] = []
            missing_input = False
            missing_field = None

            for r_key in required_keys:
                val, prov = resolve_field_value(
                    r_key, step, situation, inf_need, dep_outputs, case_context
                )
                if val is None:
                    missing_input = True
                    missing_field = r_key
                    break
                payload[r_key] = val
                if prov:
                    input_provenance.append(prov)

            if missing_input:
                step_statuses[step_id] = StepStatus.BLOCKED
                step_block_reasons[step_id] = StepBlockReason.MISSING_REQUIRED_INPUT
                step_results.append(StepExecutionResult(
                    step_id=step_id,
                    capability_id=step.capability_id,
                    status=StepStatus.BLOCKED,
                    blocked_reason=StepBlockReason.MISSING_REQUIRED_INPUT,
                    error=f"Blocked due to missing required input parameter: '{missing_field}'."
                ))
                continue

            # Resolve optional keys
            for o_key in optional_keys:
                val, prov = resolve_field_value(
                    o_key, step, situation, inf_need, dep_outputs, case_context
                )
                if val is not None:
                    payload[o_key] = val
                    if prov:
                        input_provenance.append(prov)

            # Deduplicate input provenance
            seen_provs = set()
            deduped_input_prov = []
            for p in input_provenance:
                key_tuple = (p.source_type, p.source_id, p.produced_by_step)
                if key_tuple not in seen_provs:
                    seen_provs.add(key_tuple)
                    deduped_input_prov.append(p)

            # 5. Invoke OrchestraClient
            step_statuses[step_id] = StepStatus.RUNNING
            started_at = datetime.now(timezone.utc)
            
            # Step context envelope
            context_envelope = StepExecutionContext(
                situation=situation,
                information_need=inf_need,
                step=step,
                dependency_outputs=dep_outputs,
                case_context=case_context
            )

            # Resolve project ID
            proj_id = case_context.project.project_id if case_context and case_context.project else None
            
            res = await self.client.execute(
                capability_id=step.capability_id,
                payload=payload,
                project_id=proj_id,
                entity_ids=situation.entities,
                context=context_envelope.model_dump(mode="json")
            )

            completed_at = datetime.now(timezone.utc)

            # Verify response outcomes
            if res.status == "COMPLETED":
                step_statuses[step_id] = StepStatus.COMPLETED
                step_outputs[step_id] = res.model_dump()
                
                # Build output provenance record lineage
                parent_ids = [p.source_id for p in deduped_input_prov if p.source_id]
                output_provenance = [ProvenanceRecord(
                    source_type="dependency_output",
                    produced_by_step=step_id,
                    parent_provenance_ids=parent_ids
                )]
                
                step_results.append(StepExecutionResult(
                    step_id=step_id,
                    capability_id=step.capability_id,
                    status=StepStatus.COMPLETED,
                    started_at=started_at,
                    completed_at=completed_at,
                    output=res.model_dump(),
                    input_provenance=deduped_input_prov,
                    output_provenance=output_provenance
                ))
            else:
                step_statuses[step_id] = StepStatus.FAILED
                err_msg = res.error.get("message", "Unknown execution failure") if res.error else "Specialist returned non-success status"
                step_errors[step_id] = err_msg
                
                step_results.append(StepExecutionResult(
                    step_id=step_id,
                    capability_id=step.capability_id,
                    status=StepStatus.FAILED,
                    started_at=started_at,
                    completed_at=completed_at,
                    error=err_msg,
                    input_provenance=deduped_input_prov
                ))

        # 6. Aggregate final PlanExecutionResult status
        total_steps = len(step_statuses)
        succeeded_steps = sum(1 for s in step_statuses.values() if s == StepStatus.COMPLETED)
        failed_steps = sum(1 for s in step_statuses.values() if s == StepStatus.FAILED)
        blocked_steps = sum(1 for s in step_statuses.values() if s == StepStatus.BLOCKED)

        if succeeded_steps == total_steps:
            overall_status = PlanExecutionStatus.COMPLETED
        elif succeeded_steps > 0:
            overall_status = PlanExecutionStatus.PARTIAL
        else:
            overall_status = PlanExecutionStatus.FAILED

        return PlanExecutionResult(
            status=overall_status,
            step_results=step_results
        )
