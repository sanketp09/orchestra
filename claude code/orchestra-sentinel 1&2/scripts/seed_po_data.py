"""
Seed 3-4 realistic PO records with line items so the Site Walk matching logic
has real data to compare against on first run, and so Feature 2's duplicate
checker has a guaranteed real near-duplicate hit.

Usage:
    python -m scripts.seed_po_data
"""

from __future__ import annotations

from datetime import datetime, timedelta

from app.db import SessionLocal, engine
from app.models.inventory import Base, POLineItem, PurchaseOrder, Vendor

PROJECT_ID = "proj-riverside-tower"


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        vendor = Vendor(name="Konkan Building Materials Co.")
        db.add(vendor)
        db.flush()

        window_start = datetime.utcnow()
        window_end = window_start + timedelta(days=10)

        pos = [
            PurchaseOrder(
                project_id=PROJECT_ID,
                vendor_id=vendor.id,
                requesting_team="Structural",
                delivery_window_start=window_start,
                delivery_window_end=window_end,
                line_items=[
                    POLineItem(
                        item_name="12mm rebar",
                        sku="REB-12MM",
                        expected_qty=200,
                        unit="pcs",
                        unit_cost=0.85,
                    ),
                    POLineItem(
                        item_name="cement bags",
                        sku="CEM-OPC53",
                        expected_qty=150,
                        unit="bags",
                        unit_cost=6.5,
                    ),
                ],
            ),
            PurchaseOrder(
                project_id=PROJECT_ID,
                vendor_id=vendor.id,
                requesting_team="MEP",
                delivery_window_start=window_start,
                delivery_window_end=window_end,
                line_items=[
                    POLineItem(
                        item_name="PVC pipe 4in", sku="PVC-4IN", expected_qty=80, unit="pcs", unit_cost=3.2
                    ),
                ],
            ),
            PurchaseOrder(
                project_id=PROJECT_ID,
                vendor_id=vendor.id,
                requesting_team="Finishing",
                delivery_window_start=window_start,
                delivery_window_end=window_end,
                line_items=[
                    POLineItem(
                        item_name="ceramic floor tile",
                        sku="TILE-CER-60",
                        expected_qty=500,
                        unit="sqft",
                        unit_cost=1.1,
                    ),
                    POLineItem(
                        item_name="wall paint - white",
                        sku="PAINT-WHT-20L",
                        expected_qty=25,
                        unit="cans",
                        unit_cost=42.0,
                    ),
                ],
            ),
            PurchaseOrder(
                project_id=PROJECT_ID,
                vendor_id=vendor.id,
                requesting_team="Electrical",
                # Same project, overlapping window, different team from the
                # first PO above — deliberate near-duplicate for Feature 2's
                # demo: same real item as "12mm rebar", worded differently,
                # with no shared SKU (so it can only be caught by the fuzzy
                # embedding match, not the exact-SKU pass).
                delivery_window_start=window_start + timedelta(days=2),
                delivery_window_end=window_end + timedelta(days=2),
                line_items=[
                    POLineItem(
                        item_name="12mm reinforcement bar",
                        sku=None,
                        expected_qty=180,
                        unit="pcs",
                        unit_cost=0.9,
                    ),
                ],
            ),
        ]

        db.add_all(pos)
        db.commit()
        print(f"Seeded {len(pos)} purchase orders for project '{PROJECT_ID}'.")
        print(
            "Note: run embeddings.embed_text() over each line item's item_name "
            "and populate description_embedding separately (requires "
            "OPENAI_API_KEY) — this seed script only inserts structured data."
        )
    finally:
        db.close()


if __name__ == "__main__":
    seed()
