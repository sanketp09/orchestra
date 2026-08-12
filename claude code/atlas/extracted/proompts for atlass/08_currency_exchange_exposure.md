# 8. Currency & Exchange Rate Exposure — 2 files

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

Focused on Shipment #4471 (priced in KRW from the South Korea vendor, converted to USD for 
the project budget).

**Grid layout (3 cards):**
- **Hero card (col-span-2):** an exchange-rate trend line (KRW/USD) since the PO was 
  originally priced, drawn in, with the PO's locked-in rate marked as a reference line so 
  drift from that baseline is immediately visible.
- **Cost Impact card:** a before/after — "Priced at $184,000 (at booking-date rate) — 
  currently $191,400 (at today's rate)" with the delta highlighted, animated count.
- **Hedge Suggestion card:** a plain-language note if the exposure is meaningful ("Consider 
  locking this rate for remaining payment milestones") — a real, actionable suggestion, not 
  just an FYI number.

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

`GET /atlas/currency-exposure/{shipment_id}`. Real external data if feasible — a free 
exchange-rate API (e.g. exchangerate.host or similar free-tier provider) for current KRW/
USD rate; seed the historical booking-date rate and a plausible recent trend if a free 
historical endpoint isn't available (comment clearly which parts are live vs. seeded). 
Deterministic cost recalculation: `original_usd_value` at booking rate vs. `current_usd_
value` at today's rate, using the shipment's known KRW-denominated PO amount from seeded 
data. `needs_human=True` whenever the delta exceeds a meaningful threshold (e.g. 3%).
