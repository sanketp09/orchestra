from services.relevance_engine import RelevanceEngine

re_engine = RelevanceEngine()

def shipping_capability(task):
    """
    Assess shipping/logistics risk for a specific shipment.
    Returns a dict compatible with AgentResult fields.
    """
    task_dict = task.dict() if hasattr(task, "dict") else task
    all_risks = re_engine.assess_event(task_dict)

    # Keep only shipping‑related event types
    shipping_types = {"port_congestion", "road_closure", "weather", "strike"}
    shipping_risks = [
        r for r in all_risks if r.get("event_type") in shipping_types
    ]

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
        for r in shipping_risks
    ]

    confidence = (
        sum(r["confidence"] for r in shipping_risks) / len(shipping_risks)
        if shipping_risks
        else 0.0
    )
    return {
        "findings": findings,
        "claims": [],
        "evidence": [{"event_id": r["event_id"]} for r in shipping_risks],
        "confidence": confidence,
        "risks": findings,
        "recommended_next_capabilities": [],
        "summary": "Shipping risk assessment completed",
    }
