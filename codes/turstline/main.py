"""
Trustline - vendor trust intelligence microservice.

Called only by ORCHESTRA over HTTP. Every endpoint accepts a small
Trustline-specific request body (see models.py), does its work, and wraps
the result into a common.models.AgentResult - including on failure, where it
returns status="FAILED" with a clear error in findings rather than letting an
exception surface as a raw 500.
"""

from __future__ import annotations

import json
import uuid
from pathlib import Path

from fastapi import FastAPI

import db
import logic
from common.models import AgentResult
from models import (
    TRUST_DIMENSIONS,
    AssessVendorReliabilityRequest,
    CompareVendorHistoryRequest,
    DetectBehaviouralDriftRequest,
    GetVendorProfileRequest,
    UpdateTrustRequest,
)

app = FastAPI(title="Trustline")

AGENT_NAME = "trustline"
CAPABILITIES_PATH = Path(__file__).parent / "capabilities.json"


def _receipt_id() -> str:
    return str(uuid.uuid4())


def _failed_result(task_id: str, error: str) -> AgentResult:
    return AgentResult(
        agent=AGENT_NAME,
        task_id=task_id,
        status="FAILED",
        findings=[{"error": error}],
        claims=[],
        evidence=[],
        confidence=0.0,
        risks=[],
        recommended_next_capabilities=[],
        receipt_id=_receipt_id(),
    )


@app.get("/capabilities")
def get_capabilities() -> dict:
    with open(CAPABILITIES_PATH) as f:
        return json.load(f)


@app.post("/get_vendor_profile", response_model=AgentResult)
def get_vendor_profile(req: GetVendorProfileRequest) -> AgentResult:
    task_id = _receipt_id()
    try:
        profile = db.fetch_trust_profile(req.vendor_id)
        if profile is None:
            return _failed_result(task_id, f"No trust_profiles row for vendor_id={req.vendor_id!r}")
        return AgentResult(
            agent=AGENT_NAME,
            task_id=task_id,
            status="COMPLETED",
            findings=[profile],
            claims=[],
            evidence=[f"trust_profiles:{req.vendor_id}"],
            confidence=1.0,
            risks=[],
            recommended_next_capabilities=[],
            receipt_id=task_id,
        )
    except Exception as exc:  # noqa: BLE001 - deliberately broad: never raise a raw 500
        return _failed_result(task_id, f"get_vendor_profile failed: {exc}")


@app.post("/assess_vendor_reliability", response_model=AgentResult)
def assess_vendor_reliability(req: AssessVendorReliabilityRequest) -> AgentResult:
    task_id = _receipt_id()
    try:
        if req.dimension not in TRUST_DIMENSIONS:
            return _failed_result(task_id, f"Unknown dimension: {req.dimension!r}")

        profile = db.fetch_trust_profile(req.vendor_id)
        if profile is None:
            return _failed_result(task_id, f"No trust_profiles row for vendor_id={req.vendor_id!r}")

        events = db.fetch_trust_events(req.vendor_id, impact_dimension=req.dimension, project_id=req.project_id)
        assessment = logic.assess_reliability(profile.get(req.dimension, 0.5), events)

        return AgentResult(
            agent=AGENT_NAME,
            task_id=task_id,
            status="COMPLETED",
            findings=[{"vendor_id": req.vendor_id, "dimension": req.dimension, **assessment}],
            claims=[],
            evidence=[f"trust_events:{req.vendor_id}:{req.dimension}"],
            confidence=0.8 if assessment["event_count"] > 0 else 0.4,
            risks=[],
            recommended_next_capabilities=["detect_behavioural_drift"]
            if assessment["trend"] == "declining"
            else [],
            receipt_id=task_id,
        )
    except Exception as exc:  # noqa: BLE001
        return _failed_result(task_id, f"assess_vendor_reliability failed: {exc}")


@app.post("/detect_behavioural_drift", response_model=AgentResult)
def detect_behavioural_drift(req: DetectBehaviouralDriftRequest) -> AgentResult:
    task_id = _receipt_id()
    try:
        events_by_dimension = {
            dim: db.fetch_trust_events(req.vendor_id, impact_dimension=dim, project_id=req.project_id)
            for dim in TRUST_DIMENSIONS
        }
        findings = logic.detect_drift(events_by_dimension)

        return AgentResult(
            agent=AGENT_NAME,
            task_id=task_id,
            status="COMPLETED",
            findings=findings,
            claims=[],
            evidence=[f"trust_events:{req.vendor_id}"],
            confidence=0.7,
            risks=[f"drift:{f['dimension']}" for f in findings],
            recommended_next_capabilities=["assess_vendor_reliability"] if findings else [],
            receipt_id=task_id,
        )
    except Exception as exc:  # noqa: BLE001
        return _failed_result(task_id, f"detect_behavioural_drift failed: {exc}")


@app.post("/update_trust", response_model=AgentResult)
def update_trust(req: UpdateTrustRequest) -> AgentResult:
    task_id = _receipt_id()
    try:
        source_event_id = req.source_event_id or req.verified_event.get("source_event_id")
        project_id = req.project_id or req.verified_event.get("project_id")

        # 1. Check Idempotency via source_event_id
        if source_event_id:
            existing_event = db.fetch_trust_event_by_source_id(req.vendor_id, source_event_id)
            if existing_event:
                current_profile = db.fetch_trust_profile(req.vendor_id) or {}
                return AgentResult(
                    agent=AGENT_NAME,
                    task_id=task_id,
                    status="COMPLETED",
                    findings=[{
                        "already_processed": True,
                        "source_event_id": source_event_id,
                        "existing_event": existing_event,
                        "profile": current_profile
                    }],
                    claims=[{
                        "already_processed": True,
                        "reason": f"Event {source_event_id} already processed. Idempotency preserved.",
                        "applied_delta": existing_event.get("impact_delta", 0.0)
                    }],
                    evidence=[f"trust_events:{req.vendor_id}:{source_event_id}"],
                    confidence=1.0,
                    risks=[],
                    recommended_next_capabilities=[],
                    receipt_id=existing_event.get("event_id", task_id),
                )

        profile = db.fetch_trust_profile(req.vendor_id)
        if profile is None:
            return _failed_result(task_id, f"No trust_profiles row for vendor_id={req.vendor_id!r}")

        decision = logic.determine_trust_update(req.verified_event, req.external_context)
        dimension = decision["dimension"]
        if dimension not in TRUST_DIMENSIONS:
            return _failed_result(
                task_id,
                f"verified_event.impact_dimension missing/invalid: {dimension!r}",
            )

        updated_profile = logic.apply_penalty_to_profile(
            profile, dimension, decision["applied_delta"]
        )

        # Persist the event first (audit trail with source_event_id & project_id), then profile
        db.insert_trust_event(
            {
                "vendor_id": req.vendor_id,
                "source_event_id": source_event_id,
                "project_id": project_id,
                "event_type": req.verified_event.get("event_type", "unknown"),
                "verified": True,
                "external_cause": decision["external_cause"],
                "impact_dimension": dimension,
                "impact_delta": decision["applied_delta"],
                "source_agent": req.verified_event.get("source_agent", "sentinel"),
                "raw_context": {
                    "verified_event": req.verified_event,
                    "external_context": req.external_context,
                    "reason": decision["reason"],
                    "raw_delta": decision["raw_delta"],
                    "project_id": project_id,
                    "source_event_id": source_event_id
                },
            }
        )
        db.update_trust_profile(
            req.vendor_id,
            {
                dimension: updated_profile[dimension],
                "overall_trust": updated_profile["overall_trust"],
                "last_updated": "now()",
            },
        )
        # Re-fetch so the returned profile reflects exactly what's persisted
        persisted = db.fetch_trust_profile(req.vendor_id) or updated_profile

        return AgentResult(
            agent=AGENT_NAME,
            task_id=task_id,
            status="COMPLETED",
            findings=[persisted],
            claims=[
                {
                    "already_processed": False,
                    "dimension": dimension,
                    "external_cause": decision["external_cause"],
                    "applied_delta": decision["applied_delta"],
                    "reason": decision["reason"],
                }
            ],
            evidence=[f"trust_events:{req.vendor_id}", f"trust_profiles:{req.vendor_id}"],
            confidence=0.9,
            risks=[] if decision["external_cause"] else [f"trust_penalty:{dimension}"],
            recommended_next_capabilities=["detect_behavioural_drift"],
            receipt_id=task_id,
        )
    except Exception as exc:  # noqa: BLE001
        return _failed_result(task_id, f"update_trust failed: {exc}")


@app.post("/compare_vendor_history", response_model=AgentResult)
def compare_vendor_history(req: CompareVendorHistoryRequest) -> AgentResult:
    task_id = _receipt_id()
    try:
        profiles = []
        drift_flags = {}
        missing = []
        for vendor_id in req.vendor_ids:
            profile = db.fetch_trust_profile(vendor_id)
            if profile is None:
                missing.append(vendor_id)
                continue
            profiles.append(profile)
            events_by_dimension = {
                dim: db.fetch_trust_events(vendor_id, impact_dimension=dim, project_id=req.project_id)
                for dim in TRUST_DIMENSIONS
            }
            drift_flags[vendor_id] = logic.detect_drift(events_by_dimension)

        if not profiles:
            return _failed_result(task_id, f"No trust_profiles found for vendor_ids={req.vendor_ids}")

        note = logic.summarize_comparison(profiles, drift_flags)
        risks = [
            f"drift:{vendor_id}:{flag['dimension']}"
            for vendor_id, flags in drift_flags.items()
            for flag in flags
        ]

        return AgentResult(
            agent=AGENT_NAME,
            task_id=task_id,
            status="COMPLETED" if not missing else "INSUFFICIENT_INFORMATION",
            findings=profiles,
            claims=[{"note": note, "missing_vendor_ids": missing}],
            evidence=[f"trust_profiles:{vid}" for vid in req.vendor_ids],
            confidence=0.8 if not missing else 0.5,
            risks=risks,
            recommended_next_capabilities=[],
            receipt_id=task_id,
        )
    except Exception as exc:  # noqa: BLE001
        return _failed_result(task_id, f"compare_vendor_history failed: {exc}")
