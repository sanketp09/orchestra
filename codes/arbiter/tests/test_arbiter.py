"""
Minimal sanity test for Arbiter's reasoning logic.

Uses a hand-written fake context (evidence + a contradiction + vendor
history) and calls into logic.py directly — no FastAPI, no Supabase — so it
can run standalone with just ANTHROPIC_API_KEY set.

Run with:
    python tests/test_arbiter.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import logic  # noqa: E402

# ---------------------------------------------------------------------------
# Fake context: vendor over-claimed completion, no external disruption found,
# vendor has 2 prior similar incidents. "Correct" story: cause is vendor
# overstatement / progress-reporting inaccuracy, responsibility should skew
# heavily toward the vendor since nothing points to external causes.
# ---------------------------------------------------------------------------

FAKE_CLAIMS = [
    {
        "claim_id": "claim-1001",
        "party": "vendor",
        "text": "Vendor submitted a progress claim stating the foundation and structural work was 80% complete as of the billing cycle.",
    }
]

FAKE_EVIDENCE_CONTEXT = {
    "verified_facts": [
        "Site inspection photos dated the same week show foundation work at approximately 55% completion.",
        "No weather delay reports, permit holds, or supplier disruptions were logged for this project in the claim period.",
        "Material delivery logs show all required materials arrived on schedule before the claim date.",
    ],
    "contradictions": [
        "Vendor's 80% completion claim contradicts inspection photo evidence showing ~55% completion for the same date."
    ],
    "vendor_trust_signals": {
        "vendor_id": "vendor-42",
        "trust_score": 0.41,
        "note": "Below-average trust score driven by prior progress-reporting discrepancies.",
    },
    "similar_cases": [
        {
            "case_ref": "case-771",
            "summary": "Same vendor previously overstated completion percentage by ~20 points on an unrelated project; resolved as vendor responsibility.",
        },
        {
            "case_ref": "case-802",
            "summary": "Same vendor submitted a progress claim later revised downward after an independent inspection.",
        },
    ],
}


def run():
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ANTHROPIC_API_KEY not set — skipping live LLM test.")
        print("Set ANTHROPIC_API_KEY and re-run to exercise analyze_causation / assess_responsibility.")
        return

    print("=== analyze_causation ===")
    causation = logic.analyze_causation(
        claims=FAKE_CLAIMS,
        evidence_context=FAKE_EVIDENCE_CONTEXT,
        timeline=None,
    )
    causes = causation["causes"]
    assert causes, "Expected at least one cause"
    top = causes[0]
    print(f"Top cause: {top['cause']}")
    print(f"Confidence: {top['confidence']}")
    print(f"Supporting context: {top['supporting_context']}")
    print(f"Reasoning summary: {causation['reasoning_summary']}")

    assert 0.0 <= top["confidence"] <= 1.0, "Confidence must be in [0, 1]"
    # Sanity check against the scenario's "correct" story: expect the top
    # cause to reference overstatement / discrepancy / inaccurate reporting,
    # not something unrelated.
    plausible_terms = ("overst", "discrepanc", "inaccura", "misreport", "progress")
    assert any(t in top["cause"].lower() for t in plausible_terms), (
        f"Top cause '{top['cause']}' doesn't look like the expected "
        "vendor-overstatement story — inspect manually."
    )

    print("\n=== assess_responsibility ===")
    responsibility = logic.assess_responsibility(causes)["responsibility"]
    for r in responsibility:
        print(f"{r['party']}: {r['percentage']}% — {r['justification']}")

    total = sum(r["percentage"] for r in responsibility)
    assert abs(total - 100) < 0.5, f"Responsibility percentages summed to {total}, expected 100"

    vendor_pct = next((r["percentage"] for r in responsibility if "vendor" in r["party"].lower()), 0)
    assert vendor_pct >= 50, (
        f"Expected vendor to bear majority responsibility given no external cause was found, "
        f"got {vendor_pct}%"
    )

    print("\nAll checks passed.")


if __name__ == "__main__":
    run()
