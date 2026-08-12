"""
These tests exercise the deterministic matcher (stamp_matcher.py) directly, using
synthetic ExtractedStampData instead of real photos — that keeps them fast, free of API
calls, and independent of any images.

The plan calls for two *photos* to test the full extraction pipeline end-to-end (a clean
matching stamp photo and a deliberately mismatched one). Those images aren't something
this environment can produce, so per the plan's own note, they still need to be supplied
in tests/fixtures/material_photos/ before extending these into full-pipeline tests that
call extract_stamp_data() against a real Claude vision request.
"""
from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base
from app.models.materials import MillReference
from app.schemas.materials import ExtractedStampData
from app.services.stamp_matcher import match_against_reference


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()

    session.add(
        MillReference(
            manufacturer_name="Ridgeview Steel Co.",
            known_stamp_pattern={
                "font_characteristics": "bold sans-serif condensed uppercase",
                "spacing_ratio": 1.2,
                "heat_number_regex": r"RV-\d{6}",
                "manufacturer_mark_aliases": ["RVS", "Ridgeview", "Ridgeview Steel"],
            },
        )
    )
    session.commit()

    yield session
    session.close()


def test_matching_stamp_returns_verified(db_session):
    extracted = ExtractedStampData(
        visible_text="RVS RV-402981",
        heat_number="RV-402981",
        manufacturer_mark="RVS",
        estimated_font_style="bold sans-serif condensed uppercase",
        spacing_notes="tight, even spacing",
    )
    score, verdict, needs_human = match_against_reference(extracted, "Ridgeview Steel Co.", db_session)

    assert verdict == "verified"
    assert not needs_human
    assert score >= 0.65


def test_mismatched_stamp_returns_contradicted_or_uncertain(db_session):
    extracted = ExtractedStampData(
        visible_text="ACME 8871-QX",
        heat_number="8871-QX",
        manufacturer_mark="ACME",
        estimated_font_style="thin script lowercase",
        spacing_notes="wide, irregular spacing",
    )
    score, verdict, needs_human = match_against_reference(extracted, "Ridgeview Steel Co.", db_session)

    assert verdict in ("contradicted", "uncertain")
    assert score < 0.65


def test_unknown_manufacturer_always_escalates(db_session):
    extracted = ExtractedStampData(
        visible_text="???",
        estimated_font_style="unknown",
        spacing_notes="unclear",
    )
    score, verdict, needs_human = match_against_reference(extracted, "Not A Real Mill", db_session)

    assert needs_human is True
    assert verdict == "uncertain"
