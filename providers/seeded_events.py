from typing import List, Dict, Any
from .base import ExternalEventProvider
from datetime import datetime, timedelta

class SeededEventProvider(ExternalEventProvider):
    """Provides curated demo external events. If the Supabase table is empty, seed it with realistic mock data.
    Falls back gracefully to in-memory events if Supabase is inaccessible or the table does not exist.
    """
    def __init__(self):
        self.supabase = None
        self.table = "external_events"
        self.use_fallback = False
        
        # Define in-memory fallback events
        self.fallback_events = [
            {
                "event_id": "EXT-MUM-001",
                "event_type": "port_congestion",
                "location": "Mumbai Port",
                "description": "Severe congestion at Mumbai Port due to labor strike.",
                "severity": "high",
                "start_date": (datetime.utcnow() - timedelta(days=1)).isoformat(),
                "end_date": (datetime.utcnow() + timedelta(days=5)).isoformat(),
                "created_at": datetime.utcnow().isoformat(),
            },
            {
                "event_id": "EXT-ROAD-001",
                "event_type": "road_closure",
                "location": "Delhi-Nagpur Highway",
                "description": "Major road closure for construction, causing delays.",
                "severity": "medium",
                "start_date": (datetime.utcnow() - timedelta(days=2)).isoformat(),
                "end_date": (datetime.utcnow() + timedelta(days=10)).isoformat(),
                "created_at": datetime.utcnow().isoformat(),
            },
            {
                "event_id": "EXT-WEATHER-001",
                "event_type": "weather",
                "location": "Bangkok Region",
                "description": "Severe monsoon flooding affecting transport routes.",
                "severity": "high",
                "start_date": (datetime.utcnow() - timedelta(hours=12)).isoformat(),
                "end_date": (datetime.utcnow() + timedelta(days=3)).isoformat(),
                "created_at": datetime.utcnow().isoformat(),
            },
            {
                "event_id": "EXT-COMM-001",
                "event_type": "commodity_price",
                "commodity": "steel",
                "description": "Steel price surge 12% over last month.",
                "severity": "high",
                "price_change": 12.0,
                "created_at": datetime.utcnow().isoformat(),
            },
            {
                "event_id": "EXT-GEO-001",
                "event_type": "export_restriction",
                "location": "Vietnam",
                "description": "New export restriction on aluminum affecting suppliers.",
                "severity": "medium",
                "created_at": datetime.utcnow().isoformat(),
            },
            {
                "event_id": "EXT-IRR-001",
                "event_type": "unrelated_event",
                "location": "Paris",
                "description": "Cultural festival in Paris, irrelevant to procurement.",
                "severity": "low",
                "created_at": datetime.utcnow().isoformat(),
            },
        ]
        
        try:
            from common.supabase_client import get_supabase_client
            self.supabase = get_supabase_client()
            self._ensure_seeded()
        except Exception:
            self.use_fallback = True

    def _ensure_seeded(self):
        if self.use_fallback or not self.supabase:
            return
        try:
            res = self.supabase.table(self.table).select("*").execute()
            if not res.data:
                # Insert demo events
                for ev in self.fallback_events:
                    self.supabase.table(self.table).insert(ev).execute()
        except Exception:
            self.use_fallback = True

    def list_events(self) -> List[Dict[str, Any]]:
        if self.use_fallback or not self.supabase:
            return self.fallback_events
        try:
            res = self.supabase.table(self.table).select("*").execute()
            if not res.data:
                return self.fallback_events
            return res.data
        except Exception:
            return self.fallback_events
