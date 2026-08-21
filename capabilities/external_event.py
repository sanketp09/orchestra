from services.relevance_engine import RelevanceEngine

re_engine = RelevanceEngine()

def external_event_capability(task):
    """Assess all external events for relevance to the given task.
    Returns a dict compatible with AgentResult fields.
    """
    # Convert Pydantic model to dict if needed
    task_dict = task.dict() if hasattr(task, "dict") else task
    risks = re_engine.assess_event(task_dict)
    # Filter only events with non‑zero relevance
    findings = [r for r in risks if r.get("relevance", 0) > 0]
    confidence = (
        sum(r.get("confidence", 0) for r in findings) / len(findings)
        if findings else 0.0
    )
    return {
        "findings": findings,
        "claims": [],
        "evidence": [{"event_id": r["event_id"]} for r in findings],
        "confidence": confidence,
        "risks": findings,
        "recommended_next_capabilities": [],
        "summary": "External event relevance assessment completed",
    }
