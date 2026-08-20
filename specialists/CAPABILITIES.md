# Specialist Capability Catalog

This document outlines the high-level capabilities provided by each decoupled specialist agent to the ORCHESTRA Brain.

## Sentinel
Evidence verification and visual/semantic comparison.

*   `sentinel.verify_claim`: Validates claims against ingested site evidence.
*   `sentinel.compare_documents`: Cross-checks discrepancies between POs/Invoices/Delivery tickets.
*   `sentinel.detect_contradiction`: Identifies logical contradictions between claims and verified reality.
*   `sentinel.find_missing_evidence`: Determines what proof is missing for a delay claim.
*   `sentinel.verify_progress`: Validates physical site progress against photos/logs.
*   `sentinel.verify_invoice`: Audits quantities and terms.

## Trustline
Reliability assessment and behavioral drifting.

*   `trustline.get_vendor_profile`: Fetches the vendor's reputation and baseline risk.
*   `trustline.assess_vendor_reliability`: Re-calculates trust score given new negative or positive events.
*   `trustline.detect_behavioural_drift`: Flags systemic changes in vendor patterns over time.
*   `trustline.update_trust`: Persists a new calculated trust score to the ledger.
*   `trustline.compare_vendor_history`: Compares multiple vendors' reliability.

## Precedent
Organizational memory and case/vector retrieval.

*   `precedent.find_similar_case`: RAG search over historical claims based on semantic similarity.
*   `precedent.find_similar_vendor`: Finds vendors with comparable dispute histories.
*   `precedent.find_similar_contract`: Retrieves similar contractual clauses or project frameworks.
*   `precedent.find_similar_dispute`: Finds past disputes matching current fact patterns.
*   `precedent.retrieve_previous_outcome`: Exact retrieval of how past disputes were resolved.

## Arbiter
Generative delay causation and attribution.

*   `arbiter.reconstruct_timeline`: Compiles disparate events into a single causal timeline.
*   `arbiter.analyze_causation`: Identifies the primary root cause behind a delay.
*   `arbiter.assess_responsibility`: Outputs percentage-based attribution split.
*   `arbiter.analyze_dispute`: High-level summary of a dispute's core tension.
*   `arbiter.run_debate`: Generative adversarial debate reasoning over conflict evidence.
