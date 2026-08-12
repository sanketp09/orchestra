from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from app.schemas.shared import EvidenceResult


class PriceOutlier(BaseModel):
    bid_id: str
    line_item: str
    z_score: float
    flagged: bool


class SynchronizationSignal(BaseModel):
    vendor_a: str
    vendor_b: str
    pattern: str  # e.g. "line item priced at exact 1.05x winning bid across 3 packages"
    packages_observed: int
    confidence: float


class SharedEntityMatch(BaseModel):
    vendor_a: str
    vendor_b: str
    shared_field: Literal["officer", "address", "bonding_agent"]
    value: str


class BidIntegrityResult(BaseModel):
    package_id: str
    price_outliers: list[PriceOutlier]
    synchronization_signals: list[SynchronizationSignal]
    shared_entities: list[SharedEntityMatch]
    summary: EvidenceResult  # reasoning field holds the LLM synthesis
