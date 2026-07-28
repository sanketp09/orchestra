# 09 — Development Roadmap / Task List

Assumes a 4-person team split (Member A: Frontend, B: Backend/AI, C: Full-stack, D: Data/Design/Demo). If team size differs, keep the week-by-week sequencing — it encodes dependencies (Receipt Panel before X-Ray, seed data before scan-tuning, etc.) — and re-split rows across whatever headcount exists.

Work top to bottom within a week's block. Don't start a Week N+1 item while a same-week dependency is unchecked.

## Week 1 — Foundations
- [ ] **A** — Build shell: nav, layout, homepage skeleton with fake data shaped like the real schema (`03-DATABASE-SCHEMA.md`)
- [ ] **B** — Set up Supabase, write the 4-table schema, seed realistic vendor/evidence data
- [ ] **C** — Build Receipt Panel component (shared everywhere) against seeded data — **blocking dependency for Week 2 X-Ray and Week 3 Trustline**
- [ ] **D** — Write and refine seed data (realistic dates, believable evidence, dispute history per `03-DATABASE-SCHEMA.md`'s bar); start demo script draft

## Week 2 — Core path: X-Ray
- [ ] **A** — Build Procurement X-Ray UI (upload, scan animation, flag cards)
- [ ] **B** — Build Sentinel + Precedent + Compass services and the LangGraph graph (`02-ARCHITECTURE.md`)
- [ ] **C** — Wire X-Ray frontend to real `/xray/analyze` endpoint
- [ ] **D** — Test X-Ray on real sample documents, tune Sentinel prompt against them

## Week 3 — Core path: Trustline + supporting screens
- [ ] **A** — Build Trustline UI (trust chart, animation, timeline feed)
- [ ] **B** — Build Trustline recompute logic + `/vendor/:id/evidence` endpoint
- [ ] **C** — Build Supplier Workspace + Global Search
- [ ] **D** — Rehearse the live trust-animation demo moment repeatedly until reliable

## Week 4 — Polish, Arbiter, integration
- [ ] **A** — Polish empty/loading/error states across all screens (verify against `01-PRD.md` state copy, verbatim)
- [ ] **B** — Build Arbiter debate graph (one rehearsed case only — see `08-SCOPE-BOUNDARIES.md`)
- [ ] **C** — Integration pass, fix cross-screen navigation
- [ ] **D** — Full run-throughs of the demo script (`10-DEMO-SCRIPT.md`), timing, backup plan if wifi/API fails

## Definition of done (applies to every checked box)
- All four states (loading/empty/success/error) implemented, matching `01-PRD.md` copy
- Any Decision/Evidence card opens a Receipt Panel
- No hardcoded confidence/trust numbers — traced to real evidence via API contracts in `04-API-CONTRACTS.md`
- Nothing built outside the `08-SCOPE-BOUNDARIES.md` core path unless explicitly re-scoped by the human
