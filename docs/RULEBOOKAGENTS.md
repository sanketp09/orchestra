# RULEBOOKAGENTS.md

# ORCHESTRA Build Rules

These rules are mandatory for implementation agents and contributors.

## 1. Source of Truth

Read, in order:

1. PROJECT_CONTEXT.md
2. ARCHITECTURE.md
3. CAPABILITIES_AND_CONTRACTS.md
4. this file

Do not redesign the architecture unless explicitly instructed.

## 2. ORCHESTRA Is the Only Orchestrator

Only ORCHESTRA may:

- create a plan
- validate a plan
- schedule execution
- invoke a capability
- retry execution
- cancel execution
- trigger replanning
- route to human review

Specialists may return findings and advisory recommendations only.

## 3. No Hardcoded Routing

Never write:

```python
if dispute:
    call_sentinel()
```

Never write:

```python
if vendor_fault:
    call_trustline()
```

Never hardcode:

```text
Sentinel → Precedent → Arbiter → Trustline
```

All routing decisions must be capability-driven and based on the current situation, registered metadata, accumulated state, and validated plans.

## 4. Plan Against Capabilities

The planner should receive capability metadata, not merely a list of specialist names.

Do not infer a capability's complete behavior solely from its ID.

Use:

- description
- use_when
- requirements
- preconditions
- produces
- availability
- payload schema

## 5. Capability Metadata Does Not Prescribe Workflow

Metadata may say:

> suitable when a claim requires verification

It must not say:

> always call at the beginning of a dispute

Possible workflow sequences are emergent plans, not platform rules.

## 6. Validation Is Deterministic

Every LLM-generated plan must be validated before execution.

The validator checks:

- capability existence
- availability
- payload requirements
- preconditions
- execution constraints

The validator may reject invalid steps.

The validator must never become a second planner or invent replacement capabilities.

## 7. Specialist Recommendations Are Advisory

`recommended_next_capabilities`:

- may be stored in ORCHESTRA state
- may influence planning/evaluation
- may be ignored

They must never automatically trigger execution.

Only a validated ORCHESTRA plan may create a new task.

## 8. Shared Contracts

Use the shared:

- AgentTask
- AgentResult
- error structure

Do not create incompatible request/response contracts for individual specialists at the ORCHESTRA boundary.

## 9. Specialist Isolation

Specialists must not:

- call each other
- create workflow steps
- modify ORCHESTRA plans
- directly manipulate ORCHESTRA run state

ORCHESTRA treats specialists as black-box capability providers.

## 10. Data Ownership

ORCHESTRA owns orchestration data.

Do not write directly into specialist-owned domain tables.

Use the specialist API/capability boundary.

## 11. Failure Handling

Never silently swallow specialist failures.

Convert failures into structured state.

A failure may lead to:

- retry, when explicitly safe
- REPLAN
- HUMAN_REVIEW
- FINALIZE, only if remaining evidence is sufficient

Never silently substitute a hardcoded fallback specialist.

## 12. Replanning

Replanning must use accumulated state.

Never restart the run from an empty situation.

Enforce bounded planning cycles.

Prevent uncontrolled loops.

## 13. Parallel Execution

Only execute plan steps in parallel when the plan explicitly marks them as independent and their dependencies are satisfied.

Do not hardcode specialist-specific parallelism.

## 14. LLM Boundaries

LLMs may:

- understand situations
- propose capability-level plans
- identify semantic gaps
- support replanning/evaluation

LLMs may not directly execute arbitrary actions.

All actions pass deterministic validation and registered capability resolution.

Keep model providers configurable.

Do not scatter provider-specific calls throughout the orchestration graph.

## 15. Extensibility Test

A new specialist should be integrable primarily by adding:

- capability metadata
- compatible endpoint
- shared contract support

Do not modify the core planner with specialist-specific branches unless explicitly approved as a temporary exception.

## 16. Build Discipline

Do not add:

- extra frameworks
- unnecessary databases
- specialist intelligence
- frontend work unrelated to the current milestone
- duplicate architecture documentation

Build the smallest implementation that proves the documented architecture.

## 17. Required Invariants

The following must always remain true:

1. No situation-to-specialist hardcoding.
2. No mandatory specialist sequence.
3. No specialist-to-specialist orchestration.
4. No unvalidated LLM action execution.
5. Specialist recommendations are advisory.
6. Capability metadata is the integration source of truth.
7. ORCHESTRA remains the sole orchestration authority.
8. Replanning uses accumulated state.
9. Human review is a first-class terminal route.
10. New specialists should not require rewriting core planning logic.
