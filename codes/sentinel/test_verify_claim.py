"""
Minimal tests for /verify_claim. Supabase and the LLM client are mocked so
these run with no network/DB access - they check that Sentinel's routing
and status logic behave correctly given a canned LLM verdict.
"""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from sentinel.logic import VerdictSchema
from sentinel.main import app
from sentinel.models import get_supabase


def _fake_supabase_with_evidence(evidence_rows):
    """A MagicMock standing in for the Supabase client, wired just enough
    for get_evidence_by_refs/find_relevant_evidence and the insert calls
    verify_claim makes along the way."""
    supabase = MagicMock()

    # evidence.select(...).in_(...).execute() -> rows
    (
        supabase.table.return_value.select.return_value.in_.return_value.execute.return_value
    ).data = evidence_rows

    # verification_results.insert(...).execute() -> a fake result_id
    insert_execute = supabase.table.return_value.insert.return_value.execute
    insert_execute.return_value.data = [{"result_id": "result-123"}]

    # claims.update(...).eq(...).execute() -> no-op
    supabase.table.return_value.update.return_value.eq.return_value.execute.return_value = (
        MagicMock()
    )

    return supabase


@pytest.fixture(autouse=True)
def _clear_overrides():
    yield
    app.dependency_overrides.clear()


def test_verify_claim_evidence_supports():
    evidence_rows = [
        {
            "evidence_id": "ev-1",
            "source_type": "pdf",
            "source_ref": "some/path.pdf",
            "extracted_text": "The delivery was completed on March 3rd as agreed.",
        }
    ]
    supabase = _fake_supabase_with_evidence(evidence_rows)
    app.dependency_overrides[get_supabase] = lambda: supabase

    canned = VerdictSchema(
        verdict="supported",
        confidence=0.9,
        explanation="The evidence confirms the delivery date matches the claim.",
    )
    with patch("sentinel.logic.generate_structured", return_value=canned):
        client = TestClient(app)
        resp = client.post(
            "/verify_claim",
            params={"task_id": "t1"},
            json={
                "project_id": "proj-1",
                "claim_text": "Delivery was completed on time.",
                "evidence_refs": ["ev-1"],
            },
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "COMPLETED"
    assert body["confidence"] == pytest.approx(0.9)
    assert body["findings"][0]["verdict"] == "supported"
    assert body["evidence"] == ["ev-1"]


def test_verify_claim_evidence_contradicts():
    evidence_rows = [
        {
            "evidence_id": "ev-2",
            "source_type": "pdf",
            "source_ref": "some/other.pdf",
            "extracted_text": "The delivery was delayed by two weeks due to customs.",
        }
    ]
    supabase = _fake_supabase_with_evidence(evidence_rows)
    app.dependency_overrides[get_supabase] = lambda: supabase

    canned = VerdictSchema(
        verdict="contradicted",
        confidence=0.85,
        explanation="The evidence shows a two-week delay, contradicting the on-time claim.",
        contradiction_details="Claim says on-time; evidence says delayed two weeks.",
    )
    with patch("sentinel.logic.generate_structured", return_value=canned):
        client = TestClient(app)
        resp = client.post(
            "/verify_claim",
            params={"task_id": "t2"},
            json={
                "project_id": "proj-1",
                "claim_text": "Delivery was completed on time.",
                "evidence_refs": ["ev-2"],
            },
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "COMPLETED"
    assert body["findings"][0]["verdict"] == "contradicted"
    assert body["findings"][0]["contradiction_details"]


def test_verify_claim_no_evidence_needs_more_evidence():
    supabase = MagicMock()
    # find_relevant_evidence hits the RPC path when evidence_refs is omitted
    supabase.rpc.return_value.execute.return_value.data = []
    app.dependency_overrides[get_supabase] = lambda: supabase

    client = TestClient(app)
    # embed() loads a real sentence-transformers model - mock it out so this
    # test only exercises Sentinel's routing/status logic, not the model.
    with patch("sentinel.retrieval.embed", return_value=[0.0] * 384):
        resp = client.post(
            "/verify_claim",
            params={"task_id": "t3"},
            json={
                "project_id": "proj-1",
                "claim_text": "Site inspection passed with no defects.",
            },
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "INSUFFICIENT_INFORMATION"
    assert body["confidence"] == 0.0
    assert "sentinel.find_missing_evidence" in body["recommended_next_capabilities"]
