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

## Phase 2 — Situation Understanding (Completed)
- **Completed on**: 2026-08-20
- **Milestones**:
  - Modified [state.py](file:///c:/Users/Shravanya/Desktop/ORCHESTRA%20PARENT/orchestra/orchestra/state.py) to allow attaching `SituationContext` objects to the in-memory `OrchestraState`.
  - Implemented [situation.py](file:///c:/Users/Shravanya/Desktop/ORCHESTRA%20PARENT/orchestra/orchestra/situation.py):
    - **`SituationContext`**: Pydantic schema tracking primary objective, expected outcome, entities, facts, uncertainties, evidence references, gaps, constraints, urgency, and risks.
    - **Input Normalization**: Separates deterministic metadata (like project and vendor IDs) from semantic text to ensure explicit fields are preserved without re-interpretation.
    - **`SituationAnalyzer`**: Combines deterministic context with semantic JSON schema extraction via Unified LLM Client, complete with a robust rule-based fallback scanner and validation error handling (`SituationAnalysisError`).
  - Created [test_orchestra_situation.py](file:///c:/Users/Shravanya/Desktop/ORCHESTRA%20PARENT/orchestra/tests/test_orchestra_situation.py) covering metadata preservation, raw text parsing, list distinction, validation fallbacks, and E2E state attachment.
- **Architectural Verification**:
  - Employs a hybrid deterministic/semantic approach to interpret situations without choosing or referencing any specialist systems (Sentinel, Trustline, etc.).
  - All Phase 1 and Phase 2 tests passed successfully.

## OpenAI Integration Milestone (Completed)
- **Completed on**: 2026-08-21
- **Milestones**:
  - Refactored [llm_client.py](file:///c:/Users/Shravanya/Desktop/ORCHESTRA%20PARENT/orchestra/common/llm_client.py) (`UnifiedLLMClient`) to use `AsyncOpenAI` as the sole runtime LLM provider (removing Gemini, Groq, Claude).
  - Implemented an event-loop-safe synchronous wrapper (`run_async` via ThreadPoolExecutor) to support async API connections without breaking the specialists' existing synchronous public client signatures.
  - Implemented dynamic JSON Schema strict cleaning (`clean_json_schema_for_openai`) to format Pydantic and dictionary schemas for OpenAI's `strict: True` structured output requirements (recursively setting `additionalProperties: False`, removing defaults, and setting all properties as required).
  - Removed all local fallback client models (`deterministic_fallback_reasoning` and keyword scanners) from production runtime to enforce clear `OPENAI_API_KEY` configuration/runtime validation.
  - Refactored [test_orchestra_situation.py](file:///c:/Users/Shravanya/Desktop/ORCHESTRA%20PARENT/orchestra/tests/test_orchestra_situation.py) to use explicit client mocks, ensuring the default test suite runs fully deterministically and consumes zero API credits.
  - Created [test_openai_integration.py](file:///c:/Users/Shravanya/Desktop/ORCHESTRA%20PARENT/orchestra/tests/test_openai_integration.py) covering opt-in smoke testing and E2E procurement scenario validation.
- **Architectural Verification**:
  - E2E procurement delay scenario successfully parsed using OpenAI `gpt-5-mini` and validated as a Pydantic `SituationContext`.
  - Facts, uncertainties, gaps, and explicit entities preserve all constraints.

## Case Studies & Repository Abstraction Milestone (Completed)
- **Completed on**: 2026-08-21
- **Milestones**:
  - Implemented [repository.py](file:///c:/Users/Shravanya/Desktop/ORCHESTRA%20PARENT/orchestra/orchestra/repository.py) to decouple the ORCHESTRA reasoning engine from specific database query dialects:
    - **`NormalizedCaseContext`**: Standard Pydantic structure mapping project context, vendors, procurement items, purchase orders, engineering changes, schedule events, performances, and sources.
    - **Provenance Preservation**: Enforces data origins (`verified_public`, `logically_derived`, `synthetic_augmented`) at both the database level (via SQL CHECK constraints) and model level (via Pydantic validator checks).
    - **`FakeCaseRepository` / `SupabaseCaseRepository`**: Abstraction enabling clean swaps between mocked local datasets and live Supabase queries.
  - Formulated canonical case studies under `orchestra/cases_data/`:
    - **Crossrail Case 1** (`crossrail_case.py`): Bounded track and systems installation delay study based strictly on NAO report facts, representing reactive delay diagnostics.
    - **DPR Case 2** (`data_center_case.py`): Accelerated material requirement study representing proactive risk planning.
  - Appended the `analyze_case(NormalizedCaseContext)` adapter to `SituationAnalyzer` in [situation.py](file:///c:/Users/Shravanya/Desktop/ORCHESTRA%20PARENT/orchestra/orchestra/situation.py) to map unified case contexts into the existing semantic/deterministic analysis flow without breaking public API compatibility.
  - Implemented database migrations with safe column modifications (`ADD COLUMN IF NOT EXISTS`) and database-enforced CHECK constraints, complete with an idempotent seeding pipeline in [seed.py](file:///c:/Users/Shravanya/Desktop/ORCHESTRA%20PARENT/orchestra/orchestra/seed.py).
  - Created [test_orchestra_cases.py](file:///c:/Users/Shravanya/Desktop/ORCHESTRA%20PARENT/orchestra/tests/test_orchestra_cases.py) verifying repository exceptions, provenance survival, adapter compatibility, and partial data handling with zero API call costs.
- **Architectural Verification**:
  - Exposes a clean repository data pipeline: `Supabase -> CaseRepository -> NormalizedCaseContext -> SituationAnalyzer -> SituationContext -> OrchestraState`.
  - Maintains strict factual integrity boundary rules and separates logical inferences from synthetic augmented records.
  - All 23 deterministic unit tests passed successfully.

## Phase 3A — Dynamic Capability Discovery and Candidate Scoring (Completed)
- **Completed on**: 2026-08-21
- **Milestones**:
  - Implemented structured **`InformationNeed`** and **`CapabilityCandidate`** schemas in [planner.py](file:///c:/Users/Shravanya/Desktop/ORCHESTRA%20PARENT/orchestra/orchestra/planner.py) to translate `SituationContext` objective, facts, gaps, and uncertainties into concrete resolution requirements.
  - Implemented dynamic capability discovery by reading the runtime `CapabilityRegistry.list_capabilities()` instead of hardcoded lists.
  - Developed semantic capability relevance scoring matching needs against registered capability use rules (`use_when`, descriptions) using UnifiedLLMClient structured outputs, strictly validating candidate integrity in Python.

## Phase 3B — Dynamic Plan Generation and Dependency Resolution (Completed)
- **Completed on**: 2026-08-21
- **Milestones**:
  - Implemented hybrid plan generation where the LLM semantically proposes plans containing step objectives, expected outputs, dependencies, and reasons (`ProposedPlan`, `ProposedPlanStep`), and Python code executes rigid deterministic validation.
  - Developed topological sorting and cycle detection using Kahn's algorithm over the step dependency DAG.
  - Enforced deterministic ordering and tie-breakers for independent parallel steps based on information need priority, Phase 3A candidate score, capability ID, and step ID.
  - Added strict coverage verification (high priority needs must be addressed; lower priority omissions must be justified), dependency reason matching, step count limits, dependency depth limits, and capability contract compatibility matching.
  - Created 13 unit tests in [test_orchestra_planner.py](file:///c:/Users/Shravanya/Desktop/ORCHESTRA%20PARENT/orchestra/tests/test_orchestra_planner.py) covering all DAG validation, priority omissions, dynamic capability injections, and contract failures with zero API costs.
- **Architectural Verification**:
  - Semantic proposal combined with deterministic DAG & contract validation guarantees structured, safe plans.
  - Total isolation from case names, IDs, or specialist names in the planning logic.
  - All 36 deterministic tests passed successfully.

## Phase 4 — Dynamic Plan Execution and Result Propagation (Completed)
- **Completed on**: 2026-08-21
- **Milestones**:
  - Implemented the topologically sorted, dependency-aware execution engine **`ExecutionOrchestrator`** in [execution.py](file:///c:/Users/Shravanya/Desktop/ORCHESTRA%20PARENT/orchestra/orchestra/execution.py).
  - Formulated dynamic, generic, contract-based input resolution that matches input payloads generically based on capability schema properties (dependency outputs, case context, situation facts, and needs) without hardcoding specialist names.
  - Enforced execution-time active verification (capability ID must exist and be active in CapabilityRegistry) and payload contract schema validation before invoking specialist services.
  - Introduced the structured **`ProvenanceRecord`** Pydantic schema supporting parent provenance tracking (lineage records) to trace sources (case context documents, previous specialist analysis steps) without tree duplication.
  - Developed branch failure isolation where dependency failures/blocks propagate downstream (`StepBlockReason`), allowing independent execution branches to complete.
  - Created 9 unit tests in [test_orchestra_execution.py](file:///c:/Users/Shravanya/Desktop/ORCHESTRA%20PARENT/orchestra/tests/test_orchestra_execution.py) verifying all routing, lineage, and failure properties, and extended Level B1 integration tests in [test_openai_integration.py](file:///c:/Users/Shravanya/Desktop/ORCHESTRA%20PARENT/orchestra/tests/test_openai_integration.py).
- **Architectural Verification**:
  - Validated plans are executed in topologically sorted order, resolving inputs dynamically and validating payload schemas against runtime registry contracts.
  - No case-specific or specialist-specific hardcoding.
  - All 45 deterministic tests passed successfully.

## Compass and Arbiter Specialists Integration Milestone (Completed)
- **Completed on**: 2026-08-21
- **Milestones**:
  - Integrated the **Compass** specialist for downstream impact and dependency analysis:
    - **`compass.analyze_downstream_impact`**: Added this capability to `specialists/capabilities.json`.
    - **`compass_service.py`**: Created the Compass specialist APIRouter in [compass_service.py](file:///c:/Users/Shravanya/Desktop/ORCHESTRA%20PARENT/orchestra/services/compass_service.py). Implemented `build_dynamic_ripple_graph` which dynamically builds dependency graphs from case context (checking engineering changes, POs, schedule events) using generic keyword overlaps and date deltas without any hardcoded case logic.
  - Integrated the **Arbiter** specialist for causation-and-responsibility reasoning:
    - Exposes five capabilities (`arbiter.reconstruct_timeline`, `arbiter.analyze_causation`, `arbiter.assess_responsibility`, `arbiter.analyze_dispute`, `arbiter.run_debate`) from [arbiter_service.py](file:///c:/Users/Shravanya/Desktop/ORCHESTRA%20PARENT/orchestra/services/arbiter_service.py) via `/arbiter/execute`.
    - Adapted the generic execution-time input resolution layer in [execution.py](file:///c:/Users/Shravanya/Desktop/ORCHESTRA%20PARENT/orchestra/orchestra/execution.py) to resolve structured inputs (`event_refs`, `evidence_context`, `claims`, `dispute_context`) from case context dynamically.
  - Created [test_orchestra_compass.py](file:///c:/Users/Shravanya/Desktop/ORCHESTRA%20PARENT/orchestra/tests/test_orchestra_compass.py) (11 tests) and [test_orchestra_arbiter.py](file:///c:/Users/Shravanya/Desktop/ORCHESTRA%20PARENT/orchestra/tests/test_orchestra_arbiter.py) (7 tests) verifying registry discovery, dynamic candidate scoring, generic execution inputs resolution, dependency outputs propagation, failure isolation, and provenance tracking with zero credit cost.
- **Architectural Verification**:
  - Dynamic discovery and execution runs fully generic without any case-specific (`if case == "crossrail"`) or specialist-specific (`if specialist == "Compass"`) hardcoded routes in the planner or execution layers.
  - All 63 deterministic tests passed successfully.

## Atlas External Risk Capabilities Integration Milestone (Completed)
- **Completed on**: 2026-08-21
- **Milestones**:
  - Integrated the **Atlas** specialist for dynamic external-risk intelligence gathering and analysis:
    - **Atlas Capabilities**: Added `atlas.external_event`, `atlas.commodity`, `atlas.shipping`, and `atlas.geopolitical` capabilities to `specialists/capabilities.json`.
    - **`providers/base.py` & `providers/seeded_events.py`**: Created a provider interface and concrete `SeededEventProvider` that loads in-memory fallback events if Supabase is inaccessible or database tables are missing.
    - **`services/relevance_engine.py`**: Refactored relevance engine from Grok/LLM logic to a zero-API-cost deterministic relevance filter that scores events against task routes, expected arrivals, material names, and vendor countries.
    - **`services/atlas_service.py`**: Built the standard APIRouter matching `AgentTask` to corresponding capability routines and returning `AgentResult` packages.
    - **Dynamic Contract Input Resolution**: Extended the generic input resolver in [execution.py](file:///c:/Users/Shravanya/Desktop/ORCHESTRA%20PARENT/orchestra/orchestra/execution.py) to map `route`, `expected_arrival`, `material`, and `vendor_country` from need description, PO details, and project records with structured provenance.
    - **`tests/test_orchestra_atlas.py`**: Added 5 tests covering dynamic registry discovery, relevance scoring, commodity price risk matching, generic pipeline execution, and blocked inputs validation with zero credit cost.
- **Architectural Verification**:
  - Exposes Atlas as a first-class citizen using standard `AgentTask` -> `AgentResult` routing without introducing parallel pipelines or custom executors.
  - All 68 deterministic tests passed successfully.




