"""
Shared base schema used across every Sentinel feature's result object.

ASSUMED TO ALREADY EXIST from earlier features (it's what the shared ReceiptCard component
renders). Included here as a minimal stub so this package is self-contained — delete and
repoint imports if your project already defines it.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class EvidenceResult(BaseModel):
    """The human-readable synthesis every feature's result carries for the ReceiptCard."""

    reasoning: str = Field(..., description="Plain-language explanation of the finding.")
    verdict: Literal["flagged", "clear", "needs_review"]
    confidence: float = Field(..., ge=0.0, le=1.0)
