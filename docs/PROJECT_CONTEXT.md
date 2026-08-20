# PROJECT_CONTEXT.md

# ORCHESTRA — Project Context

## 1. Project Purpose

ORCHESTRA is the orchestration brain of a construction procurement decision-support system.

It does not replace the specialist systems. It decides, for the current situation:

- what is unknown or needs to be resolved
- which registered capabilities may help
- what information each capability needs
- which capabilities can run independently or must wait for new information
- whether the current evidence is sufficient
- whether to replan, finalize, or route the situation to a human

ORCHESTRA is designed to work with independent specialist systems such as Sentinel, Trustline, Precedent, Arbiter, Compass, Atlas, and future capabilities.

The central principle is:

> Specialists expose what they can do. ORCHESTRA decides whether and when to use them.

## 2. Core Architecture Principle

ORCHESTRA is the only orchestration authority.

A specialist may:

- perform its own domain task
- validate its own inputs
- return findings, evidence, confidence, risks, and errors
- expose optional recommendations for potentially useful next capabilities

A specialist may not:

- invoke another specialist
- create a workflow step
- schedule another capability
- modify ORCHESTRA's plan
- automatically trigger a recommended capability

A sequence such as:

Sentinel → Precedent → Arbiter → Trustline

is a possible plan for a particular situation. It is never a mandatory platform workflow.

## 3. What ORCHESTRA Owns

- Situation understanding
- Dynamic capability-level planning
- Plan validation
- Capability discovery and resolution
- Execution scheduling
- Parallel/sequential execution decisions
- Result accumulation
- Evaluation of evidence sufficiency
- Replanning
- Human-review routing
- Run history and orchestration state

## 4. What ORCHESTRA Does Not Own

ORCHESTRA does not implement the internal intelligence of:

- Sentinel
- Trustline
- Precedent
- Arbiter
- Compass
- Atlas
- any future specialist

These systems are treated as independently deployable black-box services.

ORCHESTRA only reasons over their declared capability metadata and interacts with them through shared contracts.

## 5. Dynamic Planning Model

ORCHESTRA must plan against capabilities, not specialist names.

The planner receives a capability catalog containing information such as:

- capability ID
- specialist
- description
- when the capability is useful
- required inputs
- preconditions
- outputs it can produce
- endpoint and method
- input/output contracts
- availability

The planner must not rely on hardcoded rules such as:

```text
if dispute:
    call Sentinel
```

or:

```text
always call Sentinel before Arbiter
```

Instead:

```text
Current situation
        ↓
What is the pending decision?
        ↓
What is uncertain or missing?
        ↓
What information/output is needed?
        ↓
Which registered capability can produce it?
        ↓
Create a capability-level plan
        ↓
Validate
        ↓
Execute
```

## 6. Planning Is Incremental

ORCHESTRA does not need to plan the entire workflow at the beginning.

It plans the next useful batch of work.

After results return:

1. the state is updated
2. the evaluator identifies whether the decision is sufficiently supported
3. if gaps remain, ORCHESTRA replans using accumulated evidence
4. execution continues until a terminal outcome is reached

Terminal outcomes are:

- FINALIZE
- REPLAN
- HUMAN_REVIEW

REPLAN is bounded by a configured iteration limit.

## 7. Specialist Recommendations

A specialist may return:

`recommended_next_capabilities`

These are advisory signals only.

ORCHESTRA may:

- consider them
- ignore them
- choose another capability instead

A recommendation must never directly create or execute a workflow step.

Only a validated ORCHESTRA plan can schedule execution.

## 8. Shared Integration Boundary

The external boundary is:

```text
ORCHESTRA
    ↓
AgentTask
    ↓
Specialist Capability
    ↓
AgentResult
    ↓
ORCHESTRA
```

Specialists may use completely different internal algorithms, databases, models, or services.

Their external contracts must remain compatible with the shared task/result boundary.

## 9. Data Ownership

Specialists own their domain data.

Examples:

- Sentinel owns verification-specific data
- Trustline owns trust profiles and trust events
- Precedent owns historical case/index data
- Arbiter owns timeline and causation outputs

ORCHESTRA owns:

- situations
- orchestration runs
- plans
- plan steps
- execution history
- evaluation outcomes
- replanning history
- human-review requests

ORCHESTRA must not directly write into specialist-owned tables.

## 10. Tech Direction

The implementation should fit the existing Kaya-compatible stack:

- Python
- FastAPI
- Pydantic v2
- LangGraph
- SQLAlchemy where persistence requires it
- Supabase PostgreSQL/shared project where agreed by the team
- httpx for specialist communication

Runtime LLM usage is bounded and configurable.

LLMs are used for:

- situation understanding
- capability-level planning
- replanning
- semantic evaluation where deterministic rules are insufficient

LLMs do not directly execute arbitrary actions.

Every planned action must pass deterministic validation before execution.

## 11. Primary Success Criteria

ORCHESTRA is successful if a new specialist can be integrated primarily by adding:

1. capability metadata
2. an endpoint
3. compatible input/output contracts

without changing the core planning logic.

The strongest demonstration is that different situations can lead to different combinations and orders of specialist capabilities without scenario-specific routing code.
