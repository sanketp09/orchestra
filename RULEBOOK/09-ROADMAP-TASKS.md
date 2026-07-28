09 — Development Roadmap / Task List

A single sequential build order. Work top to bottom — each item unlocks the next. Don't skip ahead to a later item while an earlier blocking dependency is unchecked; the order encodes real dependencies (schema before UI, Receipt Panel before any screen that uses it, seed data before prompt-tuning, core screens before Arbiter/polish).

Phase 1 — Foundations
 Set up the database: create the four tables exactly as specified in 03-DATABASE-SCHEMA.md (entity, evidence, decision, receipt) in Supabase or local Postgres.
 Write a seed script that generates realistic vendor/evidence/decision/receipt data — real dates, believable evidence, at least one vendor with a full dispute/delay/recovery history. Match the tone of the seed example in 03-DATABASE-SCHEMA.md, not placeholder data like "Vendor 1."
 Scaffold the frontend and backend folder structures exactly as laid out in 02-ARCHITECTURE.md.
 Build the Homepage shell: nav, layout, and a skeleton page using fake data shaped like the real schema (so swapping in the real API later is a one-line change).
 Build the Receipt Panel / Receipt Card component against the seeded data, using 05-COMPONENT-LIBRARY.md for its props/reuse contract, 01-PRD.md's "Receipt Center" section for states and layout, and 06-DESIGN-SYSTEM.md for its slide-in animation. This blocks everything in Phase 2 and 3 — do not proceed until it's fully working and reusable.
 Draft the demo script skeleton in 10-DEMO-SCRIPT.md so you know which specific file/vendor/case you're building toward.
Phase 2 — Core path: Procurement X-Ray
 Build the Sentinel, Precedent, and Compass services and wire the LangGraph graph (Extract → Sentinel → Precedent → Compass → Combine → Receipt Generator) per 02-ARCHITECTURE.md.
 Implement the Sentinel and Receipt Generator prompts from 07-PROMPTS.md exactly as written.
 Build the Procurement X-Ray UI: upload dropzone, staged scan progress list, animated Risk Score, stacked Flag Cards — per 01-PRD.md's "Procurement X-Ray" section.
 Wire the X-Ray frontend to the real POST /xray/analyze endpoint per 04-API-CONTRACTS.md, including the staged step-label progress pattern (not a bare spinner).
 Confirm every Flag Card opens the Receipt Panel from Phase 1.
 Test X-Ray against real sample documents and tune the Sentinel prompt until flags are accurate and each one traces to a specific supporting basis.
 Check 08-SCOPE-BOUNDARIES.md before writing any Compass logic beyond what X-Ray's flags need — do not build Compass's other capabilities yet.
Phase 3 — Core path: Trustline + supporting screens
 Build the Trustline recompute logic and POST /vendor/:id/evidence endpoint, applying the Trustline prompt from 07-PROMPTS.md and enforcing that confidence never exceeds what the evidence's reliability tier justifies.
 Build the Trustline UI: trust number, trust trajectory chart, "Recent Changes" feed — per 01-PRD.md's "Trustline" section, including the ~600ms ease animation on the trust number (must fire on increases and decreases).
 Wire it to GET /vendor/:id/trust and GET /vendor/:id/timeline per 04-API-CONTRACTS.md.
 Confirm clicking a "Recent Changes" entry expands into the Receipt Panel.
 Build Supplier Workspace (checklist, upload, progress bar) per its 01-PRD.md section and POST /supplier/:id/upload / GET /supplier/:id/checklist.
 Build Global Search as a persistent header component per its 01-PRD.md section and POST /search.
 Build the standalone Receipt Center page and the Timeline View tab as thin wrappers around the Receipt Panel — don't rebuild receipt-viewing logic a second time.
 Rehearse the live trust-animation demo moment (a specific vendor, a specific evidence upload that moves the score) repeatedly until it's reliable on demand.
Phase 4 — Arbiter, polish, integration
 Build the Arbiter debate graph (Buyer's Advocate → Vendor's Advocate → Judge) using the three prompts in 07-PROMPTS.md exactly as written, wired to one specific rehearsed dispute case from the seed data. Do not generalize it to arbitrary disputes — see 08-SCOPE-BOUNDARIES.md.
 Go through every screen and verify all four states (loading/empty/success/error) exist and match 01-PRD.md's copy verbatim — fix any screen missing a state instead of leaving it.
 Verify every Decision/Evidence card across the app opens a Receipt Panel, per the rule in 05-COMPONENT-LIBRARY.md.
 Verify color/typography/spacing/theme are applied consistently per 06-DESIGN-SYSTEM.md — no per-component overrides.
 Do a full integration pass: fix cross-screen navigation and shared-element route transitions (Homepage → destination screens).
 Run the full demo script (10-DEMO-SCRIPT.md) end to end against real seed data: the specific X-Ray PDF, the specific Trustline vendor/evidence file, the Arbiter case.
 Time the full run-through and test the offline/API-failure fallback (cached "last known state" per the Error states in 01-PRD.md).
 Test on a backup laptop with the same seed data and files, in case of wifi failure at demo time.
Definition of done (applies to every checked box)
All four states (loading/empty/success/error) implemented, matching 01-PRD.md copy verbatim.
Any Decision/Evidence card opens a Receipt Panel.
No hardcoded confidence/trust numbers — every one traces to real evidence via the API contracts in 04-API-CONTRACTS.md.
Nothing built outside the 08-SCOPE-BOUNDARIES.md core path unless explicitly re-scoped by the human.