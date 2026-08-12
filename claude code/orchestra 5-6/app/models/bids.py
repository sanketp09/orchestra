from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, Float, ForeignKey, String
from sqlalchemy.orm import relationship

from app.db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class VendorEntity(Base):
    """Registration data used to power the shared-entity check.

    Seed data should deliberately give a couple of "independent" vendors a shared officer,
    address, or bonding agent so shared_entity_checker.py has something real to catch.
    """

    __tablename__ = "vendor_entities"

    id = Column(String, primary_key=True, default=_uuid)
    vendor_id = Column(String, unique=True, nullable=False, index=True)
    registered_officers = Column(JSON, nullable=False, default=list)  # list[str]
    registered_address = Column(String, nullable=True)
    bonding_agent = Column(String, nullable=True)

    bids = relationship("Bid", back_populates="vendor")


class BidPackage(Base):
    __tablename__ = "bid_packages"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, nullable=False, index=True)
    package_name = Column(String, nullable=False)
    close_date = Column(DateTime, nullable=False)

    bids = relationship("Bid", back_populates="package")


class Bid(Base):
    __tablename__ = "bids"

    id = Column(String, primary_key=True, default=_uuid)
    package_id = Column(String, ForeignKey("bid_packages.id"), nullable=False, index=True)
    vendor_id = Column(String, ForeignKey("vendor_entities.vendor_id"), nullable=False, index=True)
    total_price = Column(Float, nullable=False)
    submitted_at = Column(DateTime, default=datetime.utcnow)

    package = relationship("BidPackage", back_populates="bids")
    vendor = relationship("VendorEntity", back_populates="bids")
    line_items = relationship("BidLineItem", back_populates="bid")


class BidLineItem(Base):
    __tablename__ = "bid_line_items"

    id = Column(String, primary_key=True, default=_uuid)
    bid_id = Column(String, ForeignKey("bids.id"), nullable=False, index=True)
    item_name = Column(String, nullable=False, index=True)
    unit_price = Column(Float, nullable=False)
    quantity = Column(Float, nullable=False, default=1.0)

    bid = relationship("Bid", back_populates="line_items")
