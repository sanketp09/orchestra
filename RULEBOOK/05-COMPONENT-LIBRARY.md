# 05 — Component Library

**Design rule for the whole library:** every card that represents a Decision or piece of Evidence must be able to open a Receipt Panel. If a component can't answer "why," it shouldn't exist as a standalone card — fold it into one that can.

| Component | Props | Behavior | Variants | Reused in |
|---|---|---|---|---|
| Receipt Card | `evidence[]`, `confidence`, `reasoning`, `decision_id` | expands to full Receipt Panel on click | compact / full | X-Ray, Trustline, Evidence, Search |
| Vendor Card | `name`, `trust_score`, `trend_direction` | click routes to Trustline | list / featured | Homepage, Search results |
| Decision Card | `title`, `type` (risk/recommendation/alert/approval), `CTA label` | single action button, routes contextually | risk / opportunity / neutral | Homepage |
| Evidence Card | `type`, `reliability_tier`, `uploaded_by`, `date` | click opens detail panel | thumbnail (photo/video) / document | Receipt Center |
| Timeline Card | `event_label`, `date`, `linked_decision_id` | click expands to Receipt Panel | — | Trustline, Project Timeline |
| Alert Badge | `severity` (info/warning/critical) | color + icon only, no independent click action | dot / pill | Homepage, X-Ray flags |
| Trust Badge | `value` (0–100), `previous_value` | animates on value change (eases + tooltip) | large (profile header) / small (card) | Trustline, Vendor Card |
| Reliability Badge | `tier` (self_reported / third_party_observed / verified_transaction) | static color-coded label | — | Evidence Card, Receipt Panel |
| Search Result | `type`, `title`, `snippet` | click routes to source screen | grouped by type | Global Search |
| Flag Card | `title`, `severity`, one-line reason | click opens Receipt Panel | — | Procurement X-Ray |

## Build order note
The **Receipt Panel/Card** is the highest-leverage component in this table — it's reused by 4 of the 6 primary screens. Per `09-ROADMAP-TASKS.md`, it is built in Week 1 against seeded data, before X-Ray or Trustline exist to consume it. Do not let X-Ray or Trustline fork a local "receipt-ish" component while waiting on this — block on it instead.
