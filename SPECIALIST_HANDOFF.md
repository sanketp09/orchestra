# Orchestra Specialist Handoff Document

This document outlines the final integration boundaries for the four Orchestra procurement intelligence specialists: Sentinel, Trustline, Precedent, and Arbiter. It is written specifically for the ORCHESTRA / BRAIN team to integrate with the specialists seamlessly.

## 1. Architecture
The specialist systems operate purely as **Capability Providers**.
*   **ORCHESTRA** acts as the workflow planner and decision-making authority.
*   Specialists **DO NOT** determine global workflow.
*   Specialists **DO NOT** communicate directly with one another (no direct HTTP calls).
*   All interactions occur via standard `AgentTask` (input) and `AgentResult` (output) schemas.

```
                    BRAIN / ORCHESTRA
                           |
                       AgentTask
                           |
        -------------------------------------------
        |              |              |             |
        v              v              v             v
     SENTINEL       TRUSTLINE      PRECEDENT      ARBITER
```

## 2. Canonical Implementation of Each Service
To avoid ambiguity, the canonical implementations for each service are:
*   **SENTINEL**: `services/sentinel_service.py` (via `sentinel/app/main.py`)
*   **TRUSTLINE**: `services/trustline_service.py` (via `sentinel/app/main.py`)
*   **PRECEDENT**: `services/precedent_service.py` (via `sentinel/app/main.py`)
*   **ARBITER**: `services/arbiter_service.py` (via `sentinel/app/main.py`)

*Note: The standalone FastAPI applications found in `codes/*/main.py` are explicitly marked as **DEPRECATED** and should not be used as the integration boundary.*

## 3. Service Run Commands
Since all services are routed together under the single `sentinel/app/main.py` FastAPI app for simplified deployment (though they maintain strict logical decoupling):
```bash
uvicorn sentinel.app.main:app --host 0.0.0.0 --port 8000
```

## 4. Base URLs
In production, you should use environment variables to map to these services. Since they are co-located in one app by default, they all share the same host/port but have different URL prefixes:
*   `SENTINEL_URL=http://localhost:8000/sentinel`
*   `TRUSTLINE_URL=http://localhost:8000/trustline`
*   `PRECEDENT_URL=http://localhost:8000/precedent`
*   `ARBITER_URL=http://localhost:8000/arbiter`

## 5. GET /health
Every specialist provides a health check endpoint: `GET {SERVICE_URL}/health`
```json
{
  "service": "sentinel",
  "status": "healthy",
  "version": "1.0"
}
```

## 6. GET /capabilities
Every specialist provides a capability manifest: `GET {SERVICE_URL}/capabilities`
This returns machine-readable JSON outlining the `use_when`, `requires`, and `produces` metadata, but **without** workflow-routing instructions.

## 7. POST /execute
Every specialist accepts capability dispatching via a standard POST route: `POST {SERVICE_URL}/execute`.
The route accepts an `AgentTask` and internally resolves the specific handler based on `task.capability`.

## 8. AgentTask Example
The shared contract is defined in `common/schemas/task.py`.
```json
{
  "task_id": "123e4567-e89b-12d3",
  "capability": "sentinel.verify_claim",
  "project_id": "prj_001",
  "entity_ids": ["vendor_999"],
  "payload": {
    "claim_text": "Supplier delayed delivery due to hurricane."
  },
  "context": {}
}
```

## 9. AgentResult Example
The shared contract is defined in `common/schemas/task.py`.
```json
{
  "agent": "sentinel",
  "task_id": "123e4567-e89b-12d3",
  "status": "COMPLETED",
  "findings": [{"verified": false, "anomalies": []}],
  "claims": [],
  "evidence": ["img_001.jpg"],
  "confidence": 0.95,
  "risks": [],
  "recommended_next_capabilities": ["arbiter.analyze_causation"],
  "receipt_id": "rcpt_sentinel_xyz123"
}
```

## 10. Capability Catalog & 11. Payload Schemas
Reference `capabilities.json` at the repository root for the comprehensive global capability list and payload structures. Examples include:
*   **sentinel.verify_claim**: Requires `claim_text`.
*   **trustline.get_vendor_profile**: Requires `vendor_id`.
*   **precedent.find_similar_case**: Requires `query`.
*   **arbiter.analyze_causation**: Requires `claims` and `evidence_context`.

## 12. Error Codes
Defined in `common/schemas/errors.py`. Found under `AgentResult.error`.
*   `INVALID_INPUT` (e.g. unknown capability dispatch)
*   `MISSING_REQUIRED_CONTEXT` (e.g. missing payload fields)
*   `INSUFFICIENT_EVIDENCE`
*   `SPECIALIST_UNAVAILABLE` (e.g. Supabase downtime)
*   `PROCESSING_FAILED`
*   `TIMEOUT`

## 13. Availability
Capability metadata (`GET /capabilities`) exposes dynamic availability statuses (`AVAILABLE`, `DEGRADED`, `UNAVAILABLE`) based on backend health checks (Database, LLMs). 

## 14. Environment Variables
*   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
*   `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`
*   `SENTINEL_URL`, `TRUSTLINE_URL`, `PRECEDENT_URL`, `ARBITER_URL`

## 15. Database Dependencies
All services depend on Supabase (PostgreSQL). Precedent specifically requires `pgvector` enabled for 384-d `historical_cases` similarity indexing.

## 16. Data Ownership
Brain **MUST NOT** directly write into specialist-owned tables. 
*   **Sentinel**: evidence files, verification results.
*   **Trustline**: `trust_profiles`, `trust_events`.
*   **Precedent**: `historical_cases` (pgvector).
*   **Arbiter**: `timelines`, `causation_results`, `belief_edges`.

## 17. Known Limitations
*   Sentinel's vision capabilities require high-quality source documents; poorly scanned PDFs will return `INSUFFICIENT_INFORMATION`.
*   Arbiter expects structured `evidence_context`; if thin, it defers analysis.

## 18. What ORCHESTRA Should NOT Assume
*   Do not assume a fixed progression. Do not assume Sentinel must *always* run before Trustline.
*   `recommended_next_capabilities` is purely advisory, NOT an execution command.

## 19. Direct Specialist-to-Specialist Call Policy
**Strictly Forbidden.** 
No cross-specialist imports or HTTP clients are permitted. Specialists only report to ORCHESTRA.
