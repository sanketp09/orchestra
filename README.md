# ORCHESTRA — Agent-Ready Build Docs

This folder is a working spec broken into the pieces an Antigravity agent needs, sized so each file stays in a single, checkable context window instead of one giant document.

## How to use these in Antigravity
1. Drop this whole `orchestra-docs/` folder into the repo root (or wherever Antigravity looks for project-level context — check your workspace settings for the exact convention it expects, e.g. a `.antigravity/` or root `AGENTS.md` pattern).
2. Point the agent at `AGENTS.md` explicitly in your first prompt/task: *"Read AGENTS.md and the docs it references before starting."* Agentic IDEs don't always auto-discover every markdown file, so an explicit pointer in your first message is the reliable path.
3. Give it `09-ROADMAP-TASKS.md` as the actual task list to work through — ask it to check boxes off as it completes them, and to re-read it before starting each new week's block.
4. If it starts building something in `08-SCOPE-BOUNDARIES.md`'s "not built" column, point it back at that file.

## File map
| File | What it's for |
|---|---|
| `AGENTS.md` | Rules the agent follows before/while coding — read this first |
| `01-PRD.md` | Every screen's purpose, layout, states, animations, APIs |
| `02-ARCHITECTURE.md` | Six systems, LangGraph flow, folder structures |
| `03-DATABASE-SCHEMA.md` | The four tables, SQL, seed data bar |
| `04-API-CONTRACTS.md` | Exact request/response shapes for every route |
| `05-COMPONENT-LIBRARY.md` | Reusable components and where each is used |
| `06-DESIGN-SYSTEM.md` | Color/type/spacing/animation/theme rules (condensed on purpose) |
| `07-PROMPTS.md` | LLM prompts for the core path only |
| `08-SCOPE-BOUNDARIES.md` | What's deliberately not built, and why |
| `09-ROADMAP-TASKS.md` | Week-by-week checklist, the actual backlog |
| `10-DEMO-SCRIPT.md` | The rehearsed walkthrough + rehearsal checklist |

## Why split like this instead of one file
A single 5,000-word spec in context tends to get skimmed unevenly — early sections (executive overview) get more weight than late ones (scope boundaries, roadmap), which is backwards for an agent that needs to *not* overbuild. Splitting means you can reference the scope/roadmap files repeatedly without re-feeding the whole spec, and the agent can hold "what to build this week" and "what never to build" as two separate, equally-weighted files instead of buried paragraphs 40 and 41 of one document.
