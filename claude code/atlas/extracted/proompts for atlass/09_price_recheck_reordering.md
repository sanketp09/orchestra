# 9. Price Re-Check Before Reordering — 2 files

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

A small, focused confirmation-moment UI (not a big dashboard page — this is meant to appear 
as a step inside a reorder flow, build it as a self-contained card/modal-like component 
that could be dropped into another flow). Shows: the item being reordered, the price you're 
about to pay (from habit/last time), and a small comparison row of 2-3 current alternative 
prices from other approved vendors for the same item — if a better price exists, highlight 
it (--success) with a one-click "Use this price instead" action; if the habitual price is 
still the best, show a calm confirming state instead of a false alarm.

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

`GET /atlas/price-recheck?item=&habitual_vendor_id=&habitual_price=`. Deterministic — no 
LLM. Seed a small `CURRENT_APPROVED_PRICING` table (item, vendor_id, current_price) with 
2-3 approved vendors per common item, including at least one scenario where a cheaper 
option now exists than the habitual vendor's last-used price. Return the comparison sorted 
by price, with a `better_option_exists: bool` flag.
