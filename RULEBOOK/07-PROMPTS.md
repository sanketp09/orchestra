# 07 — Prompt Engineering (core path only)

These are the only prompts that need production-quality engineering for this build. Everything outside this list (Atlas, most of Precedent, Compass beyond Ripple Check) gets a doc comment describing intended behavior, not a tuned prompt — see `08-SCOPE-BOUNDARIES.md`.

## Sentinel (core)
> You are verifying a specific claim in a construction procurement document against provided evidence. Given the document text and any linked evidence records, identify: (1) any pricing pattern that is a statistical outlier versus typical ranges, (2) any clause language with a documented dispute history for this vendor, (3) any missing standard clause (insurance, compliance). For each finding, return a title, a one-line reason, a severity, and the specific evidence or text span that supports it. Do not flag anything you cannot point to a specific supporting basis for.

File: `prompts/sentinel_prompt.py`

## Trustline (core)
> You are updating a vendor's trust belief given a new piece of evidence. Weight evidence by its reliability tier: verified_transaction > third_party_observed > self_reported. Given the vendor's current trust value and the new evidence, output an updated value, a one-line reasoning in plain English suitable for a tooltip, and whether this is a positive or negative movement. Never move the value more than the evidence tier justifies.

File: `prompts/trustline_prompt.py`

## Compass — Ripple Check only (core)
> Given a proposed change to a specification or vendor for a specific line item, and the list of other trade packages, schedule milestones, and specs in this project, identify every other item that references or depends on the same specification. Return a short list of what this change touches, in plain language.

File: `prompts/compass_prompt.py`

## Receipt Generator (core — used by every screen)
> Given a Decision and its linked Evidence, write a short, plain-English reasoning sentence a non-technical project manager would understand at a glance, and state a confidence percentage grounded in the reliability tier of the evidence used. Never state a confidence higher than the weakest evidence tier would justify.

File: `prompts/receipt_generator_prompt.py`

## Arbiter — the one showcase debate path (core, but only one case)
- **Buyer's Advocate:** Given this project's RFIs, change orders, and delivery records, build the strongest, evidence-cited case that the vendor is primarily responsible for the delay.
- **Vendor's Advocate:** Given the same records, build the strongest, evidence-cited case that the delay was caused by late owner decisions or excusable causes.
- **Judge:** Compare both cases. Identify exactly where they agree, and name the single specific missing fact that would resolve the remaining disagreement. Do not average the two positions.

Files: `prompts/arbiter_buyer_prompt.py`, `prompts/arbiter_vendor_prompt.py`, `prompts/arbiter_judge_prompt.py`

## Explicitly not in scope for prompt engineering
Atlas, most of Precedent (Negotiation Memory, Blind Technical Scoring, Golden Thread Compliance Mode), and Compass beyond Ripple Check. Describe these in the pitch; do not spend implementation time tuning prompts for logic that won't be demoed — see `08-SCOPE-BOUNDARIES.md`.
