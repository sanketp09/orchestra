# 5. Political & Regulatory Risk — 2 files

## FILE 1 — component.tsx
CONTEXT: IDE agent with full repo access — Sentinel, Trustline, Compass, Arbiter, and 
Precedent are already built. DO NOT redefine the design system — reuse the existing color 
tokens, shadow tokens, animation primitives (`lib/animations.ts`), and card/grid patterns 
already established in the repo, especially Trustline's bento-grid + soft-depth treatment, 
which Atlas should visually match (Atlas is data-rich like Trustline, not flow-based like 
Sentinel).

CENTRALIZED DEMO DATA — reuse existing entities (Meridian Steel Fabrication / 
vendor_meridian_steel, Austin Semiconductor Fab / project_austin_fab) and add these Atlas-
specific ones, consistent across all ten files below:
- Active shipment: "Switchgear Shipment #4471" — Meridian Steel is the vendor, shipping 
  from a fabrication facility in Ulsan, South Korea, currently mid-transit toward the Port 
  of Houston, destined for project_austin_fab.
- Budget lines for project_austin_fab: structural steel ($2.1M budgeted), copper wiring 
  ($480K budgeted).

SHARED SHAPE — every Atlas signal extends this:
```python
class WorldSignal(BaseModel):
    signal_type: str            # e.g. "commodity_price", "port_congestion", "tariff_change"
    affected_entity_ids: list[str]   # which of YOUR vendors/shipments/projects this touches
    severity: Literal["info","watch","action_needed"]
    summary: str
    detail: dict                 # signal-specific structured data
    recommended_action: str | None
    detected_at: datetime
```
The point of every Atlas screen: don't just show world data, show **which of the user's 
actual active vendors/shipments/budget lines it touches** — every screen must visibly 
connect a world event to something specific and named from the centralized demo data above, 
never a generic "here's some market data" view with no connection back to the user's real 
exposure.

One single .tsx file and one single .py file per feature. Framer-motion animations 
mandatory, matching established repo patterns — staggered mounts, count-up numbers, real 
hover states, no static unanimated screens.

**Grid layout (3 cards):**
- **Hero card (col-span-2, glass treatment):** a feed-style list (not a chart — this is 
  genuinely a news/event feed) of recent regulatory/political events, each entry showing 
  the event headline, date, and — critically — a directly-stated exposure line beneath it: 
  "Affects: Shipment #4471 (South Korea origin)" or similar, pulled from checking the event 
  against the centralized demo data's actual vendors/shipments. An event with no real 
  exposure to the user's data should simply not appear — do not show irrelevant world news.
- **Exposure Summary card:** a count — "1 of your active shipments is exposed to this 
  week's events" — animated.
- **Monitoring Scope card:** a small, honest list of what regions/categories are currently 
  being watched (South Korea, structural steel tariffs, etc., derived from your actual 
  active vendor/shipment list) — this makes clear the monitoring is scoped to real exposure, 
  not everything in the world.

## FILE 2 — route.py
CONTEXT: IDE agent with full repo access — Sentinel, Trustline, Compass, Arbiter, and 
Precedent are already built. DO NOT redefine the design system — reuse the existing color 
tokens, shadow tokens, animation primitives (`lib/animations.ts`), and card/grid patterns 
already established in the repo, especially Trustline's bento-grid + soft-depth treatment, 
which Atlas should visually match (Atlas is data-rich like Trustline, not flow-based like 
Sentinel).

CENTRALIZED DEMO DATA — reuse existing entities (Meridian Steel Fabrication / 
vendor_meridian_steel, Austin Semiconductor Fab / project_austin_fab) and add these Atlas-
specific ones, consistent across all ten files below:
- Active shipment: "Switchgear Shipment #4471" — Meridian Steel is the vendor, shipping 
  from a fabrication facility in Ulsan, South Korea, currently mid-transit toward the Port 
  of Houston, destined for project_austin_fab.
- Budget lines for project_austin_fab: structural steel ($2.1M budgeted), copper wiring 
  ($480K budgeted).

SHARED SHAPE — every Atlas signal extends this:
```python
class WorldSignal(BaseModel):
    signal_type: str            # e.g. "commodity_price", "port_congestion", "tariff_change"
    affected_entity_ids: list[str]   # which of YOUR vendors/shipments/projects this touches
    severity: Literal["info","watch","action_needed"]
    summary: str
    detail: dict                 # signal-specific structured data
    recommended_action: str | None
    detected_at: datetime
```
The point of every Atlas screen: don't just show world data, show **which of the user's 
actual active vendors/shipments/budget lines it touches** — every screen must visibly 
connect a world event to something specific and named from the centralized demo data above, 
never a generic "here's some market data" view with no connection back to the user's real 
exposure.

One single .tsx file and one single .py file per feature. Framer-motion animations 
mandatory, matching established repo patterns — staggered mounts, count-up numbers, real 
hover states, no static unanimated screens.

`GET /atlas/political-regulatory-risk`. Seed a small `WORLD_EVENTS` list (headline, date, 
region, category) including at least one event plausibly relevant to South Korea/
switchgear/steel (matching shipment_4471 and the structural steel budget line) and one or 
two irrelevant events to prove the filtering actually works. Deterministic matching logic: 
cross-reference each event's region/category against the user's active vendors/shipments' 
known origins and material categories — filter to only events with a real match, return 
the matched entity_ids per event. No LLM needed for this matching if region/category are 
structured fields; only use an LLM if you want to also match on free-text event 
descriptions, and if so, keep that as one clearly-isolated optional step.
