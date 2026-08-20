"""
Arbiter — causation-and-responsibility microservice.

Called only by ORCHESTRA over HTTP. Never calls Sentinel, Trustline,
Precedent, or Atlas directly — everything it needs arrives pre-assembled
via AgentTask.context.
"""
from __future__ import annotations

import json
import uuid
import os
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from fastapi import FastAPI, Body
from fastapi.responses import JSONResponse

import logic
from common.supabase_client import get_supabase_client
from common.belief_ledger.client import BeliefLedgerClient
from models import (
    AgentResult,
    AnalyzeCausationRequest,
    AnalyzeDisputeRequest,
    AssessResponsibilityRequest,
    ReconstructTimelineRequest,
    RunDebateRequest,
)

app = FastAPI(title="Arbiter", version="0.1.0")
CAPABILITIES_PATH = Path(__file__).parent / "capabilities.json"
belief_ledger = BeliefLedgerClient()


def _new_receipt() -> str:
    return f"rcpt_arbiter_{uuid.uuid4().hex[:8]}"


def _task_id(supplied: str | None) -> str:
    return supplied or str(uuid.uuid4())


def _persist_receipt(
    receipt_id: str,
    project_id: Optional[str],
    task_id: str,
    capability: str,
    evidence_ids: list[str],
    summary: str,
    confidence: float,
    reasoning: Optional[str] = None
):
    """
    Writes a receipt to the shared 'receipts' table.
    """
    client = get_supabase_client()
    metadata = {
        "confidence": confidence,
        "reasoning": reasoning or ""
    }
    db_payload = {
        "receipt_id": receipt_id,
        "project_id": project_id,
        "agent": "arbiter",
        "task_id": task_id,
        "capability": capability,
        "evidence_ids": evidence_ids,
        "summary": summary,
        "metadata": metadata
    }
    try:
        client.table("receipts").insert(db_payload).execute()
    except Exception as e:
        print(f"[Receipts] Warning: Failed to persist receipt: {e}")


# ---------------------------------------------------------------------------
# GET /capabilities
# ---------------------------------------------------------------------------

@app.get("/capabilities")
def get_capabilities():
    with open(CAPABILITIES_PATH) as f:
        return JSONResponse(content=json.load(f))


# ---------------------------------------------------------------------------
# 1. POST /reconstruct_timeline
# ---------------------------------------------------------------------------

@app.post("/reconstruct_timeline", response_model=AgentResult)
def reconstruct_timeline(req: ReconstructTimelineRequest):
    task_id = _task_id(req.task_id)
    receipt_id = _new_receipt()

    if not req.event_refs:
        _persist_receipt(
            receipt_id=receipt_id,
            project_id=req.project_id,
            task_id=task_id,
            capability="arbiter.reconstruct_timeline",
            evidence_ids=[],
            summary="Timeline reconstruction failed: Empty event_refs",
            confidence=0.0
        )
        return AgentResult(
            task_id=task_id,
            status="INSUFFICIENT_INFORMATION",
            findings=[{"message": "No event_refs provided — cannot reconstruct a timeline."}],
            recommended_next_capabilities=["sentinel.find_missing_evidence"],
            receipt_id=receipt_id,
        )

    try:
        event_refs = [e.model_dump() for e in req.event_refs]
        timeline_result = logic.reconstruct_timeline(req.entity_ids, event_refs)
    except Exception as exc:
        _persist_receipt(
            receipt_id=receipt_id,
            project_id=req.project_id,
            task_id=task_id,
            capability="arbiter.reconstruct_timeline",
            evidence_ids=[],
            summary=f"Timeline reconstruction error: {exc}",
            confidence=0.0
        )
        return AgentResult(
            task_id=task_id,
            status="FAILED",
            findings=[{"error": f"Timeline reconstruction failed: {exc}"}],
            receipt_id=receipt_id,
        )

    evidence = [e.source for e in req.event_refs if e.source]
    has_gaps = bool(timeline_result.get("gaps_or_inconsistencies"))
    confidence = 0.6 if has_gaps else 0.95

    try:
        get_supabase_client().table("timelines").insert(
            {
                "timeline_id": str(uuid.uuid4()),
                "project_id": req.project_id,
                "entity_ids": req.entity_ids,
                "events": timeline_result["events"],
                "evidence_refs": evidence,
                "confidence": confidence,
                "source_agent": "arbiter",
                "receipt_id": receipt_id,
            }
        ).execute()
    except Exception as exc:
        print(f"[Supabase] Warning: Timelines insert failed: {exc}")

    _persist_receipt(
        receipt_id=receipt_id,
        project_id=req.project_id,
        task_id=task_id,
        capability="arbiter.reconstruct_timeline",
        evidence_ids=evidence,
        summary=f"Timeline reconstructed ({len(timeline_result.get('events', []))} events)",
        confidence=confidence
    )

    return AgentResult(
        task_id=task_id,
        status="COMPLETED",
        findings=[timeline_result],
        evidence=evidence,
        confidence=confidence,
        risks=timeline_result.get("gaps_or_inconsistencies", []),
        receipt_id=receipt_id,
    )


# ---------------------------------------------------------------------------
# 2. POST /analyze_causation
# ---------------------------------------------------------------------------

@app.post("/analyze_causation", response_model=AgentResult)
def analyze_causation(req: AnalyzeCausationRequest):
    task_id = _task_id(req.task_id)
    receipt_id = _new_receipt()
    evidence_refs = list(req.evidence_context.keys())

    if logic.evidence_is_too_thin(req.evidence_context):
        _persist_receipt(
            receipt_id=receipt_id,
            project_id=req.project_id,
            task_id=task_id,
            capability="arbiter.analyze_causation",
            evidence_ids=evidence_refs,
            summary="Causation analysis deferred: thin context",
            confidence=0.0
        )
        return AgentResult(
            task_id=task_id,
            status="INSUFFICIENT_INFORMATION",
            findings=[{"message": "evidence_context is too thin to reach a confident causation conclusion."}],
            recommended_next_capabilities=logic.missing_capabilities_for(
                req.evidence_context, req.timeline
            ),
            receipt_id=receipt_id,
        )

    try:
        result = logic.analyze_causation(req.claims, req.evidence_context, req.timeline)
    except Exception as exc:
        _persist_receipt(
            receipt_id=receipt_id,
            project_id=req.project_id,
            task_id=task_id,
            capability="arbiter.analyze_causation",
            evidence_ids=evidence_refs,
            summary=f"Causation analysis error: {exc}",
            confidence=0.0
        )
        return AgentResult(
            task_id=task_id,
            status="FAILED",
            findings=[{"error": f"Causation analysis failed: {exc}"}],
            receipt_id=receipt_id,
        )

    causes = result.get("causes", [])
    top_confidence = causes[0]["confidence"] if causes else 0.0
    reasoning_summary = result.get("reasoning_summary", "")

    # Save to causation_results table
    causation_result_id = str(uuid.uuid4())
    try:
        get_supabase_client().table("causation_results").insert(
            {
                "causation_result_id": causation_result_id,
                "project_id": req.project_id,
                "case_ref": req.claims[0].get("claim_id") if req.claims else None,
                "causes": causes,
                "evidence_refs": evidence_refs,
                "reasoning_summary": reasoning_summary,
                "confidence": top_confidence,
                "receipt_id": receipt_id,
                "source_agent": "arbiter"
            }
        ).execute()
    except Exception as exc:
        print(f"[Supabase] Warning: causation_results insert failed: {exc}")

    # Record belief edges for established causes
    for cause in causes:
        # Only record if confidence is reasonable
        if cause.get("confidence", 0.0) >= 0.5:
            subj_id = req.entity_ids[0] if req.entity_ids else "vendor_unknown"
            # Map correctly to belief ledger schema columns
            belief_ledger.record_edge(
                entity_id=subj_id,
                relation="caused_delay",
                target_id=cause.get("cause_id", "unknown_cause"),
                confidence=cause.get("confidence", 0.5),
                source_agent="arbiter",
                subject_type="vendor",
                object_type="cause",
                evidence_ids=cause.get("evidence_ids", []),
                project_id=req.project_id
            )

    _persist_receipt(
        receipt_id=receipt_id,
        project_id=req.project_id,
        task_id=task_id,
        capability="arbiter.analyze_causation",
        evidence_ids=evidence_refs,
        summary=f"Causation Analyzed: {reasoning_summary[:60]}...",
        confidence=top_confidence,
        reasoning=reasoning_summary
    )

    return AgentResult(
        task_id=task_id,
        status="COMPLETED",
        findings=causes,
        claims=req.claims,
        evidence=evidence_refs,
        confidence=top_confidence,
        recommended_next_capabilities=["arbiter.assess_responsibility"] if causes else [],
        receipt_id=receipt_id,
    )


# ---------------------------------------------------------------------------
# 3. POST /assess_responsibility
# ---------------------------------------------------------------------------

@app.post("/assess_responsibility", response_model=AgentResult)
def assess_responsibility(req: AssessResponsibilityRequest):
    task_id = _task_id(req.task_id)
    receipt_id = _new_receipt()

    causes = req.causes
    causation_row = None
    project_id = req.project_id

    if causes is None:
        if not req.causation_result_id:
            return AgentResult(
                task_id=task_id,
                status="INSUFFICIENT_INFORMATION",
                findings=[{"message": "Provide either causation_result_id or causes."}],
                recommended_next_capabilities=["arbiter.analyze_causation"],
                receipt_id=receipt_id,
            )
        try:
            resp = (
                get_supabase_client()
                .table("causation_results")
                .select("*")
                .eq("causation_result_id", req.causation_result_id)
                .single()
                .execute()
            )
            causation_row = resp.data
            causes = causation_row["causes"]
            project_id = project_id or causation_row.get("project_id")
        except Exception as exc:
            return AgentResult(
                task_id=task_id,
                status="FAILED",
                findings=[{"error": f"Failed to fetch causation_result {req.causation_result_id}: {exc}"}],
                receipt_id=receipt_id,
            )

    if not causes:
        return AgentResult(
            task_id=task_id,
            status="INSUFFICIENT_INFORMATION",
            findings=[{"message": "No causes available to attribute responsibility against."}],
            recommended_next_capabilities=["arbiter.analyze_causation"],
            receipt_id=receipt_id,
        )

    try:
        result = logic.assess_responsibility(causes)
    except Exception as exc:
        return AgentResult(
            task_id=task_id,
            status="FAILED",
            findings=[{"error": f"Responsibility assessment failed: {exc}"}],
            receipt_id=receipt_id,
        )

    # Validate sum
    vendor_pct = result.get("vendor", 0.0)
    external_pct = result.get("external", 0.0)
    buyer_pct = result.get("buyer", 0.0)
    shared_pct = result.get("shared", 0.0)
    unknown_pct = result.get("unknown", 0.0)
    rationale = result.get("rationale", "")

    total_pct = round(vendor_pct + external_pct + buyer_pct + shared_pct + unknown_pct, 4)
    is_valid = abs(total_pct - 1.0) < 0.01

    try:
        if req.causation_result_id:
            get_supabase_client().table("causation_results").update(
                {"responsibility": result}
            ).eq("causation_result_id", req.causation_result_id).execute()
    except Exception as exc:
        print(f"[Supabase] Warning: causation_results update failed: {exc}")

    _persist_receipt(
        receipt_id=receipt_id,
        project_id=project_id,
        task_id=task_id,
        capability="arbiter.assess_responsibility",
        evidence_ids=["causation_result"],
        summary=f"Responsibility split: vendor={vendor_pct}, external={external_pct}, buyer={buyer_pct}",
        confidence=1.0 if is_valid else 0.5,
        reasoning=rationale
    )

    return AgentResult(
        task_id=task_id,
        status="COMPLETED",
        findings=[result],
        confidence=1.0 if is_valid else 0.5,
        risks=[] if is_valid else [f"Responsibility values summed to {total_pct}, not 1.0."],
        receipt_id=receipt_id,
    )


# ---------------------------------------------------------------------------
# 4. POST /analyze_dispute
# ---------------------------------------------------------------------------

@app.post("/analyze_dispute", response_model=AgentResult)
def analyze_dispute(req: AnalyzeDisputeRequest):
    task_id = _task_id(req.task_id)
    receipt_id = _new_receipt()

    entity_ids = req.full_context.get("entity_ids", [])
    evidence_context = {
        k: v
        for k, v in req.full_context.items()
        if k in ("verified_facts", "contradictions", "vendor_trust_signals", "documents", "claims_evidence")
    }

    if logic.evidence_is_too_thin(evidence_context):
        _persist_receipt(
            receipt_id=receipt_id,
            project_id=req.project_id,
            task_id=task_id,
            capability="arbiter.analyze_dispute",
            evidence_ids=list(evidence_context.keys()),
            summary="Dispute analysis deferred: thin context",
            confidence=0.0
        )
        return AgentResult(
            task_id=task_id,
            status="INSUFFICIENT_INFORMATION",
            findings=[{"message": "full_context does not contain enough verified evidence for a full dispute analysis."}],
            recommended_next_capabilities=logic.missing_capabilities_for(evidence_context, None),
            receipt_id=receipt_id,
        )

    try:
        result = logic.analyze_dispute(entity_ids, req.full_context)
    except Exception as exc:
        _persist_receipt(
            receipt_id=receipt_id,
            project_id=req.project_id,
            task_id=task_id,
            capability="arbiter.analyze_dispute",
            evidence_ids=list(evidence_context.keys()),
            summary=f"Dispute analysis error: {exc}",
            confidence=0.0
        )
        return AgentResult(
            task_id=task_id,
            status="FAILED",
            findings=[{"error": f"Full dispute analysis failed: {exc}"}],
            receipt_id=receipt_id,
        )

    try:
        client = get_supabase_client()
        if result.get("timeline"):
            client.table("timelines").insert(
                {
                    "timeline_id": str(uuid.uuid4()),
                    "project_id": req.project_id,
                    "entity_ids": entity_ids,
                    "events": result["timeline"]["events"],
                    "evidence_refs": list(evidence_context.keys()),
                    "confidence": result["confidence"],
                    "source_agent": "arbiter",
                    "receipt_id": receipt_id
                }
            ).execute()

        client.table("causation_results").insert(
            {
                "causation_result_id": str(uuid.uuid4()),
                "project_id": req.project_id,
                "case_ref": req.full_context.get("case_ref"),
                "causes": result["causes"],
                "responsibility": result["responsibility"],
                "evidence_refs": list(evidence_context.keys()),
                "reasoning_summary": result["reasoning_summary"],
                "confidence": result["confidence"],
                "receipt_id": receipt_id,
                "source_agent": "arbiter"
            }
        ).execute()
    except Exception as exc:
        print(f"[Supabase] Warning: Dispute persistence failed: {exc}")

    # Record belief edges for established causes
    causes = result.get("causes", [])
    for cause in causes:
        if cause.get("confidence", 0.0) >= 0.5:
            subj_id = entity_ids[0] if entity_ids else "vendor_unknown"
            belief_ledger.record_edge(
                entity_id=subj_id,
                relation="caused_delay",
                target_id=cause.get("cause_id", "unknown_cause"),
                confidence=cause.get("confidence", 0.5),
                source_agent="arbiter",
                subject_type="vendor",
                object_type="cause",
                evidence_ids=cause.get("evidence_ids", []),
                project_id=req.project_id
            )

    _persist_receipt(
        receipt_id=receipt_id,
        project_id=req.project_id,
        task_id=task_id,
        capability="arbiter.analyze_dispute",
        evidence_ids=list(evidence_context.keys()),
        summary=f"Dispute debate resolved with confidence {result['confidence']}",
        confidence=result["confidence"],
        reasoning=result["reasoning_summary"]
    )

    return AgentResult(
        task_id=task_id,
        status="COMPLETED",
        findings=[
            {
                "timeline": result["timeline"],
                "causes": result["causes"],
                "responsibility": result["responsibility"],
                "reasoning_summary": result["reasoning_summary"],
            }
        ],
        evidence=list(evidence_context.keys()),
        confidence=result["confidence"],
        receipt_id=receipt_id,
    )


# ---------------------------------------------------------------------------
# 5. POST /run_debate
# ---------------------------------------------------------------------------

@app.post("/run_debate", response_model=AgentResult)
def run_debate(req: RunDebateRequest):
    task_id = _task_id(req.task_id)
    receipt_id = _new_receipt()

    try:
        verdict = logic.run_adversarial_debate(req.evidence_context)
    except Exception as exc:
        return AgentResult(
            task_id=task_id,
            status="FAILED",
            findings=[{"error": f"Debate failed: {exc}"}],
            receipt_id=receipt_id,
        )

    _persist_receipt(
        receipt_id=receipt_id,
        project_id="prj_riverside", # Assuming scoped to the specific rehearsed case
        task_id=task_id,
        capability="arbiter.run_debate",
        evidence_ids=list(req.evidence_context.keys()),
        summary=f"Debate resolved: {verdict['judge_verdict'].get('judge_ruling', 'Completed')}",
        confidence=0.8,
        reasoning=verdict['judge_verdict'].get("judge_ruling", "")
    )

    return AgentResult(
        task_id=task_id,
        status="COMPLETED",
        findings=[verdict],
        receipt_id=receipt_id,
        confidence=0.8
    )
