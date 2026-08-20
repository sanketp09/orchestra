# CAPABILITIES_AND_CONTRACTS.md

# Capability and Integration Contracts

## 1. Purpose

This document defines how independent specialist systems are described to and invoked by ORCHESTRA.

The contract describes capabilities.

It does not prescribe workflow.

## 2. Capability Manifest

Every specialist capability must be represented in a machine-readable manifest.

Minimum fields:

```yaml
id: string
specialist: string
description: string
use_when:
  - string
endpoint: string
method: POST
input_schema: string
output_schema: string
payload_schema:
  required: []
  optional: []
requires: []
requires_any: []
produces: []
availability: AVAILABLE
```

Recommended additional metadata:

```yaml
version: string
timeout_seconds: number
idempotent: boolean
cost_hint: low | medium | high
latency_hint: low | medium | high
```

## 3. Capability Semantics

### `description`

What the capability does.

### `use_when`

Types of problems for which the capability may be useful.

This is descriptive metadata, not a routing rule.

### `requires`

Information that must be present before execution.

### `requires_any`

At least one item in this set must be satisfied.

This prevents rigid dependencies such as:

```text
Arbiter requires Sentinel first
```

Instead:

```text
Arbiter may require any sufficiently structured event context,
such as verified events, an existing timeline, or reliable
project facts.
```

ORCHESTRA decides how such conditions are satisfied.

### `produces`

Structured concepts or outputs that the capability can add to ORCHESTRA state.

Examples:

- verification_findings
- contradictory_evidence
- evidence_gaps
- trust_profile
- trust_history
- similar_cases
- causal_analysis
- responsibility_assessment
- recommendation

The planner reasons over these declared outputs when deciding what capability may help resolve a gap.

## 4. Shared AgentTask

Every specialist must accept the common task envelope.

Conceptual schema:

```python
class AgentTask(BaseModel):
    task_id: str
    capability: str
    project_id: str | None = None
    entity_ids: list[str] = []
    payload: dict
    context: dict = {}
```

`payload` contains capability-specific data.

The capability manifest must explicitly document its required and optional payload fields.

## 5. Shared AgentResult

Every specialist must return the common result envelope.

Conceptual schema:

```python
class AgentResult(BaseModel):
    agent: str
    task_id: str
    status: str
    findings: dict | list | str | None = None
    claims: list[dict] = []
    evidence: list[dict] = []
    confidence: float | None = None
    risks: list[dict] = []
    recommended_next_capabilities: list[str] = []
    receipt_id: str | None = None
    error: dict | None = None
```

Specialists may include additional domain-specific information inside structured findings or an agreed extension field, but the common envelope must remain stable.

## 6. Result Statuses

Use a shared top-level status vocabulary:

```text
COMPLETED
INSUFFICIENT_INFORMATION
FAILED
NEEDS_HUMAN_REVIEW
```

Domain-specific interpretations may appear inside `findings`.

The top-level status should remain standardized.

## 7. Structured Errors

When execution fails, return:

```json
{
  "code": "MISSING_REQUIRED_CONTEXT",
  "message": "Vendor ID is required.",
  "retryable": false
}
```

Recommended error codes:

```text
INVALID_INPUT
MISSING_REQUIRED_CONTEXT
INSUFFICIENT_EVIDENCE
SPECIALIST_UNAVAILABLE
PROCESSING_FAILED
TIMEOUT
```

The error becomes part of ORCHESTRA state and is evaluated for replanning or human review.

## 8. Advisory Recommendations

`recommended_next_capabilities` is advisory only.

Rules:

- specialists may suggest capabilities
- ORCHESTRA may consider or ignore them
- recommendations never trigger automatic execution
- recommendations never modify the current plan directly
- only a new validated ORCHESTRA plan can schedule a capability

## 9. Example Capability Definitions

### Sentinel

```yaml
id: sentinel.verify_claim
specialist: sentinel
description: Verify whether a procurement or construction claim is supported, contradicted, or insufficiently supported by available evidence.
use_when:
  - A claim requires evidence-based verification.
  - Conflicting evidence must be identified.
payload_schema:
  required:
    - claim_text
  optional:
    - evidence_ids
    - document_ids
    - project_context
requires:
  - claim_context
requires_any:
  - evidence
  - project_context
produces:
  - verification_findings
  - supporting_evidence
  - contradictory_evidence
  - evidence_gaps
  - confidence
availability: AVAILABLE
```

### Trustline

```yaml
id: trustline.get_profile
specialist: trustline
description: Retrieve the current vendor trust profile, history, and relevant risk signals.
use_when:
  - A vendor's reliability or historical behavior is relevant to a decision.
payload_schema:
  required:
    - vendor_id
  optional:
    - project_id
requires:
  - vendor_id
produces:
  - trust_profile
  - trust_history
  - risk_signals
availability: AVAILABLE
```

### Precedent

```yaml
id: precedent.find_similar_case
specialist: precedent
description: Retrieve historically similar procurement, vendor, contract, or dispute cases.
use_when:
  - Historical similarity or prior outcomes may provide useful context.
payload_schema:
  required:
    - situation_description
  optional:
    - vendor_id
    - contract_context
produces:
  - similar_cases
  - historical_outcomes
  - similarity_scores
availability: AVAILABLE
```

### Arbiter

```yaml
id: arbiter.analyze_causation
specialist: arbiter
description: Analyze a structured set of events and facts to identify likely root causes and responsibility.
use_when:
  - A decision requires causation or responsibility analysis.
payload_schema:
  required:
    - events
  optional:
    - verification_results
    - historical_context
requires_any:
  - structured_events
  - verified_events
  - existing_timeline
produces:
  - causal_analysis
  - responsibility_assessment
  - reasoning
availability: AVAILABLE
```

These examples are capability descriptions, not a required execution order.

## 10. Plan Validation Contract

For every `PlanStep`, ORCHESTRA validates:

1. capability exists
2. capability is available
3. payload has required fields
4. payload matches documented expectations
5. `requires` conditions are satisfied
6. at least one `requires_any` condition is satisfied where applicable
7. run/iteration constraints are respected

The validator may reject a step.

The validator must not select a replacement capability.

## 11. Integration Rules

Specialists:

- must not call other specialists directly
- must not write ORCHESTRA workflow state
- must not create ORCHESTRA plan steps
- must not assume they always run before or after another specialist

ORCHESTRA:

- invokes specialists through their registered capability
- does not depend on their internal implementation
- does not write directly into specialist-owned tables
- persists orchestration state separately

## 12. Capability Availability

A capability may expose:

```text
AVAILABLE
DEGRADED
UNAVAILABLE
```

Unavailable or degraded capability state must be visible to validation/evaluation.

ORCHESTRA must not silently use a hardcoded substitute.

## 13. Handoff Requirement for Specialist Teams

Each specialist team should provide:

1. `capabilities.json` or `capabilities.yaml`
2. endpoint details
3. shared `AgentTask` compatibility
4. shared `AgentResult` compatibility
5. payload requirements
6. error behavior
7. a reachable implementation or schema-valid mock during integration

The capability manifest is the primary integration source for ORCHESTRA.
