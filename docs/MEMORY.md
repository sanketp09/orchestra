# MEMORY.md

# ORCHESTRA — Persistent Project Memory

> This file exists to restore project context when an AI coding agent,
> Antigravity session, or developer loses conversation history.
>
> Read this file FIRST before making architectural or implementation decisions.
>
> Then read:
>
> 1. PROJECT_CONTEXT.md
> 2. ARCHITECTURE.md
> 3. CAPABILITIES_AND_CONTRACTS.md
> 4. RULEBOOKAGENTS.md
>
> Do not redesign the architecture unless explicitly instructed.

---

# 1. WHAT THIS PROJECT IS

ORCHESTRA is the intelligent orchestration brain for our construction
procurement decision-support system.

The overall project contains multiple independent specialist systems such as:

- Sentinel
- Trustline
- Precedent
- Arbiter
- Compass
- potentially future systems

These specialists have different responsibilities and may operate at different
stages or scenarios in procurement.

ORCHESTRA's job is NOT to replace these systems or combine them into one giant
agent.

Its job is to intelligently determine:

- what the current situation is
- what decision needs to be made
- what information is missing or uncertain
- which specialist capability may help
- what order capabilities should run in
- which capabilities can run in parallel
- whether current evidence is sufficient
- whether to replan
- whether human review is required

The core idea is:

> Specialists expose what they can do. ORCHESTRA decides whether and when to use them.

---

# 2. THE PROBLEM WE ARE SOLVING

A simple hardcoded workflow would look like:

Sentinel → Trustline → Precedent → Arbiter

This is NOT acceptable as the final architecture because different situations
may require different combinations and sequences.

For example:

A claim verification problem may require:

Sentinel only.

A vendor selection problem may require:

Trustline + Precedent.

A dispute may require:

Sentinel → Arbiter → Trustline.

Another situation may require capabilities in a completely different order.

Therefore ORCHESTRA must dynamically create plans based on:

- the current situation
- available evidence
- unresolved uncertainties
- outputs needed
- registered capability metadata
- previous execution results

However, the system must also NOT be fully dependent on an LLM.

The final approach is:

> Bounded dynamic autonomy.

LLMs may reason and propose plans.

Deterministic infrastructure validates and controls those plans before execution.

---

# 3. LOCKED ARCHITECTURAL DECISIONS

The following decisions have already been made and should NOT be casually changed.

## ORCHESTRA is the only orchestration authority

Only ORCHESTRA can:

- create plans
- validate plans
- schedule execution
- invoke specialist capabilities
- trigger replanning
- retry execution
- route to human review

Specialists cannot orchestrate other specialists.

---

## No hardcoded situation-to-specialist routing

Do NOT implement:

```python
if dispute:
    call_sentinel()

CURRENT PROJECT STATE

The repository contains Person 2's completed specialist layer.

Implemented specialists:
- Sentinel
- Trustline
- Precedent
- Arbiter

Canonical specialist architecture:

Each specialist exposes:
GET /health
GET /capabilities
POST /execute

All specialists receive the shared AgentTask contract.

All specialists return the shared AgentResult contract.

Specialists do not call each other.

recommended_next_capabilities is advisory only.

ORCHESTRA is responsible for:
- understanding the current situation
- discovering relevant capabilities
- selecting capabilities
- creating plans
- validating plans
- executing specialists
- evaluating results
- deciding whether to continue, replan, finish, or request human review

Current implementation owner is Person 1.

Person 1 must build ORCHESTRA without:
- hardcoding scenario → specialist mappings
- hardcoding fixed workflows
- making the system fully dependent on an LLM
- modifying specialist domain logic unnecessarily

---

# 4. DEVELOPMENT HISTORY

## Phase 1 — ORCHESTRA Integration Foundation (Completed)
- **Completed on**: 2026-08-20
- **Milestones**:
  - Implemented [state.py](file:///c:/Users/Shravanya/Desktop/ORCHESTRA%20PARENT/orchestra/orchestra/state.py) containing in-memory tracking structures for `OrchestraState` and `PlanStep`.
  - Implemented [registry.py](file:///c:/Users/Shravanya/Desktop/ORCHESTRA%20PARENT/orchestra/orchestra/registry.py) (`CapabilityRegistry`) which reads `specialists/capabilities.json` and maps capability IDs (e.g., `sentinel.verify_claim`) to their corresponding owner specialist services and canonical execution routes (e.g., `/sentinel/execute`) based on nested JSON structure hierarchy.
  - Implemented [client.py](file:///c:/Users/Shravanya/Desktop/ORCHESTRA%20PARENT/orchestra/orchestra/client.py) (`OrchestraClient`), an async HTTP execution coordinator. It takes execution payloads, builds `AgentTask` envelopes, makes loopback `httpx` POST calls to `/{specialist}/execute`, and validates standard `AgentResult` returns.
  - Implemented [trace.py](file:///c:/Users/Shravanya/Desktop/ORCHESTRA%20PARENT/orchestra/orchestra/trace.py) for step-level audit trails of runs (`ExecutionTraceEntry`).
  - Added focused unit/integration tests in [test_orchestra_foundation.py](file:///c:/Users/Shravanya/Desktop/ORCHESTRA%20PARENT/orchestra/tests/test_orchestra_foundation.py) covering registry lookups, client validations, and mock-transport E2E simulation.
- **Architectural Verification**:
  - All communication successfully routes to the canonical execute endpoint `POST /{specialist}/execute`. No capability-specific routes created.
  - All tests passed. The core foundation layer is fully operational.