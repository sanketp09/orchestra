from __future__ import annotations
from typing import Any
from pydantic import BaseModel, Field


class Capability(BaseModel):
    """
    Capability registered by specialist agents with ORCHESTRA's Capability Registry.
    """
    name: str                      # e.g., "sentinel.verify_claim"
    description: str               # Used by LLM planner to decide when to call this
    input_schema: dict[str, Any] = Field(default_factory=dict)
    output_schema: dict[str, Any] = Field(default_factory=dict)
    endpoint: str                  # e.g., "http://localhost:8001/verify_claim" or internal route
