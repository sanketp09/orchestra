# 02 — Architecture

## The four primitives (own table each, see `03-DATABASE-SCHEMA.md`)
- **Entity** — vendors, projects, contracts, purchase orders.
- **Evidence** — everything that supports a belief (photo, contract, email, weather, delivery ticket, invoice), each tagged with a `reliability_tier`.
- **Decision** — risk flags, recommendations, alerts, approvals. Carries `value`/`previous_value` for animated numbers.
- **Receipt** — the explanation linking a Decision to its Evidence, with `confidence` and plain-English `reasoning`.

## The six backend systems (never user-visible)
| System | Role | Build scope for this prototype |
|---|---|---|
| Sentinel | Verifies claims/documents against evidence | Full — core path |
| Trustline | Computes weighted vendor trust from evidence | Full — core path |
| Compass | Downstream impact / dependency checking | Procurement X-Ray flags + Ripple Check only |
| Precedent | Clause/vendor history matching | Project Clone + Clause Memory only |
| Arbiter | Adversarial dispute resolution | One rehearsed debate case only |
| Atlas | External market/data monitoring | Not built — described only, see `08-SCOPE-BOUNDARIES.md` |

These are services, not routes or pages. No system name should appear in user-facing copy, nav labels, or badges.

## Main analysis graph (LangGraph)
```
START
  │
Extract            (parse PDF/photo/audio into structured data)
  │
Sentinel           (verify claims against evidence; may short-circuit to END on hard failure)
  │
Precedent          (check clause/vendor history)
  │
Compass            (check downstream impact)
  │
Combine            (merge outputs into one ranked list of Decisions)
  │
Receipt Generator  (attach evidence + confidence + reasoning to each Decision)
  │
END → response to API
```

State object passed through the graph:
```python
class OrchestraState(TypedDict):
    document_text: str
    entity_id: str
    sentinel_flags: list
    precedent_matches: list
    compass_impacts: list
    decisions: list
    receipts: list
```

## Arbiter debate graph (separate, smaller graph — only from the Arbiter demo path)
```
START → Buyer's Advocate (LLM call, argues buyer's case)
       → Vendor's Advocate (LLM call, argues vendor's case)
       → Judge (LLM call, compares both, isolates the actual disagreement)
       → END
```
Do not generalize this graph to other dispute types for this build — one rehearsed case only (see `08-SCOPE-BOUNDARIES.md`).

## Frontend folder structure
```
app/
  (dashboard)/
    page.tsx                 → Homepage / Decision Center
  xray/
    page.tsx
  vendor/[id]/
    page.tsx                 → Trustline
  evidence/
    page.tsx                 → Receipt Center
  supplier/[id]/
    page.tsx                 → Supplier Workspace
  site/
    page.tsx                 → Mobile Site Capture
components/
  ui/                        → shadcn primitives (button, card, dialog...)
  receipt-card.tsx
  vendor-card.tsx
  decision-card.tsx
  evidence-card.tsx
  timeline-card.tsx
  alert-badge.tsx
  trust-badge.tsx
  reliability-badge.tsx
  flag-card.tsx
  search-bar.tsx
features/
  xray/                      → X-Ray-specific components, hooks
  trustline/
  supplier-workspace/
hooks/
  use-trust-score.ts
  use-search.ts
services/
  api.ts                     → typed fetch wrappers for every backend route
lib/
  format.ts
  animation-variants.ts       → Framer Motion presets (stagger, count-up, ease)
types/
  entity.ts
  evidence.ts
  decision.ts
  receipt.ts
styles/
  globals.css
```

## Backend folder structure
```
routers/
  xray.py
  vendor.py
  evidence.py
  supplier.py
  search.py
  site.py
services/
  sentinel_service.py
  trustline_service.py
  compass_service.py
  precedent_service.py
  arbiter_service.py
graphs/
  xray_graph.py               → the main LangGraph defined above
  arbiter_debate_graph.py
models/
  entity.py
  evidence.py
  decision.py
  receipt.py
prompts/
  sentinel_prompt.py
  trustline_prompt.py
  compass_prompt.py
  receipt_generator_prompt.py
  arbiter_buyer_prompt.py
  arbiter_vendor_prompt.py
  arbiter_judge_prompt.py
utils/
  llm_client.py
  file_parsing.py
```
