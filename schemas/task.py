from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class AgentTask(BaseModel):
    task_id: str = Field(..., description="Unique identifier for the task")
    capability: str = Field(..., description="Capability name to invoke, e.g., atlas.check_shipping_risk")
    project_id: Optional[str] = Field(None, description="Related project identifier")
    entity_ids: Optional[List[str]] = Field(default_factory=list, description="List of entity IDs involved")
    payload: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Capability-specific input data")
    context: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Arbitrary context supplied by ORCHESTRA")
