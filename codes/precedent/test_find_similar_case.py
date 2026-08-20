"""
Minimal test for find_similar_case.

This hits the live Supabase project by default (matching the "run
find_similar_case against a known seeded case" instruction), so it only
runs if SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are set and seed_data.py has
already been run once. It's skipped otherwise so the suite stays green in
environments without those credentials.
"""

import os

import pytest
from fastapi.testclient import TestClient

from main import app

pytestmark = pytest.mark.skipif(
    not (os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_ROLE_KEY")),
    reason="requires a live, seeded Supabase project",
)

client = TestClient(app)

# Pulled verbatim from one of the seed_data.py vendor_history cases so the
# semantic match should be strong and unambiguous.
KNOWN_SEEDED_SUMMARY = (
    "Meridian Steel was the lowest bidder on structural steel for the "
    "Meridian Data Center project but generated 4 change orders during "
    "fabrication, driving a 15% cost overrun against the original PO. "
    "Root cause was underspecified connection details in the original bid package."
)


def test_find_similar_case_returns_known_case_as_top_match():
    response = client.post(
        "/find_similar_case",
        json={"situation_description": KNOWN_SEEDED_SUMMARY, "top_k": 5},
    )
    assert response.status_code == 200

    result = response.json()
    assert result["status"] == "completed"
    assert len(result["findings"]) > 0

    top_match = result["findings"][0]
    # The known case, queried with its own summary, should come back at or
    # very near the top with a near-1.0 similarity score.
    assert top_match["summary"] == KNOWN_SEEDED_SUMMARY
    assert top_match["similarity"] > 0.95
    assert result["confidence"] > 0.95
