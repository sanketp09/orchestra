"""
Seeds one bid package with 5 vendors and 2 line items so all three detectors have
something real to catch on first run:

  - Shared entity:   vendor-a and vendor-c share registered officer "J. Alvarez".
  - Synchronization: on "Grade 60 Rebar - 40ft", vendor-c bids exactly 1.05x vendor-a's
                     (winning) price — a textbook cover-bid signature.
  - Price outlier:   on "Structural Steel Beam - 20ft", vendor-e bids 5000/unit against a
                     cluster around 1000 — a genuine statistical outlier, independent of
                     the cover-bid signature above so each detector is exercised on its
                     own, unambiguous anomaly.

Run with: python -m scripts.seed_bid_data
"""
from __future__ import annotations

from datetime import datetime, timedelta

from app.db import Base, SessionLocal, engine
from app.models.bids import Bid, BidLineItem, BidPackage, VendorEntity

REBAR = "Grade 60 Rebar - 40ft"
BEAM = "Structural Steel Beam - 20ft"


def run() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        vendors = [
            VendorEntity(
                vendor_id="vendor-a",
                registered_officers=["J. Alvarez"],
                registered_address="100 Harbor Rd",
                bonding_agent="Meridian Surety",
            ),
            VendorEntity(
                vendor_id="vendor-b",
                registered_officers=["T. Nguyen"],
                registered_address="220 Foundry Ln",
                bonding_agent="Continental Bonding",
            ),
            VendorEntity(
                vendor_id="vendor-c",
                registered_officers=["J. Alvarez"],
                registered_address="415 Quarry St",
                bonding_agent="Meridian Surety",
            ),
            VendorEntity(
                vendor_id="vendor-d",
                registered_officers=["R. Okafor"],
                registered_address="9 Millwright Ave",
                bonding_agent="Pinnacle Bonding",
            ),
            VendorEntity(
                vendor_id="vendor-e",
                registered_officers=["S. Park"],
                registered_address="72 Ironside Blvd",
                bonding_agent="Continental Bonding",
            ),
        ]
        db.add_all(vendors)
        db.commit()

        package = BidPackage(
            project_id="proj-001",
            package_name="Rebar & Steel Supply — Phase 2",
            close_date=datetime.utcnow(),
        )
        db.add(package)
        db.commit()

        # (vendor_id, rebar unit price, beam unit price)
        bid_rows = [
            ("vendor-a", 480.00, 1000.00),  # winner on total price
            ("vendor-b", 512.00, 1010.00),
            ("vendor-c", 504.00, 1005.00),  # 504 = 480 * 1.05 exactly -> cover bid
            ("vendor-d", 495.00, 990.00),
            ("vendor-e", 520.00, 5000.00),  # beam price is a genuine statistical outlier
        ]

        for i, (vendor_id, rebar_price, beam_price) in enumerate(bid_rows):
            total_price = rebar_price * 40 + beam_price * 10
            bid = Bid(
                package_id=package.id,
                vendor_id=vendor_id,
                total_price=total_price,
                submitted_at=datetime.utcnow() - timedelta(days=i),
            )
            db.add(bid)
            db.commit()

            db.add(BidLineItem(bid_id=bid.id, item_name=REBAR, unit_price=rebar_price, quantity=40))
            db.add(BidLineItem(bid_id=bid.id, item_name=BEAM, unit_price=beam_price, quantity=10))
            db.commit()

        print("Seeded 1 bid package, 5 vendors, 5 bids across 2 line items.")
        print("Expected catches:")
        print("  - shared_entity_checker: vendor-a & vendor-c share officer 'J. Alvarez'")
        print("  - synchronization_detector: vendor-c rebar price (504.00) = 1.05x vendor-a's (480.00)")
        print("  - price_outlier: vendor-e beam price (5000.00) vs cluster around 1000.00")
    finally:
        db.close()


if __name__ == "__main__":
    run()
