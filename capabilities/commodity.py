from services.relevance_engine import RelevanceEngine

re_engine = RelevanceEngine()

def commodity_capability(task):
    """
    Determine commodity price exposure for the procurement task.
    Returns a dict compatible with AgentResult fields.
    """
    task_dict = task.dict() if hasattr(task, "dict") else task
    all_risks = re_engine.assess_event(task_dict)
    commodity_risks = [
        r for r in all_risks if r.get("event_type") == "commodity_price"
    ]

    findings = [
        {
            "event_id": r["event_id"],
            "description": r["description"],
            "relevance": r["relevance"],
            "estimated_impact": r["estimated_impact"],
            "affected_entities": r["affected_entities"],
            "confidence": r["confidence"],
        }
        for r in commodity_risks
    ]

    confidence = (
        sum(r["confidence"] for r in commodity_risks) / len(commodity_risks)
        if commodity_risks
        else 0.0
    )
    return {
        "findings": findings,
        "claims": [],
        "evidence": [{"event_id": r["event_id"]} for r in commodity_risks],
        "confidence": confidence,
        "risks": findings,
        "recommended_next_capabilities": [],
        "summary": "Commodity price exposure assessment completed",
    }
