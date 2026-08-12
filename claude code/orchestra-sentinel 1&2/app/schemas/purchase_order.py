from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.duplicate_check import DuplicateCheckResult


class POLineItemCreate(BaseModel):
    item_name: str
    sku: Optional[str] = None
    expected_qty: int
    unit: str = "unit"
    unit_cost: Optional[float] = None


class PurchaseOrderCreate(BaseModel):
    project_id: str
    vendor_id: Optional[str] = None
    requesting_team: Optional[str] = None
    delivery_window_start: Optional[datetime] = None
    delivery_window_end: Optional[datetime] = None
    line_items: list[POLineItemCreate] = Field(default_factory=list)


class PurchaseOrderResponse(BaseModel):
    id: str
    project_id: str
    vendor_id: Optional[str] = None
    requesting_team: Optional[str] = None
    line_item_ids: list[str]
    warnings: list[DuplicateCheckResult] = Field(default_factory=list)
