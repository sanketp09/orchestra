# 7. Labor Market Intelligence — 2 files

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

**Grid layout (3 cards), scoped to project_austin_fab's region:**
- **Hero card (col-span-2):** a dual-line chart — electrician wage trend and electrician 
  availability trend for the Austin region over recent months, on the same time axis so 
  the "wages up, availability down" story is visible in one glance (two lines, clearly 
  differentiated colors/styles, small legend).
- **Staffing Risk card:** a plain-language assessment — "This trade may be harder and more 
  expensive to staff than planned" — with a severity badge, shown only when both trend 
  lines cross a threshold together (rising wage AND falling availability), not on either 
  alone.
- **Comparable Trades card:** a small ranked list showing which other trades on this 
  project are trending similarly, so this isn't presented as an isolated one-trade issue.

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

`GET /atlas/labor-market?region=austin_tx&trade=electrician`. Seed a `LABOR_MARKET_TRENDS` 
table (region, trade, month, avg_wage, availability_index) with a realistic several-month 
trend showing wage rising and availability falling for electricians specifically. 
Deterministic trend-slope calculation (simple linear regression or even just first-vs-last 
comparison) for both series; flag `staffing_risk=True` only when both slopes cross their 
respective thresholds together — comment that the "and" condition, not "or," is intentional 
to avoid over-flagging.
