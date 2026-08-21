from typing import List, Dict, Any
from datetime import datetime
from services.grok_service import GrokClient
from providers.seeded_events import SeededEventProvider

class RelevanceEngine:
    def __init__(self):
        self.grok = GrokClient()
        self.event_provider = SeededEventProvider()

    def _deterministic_signals(self, task: Dict[str, Any], event: Dict[str, Any]) -> Dict[str, bool]:
        """Compute simple deterministic relevance signals.
        Returns a dict of boolean flags.
        """
        signals = {}
        # Location match (if task payload includes route or location info)
        payload = task.get("payload", {})
        route = payload.get("route", {})
        origin = route.get("origin")
        destination = route.get("destination")
        ports = [origin, destination]
        event_loc = event.get("location")
        signals["location_match"] = event_loc in ports if event_loc else False

        # Date overlap
        start = event.get("start_date")
        end = event.get("end_date")
        expected_arrival = payload.get("expected_arrival")
        if start and end and expected_arrival:
            try:
                ev_start = datetime.fromisoformat(start)
                ev_end = datetime.fromisoformat(end)
                arr = datetime.fromisoformat(expected_arrival)
                signals["date_overlap"] = ev_start <= arr <= ev_end
            except Exception:
                signals["date_overlap"] = False
        else:
            signals["date_overlap"] = False

        # Material match for commodity_price events
        material = payload.get("material")
        event_commodity = event.get("commodity")
        signals["material_match"] = (material == event_commodity) if event_commodity else False

        # Vendor match for geopolitical/export events
        vendor_country = payload.get("vendor_country")
        event_loc_country = event.get("location")
        signals["vendor_country_match"] = (vendor_country == event_loc_country) if vendor_country else False

        return signals

    def assess_event(self, task: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Assess all external events for a given task and return list of ExternalRisk dicts."""
        events = self.event_provider.list_events()
        results = []
        for ev in events:
            signals = self._deterministic_signals(task, ev)
            # Build a prompt for Grok, providing signals and event description
            system_prompt = (
                "You are an expert external procurement risk analyst. "
                "Given the deterministic signals and the event description, determine the relevance (0-1), "
                "estimated impact, affected entities, and confidence. "
                "Do NOT hallucinate facts not present in the signals or description."
            )
            user_prompt = f"""Task payload: {task.get('payload',{})}\nEvent: {ev}\nDeterministic signals: {signals}\nProvide a JSON object with keys: relevance (float 0-1), estimated_impact (string), affected_entities (list), confidence (float 0-1)."""
            # Define response schema for structured output
            response_schema = {
                "type": "object",
                "properties": {
                    "relevance": {"type": "number", "minimum": 0, "maximum": 1},
                    "estimated_impact": {"type": "string"},
                    "affected_entities": {"type": "array", "items": {"type": "string"}},
                    "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                },
                "required": ["relevance", "estimated_impact", "affected_entities", "confidence"],
            }
            grok_resp = self.grok.reason(system_prompt, user_prompt, response_schema)
            # If Grok failed to return proper JSON, fallback to minimal deterministic assessment
            if "relevance" not in grok_resp:
                # Simple heuristic: relevance is 1.0 only if any deterministic signal true
                relevance = 1.0 if any(signals.values()) else 0.0
                estimated = "Potential impact based on deterministic signals" if relevance else "No impact"
                affected = []
                confidence = 0.5 if relevance else 0.0
                grok_resp = {
                    "relevance": relevance,
                    "estimated_impact": estimated,
                    "affected_entities": affected,
                    "confidence": confidence,
                }
            # Assemble ExternalRisk dict
            result = {
                "event_id": ev.get("event_id"),
                "event_type": ev.get("event_type"),
                "description": ev.get("description"),
                "relevance": grok_resp["relevance"],
                "estimated_impact": grok_resp["estimated_impact"],
                "affected_entities": grok_resp["affected_entities"],
                "confidence": grok_resp["confidence"],
            }
            results.append(result)
        return results
