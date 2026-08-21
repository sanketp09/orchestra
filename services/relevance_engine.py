from typing import List, Dict, Any
from datetime import datetime
from providers.seeded_events import SeededEventProvider

class RelevanceEngine:
    def __init__(self):
        self.event_provider = SeededEventProvider()

    def _deterministic_signals(self, task: Dict[str, Any], event: Dict[str, Any]) -> Dict[str, bool]:
        """Compute simple deterministic relevance signals.
        Returns a dict of boolean flags.
        """
        signals = {}
        payload = task.get("payload", {})
        
        # 1. Location match (check origin/destination routes or task locations)
        route = payload.get("route") or {}
        origin = route.get("origin")
        destination = route.get("destination")
        ports = [origin, destination]
        
        # Fallback to general location field in payload
        loc_val = payload.get("location")
        if loc_val:
            ports.append(loc_val)
            
        event_loc = event.get("location")
        signals["location_match"] = any(p and event_loc and p.lower() in event_loc.lower() for p in ports) if event_loc else False

        # 2. Date overlap
        start = event.get("start_date")
        end = event.get("end_date")
        expected_arrival = payload.get("expected_arrival")
        if start and end and expected_arrival:
            try:
                ev_start = datetime.fromisoformat(start.replace("Z", "+00:00"))
                ev_end = datetime.fromisoformat(end.replace("Z", "+00:00"))
                arr = datetime.fromisoformat(expected_arrival.replace("Z", "+00:00"))
                signals["date_overlap"] = ev_start <= arr <= ev_end
            except Exception:
                signals["date_overlap"] = False
        else:
            signals["date_overlap"] = False

        # 3. Material match for commodity_price events
        material = payload.get("material")
        event_commodity = event.get("commodity")
        
        signals["material_match"] = False
        if material:
            if event_commodity and material.lower() == event_commodity.lower():
                signals["material_match"] = True
            elif event.get("description") and material.lower() in event.get("description").lower():
                signals["material_match"] = True

        # 4. Vendor country match for geopolitical/export events
        vendor_country = payload.get("vendor_country")
        event_loc_country = event.get("location")
        
        signals["vendor_country_match"] = False
        if vendor_country and event_loc_country:
            if vendor_country.lower() in event_loc_country.lower():
                signals["vendor_country_match"] = True
            elif event.get("description") and vendor_country.lower() in event.get("description").lower():
                signals["vendor_country_match"] = True

        return signals

    def assess_event(self, task: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Assess all external events for a given task and return list of ExternalRisk dicts."""
        events = self.event_provider.list_events()
        results = []
        for ev in events:
            signals = self._deterministic_signals(task, ev)
            
            relevance = 0.0
            estimated_impact = "No impact detected."
            affected_entities = []
            confidence = 0.95
            
            # Port congestion
            if ev.get("event_type") == "port_congestion":
                if signals.get("location_match") and signals.get("date_overlap"):
                    relevance = 0.95
                    estimated_impact = f"High congestion at {ev['location']} during delivery window; estimated 5 days delay."
                    affected_entities = [ev["location"]]
                elif signals.get("location_match"):
                    relevance = 0.70
                    estimated_impact = f"Congestion at route port {ev['location']}; possible logistics disruption."
                    affected_entities = [ev["location"]]
            
            # Weather
            elif ev.get("event_type") == "weather":
                if signals.get("location_match") and signals.get("date_overlap"):
                    relevance = 0.90
                    estimated_impact = f"Severe weather at {ev['location']} during delivery window; estimated 3 days delay."
                    affected_entities = [ev["location"]]
                elif signals.get("location_match"):
                    relevance = 0.60
                    estimated_impact = f"Weather event in region {ev['location']}; possible transit delays."
                    affected_entities = [ev["location"]]

            # Road closure
            elif ev.get("event_type") == "road_closure":
                if signals.get("location_match") and signals.get("date_overlap"):
                    relevance = 0.85
                    estimated_impact = f"Road closure on route {ev['location']}; estimated 2 days detour delay."
                    affected_entities = [ev["location"]]
                elif signals.get("location_match"):
                    relevance = 0.50
                    estimated_impact = f"Road closure near route area {ev['location']}."
                    affected_entities = [ev["location"]]

            # Commodity price
            elif ev.get("event_type") == "commodity_price":
                if signals.get("material_match"):
                    relevance = 0.90
                    price_change = ev.get("price_change", 12.0)
                    estimated_impact = f"Material price surge of {price_change}% directly impacts procurement costs."
                    affected_entities = [ev.get("commodity", "material")]
            
            # Geopolitical / Export restrictions / Tariffs
            elif ev.get("event_type") in ["export_restriction", "tariff", "geopolitical"]:
                if signals.get("vendor_country_match"):
                    relevance = 0.85
                    estimated_impact = f"Trade restriction in {ev.get('location')} directly affects vendor/supplier country."
                    affected_entities = [ev.get("location")]
                elif signals.get("material_match"):
                    relevance = 0.70
                    estimated_impact = f"Trade restriction affecting commodity {ev.get('commodity') or 'material'}."
                    affected_entities = [ev.get("commodity") or "material"]

            # General semantic/description overlap fallback
            if relevance == 0.0:
                task_desc = task.get("description", "").lower()
                # Check for overlaps of location or commodity name
                loc = ev.get("location", "")
                comm = ev.get("commodity", "")
                if loc and loc.lower() in task_desc:
                    relevance = 0.75
                    estimated_impact = f"Event at {loc} mentioned in task description."
                    affected_entities = [loc]
                elif comm and comm.lower() in task_desc:
                    relevance = 0.80
                    estimated_impact = f"Commodity event affecting {comm} mentioned in task description."
                    affected_entities = [comm]

            result = {
                "event_id": ev.get("event_id"),
                "event_type": ev.get("event_type"),
                "description": ev.get("description"),
                "relevance": relevance,
                "estimated_impact": estimated_impact,
                "affected_entities": affected_entities,
                "confidence": confidence if relevance > 0 else 0.0,
            }
            results.append(result)
        return results
