"""
Arbiter reasoning logic. All LLM prompting + schema definitions live here,
kept separate from the FastAPI route handlers in main.py.

Every public function here is pure-ish: it takes plain dicts/lists in,
returns plain dicts out, and raises on unrecoverable errors. main.py is
responsible for catching exceptions, writing to Supabase, and wrapping
everything into an AgentResult.
"""
from __future__ import annotations

from typing import Any

from common.llm_client import generate_structured


# ---------------------------------------------------------------------------
# Thin-context guard
# ---------------------------------------------------------------------------

def evidence_is_too_thin(evidence_context: dict | None) -> bool:
    """
    Heuristic gate for status="INSUFFICIENT_INFORMATION". Arbiter should not
    reason about causation with no verified evidence to reason over.
    """
    if not evidence_context:
        return True
    substantive_keys = (
        "verified_facts",
        "contradictions",
        "vendor_trust_signals",
        "documents",
        "claims_evidence",
    )
    return not any(evidence_context.get(k) for k in substantive_keys)


def missing_capabilities_for(evidence_context: dict | None, timeline: dict | None) -> list[str]:
    missing = []
    if evidence_is_too_thin(evidence_context):
        missing.append("sentinel.find_missing_evidence")
    if not evidence_context or not evidence_context.get("vendor_trust_signals"):
        missing.append("trustline.get_vendor_trust_profile")
    if not evidence_context or not evidence_context.get("similar_cases"):
        missing.append("precedent.find_similar_dispute")
    if timeline is None:
        missing.append("arbiter.reconstruct_timeline")
    return missing


# ---------------------------------------------------------------------------
# 1. Timeline reconstruction
# ---------------------------------------------------------------------------

TIMELINE_SCHEMA = {
    "type": "object",
    "properties": {
        "events": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "description": {"type": "string"},
                    "date": {"type": ["string", "null"]},
                    "order_confidence": {
                        "type": "string",
                        "enum": ["exact", "inferred", "uncertain"],
                    },
                    "source": {"type": ["string", "null"]},
                },
                "required": ["description", "order_confidence"],
            },
        },
        "gaps_or_inconsistencies": {
            "type": "array",
            "items": {"type": "string"},
        },
    },
    "required": ["events", "gaps_or_inconsistencies"],
}


def reconstruct_timeline(entity_ids: list[str], event_refs: list[dict]) -> dict[str, Any]:
    prompt = f"""You are reconstructing a factual timeline for a construction
procurement dispute investigation, involving entities: {entity_ids}.

Below is a list of raw event references gathered from claim submissions,
evidence timestamps, and prior specialist findings. Some dates may be
missing or approximate.

Event references:
{event_refs}

Order these into a single coherent timeline in chronological order. Where an
exact date is missing, infer relative ordering from context (e.g. "evidence
of X submitted after claim Y was filed") and mark that event's
order_confidence as "inferred" rather than "exact". If ordering truly cannot
be determined, mark it "uncertain" and still place it in your best-guess
position. Do not invent dates if they are not in the references.

Explicitly flag any gaps (missing information you'd expect to see) or
inconsistencies (events that contradict each other's implied ordering) in
gaps_or_inconsistencies.

Do not invent events that aren't grounded in the references given."""

    return generate_structured(prompt, TIMELINE_SCHEMA, provider="claude")


# ---------------------------------------------------------------------------
# 2. Causation analysis
# ---------------------------------------------------------------------------

CAUSATION_SCHEMA = {
    "type": "object",
    "properties": {
        "causes": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "cause_id": {"type": "string"},
                    "description": {"type": "string"},
                    "type": {
                        "type": "string",
                        "enum": ["vendor_fault", "external_cause", "buyer_fault", "shared", "unknown"]
                    },
                    "contribution": {"type": "number", "minimum": 0.0, "maximum": 1.0},
                    "evidence_ids": {
                        "type": "array",
                        "items": {"type": "string"}
                    },
                    "confidence": {"type": "number", "minimum": 0.0, "maximum": 1.0},
                    "reasoning": {"type": "string"}
                },
                "required": ["cause_id", "description", "type", "contribution", "evidence_ids", "confidence", "reasoning"],
            },
        },
        "reasoning_summary": {
            "type": "string",
            "description": "Plain-language explanation of how the top cause was reached.",
        },
    },
    "required": ["causes", "reasoning_summary"],
}


def analyze_causation(
    claims: list[dict],
    evidence_context: dict,
    timeline: dict | None,
) -> dict[str, Any]:
    prompt = f"""You are determining the most likely cause(s) of a
procurement discrepancy, delay, or dispute, using only the context provided
below. Do not speculate beyond what the context supports.

CLAIMS (what parties assert):
{claims}

VERIFIED EVIDENCE CONTEXT (from Sentinel — verified facts, contradictions
found, and any other evidence-layer findings):
{evidence_context}

TIMELINE (if available):
{timeline if timeline else "Not provided."}

Identify the most likely cause(s) of the situation (e.g. discrepancy, delay,
dispute). For each candidate cause, fill out the required fields:
- cause_id: unique identifier
- description: clear, specific description of the cause
- type: must be one of: vendor_fault, external_cause, buyer_fault, shared, unknown.
- contribution: a decimal between 0.0 and 1.0 representing contribution of this cause.
- evidence_ids: list of evidence keys from VERIFIED EVIDENCE CONTEXT supporting this cause. If no evidence ID, do not claim the cause as established.
- confidence: confidence score between 0.0 and 1.0.
- reasoning: reasoning explaining why this cause is established.

The sum of contribution values for all causes must sum to exactly 1.0. If you cannot establish causation, set type to 'unknown'.
Do not invent causes, dates, documents, or details not present in evidence.

Then give a short plain-language reasoning_summary of how you reached the
top cause, written so a non-technical human reviewer can follow it."""

    return generate_structured(prompt, CAUSATION_SCHEMA, provider="claude")


# ---------------------------------------------------------------------------
# 3. Responsibility attribution
# ---------------------------------------------------------------------------

RESPONSIBILITY_SCHEMA = {
    "type": "object",
    "properties": {
        "vendor": {"type": "number", "minimum": 0.0, "maximum": 1.0},
        "external": {"type": "number", "minimum": 0.0, "maximum": 1.0},
        "buyer": {"type": "number", "minimum": 0.0, "maximum": 1.0},
        "shared": {"type": "number", "minimum": 0.0, "maximum": 1.0},
        "unknown": {"type": "number", "minimum": 0.0, "maximum": 1.0},
        "rationale": {"type": "string"}
    },
    "required": ["vendor", "external", "buyer", "shared", "unknown", "rationale"],
}


def assess_responsibility(causes: list[dict]) -> dict[str, Any]:
    prompt = f"""You are attributing responsibility for a procurement issue
across the relevant parties, based on the identified cause(s) below.

IDENTIFIED CAUSES (with supporting context and confidence):
{causes}

Attribute responsibility as decimal percentages across parties: vendor, external, buyer, shared, unknown.
The values must be between 0.0 and 1.0, and must sum to exactly 1.0.
Provide a clear rationale grounded in the causes and evidence.

IMPORTANT: only attribute meaningful responsibility when the context actually supports it.
If the causes point to an external or force-majeure factor (e.g. supply chain disruption, regulatory change, weather), attribute responsibility to 'external'.
Do not penalize the vendor for delays outside their control.
If evidence is insufficient, use 'unknown' or 'shared' and lower the confidence."""

    return generate_structured(prompt, RESPONSIBILITY_SCHEMA, provider="claude")


# ---------------------------------------------------------------------------
# 4. Combined dispute analysis
# ---------------------------------------------------------------------------

def analyze_dispute(entity_ids: list[str], full_context: dict) -> dict[str, Any]:
    """
    Runs timeline reconstruction + causation + responsibility as one pass
    over the richest available context, and produces a human-readable
    reasoning_summary on top.
    """
    event_refs = full_context.get("event_refs", [])
    timeline = reconstruct_timeline(entity_ids, event_refs) if event_refs else None

    claims = full_context.get("claims", [])
    evidence_context = {
        k: v
        for k, v in full_context.items()
        if k in ("verified_facts", "contradictions", "vendor_trust_signals", "documents",
                  "claims_evidence", "similar_cases", "external_risk_context")
    }

    causation = analyze_causation(claims, evidence_context, timeline)
    responsibility = assess_responsibility(causation["causes"])

    top_cause_confidence = causation["causes"][0]["confidence"] if causation["causes"] else 0.0
    timeline_confidence = 1.0 if timeline and not timeline.get("gaps_or_inconsistencies") else 0.6 if timeline else 0.0

    # Weighted average: causation quality matters most, timeline confidence
    # is a supporting signal
    weighted_confidence = round(
        (0.7 * top_cause_confidence) + (0.3 * timeline_confidence), 3
    )

    summary_prompt = f"""Write a short plain-language summary (3-6 sentences)
of this dispute investigation, suitable for a human reviewer with no
technical background, based on:

TIMELINE: {timeline}
CAUSES: {causation["causes"]}
CAUSATION REASONING: {causation["reasoning_summary"]}
RESPONSIBILITY: {responsibility}

Explain what most likely happened, why, and who bears responsibility and
why — in plain terms, no jargon."""

    summary_schema = {
        "type": "object",
        "properties": {"summary": {"type": "string"}},
        "required": ["summary"],
    }
    summary_result = generate_structured(summary_prompt, summary_schema, provider="claude")

    return {
        "timeline": timeline,
        "causes": causation["causes"],
        "responsibility": responsibility,
        "reasoning_summary": summary_result["summary"],
        "confidence": weighted_confidence,
    }


# ---------------------------------------------------------------------------
# 5. Adversarial Debate Graph (Buyer vs Vendor vs Judge)
# ---------------------------------------------------------------------------
def run_adversarial_debate(evidence_context: dict) -> dict[str, Any]:
    """
    Runs the 3-step adversarial debate: Buyer Advocate -> Vendor Advocate -> Judge.
    Returns the judge's final verdict.
    """
    import os
    import sys
    # Load prompts
    try:
        from prompts.arbiter_buyer_prompt import ARBITER_BUYER_PROMPT
        from prompts.arbiter_vendor_prompt import ARBITER_VENDOR_PROMPT
        from prompts.arbiter_judge_prompt import ARBITER_JUDGE_PROMPT
    except ImportError:
        root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        if root_dir not in sys.path:
            sys.path.insert(0, root_dir)
        from prompts.arbiter_buyer_prompt import ARBITER_BUYER_PROMPT
        from prompts.arbiter_vendor_prompt import ARBITER_VENDOR_PROMPT
        from prompts.arbiter_judge_prompt import ARBITER_JUDGE_PROMPT

    # Step 1: Buyer Advocate
    buyer_prompt = f"{ARBITER_BUYER_PROMPT}\n\nEvidence Context:\n{evidence_context}"
    buyer_schema = {
        "type": "object",
        "properties": {
            "argument": {"type": "string"},
            "cited_evidence": {"type": "array", "items": {"type": "string"}}
        },
        "required": ["argument", "cited_evidence"]
    }
    buyer_case = generate_structured(buyer_prompt, buyer_schema, provider="claude")

    # Step 2: Vendor Advocate
    vendor_prompt = f"{ARBITER_VENDOR_PROMPT}\n\nEvidence Context:\n{evidence_context}"
    vendor_schema = {
        "type": "object",
        "properties": {
            "argument": {"type": "string"},
            "cited_evidence": {"type": "array", "items": {"type": "string"}}
        },
        "required": ["argument", "cited_evidence"]
    }
    vendor_case = generate_structured(vendor_prompt, vendor_schema, provider="claude")

    # Step 3: Judge
    judge_prompt = f"{ARBITER_JUDGE_PROMPT}\n\nBuyer Case:\n{buyer_case}\n\nVendor Case:\n{vendor_case}"
    judge_schema = {
        "type": "object",
        "properties": {
            "agreements": {"type": "array", "items": {"type": "string"}},
            "missing_fact_to_resolve": {"type": "string"},
            "judge_ruling": {"type": "string"}
        },
        "required": ["agreements", "missing_fact_to_resolve", "judge_ruling"]
    }
    judge_verdict = generate_structured(judge_prompt, judge_schema, provider="claude")

    return {
        "buyer_case": buyer_case,
        "vendor_case": vendor_case,
        "judge_verdict": judge_verdict
    }
