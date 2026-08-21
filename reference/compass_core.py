import re
from datetime import datetime, timezone
from typing import Literal, Optional, Any, List, Dict
from pydantic import BaseModel, Field

# Import all route functions/routers to call them programmatically
from app.api.routes.compass.xray import procurement_xray, XRayRequest
from app.api.routes.compass.pattern_break import company_pattern_break, CurrentDecisionRequest
from app.api.routes.compass.warranty_clock import get_warranty_tracker
from app.api.routes.compass.ripple import ripple_check, RippleCheckRequest
from app.api.routes.compass.pre_mortem import run_pre_mortem, PreMortemRequest
from app.api.routes.compass.decision_debt import decision_debt_ledger
from app.api.routes.compass.procurement_opportunity import procurement_opportunities
from app.api.routes.compass.clause_value import clause_value, ClauseValueRequest, ClauseId

# ============================================================================
# Compass Registry & Metadata
# ============================================================================

COMPASS_FEATURE_METADATA = {
    "procurement_xray": {
        "id": "procurement_xray",
        "name": "Procurement X-Ray",
        "keywords": ["xray", "x-ray", "quote", "proposal", "scope gap", "pricing anomaly", "clause risk", "meridian steel", "deviation"],
        "icon": "ScanSearch",
        "description": "Analyzes incoming vendor quotes and contracts against drawings, budgets, and historical risks to flag scope gaps and pricing anomalies."
    },
    "company_pattern_break": {
        "id": "company_pattern_break",
        "name": "Company Pattern Break",
        "keywords": ["pattern", "break", "deviation", "trade-off", "prioritized", "decision cohort", "slack summary", "approval memo"],
        "icon": "Activity",
        "description": "Determines whether a proposed procurement decision deviates from historical trade-off patterns for comparable projects."
    },
    "warranty_clock": {
        "id": "warranty_clock",
        "name": "Warranty Clock Tracker",
        "keywords": ["warranty", "warranty clock", "defect", "remediation", "expiration", "claim window", "subcontractor warranty"],
        "icon": "Clock",
        "description": "Tracks active subcontractor warranties and calculates defect remediation exposure windows based on historical claims."
    },
    "ripple_check": {
        "id": "ripple_check",
        "name": "Ripple Check",
        "keywords": ["ripple", "dependency graph", "blast radius", "transformer", "downstream", "trade package", "critical path"],
        "icon": "Workflow",
        "description": "Builds a dependency graph for a proposed procurement decision to compute its blast radius and schedule/cost exposure."
    },
    "pre_mortem": {
        "id": "pre_mortem",
        "name": "Pre-Mortem Generator",
        "keywords": ["pre-mortem", "premortem", "fail", "failure mode", "risk score", "mitigation", "early warning", "switchgear"],
        "icon": "AlertTriangle",
        "description": "Generates project-specific failure scenarios and mitigation plans based on historical vendor and category risk rates."
    },
    "decision_debt": {
        "id": "decision_debt",
        "name": "Decision Debt Ledger",
        "keywords": ["debt", "ledger", "postponed", "deferred", "residual risk", "liquidated damages", "uninsured"],
        "icon": "Scale",
        "description": "Maintains a ledger of knowingly-deferred procurement risks, tracking their deadlines, exposure, and next best actions."
    },
    "procurement_opportunity": {
        "id": "procurement_opportunity",
        "name": "Procurement Opportunity Engine",
        "keywords": ["opportunity", "savings", "bulk", "discount", "consolidate", "timing", "renegotiate", "early buy"],
        "icon": "Sparkles",
        "description": "Scans active procurement plans across projects to identify consolidation, bundling, and timing-based savings."
    },
    "clause_value": {
        "id": "clause_value",
        "name": "Clause Value Calculator",
        "keywords": ["clause", "value", "contract clause", "exposure", "negotiation", "damages cap", "termination notice"],
        "icon": "Calculator",
        "description": "Calculates the financial value and unmitigated exposure of key contract clauses using deterministic pricing models."
    }
}

# ============================================================================
# Classification & Orchestration
# ============================================================================

def classify_compass_intent(input_text: str, file_name: Optional[str] = None) -> List[str]:
    """
    Classifies input text / file name to identify all matching features.
    Returns a list of feature IDs, sorted by classification score.
    """
    text = f"{input_text} {file_name or ''}".lower()
    scores = {key: 0 for key in COMPASS_FEATURE_METADATA.keys()}

    for key, meta in COMPASS_FEATURE_METADATA.items():
        for kw in meta["keywords"]:
            if kw in text:
                scores[key] += 3
            # Partial token matches
            tokens = kw.split()
            if any(t in text for t in tokens if len(t) > 3):
                scores[key] += 1

    # Keep features with score > 0, sorted descending
    matched = [key for key, score in scores.items() if score > 0]
    matched.sort(key=lambda k: scores[k], reverse=True)

    if not matched:
        # Default fallback
        return ["procurement_xray"]
    
    return matched

async def execute_feature(feature_id: str, input_text: str, file_name: Optional[str] = None) -> Any:
    """
    Executes a single Compass feature by invoking its route function programmatically,
    mapping inputs appropriately.
    """
    text_lower = input_text.lower()

    if feature_id == "procurement_xray":
        payload = XRayRequest(
            document_text=input_text,
            document_name=file_name or "uploaded_document.pdf",
            project_id="project_riverside",
            vendor_id="vendor_meridian_steel"
        )
        res = await procurement_xray(payload)
        return res.model_dump()

    elif feature_id == "company_pattern_break":
        payload = CurrentDecisionRequest(
            decision_text=input_text,
            project_name="Riverside Commons — Phase 2"
        )
        res = await company_pattern_break(payload)
        return res.model_dump()

    elif feature_id == "warranty_clock":
        res = await get_warranty_tracker(project_id="project_austin_fab")
        return res.model_dump()

    elif feature_id == "ripple_check":
        # Extract decision choice (transformer_b or transformer_c)
        decision_id = "transformer_b"
        if "transformer_c" in text_lower or "transformer c" in text_lower:
            decision_id = "transformer_c"
        
        payload = RippleCheckRequest(
            decision_id=decision_id,
            decision_label=input_text if len(input_text.strip()) > 5 else None
        )
        res = ripple_check(payload)
        return res.model_dump()

    elif feature_id == "pre_mortem":
        payload = PreMortemRequest(
            decision_id="switchgear_vendor_a"
        )
        res = run_pre_mortem(payload)
        return res.model_dump()

    elif feature_id == "decision_debt":
        res = decision_debt_ledger(company_id="company_coastal_bay")
        return res.model_dump()

    elif feature_id == "procurement_opportunity":
        res = procurement_opportunities(company_id="company_coastal_bay")
        return res.model_dump()

    elif feature_id == "clause_value":
        # Determine clause ID based on keywords
        clause_id: ClauseId = "liquidated_damages_cap"
        if "escalation" in text_lower:
            clause_id = "escalation_clause"
        elif "termination" in text_lower:
            clause_id = "termination_right"
        elif "payment" in text_lower:
            clause_id = "payment_term"
        elif "warranty" in text_lower:
            clause_id = "warranty"

        # Try to parse a slider parameter value (numeric)
        parameter_value = None
        numbers = re.findall(r"\b\d+(?:\.\d+)?\b", input_text)
        if numbers:
            try:
                parameter_value = float(numbers[0])
            except ValueError:
                pass

        payload = ClauseValueRequest(
            clause_id=clause_id,
            parameter_value=parameter_value
        )
        res = await clause_value(payload)
        return res.model_dump()

    raise ValueError(f"Unknown Compass feature ID: {feature_id}")

async def process_compass_analysis(input_text: str, file_name: Optional[str] = None) -> Dict[str, Any]:
    """
    Main entry point for unified Compass analysis.
    Classifies inputs, executes all relevant features, and combines results.
    """
    feature_ids = classify_compass_intent(input_text, file_name)
    results = {}
    errors = {}

    for fid in feature_ids:
        try:
            results[fid] = await execute_feature(fid, input_text, file_name)
        except Exception as e:
            errors[fid] = str(e)

    # Return unified response payload matching the Orchestration layer contract
    return {
        "primary_feature_id": feature_ids[0],
        "all_matched_feature_ids": feature_ids,
        "results": results,
        "errors": errors,
        "metadata": {fid: COMPASS_FEATURE_METADATA[fid] for fid in feature_ids}
    }
