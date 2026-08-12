from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.inventory import POLineItem, PurchaseOrder
from app.schemas.duplicate_check import DuplicateCheckResult
from app.schemas.purchase_order import PurchaseOrderCreate, PurchaseOrderResponse
from app.services import embeddings
from app.services.duplicate_checker import check_for_duplicates

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/purchase-orders", tags=["purchase-orders"])


@router.post("", response_model=PurchaseOrderResponse)
async def create_purchase_order(payload: PurchaseOrderCreate, db: Session = Depends(get_db)):
    po = PurchaseOrder(
        project_id=payload.project_id,
        vendor_id=payload.vendor_id,
        requesting_team=payload.requesting_team,
        delivery_window_start=payload.delivery_window_start,
        delivery_window_end=payload.delivery_window_end,
    )
    db.add(po)
    db.flush()  # assigns po.id without committing, so line items can reference it

    warnings: list[DuplicateCheckResult] = []

    for line_item_payload in payload.line_items:
        line_item = POLineItem(
            purchase_order_id=po.id,
            item_name=line_item_payload.item_name,
            sku=line_item_payload.sku,
            expected_qty=line_item_payload.expected_qty,
            unit=line_item_payload.unit,
            unit_cost=line_item_payload.unit_cost,
        )

        # Best-effort embedding — a duplicate check that only relies on exact
        # SKU matches is still useful, so we don't fail PO creation if the
        # embedding provider is unavailable.
        try:
            embedding = embeddings.embed_text(line_item_payload.item_name)
            line_item.description_embedding = embedding
        except Exception:  # noqa: BLE001
            embedding = None
            logger.warning(
                "Embedding failed for line item '%s'; falling back to exact-SKU-only "
                "duplicate check.",
                line_item_payload.item_name,
            )

        db.add(line_item)
        db.flush()  # assigns line_item.id
        line_item.purchase_order = po  # ensure relationship is populated for the checker

        result = check_for_duplicates(line_item, db, new_embedding=embedding)
        if any(m.severity in ("exact_duplicate", "likely_duplicate") for m in result.matches):
            warnings.append(result)

    db.commit()

    return PurchaseOrderResponse(
        id=po.id,
        project_id=po.project_id,
        vendor_id=po.vendor_id,
        requesting_team=po.requesting_team,
        line_item_ids=[li.id for li in po.line_items],
        warnings=warnings,
    )


@router.get("/{po_id}/duplicate-check", response_model=list[DuplicateCheckResult])
async def recheck_purchase_order_duplicates(po_id: str, db: Session = Depends(get_db)):
    po = db.get(PurchaseOrder, po_id)
    if po is None:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    results: list[DuplicateCheckResult] = []
    for line_item in po.line_items:
        results.append(check_for_duplicates(line_item, db))
    return results
