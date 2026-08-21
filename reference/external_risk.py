from pydantic import BaseModel, Field
from typing import List

class ExternalRisk(BaseModel):
    event_id: str = Field(..., description="Identifier of the external event")
    event_type: str = Field(..., description="One of: port_congestion, tariff, commodity_price, geopolitical")
    description: str = Field(..., description="Human‑readable description of the event")
    relevance: float = Field(..., description="0‑1 relevance score for this procurement")
    estimated_impact: str = Field(..., description="Impact description, e.g., delay of 2 days")
    affected_entities: List[str] = Field(default_factory=list, description="List of entity IDs impacted (vendor, shipment, material, etc.)")
    confidence: float = Field(..., description="Confidence level of the assessment")
