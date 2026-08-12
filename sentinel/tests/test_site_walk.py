"""
End-to-end test: runs the real Site Walk LangGraph — real video decoding via
opencv, real deduplication/matching logic — against a short sample video.

The only thing mocked is the Gemini vision API call itself
(`vision_detector.detect_items_in_frame`), since that requires a live
GEMINI_API_KEY and network access. Everything else (frame sampling,
dedup heuristic, PO matching, conditional routing, finalize/persist) is real.
"""

import os

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.graphs import site_walk_graph
from app.models.inventory import Base, POLineItem, PurchaseOrder, SiteWalkSession
from app.schemas.site_walk import DetectedItem

FIXTURE_VIDEO = os.path.join(
    os.path.dirname(__file__), "fixtures", "site_walk_sample.mp4"
)
PROJECT_ID = "proj-test-site"


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


@pytest.fixture
def seeded_session(db_session):
    po = PurchaseOrder(
        project_id=PROJECT_ID,
        requesting_team="Structural",
        line_items=[
            POLineItem(item_name="rebar", sku="REB-12MM", expected_qty=10, unit="pcs"),
            POLineItem(item_name="cement bags", sku="CEM-1", expected_qty=5, unit="bags"),
        ],
    )
    db_session.add(po)
    db_session.commit()

    walk_session = SiteWalkSession(
        project_id=PROJECT_ID,
        video_path=FIXTURE_VIDEO,
        status="pending",
    )
    db_session.add(walk_session)
    db_session.commit()
    return walk_session.id


def _fake_detect_items_in_frame(sampled_frame, category_taxonomy):
    """
    Deterministic stand-in for the real Claude vision call. Returns a rebar
    detection on the first two sampled frames (2s apart, i.e. within the 3s
    dedup window, so they should collapse into one item) and a cement-bags
    detection on the first frame only. This exercises: multi-frame dedup,
    a fully-matched line item (rebar), and a partially-short line item
    (cement bags).
    """
    detections = []
    if "rebar" in category_taxonomy and sampled_frame.frame_number in (0, 1):
        detections.append(
            DetectedItem(
                name="12mm rebar bundle",
                category="rebar",
                estimated_qty=10,
                condition="good",
                confidence=0.92,
                frame_number=sampled_frame.frame_number,
                frame_timestamp=sampled_frame.timestamp_seconds,
            )
        )
    if "cement bags" in category_taxonomy and sampled_frame.frame_number == 0:
        detections.append(
            DetectedItem(
                name="cement bags",
                category="cement bags",
                estimated_qty=3,
                condition="good",
                confidence=0.8,
                frame_number=sampled_frame.frame_number,
                frame_timestamp=sampled_frame.timestamp_seconds,
            )
        )
    return detections


def test_site_walk_graph_runs_end_to_end(monkeypatch, db_session, seeded_session):
    monkeypatch.setattr(
        "app.graphs.site_walk_graph.vision_detector.detect_items_in_frame",
        _fake_detect_items_in_frame,
    )

    graph = site_walk_graph.build_site_walk_graph(db_session)
    final_state = graph.invoke(
        {"video_path": FIXTURE_VIDEO, "session_id": seeded_session},
        config={"configurable": {"thread_id": seeded_session}},
    )

    result = final_state["matched"]

    # Real frame extraction actually ran and produced frames.
    assert len(final_state["frames"]) > 0

    # Real dedup collapsed the repeated even-frame rebar detections.
    rebar_detections = [d for d in result.detected_items if d.category == "rebar"]
    assert len(rebar_detections) == 1

    # Real PO matching: rebar fully matched, cement bags short.
    po_by_name = {m.item_name: m for m in result.po_matches}
    assert po_by_name["rebar"].detected_qty == 10
    assert po_by_name["rebar"].delta == 0
    assert po_by_name["cement bags"].detected_qty == 3
    assert po_by_name["cement bags"].delta == 2

    assert result.summary.feature == "site_walk"
    assert isinstance(result.session_id, str)


def test_site_walk_result_persisted_to_session(monkeypatch, db_session, seeded_session):
    monkeypatch.setattr(
        "app.graphs.site_walk_graph.vision_detector.detect_items_in_frame",
        _fake_detect_items_in_frame,
    )

    graph = site_walk_graph.build_site_walk_graph(db_session)
    graph.invoke(
        {"video_path": FIXTURE_VIDEO, "session_id": seeded_session},
        config={"configurable": {"thread_id": seeded_session}},
    )

    db_session.expire_all()
    refreshed = db_session.get(SiteWalkSession, seeded_session)
    assert refreshed.status == "complete"
    assert refreshed.result is not None
    assert refreshed.result["session_id"] == seeded_session
