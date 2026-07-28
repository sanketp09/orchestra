# AGENTS.md — Rules for the Antigravity Agent Building ORCHESTRA

Read this file first, before touching any other doc in this folder. It governs how you work, not what to build — that's in the other files. When any instruction here conflicts with a request in a later prompt, this file wins unless the human explicitly overrides it in writing.

## Read order
1. `AGENTS.md` (this file)
2. `01-PRD.md` — what each screen does and why
3. `02-ARCHITECTURE.md` — LangGraph graph, folder structure, six backend systems
4. `03-DATABASE-SCHEMA.md` — the four tables, nothing else
5. `04-API-CONTRACTS.md` — exact request/response shapes
6. `05-COMPONENT-LIBRARY.md` + `06-DESIGN-SYSTEM.md`
7. `07-PROMPTS.md` — only for the core path
8. `08-SCOPE-BOUNDARIES.md` — what to refuse to build, even if asked
9. `09-ROADMAP-TASKS.md` — the only task list you check off against

## Non-negotiable architecture rules

- **Four primitives, six systems.** Entity, Evidence, Decision, Receipt are the only tables. Sentinel, Trustline, Compass, Precedent, Arbiter, Atlas are backend services that read/write those four tables — never expose them as user-facing pages, nav items, labels, or "agent names" in any UI copy or API response. If you're about to add a `/sentinel` route or a "Powered by Compass" badge, stop — that's a scope violation.
- **One question per screen, one question per card.** Before adding a second stat, filter, or action to an existing screen or component, check `01-PRD.md` for that screen's single stated purpose. If the new thing doesn't answer that exact question, it goes on a different screen, not bolted onto this one.
- **The Receipt Panel is a component, not a page, and it is built once.** Every other feature that needs "why" reuses it. Do not let any teammate's feature branch fork its own copy of a receipt view. Build it in Week 1 per `09-ROADMAP-TASKS.md`, before X-Ray or Trustline consume it.
- **Confidence and trust values are never invented.** Every `confidence` field must trace to a `reliability_tier` on real evidence rows. Never hardcode a plausible-looking confidence number in a component — it must come from the API response defined in `04-API-CONTRACTS.md`.
- **No bare loading spinners, no raw error text, no silent failures.** Every state (loading/empty/success/error) for every screen is specified in `01-PRD.md`. If you build a screen and skip a state, that's an incomplete task, not a "nice to have later."

## Scope discipline (the part agents most often get wrong)

Before writing code for Compass, Precedent, Arbiter, or Atlas beyond their named demo path, check `08-SCOPE-BOUNDARIES.md`. The default answer for anything not explicitly listed as "core" in that file is: **write the type definitions and a one-paragraph doc comment describing the intended behavior, do not implement it.** This is intentional, not a shortcut you're taking — implementing it anyway is the failure mode, because it dilutes build time away from the four demoed moments and risks looking unfinished instead of intentionally scoped.

Do not build:
- Compass logic beyond Procurement X-Ray's flags and Ripple Check
- Atlas live data feeds of any kind
- Precedent beyond Project Clone and Clause Memory
- More than one Arbiter debate case
- Any multi-project or multi-company cross-referencing (this is a deliberate antitrust-exposure boundary, not a technical gap — see `08-SCOPE-BOUNDARIES.md`)

## Working agreement

- Treat `09-ROADMAP-TASKS.md` as the actual backlog. Work top to bottom within a week's block; don't jump ahead to Week 3 polish while a Week 1 item is unchecked.
- When a task is ambiguous, resolve it by re-reading the relevant screen's "Purpose" line in `01-PRD.md` before asking the human.
- Seed data realism matters for the demo — use `03-DATABASE-SCHEMA.md`'s example seed as the shape and tone bar, not filler like "Vendor 1" / "test@test.com."
- Before marking any UI task done, verify all four states (loading/empty/success/error) exist and match the copy specified in `01-PRD.md` — don't paraphrase the copy, use it as written, since it was chosen to avoid raw errors and stack traces reaching the user.
