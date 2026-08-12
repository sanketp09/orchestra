"""
Seeds 2-3 MillReference rows with realistic heat-number regex formats and stamp
characteristics. There's no public source for real mill stamp patterns, so this data is
necessarily fictional-but-realistic — flag this in the README's "what's real vs mocked"
section.

Run with: python -m scripts.seed_mill_references
"""
from __future__ import annotations

from app.db import Base, SessionLocal, engine
from app.models.materials import MillReference


def run() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        references = [
            MillReference(
                manufacturer_name="Ridgeview Steel Co.",
                known_stamp_pattern={
                    "font_characteristics": "bold sans-serif condensed uppercase",
                    "spacing_ratio": 1.2,
                    "heat_number_regex": r"RV-\d{6}",
                    "manufacturer_mark_aliases": ["RVS", "Ridgeview", "Ridgeview Steel"],
                },
            ),
            MillReference(
                manufacturer_name="Harlow Forge Works",
                known_stamp_pattern={
                    "font_characteristics": "serif engraved uppercase",
                    "spacing_ratio": 0.9,
                    "heat_number_regex": r"HFW\d{4}-[A-Z]{2}",
                    "manufacturer_mark_aliases": ["HFW", "Harlow", "Harlow Forge"],
                },
            ),
            MillReference(
                manufacturer_name="Cascade Metal Supply",
                known_stamp_pattern={
                    "font_characteristics": "bold sans-serif rounded",
                    "spacing_ratio": 1.05,
                    "heat_number_regex": r"CMS-[A-Z]\d{5}",
                    "manufacturer_mark_aliases": ["CMS", "Cascade", "Cascade Metal"],
                },
            ),
        ]
        db.add_all(references)
        db.commit()
        print(f"Seeded {len(references)} mill references.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
