# 08 — Scope Boundaries: What Is NOT Being Built (and why that's fine)

State this proactively in any pitch or demo — don't wait to be asked. For the agent building this: treat every item below as **out of scope by default**. If a task in `09-ROADMAP-TASKS.md` seems to require one of these, flag it rather than quietly implementing it.

| Not built | Why | What to do instead |
|---|---|---|
| Compass beyond Procurement X-Ray + Ripple Check (Opportunity Engine, Buildability AI, Package Bundling) | Same architecture, but building all six systems evenly would dilute time away from the four demoed moments | Type definitions + one-paragraph doc comment describing intended behavior |
| Atlas (live external-monitoring data feeds) | Architecturally identical to the others (reads external evidence → writes Decisions → generates Receipts) but requires live third-party data integrations not worth building for a prototype | Describe in architecture/slides as "same brain, next application" |
| Precedent beyond Project Clone and Clause Memory (Negotiation Memory, Blind Technical Scoring, Golden Thread Compliance Mode) | Same reasoning as above | Same |
| Arbiter beyond one rehearsed adversarial-debate case | The mechanism generalizes to every dispute type; only one needs to be wired end-to-end for the demo | Build one case well, rehearsed repeatedly (see `09-ROADMAP-TASKS.md` Week 4) |
| Multi-project, multi-company reasoning | Deliberately out of scope — this is the exact territory with real antitrust exposure. This is a design choice, not a technical gap, and should be stated as such if asked | Do not implement, even experimentally |

## Framing for pitches/slides
"Same brain, next application" — the point is proving the four-primitive model generalizes, not shipping six equally-built systems. A judge or stakeholder should come away believing the other five applications are a configuration change away, not a rewrite away.

## Guardrail for the agent
If you (the agent) are about to write implementation code for anything in the left column above, stop and check whether it's actually required by a task in `09-ROADMAP-TASKS.md`. If it isn't on that list, it's scope creep — write the stub/type/doc-comment version instead and move on.
