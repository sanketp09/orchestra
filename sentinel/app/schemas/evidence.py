"""
Shared evidence schemas used across all Sentinel features (Site Walk, Duplicate
Checker, and future features). This is the common contract that lets the
frontend `ReceiptCard` component render any feature's output identically, and
that lets Trustline query aggregated evidence per vendor regardless of which
feature produced it.

NOTE: The prompt references "the shared base schema from architecture doc" /
"EvidenceNode/EvidenceEdge from the architecture doc" without including that
doc's contents. This file is a reasonable, self-consistent implementation of
that contract based on how it's used in the Feature 1 & 2 spec. Adjust field
names here if the real architecture doc differs.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class EvidenceSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class EvidenceNode(BaseModel):
    """A single node in the evidence graph — e.g. a vendor, a PO, a session."""

    node_id: str
    node_type: Literal["vendor", "purchase_order", "site_walk_session", "team", "project"]
    label: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class EvidenceEdge(BaseModel):
    """A directed edge linking two evidence nodes, e.g. session -> vendor."""

    from_node_id: str
    to_node_id: str
    relationship: str  # e.g. "flags", "delivered_by", "ordered_by"
    weight: float = 1.0


class EvidenceResult(BaseModel):
    """
    Common result envelope every Sentinel feature must produce. This is what
    gets persisted to the evidence graph and what the frontend ReceiptCard
    consumes, regardless of which feature generated it.
    """

    feature: str  # e.g. "site_walk", "duplicate_checker"
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    severity: EvidenceSeverity
    title: str
    summary: str
    # Keys this evidence should be written to, e.g. "vendor:123:trust_score".
    # Populated only when the evidence ties to a specific queryable entity.
    writes_to: list[str] = Field(default_factory=list)
    nodes: list[EvidenceNode] = Field(default_factory=list)
    edges: list[EvidenceEdge] = Field(default_factory=list)
    # Raw feature-specific payload (e.g. full SiteWalkResult / DuplicateCheckResult),
    # kept generic here so ReceiptCard has one shape to render across features.
    detail: dict[str, Any] = Field(default_factory=dict)
