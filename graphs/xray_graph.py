# Main analysis graph (LangGraph) per 02-ARCHITECTURE.md
# Extract → Sentinel → Precedent → Compass → Combine → Receipt Generator

from typing import TypedDict, List

class OrchestraState(TypedDict):
    document_text: str
    entity_id: str
    sentinel_flags: List[dict]
    precedent_matches: List[dict]
    compass_impacts: List[dict]
    decisions: List[dict]
    receipts: List[dict]
