from services.relevance_engine import RelevanceEngine

re_engine = RelevanceEngine()

def geopolitical_capability(task):
    """
    Determine geopolitical/trade risk for the procurement.
    Returns a dict compatible with AgentResult fields.
    """
    task_dict = task.dict() if hasattr(task, "dict") else task
    all_risks = re_engine.assess_event(task_dict)

    geopolitical_types = {"tariff", "sanction", "export_restriction", "geopolitical"}
    geo_risks = [r for r in all_risks if r.get("event_type") in geopolitical_types]

    findings = [
        {
            "event_id": r["event_id"],
            "event_type": r["event_type"],
            "description": r["description"],
            "relevance": r["relevance"],
            "estimated_impact": r["estimated_impact"],
            "affected_entities": r["affected_entities"],
            "confidence": r["confidence"],
        }
        for r in geo_risks
    ]

    confidence = (
        sum(r["confidence"] for r in geo_risks) / len(geo_risks)
        if geo_risks
        else 0.0
    )
    return {
        "findings": findings,
        "claims": [],
        "evidence": [{"event_id": r["event_id"]} for r in geo_risks],
        "confidence": confidence,
        "risks": findings,
        "recommended_next_capabilities": [],
        "summary": "Geopolitical risk assessment completed",
    }
