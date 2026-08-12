"""
Note on the split below: the plan's seed description bundles the cover-bid signature and
the shared-officer match as "the" two seeded anomalies. In practice a cover bid a few
percent above the winner is, by design, NOT a statistical outlier within one package —
that's exactly why synchronization_detector exists as a separate check. So the seed data
here (see scripts/seed_bid_data.py) gives price_outlier its own unambiguous statistical
outlier (vendor-e's beam price) distinct from the synchronization signature (vendor-c's
rebar price), so each detector is tested against the anomaly it's actually meant to catch.
"""
from __future__ import annotations

from datetime import datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base
from app.models.bids import Bid, BidLineItem, BidPackage, VendorEntity
from app.services.price_outlier import detect_price_outliers
from app.services.shared_entity_checker import find_shared_entities
from app.services.synchronization_detector import detect_synchronization

REBAR = "Grade 60 Rebar - 40ft"
BEAM = "Structural Steel Beam - 20ft"


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


def _seed_anomalous_package(db):
    vendors = [
        VendorEntity(vendor_id="vendor-a", registered_officers=["J. Alvarez"], registered_address="100 Harbor Rd"),
        VendorEntity(vendor_id="vendor-b", registered_officers=["T. Nguyen"], registered_address="220 Foundry Ln"),
        VendorEntity(vendor_id="vendor-c", registered_officers=["J. Alvarez"], registered_address="415 Quarry St"),
        VendorEntity(vendor_id="vendor-d", registered_officers=["R. Okafor"], registered_address="9 Millwright Ave"),
        VendorEntity(vendor_id="vendor-e", registered_officers=["S. Park"], registered_address="72 Ironside Blvd"),
    ]
    db.add_all(vendors)
    db.commit()

    package = BidPackage(project_id="proj-test", package_name="Test Package", close_date=datetime.utcnow())
    db.add(package)
    db.commit()

    # (vendor_id, rebar price, beam price)
    rows = [
        ("vendor-a", 480.00, 1000.00),
        ("vendor-b", 512.00, 1010.00),
        ("vendor-c", 504.00, 1005.00),  # 1.05x vendor-a's rebar price
        ("vendor-d", 495.00, 990.00),
        ("vendor-e", 520.00, 5000.00),  # genuine beam price outlier
    ]

    bids = []
    for vendor_id, rebar_price, beam_price in rows:
        bid = Bid(package_id=package.id, vendor_id=vendor_id, total_price=rebar_price * 40 + beam_price * 10)
        db.add(bid)
        db.commit()
        db.add(BidLineItem(bid_id=bid.id, item_name=REBAR, unit_price=rebar_price, quantity=40))
        db.add(BidLineItem(bid_id=bid.id, item_name=BEAM, unit_price=beam_price, quantity=10))
        db.commit()
        bids.append(bid)

    return package, bids


def _seed_clean_package(db):
    vendors = [
        VendorEntity(vendor_id="vendor-f", registered_officers=["A. Brooks"], registered_address="1 Clean St"),
        VendorEntity(vendor_id="vendor-g", registered_officers=["B. Chen"], registered_address="2 Clean St"),
        VendorEntity(vendor_id="vendor-h", registered_officers=["C. Diaz"], registered_address="3 Clean St"),
    ]
    db.add_all(vendors)
    db.commit()

    package = BidPackage(project_id="proj-clean", package_name="Clean Package", close_date=datetime.utcnow())
    db.add(package)
    db.commit()

    prices = {"vendor-f": 500.00, "vendor-g": 503.00, "vendor-h": 498.00}
    bids = []
    for vendor_id, price in prices.items():
        bid = Bid(package_id=package.id, vendor_id=vendor_id, total_price=price * 40)
        db.add(bid)
        db.commit()
        db.add(BidLineItem(bid_id=bid.id, item_name=REBAR, unit_price=price, quantity=40))
        db.commit()
        bids.append(bid)

    return package, bids


def test_price_outlier_flags_the_seeded_statistical_outlier(db_session):
    package, bids = _seed_anomalous_package(db_session)
    line_items = db_session.query(BidLineItem).all()

    outliers = detect_price_outliers(bids, line_items)
    vendor_e_bid_id = next(b.id for b in bids if b.vendor_id == "vendor-e")

    flagged_bid_ids = {o.bid_id for o in outliers if o.flagged}
    assert vendor_e_bid_id in flagged_bid_ids

    # And it should NOT have flagged the cover-bid price — that's a different detector's job.
    vendor_c_bid_id = next(b.id for b in bids if b.vendor_id == "vendor-c")
    assert vendor_c_bid_id not in flagged_bid_ids


def test_synchronization_detector_flags_the_seeded_cover_bid(db_session):
    package, bids = _seed_anomalous_package(db_session)
    line_items = db_session.query(BidLineItem).all()

    signals = detect_synchronization(bids, line_items)
    pairs = {frozenset([s.vendor_a, s.vendor_b]) for s in signals}
    assert frozenset(["vendor-a", "vendor-c"]) in pairs


def test_shared_entity_checker_catches_seeded_officer(db_session):
    _seed_anomalous_package(db_session)
    matches = find_shared_entities(
        ["vendor-a", "vendor-b", "vendor-c", "vendor-d", "vendor-e"], db_session
    )
    officer_matches = [m for m in matches if m.shared_field == "officer"]
    assert any({m.vendor_a, m.vendor_b} == {"vendor-a", "vendor-c"} for m in officer_matches)


def test_clean_package_returns_no_flags_across_all_three_detectors(db_session):
    package, bids = _seed_clean_package(db_session)
    line_items = db_session.query(BidLineItem).all()

    outliers = detect_price_outliers(bids, line_items)
    assert all(not o.flagged for o in outliers)

    signals = detect_synchronization(bids, line_items)
    assert signals == []

    matches = find_shared_entities(["vendor-f", "vendor-g", "vendor-h"], db_session)
    assert matches == []
