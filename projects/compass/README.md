# Compass — Phase 1 Stub

Decision-synthesis specialist for the ORCHESTRA procurement intelligence system.

This is the **Phase 1** build only (per `03_PERSON3_RISK_DECISION.md`, section 4):
a minimal, stateless FastAPI service that exposes `compass.recommend`, accepts
whatever assembled context ORCHESTRA sends it, and returns a schema-valid but
fake `Recommendation`. This exists so ORCHESTRA has an end-to-end path to
integrate against before Sentinel/Trustline/Precedent/Arbiter/Atlas are real.

## What this is NOT

- Not real synthesis logic (no Claude call yet — that's Phase 3).
- Not Atlas.
- Not a database — nothing is persisted.
- Not calling any other specialist. Compass only ever reads the `context`
  field ORCHESTRA hands it in the `AgentTask`; it never reaches out to
  Sentinel, Trustline, Precedent, Arbiter, or Atlas directly.

## Files

```
compass/
├── main.py            # FastAPI app: /health and POST /compass/recommend
├── schemas.py          # AgentTask / AgentResult / Recommendation (Pydantic)
├── requirements.txt
└── README.md
```

`schemas.py` duplicates the shared contract from
`00_UNIVERSAL_ARCHITECTURE.md` §4.2–4.3 locally so this service can run
standalone right now. Once `common/` is frozen (Phase 0, whole team), delete
the local model definitions here and import from the shared package instead
— don't let this become a second source of truth for the schema.

## How ORCHESTRA calls this service

ORCHESTRA is the only caller. It POSTs an `AgentTask` to
`/compass/recommend` and gets back a `AgentResult`. Per the integration
contract, ORCHESTRA is responsible for assembling the multi-specialist
`context` (Sentinel/Trustline/Precedent/Arbiter/Atlas outputs) before
calling Compass — Compass does not fetch that itself.

```python
# inside orchestra/, illustrative only
import httpx

response = httpx.post(
    "http://compass:8005/compass/recommend",
    json={
        "task_id": "task_001",
        "capability": "compass.recommend",
        "project_id": "proj_123",
        "entity_ids": ["vendor_42", "claim_9"],
        "payload": {},
        "context": {
            "situation_id": "situation_abc",
            "sentinel": {...},
            "trustline": {...},
        },
    },
)
result = response.json()  # AgentResult
```

## Run locally

```bash
cd compass
python3 -m venv venv && source venv/bin/activate   # optional but recommended
pip install -r requirements.txt

uvicorn main:app --reload --port 8005
```

Service will be available at `http://127.0.0.1:8005`.

## Endpoints

### `GET /health`

Basic liveness check.

```bash
curl http://127.0.0.1:8005/health
```

```json
{"status": "ok", "agent": "compass", "time": "2026-08-20T04:53:49.837034+00:00"}
```

### `POST /compass/recommend`

Implements the `compass.recommend` capability from the integration
contract. Body must be a valid `AgentTask`.

**Example request:**

```bash
curl -s -X POST http://127.0.0.1:8005/compass/recommend \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "task_001",
    "capability": "compass.recommend",
    "project_id": "proj_123",
    "entity_ids": ["vendor_42", "claim_9"],
    "payload": {},
    "context": {
      "situation_id": "situation_abc",
      "sentinel": {"claim_verified": true, "confidence": 0.82},
      "trustline": {"vendor_trust_score": 0.7}
    }
  }'
```

**Expected response (`AgentResult`):**

```json
{
    "agent": "compass",
    "task_id": "task_001",
    "status": "completed",
    "findings": [
        {
            "type": "recommendation",
            "explanation": "Phase 1 stub recommendation — not yet backed by real specialist evidence.",
            "data": {
                "recommendation_id": "rec_991764e1f8df",
                "situation_id": "situation_abc",
                "recommendation": "Approve vendor claim with standard monitoring.",
                "rationale": "Stub rationale: this is placeholder synthesis output. Once Sentinel/Trustline/Precedent/Arbiter/Atlas are wired in, this field will reflect real evidence from task.context.",
                "contributing_factors": ["stub.sentinel_finding", "stub.trustline_score"],
                "cost_impact": "No estimated cost impact (stub).",
                "schedule_impact": "No estimated schedule impact (stub).",
                "risk_exposure": "low",
                "confidence": 0.5,
                "alternatives_considered": ["Reject claim", "Request additional evidence"]
            }
        }
    ],
    "claims": [],
    "evidence": [],
    "confidence": 0.5,
    "risks": [],
    "recommended_next_capabilities": [],
    "receipt_id": "receipt_7ee15f618a45"
}
```

`recommendation_id` and `receipt_id` are randomly generated per call, so
exact values will differ each time you run it.

## Interactive API docs

FastAPI auto-generates these once the server is running:

- Swagger UI: `http://127.0.0.1:8005/docs`
- ReDoc: `http://127.0.0.1:8005/redoc`

## Next phases (not built here)

- **Phase 2 (Atlas):** build Atlas separately; not part of this stub.
- **Phase 3 (Compass, real):** replace the fake `Recommendation` in
  `main.py` with an actual Claude call over `task.context`, once
  Sentinel/Trustline/Precedent/Arbiter outputs exist to synthesize over.
- **Phase 4:** confirm the `atlas.assess_external_event` → Compass handoff
  shape with Person 3's own Atlas work and Person 2's `trustline.update_trust`.

Register `compass.recommend` (and later `compass.compare_alternatives`,
`compass.estimate_impact`) with Person 1's Capability Registry as soon as
this contract is stable.
