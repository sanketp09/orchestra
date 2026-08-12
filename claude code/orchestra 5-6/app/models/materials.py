from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, Float, String

from app.db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class MillReference(Base):
    """known_stamp_pattern shape:
    {
        "font_characteristics": str,       # e.g. "bold sans-serif condensed uppercase"
        "spacing_ratio": float,
        "heat_number_regex": str,          # e.g. r"RV-\\d{6}"
        "manufacturer_mark_aliases": list[str],
    }
    """

    __tablename__ = "mill_references"

    id = Column(String, primary_key=True, default=_uuid)
    manufacturer_name = Column(String, unique=True, nullable=False, index=True)
    known_stamp_pattern = Column(JSON, nullable=False)


class MaterialInspection(Base):
    __tablename__ = "material_inspections"

    id = Column(String, primary_key=True, default=_uuid)
    po_line_item_id = Column(String, nullable=True, index=True)
    photo_path = Column(String, nullable=False)
    claimed_manufacturer = Column(String, nullable=False, index=True)
    extracted_stamp_data = Column(JSON, nullable=False)
    verdict = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    inspected_at = Column(DateTime, default=datetime.utcnow)
