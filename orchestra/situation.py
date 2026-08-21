from __future__ import annotations
import os
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, ValidationError

from common.llm_client import get_llm_client
from orchestra.repository import NormalizedCaseContext


class SituationContext(BaseModel):
    """
    Pydantic model representing the structured interpretation of the procurement situation.
    This schema provides semantic context for subsequent capability selection and planning.
    """
    objective: str = Field(description="The primary objective to resolve in this run.")
    requested_outcome: str = Field(description="The final outcome or decision expected by the request.")
    entities: List[str] = Field(default_factory=list, description="Explicit and inferred entity IDs (vendors, projects, etc.)")
    known_facts: List[str] = Field(default_factory=list, description="Verified facts and statements of truth extracted from input.")
    evidence_references: List[str] = Field(default_factory=list, description="References to supporting documents, invoices, or site logs.")
    uncertainties: List[str] = Field(default_factory=list, description="Ambiguities or unverified claims in the situation.")
    information_gaps: List[str] = Field(default_factory=list, description="Missing proof items or contexts needed to make a decision.")
    constraints: List[str] = Field(default_factory=list, description="Identified constraints (e.g., budget limits, stand-down thresholds).")
    urgency: str = Field(default="medium", description="Estimated urgency levels (low, medium, high, critical).")
    risk_indicators: List[str] = Field(default_factory=list, description="Identified risks or dispute likelihoods.")
    confidence: float = Field(default=0.5, description="Confidence score of the semantic extraction between 0.0 and 1.0.")


class SituationAnalysisError(Exception):
    """
    Exception raised when Situation Analyzer encounters validation or LLM extraction failures.
    Includes the partial, deterministically extracted context.
    """
    def __init__(self, message: str, partial_context: Optional[SituationContext] = None):
        super().__init__(message)
        self.partial_context = partial_context


class SituationAnalyzer:
    """
    Analyzes raw procurement events and merges deterministic structured inputs
    with semantic LLM interpretation. Exposes no specialist or capability names.
    """
    def __init__(self):
        self.llm = get_llm_client()

    def normalize_deterministic_context(
        self,
        raw_input: str,
        structured_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Extracts explicitly supplied structured information from the context dictionary.
        Separates deterministic inputs (like project_id, entity_ids, evidence_refs)
        from semantic text.
        """
        ctx = structured_context or {}
        
        entities = []
        # Merge explicitly supplied entity_ids
        for key in ["entity_ids", "entity_id", "vendor_id", "project_id"]:
            val = ctx.get(key)
            if isinstance(val, list):
                entities.extend([str(x) for x in val if x])
            elif val:
                entities.append(str(val))

        # Merge evidence/document references
        evidence_refs = []
        for key in ["evidence_refs", "evidence_ids", "document_refs", "document_ids", "file_name"]:
            val = ctx.get(key)
            if isinstance(val, list):
                evidence_refs.extend([str(x) for x in val if x])
            elif val:
                evidence_refs.append(str(val))

        return {
            "entities": list(set(entities)),
            "evidence_references": list(set(evidence_refs))
        }

    def analyze(
        self,
        raw_input: str,
        structured_context: Optional[Dict[str, Any]] = None
    ) -> SituationContext:
        """
        Performs hybrid situation analysis:
        1. Normalizes and extracts deterministic metadata.
        2. Queries LLM for semantic mapping using structured JSON response.
        3. Returns validated SituationContext.
        """
        if not raw_input or not raw_input.strip():
            raise SituationAnalysisError("Raw input cannot be empty.")

        # 1. Normalize deterministic inputs
        deterministic = self.normalize_deterministic_context(raw_input, structured_context)

        # Build prompt for semantic interpretation
        prompt = f"""
Analyze the following raw construction/procurement situation report and extract its semantic elements.

RAW SITUATION REPORT:
\"\"\"
{raw_input}
\"\"\"

Expose NO specialist names (Sentinel, Trustline, Precedent, Arbiter) or capability IDs in your output.
Focus strictly on:
- What is the objective?
- What requested outcome is needed?
- What facts are known?
- What is uncertain or unverified?
- What information gaps must be filled?
- What are the constraints (budgets, schedules, terms)?
- What is the urgency level?
- What risk indicators or dispute triggers exist?
"""
        schema = SituationContext.model_json_schema()

        try:
            # Query unified LLM client
            result_json = self.llm.generate_structured(prompt, schema)
            if not result_json:
                raise ValueError("LLM returned empty structured output.")

            # Parse context from LLM output
            semantic_ctx = SituationContext.model_validate(result_json)

            # 3. Safely merge deterministic metadata
            merged_entities = list(set(deterministic["entities"] + semantic_ctx.entities))
            merged_evidence = list(set(deterministic["evidence_references"] + semantic_ctx.evidence_references))

            semantic_ctx.entities = merged_entities
            semantic_ctx.evidence_references = merged_evidence

            return semantic_ctx

        except ValidationError as e:
            # Preserving the deterministic context in partial_context
            partial = SituationContext(
                objective="Interpretation Failed",
                requested_outcome="Manual review needed",
                entities=deterministic["entities"],
                evidence_references=deterministic["evidence_references"],
                known_facts=[f"Raw input: {raw_input[:100]}"],
                uncertainties=["LLM validation error encountered"]
            )
            raise SituationAnalysisError(
                f"Validation error against SituationContext schema: {str(e)}",
                partial_context=partial
            )
        except Exception as e:
            partial = SituationContext(
                objective="Analysis Error",
                requested_outcome="Retry or manual review needed",
                entities=deterministic["entities"],
                evidence_references=deterministic["evidence_references"],
                known_facts=[f"Raw input: {raw_input[:100]}"],
                uncertainties=[f"LLM call exception: {str(e)}"]
            )
            raise SituationAnalysisError(
                f"LLM semantic extraction failed: {str(e)}",
                partial_context=partial
            )

    def analyze_case(self, case_context: NormalizedCaseContext) -> SituationContext:
        """
        Adapter method converting a source-agnostic NormalizedCaseContext into the existing
        analyze() workflow by compiling raw input logs and structured metadata.
        """
        # Compile raw input text from the case details and event logs
        lines = []
        lines.append(f"Project: {case_context.project.name}")
        lines.append(f"Description: {case_context.project.description}")

        if case_context.purchase_orders:
            for po in case_context.purchase_orders:
                lines.append(f"Purchase Order: {po.po_id} for item {po.procurement_item_id} (Status: {po.status}, Delivery Date: {po.original_delivery_date}, Revised: {po.revised_delivery_date or 'N/A'})")

        if case_context.schedule_events:
            for se in case_context.schedule_events:
                lines.append(f"Schedule Event: {se.description} (Date: {se.event_date})")

        if case_context.engineering_changes:
            for ec in case_context.engineering_changes:
                lines.append(f"Engineering Change: {ec.description} (Date: {ec.revision_date})")

        if case_context.claims:
            for cl in case_context.claims:
                lines.append(f"Claim: {cl.claim_text}")

        raw_input = "\n".join(lines)

        # Compile structured context metadata
        structured_context = {
            "project_id": case_context.project.project_id,
            "entity_ids": [v.vendor_id for v in case_context.vendors] + [po.po_id for po in case_context.purchase_orders],
            "evidence_refs": [ev.evidence_id for ev in case_context.evidence]
        }

        return self.analyze(raw_input=raw_input, structured_context=structured_context)

