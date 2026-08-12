"""
Tests for Feature 2's duplicate checker. Pure deterministic logic
(no LangGraph, no LLM call), so everything here runs for real — the only
thing supplied externally is the embedding vectors themselves, since we
don't want to require a live API key in CI. We construct embeddings by hand
so the cosine-similarity math in duplicate_checker.py is exercised for real.
"""

from datetime import datetime, timedelta, timezone

_UTC = timezone.utc

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.inventory import Base, POLineItem, PurchaseOrder
from app.services.duplicate_checker import check_for_duplicates


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()


def _unit_vector(dim: int, hot_index: int, near: float = 0.0) -> list[float]:
    """
    Build a simple embedding: 1.0 at `hot_index`, `near` spread across a few
    neighboring indices (to simulate "close but not identical" wording), zero
    elsewhere. Lets us construct near-duplicate vs. unrelated embeddings with
    predictable cosine similarity instead of needing a real embedding API.
    """
    vec = [0.0] * dim
    vec[hot_index] = 1.0
    for offset in (1, 2, 3):
        if hot_index + offset < dim:
            vec[hot_index + offset] = near
    return vec


REBAR_VECTOR = _unit_vector(768, hot_index=10)
REBAR_NEAR_DUPLICATE_VECTOR = _unit_vector(768, hot_index=10, near=0.05)  # cosine sim > 0.85
UNRELATED_VECTOR = _unit_vector(768, hot_index=600)  # cosine sim ~0.0 vs rebar


def test_exact_sku_duplicate_is_caught(db_session):
    now = datetime.now(_UTC)
    po_a = PurchaseOrder(
        project_id="proj-1",
        requesting_team="Structural",
        delivery_window_start=now,
        delivery_window_end=now + timedelta(days=5),
        line_items=[POLineItem(item_name="12mm rebar", sku="REB-12MM", expected_qty=200)],
    )
    po_b = PurchaseOrder(
        project_id="proj-1",
        requesting_team="Electrical",
        delivery_window_start=now + timedelta(days=1),
        delivery_window_end=now + timedelta(days=6),
        line_items=[POLineItem(item_name="12mm rebar", sku="REB-12MM", expected_qty=180)],
    )
    db_session.add_all([po_a, po_b])
    db_session.commit()

    new_item = po_b.line_items[0]
    result = check_for_duplicates(new_item, db_session)

    assert len(result.matches) == 1
    match = result.matches[0]
    assert match.similarity_score == 1.0
    # same project, overlapping window, different team -> most severe bucket
    assert match.severity == "exact_duplicate"


def test_fuzzy_near_duplicate_is_caught_above_threshold(db_session):
    now = datetime.now(_UTC)
    po_a = PurchaseOrder(
        project_id="proj-1",
        requesting_team="Structural",
        delivery_window_start=now,
        delivery_window_end=now + timedelta(days=5),
        line_items=[
            POLineItem(
                item_name="12mm rebar",
                sku="REB-12MM",
                expected_qty=200,
                description_embedding=REBAR_VECTOR,
            )
        ],
    )
    po_b = PurchaseOrder(
        project_id="proj-1",
        requesting_team="Electrical",
        delivery_window_start=now + timedelta(days=1),
        delivery_window_end=now + timedelta(days=6),
        line_items=[
            POLineItem(
                item_name="12mm reinforcement bar",
                sku=None,  # no shared SKU -> only the fuzzy pass can catch this
                expected_qty=180,
            )
        ],
    )
    db_session.add_all([po_a, po_b])
    db_session.commit()

    new_item = po_b.line_items[0]
    result = check_for_duplicates(new_item, db_session, new_embedding=REBAR_NEAR_DUPLICATE_VECTOR)

    assert len(result.matches) == 1
    match = result.matches[0]
    assert match.similarity_score > 0.85
    assert match.existing_item_name == "12mm rebar"
    assert match.severity in ("likely_duplicate", "possible_overlap", "exact_duplicate")


def test_unrelated_line_items_are_not_flagged(db_session):
    now = datetime.now(_UTC)
    po_a = PurchaseOrder(
        project_id="proj-1",
        requesting_team="Structural",
        delivery_window_start=now,
        delivery_window_end=now + timedelta(days=5),
        line_items=[
            POLineItem(
                item_name="12mm rebar",
                sku="REB-12MM",
                expected_qty=200,
                description_embedding=REBAR_VECTOR,
            )
        ],
    )
    po_b = PurchaseOrder(
        project_id="proj-1",
        requesting_team="Finishing",
        delivery_window_start=now,
        delivery_window_end=now + timedelta(days=5),
        line_items=[
            POLineItem(
                item_name="ceramic floor tile",
                sku="TILE-CER-60",  # different SKU
                expected_qty=500,
            )
        ],
    )
    db_session.add_all([po_a, po_b])
    db_session.commit()

    new_item = po_b.line_items[0]
    # Genuinely unrelated embedding — should land well below the 0.85 threshold.
    result = check_for_duplicates(new_item, db_session, new_embedding=UNRELATED_VECTOR)

    assert len(result.matches) == 0
