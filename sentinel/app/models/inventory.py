"""
SQLAlchemy models backing Feature 1 (AI Site Walk) and Feature 2
(Duplicate & Conflicting Order Catcher).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

_UTC = timezone.utc

def _now() -> datetime:
    return datetime.now(_UTC)

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    TypeDecorator,
)
from sqlalchemy.orm import declarative_base, relationship


Base = declarative_base()


def _uuid() -> str:
    return str(uuid.uuid4())


class PortableVector(TypeDecorator):
    """
    Uses real pgvector `Vector` on Postgres (where cosine-similarity queries
    in duplicate_checker.py run natively), but falls back to a plain JSON
    array on other dialects (e.g. SQLite) so the schema can be created and
    exercised in unit tests without a live Postgres + pgvector extension.
    """

    impl = JSON
    cache_ok = True

    def __init__(self, dim: int, *args, **kwargs):
        self.dim = dim
        super().__init__(*args, **kwargs)

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(Vector(self.dim))
        return dialect.type_descriptor(JSON())


class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    trust_score = Column(Float, default=1.0, nullable=False)
    created_at = Column(DateTime, default=_now)

    purchase_orders = relationship("PurchaseOrder", back_populates="vendor")


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, index=True, nullable=False)
    vendor_id = Column(String, ForeignKey("vendors.id"), nullable=True)
    requesting_team = Column(String, nullable=True)
    delivery_window_start = Column(DateTime, nullable=True)
    delivery_window_end = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)

    vendor = relationship("Vendor", back_populates="purchase_orders")
    line_items = relationship(
        "POLineItem", back_populates="purchase_order", cascade="all, delete-orphan"
    )


class POLineItem(Base):
    __tablename__ = "po_line_items"

    id = Column(String, primary_key=True, default=_uuid)
    purchase_order_id = Column(
        String, ForeignKey("purchase_orders.id"), nullable=False
    )
    item_name = Column(String, nullable=False)
    sku = Column(String, index=True, nullable=True)
    expected_qty = Column(Integer, nullable=False)
    unit = Column(String, nullable=False, default="unit")
    # Optional — used only to compute DuplicateMatch.estimated_savings_if_merged
    # in Feature 2. Left nullable since PO data won't always include per-unit
    # cost; savings estimates fall back to None when either side lacks it.
    unit_cost = Column(Float, nullable=True)
    # pgvector column for Feature 2's fuzzy duplicate matching.
    # Gemini text-embedding-004 produces 768-dim vectors.
    description_embedding = Column(PortableVector(768), nullable=True)
    created_at = Column(DateTime, default=_now)

    purchase_order = relationship("PurchaseOrder", back_populates="line_items")
    detected_items = relationship("DetectedItem", back_populates="matched_po_line")


class SiteWalkSession(Base):
    __tablename__ = "site_walk_sessions"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, index=True, nullable=False)
    video_path = Column(String, nullable=False)
    status = Column(String, default="pending", nullable=False)  # pending|processing|complete|error
    error_message = Column(Text, nullable=True)
    result = Column(JSON, nullable=True)  # serialized SiteWalkResult once complete
    created_at = Column(DateTime, default=_now)
    completed_at = Column(DateTime, nullable=True)

    detected_items = relationship(
        "DetectedItem", back_populates="session", cascade="all, delete-orphan"
    )


class DetectedItem(Base):
    __tablename__ = "detected_items"

    id = Column(String, primary_key=True, default=_uuid)
    session_id = Column(
        String, ForeignKey("site_walk_sessions.id"), nullable=False
    )
    matched_po_line_id = Column(
        String, ForeignKey("po_line_items.id"), nullable=True
    )
    name = Column(String, nullable=False)
    category = Column(String, nullable=False, index=True)
    detected_qty = Column(Integer, nullable=False, default=1)
    condition = Column(String, nullable=False, default="unclear")  # good|damaged|unclear
    confidence = Column(Float, nullable=False)
    frame_timestamp = Column(Float, nullable=False)  # seconds into video
    bounding_box = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=_now)

    session = relationship("SiteWalkSession", back_populates="detected_items")
    matched_po_line = relationship("POLineItem", back_populates="detected_items")
