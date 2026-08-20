# ARCHITECTURE.md

# ORCHESTRA Architecture

## 1. High-Level Flow

```text
Raw Situation
      ↓
Situation Understanding
      ↓
Dynamic Planner
      ↓
Plan Validator
      ↓
Capability Registry / Resolver
      ↓
Execution Scheduler
      ↓
AgentTask
      ↓
Specialist HTTP Capability
      ↓
AgentResult
      ↓
ORCHESTRA State
      ↓
Evaluator
      ├── FINALIZE
      ├── REPLAN ───────────────┐
      └── HUMAN_REVIEW          │
                                │
                         Dynamic Planner
```

## 2. Situation Understanding

Input may include:

- raw user text
- claim
- event
- uploaded document reference
- alert
- project context
- existing run context

The output is a structured `SituationContext`.

Responsibilities:

- identify relevant entities
- identify the pending decision
- identify uncertainties
- estimate urgency/risk hints where useful
- preserve known facts separately from unknowns

Example conceptual fields:

```python
class SituationContext(BaseModel):
    situation_id: str
    project_id: str | None = None
    entity_ids: list[str] = []
    pending_decision: str
    known_facts: list[str] = []
    uncertainties: list[str] = []
    urgency: str = "medium"
    risk_hint: float | None = None
```

Situation understanding does not choose specialists directly.

## 3. Dynamic Planner

The planner receives:

- `SituationContext`
- current ORCHESTRA state
- accumulated results
- evaluator gaps
- available capability metadata
- bounded execution constraints

The planner produces only the next useful batch of `PlanStep`s.

Example:

```python
class PlanStep(BaseModel):
    step_id: str
    capability: str
    payload: dict
    reason: str
    expected_outputs: list[str] = []
    parallel_group: int | None = None
```

The planner may create:

- one capability call
- several independent calls in parallel
- a sequential call that depends on outputs already present in state

The planner must not assume a fixed specialist order.

## 4. Plan Validator

The validator is deterministic infrastructure.

It checks each proposed step for:

1. capability existence
2. capability availability
3. payload schema compatibility
4. required fields
5. preconditions
6. execution constraints
7. iteration/run limits

The validator returns:

```python
class PlanValidationResult(BaseModel):
    valid_steps: list[PlanStep]
    rejected_steps: list[PlanStep] = []
    validation_errors: list[str] = []
    needs_replan: bool = False
```

The validator may reject invalid steps.

It must not invent replacement capabilities.

## 5. Capability Registry

The registry resolves:

```text
capability ID
        ↓
capability metadata
        ↓
endpoint + method + contracts
```

The registry is driven by a machine-readable capability manifest.

It must not contain scenario routing logic.

Example responsibilities:

```python
register(capability)
get(capability_id)
list_available()
resolve(capability_id)
```

A new specialist should not require changes to the planner's source code if its capability metadata and compatible endpoint are added.

## 6. Execution Layer

The execution layer converts a validated `PlanStep` into an `AgentTask`.

Conceptually:

```text
PlanStep
   ↓
Resolve Capability
   ↓
Build AgentTask
   ↓
HTTP POST / configured method
   ↓
Validate AgentResult
   ↓
Persist normalized result
   ↓
Update OrchestraState
```

The execution layer must remain specialist-agnostic.

It should use:

- async HTTP
- timeouts
- structured error handling
- response validation
- controlled retry only when explicitly safe

## 7. Parallel Execution

Steps sharing the same `parallel_group` may execute concurrently only when they do not depend on each other's outputs.

Parallelism is an execution decision represented by the plan, not a hardcoded specialist rule.

## 8. Orchestra State

`OrchestraState` accumulates:

- situation context
- current plan
- validated steps
- completed results
- failed results
- evaluator gaps
- planning iteration count
- execution history
- terminal outcome

Specialist results are treated as evidence/state inputs for future planning.

## 9. Evaluator

The evaluator decides whether the current state is sufficient for the pending decision.

It considers:

- completed results
- evidence coverage
- unresolved uncertainties
- result confidence where meaningful
- structured execution failures
- evidence gaps
- risk/urgency
- advisory specialist recommendations

The evaluator returns exactly one outcome:

```text
FINALIZE
REPLAN
HUMAN_REVIEW
```

Specialist recommendations are evidence for evaluation, never direct routing instructions.

## 10. Replanning

When the evaluator returns `REPLAN`, the planner is called again with:

- the original situation
- accumulated results
- evaluator gaps
- prior execution history
- available capabilities

Replanning must not restart from an empty state.

The system must enforce:

- maximum planning cycles
- loop detection where practical
- repeated-capability safeguards where appropriate

## 11. Human Review

Human review is selected when:

- the evaluator determines evidence is insufficient and no safe next action exists
- a specialist explicitly returns a human-review condition
- risk/urgency requires human intervention
- bounded replanning is exhausted
- conflicting or high-impact evidence requires an accountable decision

The reviewer should receive:

- the situation
- task graph/run history
- plan history
- all relevant results
- receipts/evidence
- unresolved gaps

The reviewer may approve, reject, or override.

The decision is recorded in ORCHESTRA-owned run state and any agreed shared belief/audit layer.

## 12. Failure Handling

Capability failures become structured state.

Examples:

- `INVALID_INPUT`
- `MISSING_REQUIRED_CONTEXT`
- `INSUFFICIENT_EVIDENCE`
- `SPECIALIST_UNAVAILABLE`
- `PROCESSING_FAILED`
- `TIMEOUT`

ORCHESTRA evaluates the failure.

It does not silently substitute a hardcoded fallback specialist.

A failure may lead to:

- safe retry
- REPLAN
- HUMAN_REVIEW
- FINALIZE if the failed capability is nonessential and the decision remains sufficiently supported

## 13. Scalability Principle

The architecture is capability-driven.

Adding a future specialist should mainly require:

```text
Capability Manifest Entry
        +
Compatible Endpoint
        +
Shared Contracts
```

The core planner and orchestration graph should not need specialist-specific branching.
