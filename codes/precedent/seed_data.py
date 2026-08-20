"""
seed_data.py — standalone script, NOT an API endpoint.

Generates ~25 realistic synthetic procurement historical cases and inserts
them into `historical_cases`, embedding each case's `summary` via the shared
embedding_client on the way in.

Uses the same demo entities as the rest of the ORCHESTRA platform (Meridian
Steel, Coastal Bolt, Austin Semiconductor Fab, the Meridian Data Center
project) alongside a handful of other synthetic vendors/projects so
find_similar_case has enough variety to be demo-able.

Run once:
    python seed_data.py
"""

import sys
import uuid

from common.embedding_client import embed
from common.supabase_client import get_client

# ---------------------------------------------------------------------------
# 1. VENDOR_HISTORY cases (~8)
# ---------------------------------------------------------------------------

VENDOR_HISTORY_CASES = [
    {
        "project_id": "meridian-data-center",
        "vendor_id": "meridian-steel",
        "summary": (
            "Meridian Steel was the lowest bidder on structural steel for the "
            "Meridian Data Center project but generated 4 change orders during "
            "fabrication, driving a 15% cost overrun against the original PO. "
            "Root cause was underspecified connection details in the original bid package."
        ),
        "details": {
            "original_bid": 4_200_000,
            "final_cost": 4_830_000,
            "overrun_pct": 15,
            "change_order_count": 4,
            "root_cause": "underspecified connection details",
        },
        "outcome": (
            "Client absorbed the overrun but flagged Meridian Steel for tighter bid-package "
            "review on future structural packages."
        ),
    },
    {
        "project_id": "harborline-logistics-hub",
        "vendor_id": "coastal-bolt",
        "summary": (
            "Coastal Bolt delivered fasteners for the Harborline Logistics Hub 11 days late "
            "against a committed lead time, triggering a two-day crew standby on site. "
            "Vendor cited a sub-tier mill delay it had not disclosed at award."
        ),
        "details": {
            "committed_lead_time_days": 21,
            "actual_lead_time_days": 32,
            "standby_days": 2,
            "disclosed_at_award": False,
        },
        "outcome": (
            "Vendor issued a partial credit for standby costs; buyer added a mill-of-origin "
            "disclosure requirement to Coastal Bolt's next PO."
        ),
    },
    {
        "project_id": "austin-semiconductor-fab",
        "vendor_id": "coastal-bolt",
        "summary": (
            "On the Austin Semiconductor Fab project, Coastal Bolt held on-time delivery "
            "across 6 consecutive POs after the Harborline delay, including one expedited "
            "order turned around in 9 days against a normal 21-day lead time."
        ),
        "details": {
            "consecutive_on_time_pos": 6,
            "expedited_turnaround_days": 9,
            "normal_lead_time_days": 21,
        },
        "outcome": (
            "Buyer upgraded Coastal Bolt from 'watch list' to 'approved, standard terms' "
            "for future fastener packages."
        ),
    },
    {
        "project_id": "austin-semiconductor-fab",
        "vendor_id": "meridian-steel",
        "summary": (
            "Meridian Steel's second engagement, on the Austin Semiconductor Fab clean-room "
            "structural package, showed no change orders after the buyer required 100% "
            "connection-detail sign-off before award, directly addressing the prior project's root cause."
        ),
        "details": {
            "change_order_count": 0,
            "mitigation_applied": "100% connection-detail sign-off pre-award",
        },
        "outcome": (
            "Zero-overrun delivery; buyer standardized the pre-award sign-off requirement "
            "for all future structural steel packages over $2M."
        ),
    },
    {
        "project_id": "riverbend-mixed-use",
        "vendor_id": "granite-ridge-concrete",
        "summary": (
            "Granite Ridge Concrete underbid a ready-mix package for the Riverbend Mixed-Use "
            "project by 22% below the next-closest bid, then requested a mid-project price "
            "escalation citing cement index increases not covered by the contract's escalation clause."
        ),
        "details": {
            "underbid_pct": 22,
            "requested_escalation_pct": 9,
            "contract_covered_escalation": False,
        },
        "outcome": (
            "Buyer denied the escalation request per contract terms; vendor completed at "
            "original price but was excluded from the next two bid invitations."
        ),
    },
    {
        "project_id": "westfield-logistics-park",
        "vendor_id": "granite-ridge-concrete",
        "summary": (
            "Granite Ridge Concrete's bid on Westfield Logistics Park included an explicit "
            "cement-index escalation clause after the Riverbend dispute, and the vendor "
            "invoked it once mid-project without friction, recovering a 6% cost increase transparently."
        ),
        "details": {
            "escalation_pct_invoked": 6,
            "dispute_occurred": False,
        },
        "outcome": (
            "Clean resolution; buyer noted the clause change as a direct process improvement "
            "traceable to the earlier Riverbend precedent."
        ),
    },
    {
        "project_id": "pinecrest-office-tower",
        "vendor_id": "vantage-mep-systems",
        "summary": (
            "Vantage MEP Systems was awarded HVAC controls on Pinecrest Office Tower despite "
            "a mid-tier technical score, on price, then failed commissioning twice due to "
            "sequence-of-operations errors, delaying substantial completion by 3 weeks."
        ),
        "details": {
            "technical_score_percentile": 45,
            "commissioning_attempts": 3,
            "delay_weeks": 3,
        },
        "outcome": (
            "Buyer's procurement team added a minimum technical-score floor for MEP controls "
            "awards regardless of price, effective the following quarter."
        ),
    },
    {
        "project_id": "meridian-data-center",
        "vendor_id": "vantage-mep-systems",
        "summary": (
            "Vantage MEP Systems, re-engaged on the Meridian Data Center project under the new "
            "technical-score floor policy, passed commissioning on the first attempt with no "
            "sequence-of-operations defects logged."
        ),
        "details": {
            "commissioning_attempts": 1,
            "defects_logged": 0,
        },
        "outcome": (
            "Buyer cited this as validation of the technical-score floor policy adopted after Pinecrest."
        ),
    },
]

# ---------------------------------------------------------------------------
# 2. CONTRACT cases (~7)
# ---------------------------------------------------------------------------

CONTRACT_CASES = [
    {
        "project_id": "meridian-data-center",
        "vendor_id": "meridian-steel",
        "summary": (
            "A liquidated-damages clause on the Meridian Data Center steel package capped "
            "penalties at 5% of PO value; when Meridian Steel's 3-week delay would have "
            "exceeded that cap, the buyer's recovery was contractually limited despite larger actual impact."
        ),
        "details": {
            "clause_type": "liquidated_damages",
            "cap_pct": 5,
            "actual_delay_weeks": 3,
            "impact_exceeded_cap": True,
        },
        "outcome": (
            "Buyer recovered the capped 5% only; legal flagged the cap as too low for "
            "critical-path structural packages going forward."
        ),
    },
    {
        "project_id": "westfield-logistics-park",
        "vendor_id": "granite-ridge-concrete",
        "summary": (
            "A cement-index price-escalation clause, added after the Riverbend dispute, "
            "specified a named public index and a quarterly reset — this precise wording "
            "prevented any disagreement when Granite Ridge invoked it on Westfield."
        ),
        "details": {
            "clause_type": "price_escalation",
            "index_named": True,
            "reset_frequency": "quarterly",
        },
        "outcome": (
            "No dispute; clause has since been adopted as the buyer's standard escalation language."
        ),
    },
    {
        "project_id": "harborline-logistics-hub",
        "vendor_id": "coastal-bolt",
        "summary": (
            "The original Coastal Bolt PO for Harborline had no sub-tier disclosure "
            "requirement, which the vendor later argued excused it from liability for an "
            "undisclosed mill delay — a gap the buyer closed in the vendor's next contract."
        ),
        "details": {
            "clause_type": "sub_tier_disclosure",
            "present_in_original": False,
            "added_after_dispute": True,
        },
        "outcome": (
            "Buyer added mandatory mill-of-origin and sub-tier disclosure language to all "
            "future Coastal Bolt POs."
        ),
    },
    {
        "project_id": "pinecrest-office-tower",
        "vendor_id": "vantage-mep-systems",
        "summary": (
            "A commissioning-retry clause on the Pinecrest MEP controls contract allowed "
            "unlimited re-attempts at vendor cost but set no outer deadline, which let the "
            "3-week delay occur without triggering any contractual remedy."
        ),
        "details": {
            "clause_type": "commissioning_retry",
            "retry_limit": None,
            "deadline_specified": False,
        },
        "outcome": (
            "Legal recommended adding a hard commissioning deadline with liquidated damages "
            "past a defined retry count."
        ),
    },
    {
        "project_id": "austin-semiconductor-fab",
        "vendor_id": "meridian-steel",
        "summary": (
            "A pre-award connection-detail sign-off requirement, written into the Austin "
            "Semiconductor Fab structural steel contract, made 100% design completeness a "
            "condition of award rather than a post-award deliverable."
        ),
        "details": {
            "clause_type": "pre_award_design_completeness",
            "threshold_pct": 100,
        },
        "outcome": (
            "Directly credited with the zero-change-order outcome on that package; now a "
            "standard clause for structural steel awards over $2M."
        ),
    },
    {
        "project_id": "riverbend-mixed-use",
        "vendor_id": "granite-ridge-concrete",
        "summary": (
            "The Riverbend Mixed-Use concrete contract's escalation clause referenced "
            "'market conditions' without naming a specific index, leaving both parties to "
            "argue over what counted as a covered escalation event."
        ),
        "details": {
            "clause_type": "price_escalation",
            "index_named": False,
        },
        "outcome": (
            "Ambiguity resolved in the buyer's favor on this project, but prompted the "
            "index-naming fix used on the later Westfield contract."
        ),
    },
    {
        "project_id": "harborline-logistics-hub",
        "vendor_id": "coastal-bolt",
        "summary": (
            "A standby-cost clause entitled the buyer to bill idle crew time back to a "
            "vendor causing a delivery delay, which the buyer successfully invoked against "
            "Coastal Bolt for the 2-day standby on Harborline."
        ),
        "details": {
            "clause_type": "standby_cost_recovery",
            "days_recovered": 2,
        },
        "outcome": "Vendor issued a partial credit without dispute; clause proved effective and low-friction.",
    },
]

# ---------------------------------------------------------------------------
# 3. DISPUTE cases (~6)
# ---------------------------------------------------------------------------

DISPUTE_CASES = [
    {
        "project_id": "riverbend-mixed-use",
        "vendor_id": "granite-ridge-concrete",
        "summary": (
            "Granite Ridge Concrete disputed the buyer's refusal to grant a mid-project "
            "price escalation on Riverbend Mixed-Use, arguing cement index increases were "
            "an implied covered event even though the clause didn't name a specific index."
        ),
        "details": {
            "dispute_cause": "ambiguous escalation clause",
            "amount_in_dispute": 310_000,
            "resolution_method": "negotiated, no arbitration",
        },
        "outcome": "Buyer prevailed on contract wording; vendor completed at original price under protest.",
    },
    {
        "project_id": "harborline-logistics-hub",
        "vendor_id": "coastal-bolt",
        "summary": (
            "A dispute arose on Harborline Logistics Hub over whether Coastal Bolt's "
            "undisclosed sub-tier mill delay constituted a force majeure event excusing "
            "late delivery, given no disclosure clause existed at the time."
        ),
        "details": {
            "dispute_cause": "force majeure claim vs. non-disclosure",
            "resolution_method": "negotiated credit",
        },
        "outcome": "Vendor agreed to a partial standby-cost credit rather than pursue the force majeure claim.",
    },
    {
        "project_id": "pinecrest-office-tower",
        "vendor_id": "vantage-mep-systems",
        "summary": (
            "The buyer and Vantage MEP Systems disputed responsibility for the 3-week "
            "commissioning delay on Pinecrest Office Tower, with the vendor arguing the "
            "buyer's late sequence-of-operations documentation contributed to the failures."
        ),
        "details": {
            "dispute_cause": "shared responsibility claim",
            "delay_weeks": 3,
            "resolution_method": "negotiated, cost split",
        },
        "outcome": (
            "Delay costs split 60/40 in the buyer's favor after review found documentation "
            "was late but not the primary cause."
        ),
    },
    {
        "project_id": "westfield-logistics-park",
        "vendor_id": "sable-crane-rental",
        "summary": (
            "Sable Crane Rental disputed a damage backcharge on Westfield Logistics Park, "
            "claiming pre-existing wear was misattributed to on-site misuse by the general "
            "contractor's crew."
        ),
        "details": {
            "dispute_cause": "equipment damage attribution",
            "amount_in_dispute": 48_000,
            "resolution_method": "third-party inspection",
        },
        "outcome": (
            "Independent inspection found partial pre-existing wear; backcharge reduced by 40%."
        ),
    },
    {
        "project_id": "meridian-data-center",
        "vendor_id": "meridian-steel",
        "summary": (
            "Meridian Steel disputed the liquidated-damages assessment on the Meridian Data "
            "Center project, arguing the delay was partly caused by buyer-side RFI response "
            "times exceeding the contractual 5-business-day window."
        ),
        "details": {
            "dispute_cause": "RFI turnaround contribution to delay",
            "resolution_method": "negotiated, partial LD waiver",
        },
        "outcome": (
            "Buyer waived 1 of the 3 delay weeks from LD calculation after confirming two "
            "RFIs exceeded the response window."
        ),
    },
    {
        "project_id": "austin-semiconductor-fab",
        "vendor_id": "granite-ridge-concrete",
        "summary": (
            "A dispute over clean-room floor flatness tolerances on Austin Semiconductor "
            "Fab centered on whether Granite Ridge Concrete's pour met the FF/FL spec called "
            "out in a referenced-but-not-attached industry standard."
            ),
        "details": {
            "dispute_cause": "ambiguous spec incorporation by reference",
            "resolution_method": "re-survey and partial re-work",
        },
        "outcome": (
            "Independent survey found 80% of the pour in spec; vendor re-worked the "
            "remaining 20% at its own cost to avoid further dispute."
        ),
    },
]

# ---------------------------------------------------------------------------
# 4. GENERAL_CASE entries (~4)
# ---------------------------------------------------------------------------

GENERAL_CASES = [
    {
        "project_id": "portfolio-wide",
        "vendor_id": None,
        "summary": (
            "Across four buyer projects (Riverbend, Harborline, Pinecrest, Meridian Data "
            "Center), the single largest driver of cost overrun was incomplete design "
            "documentation at time of award, not vendor performance — pre-award design "
            "completeness now correlates strongly with change-order volume."
        ),
        "details": {
            "projects_analyzed": 4,
            "primary_overrun_driver": "incomplete design documentation at award",
        },
        "outcome": (
            "Prompted the pre-award connection-detail sign-off requirement now standard on "
            "structural packages over $2M."
        ),
    },
    {
        "project_id": "portfolio-wide",
        "vendor_id": None,
        "summary": (
            "A recurring delay pattern across three MEP-heavy projects traced back to "
            "commissioning being scheduled without buffer for a first-attempt failure, "
            "compressing the critical path whenever any re-test was required."
        ),
        "details": {
            "projects_analyzed": 3,
            "pattern": "no commissioning buffer scheduled",
        },
        "outcome": (
            "Scheduling guidance updated to require a minimum 2-week commissioning buffer "
            "on all MEP controls packages."
        ),
    },
    {
        "project_id": "portfolio-wide",
        "vendor_id": None,
        "summary": (
            "Vendors that disclosed sub-tier supplier risk voluntarily at bid stage (rather "
            "than after a delay occurred) showed a measurably lower rate of late-delivery "
            "disputes across the portfolio, even when their nominal lead times were similar."
        ),
        "details": {
            "correlation": "voluntary sub-tier disclosure vs. dispute rate",
        },
        "outcome": (
            "Buyer began weighting voluntary supply-chain disclosure as a soft factor in "
            "technical scoring."
        ),
    },
    {
        "project_id": "portfolio-wide",
        "vendor_id": None,
        "summary": (
            "Named-index price-escalation clauses (as opposed to clauses referencing general "
            "'market conditions') eliminated escalation disputes entirely across the three "
            "projects where they were used, versus two disputes across two projects using vaguer language."
        ),
        "details": {
            "named_index_disputes": 0,
            "vague_language_disputes": 2,
        },
        "outcome": (
            "Named-index escalation language adopted as the buyer's standard clause "
            "portfolio-wide."
        ),
    },
]

ALL_CASES = (
    [{"case_type": "vendor_history", **c} for c in VENDOR_HISTORY_CASES]
    + [{"case_type": "contract", **c} for c in CONTRACT_CASES]
    + [{"case_type": "dispute", **c} for c in DISPUTE_CASES]
    + [{"case_type": "general_case", **c} for c in GENERAL_CASES]
)


def main() -> None:
    client = get_client()
    total = len(ALL_CASES)
    print(f"Seeding {total} historical cases into Supabase...\n")

    inserted, failed = 0, 0
    for i, case in enumerate(ALL_CASES, start=1):
        summary = case["summary"]
        try:
            vector = embed(summary)
            row = {
                "case_id": str(uuid.uuid4()),
                "project_id": case["project_id"],
                "vendor_id": case.get("vendor_id"),
                "case_type": case["case_type"],
                "summary": summary,
                "details": case["details"],
                "outcome": case["outcome"],
                "embedding": vector,
            }
            client.table("historical_cases").insert(row).execute()
            inserted += 1
            print(f"[{i}/{total}] OK  ({case['case_type']:<14}) {case['project_id']}")
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"[{i}/{total}] FAIL ({case['case_type']:<14}) {case['project_id']}: {exc}", file=sys.stderr)

    print(f"\nDone. Inserted {inserted}/{total} cases ({failed} failed).")


if __name__ == "__main__":
    main()
