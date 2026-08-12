# 4. Weather Intelligence — 2 files

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
- **Hero card (col-span-2):** a short forward-looking forecast strip (next 5-7 days) along 
  Shipment #4471's remaining route/destination, each day a small weather-icon+temp+precip 
  tile, with any day crossing a risk threshold (e.g. high wind, heavy precip) visually 
  flagged (--warning border on that day's tile).
- **Route Risk card:** a single composite risk label ("Low risk this week") with the 
  specific day driving that assessment named directly ("Wednesday's forecast shows heavy 
  rain at the Houston site").
- **Historical Context card:** a small note connecting this to Sentinel — "This same data 
  source is what verifies delay excuse claims" — a compact card reinforcing that this isn't 
  a separate weather app bolted on, it's the same underlying signal used elsewhere in the 
  product, framed as a genuine cross-system callback, not filler.

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

`GET /atlas/weather-forecast?lat=&lon=&shipment_id=`. Real external data — use the 
Open-Meteo forecast API (same provider Sentinel's Delay Excuse Verification uses for 
historical data, just the forecast endpoint instead of the archive endpoint: 
`https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&daily=
precipitation_sum,windspeed_10m_max`) — this should be a real, working call, consistent 
with the real-API precedent already set in Sentinel. Deterministic threshold comparison 
against the same `TRADE_WEATHER_THRESHOLDS` concept from Sentinel (reuse/import if that 
table already exists in the codebase rather than redefining it) to compute the composite 
risk label.
