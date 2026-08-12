# 4. Backup Supplier Discovery — 2 files

## FILE 1 — component.tsx
CENTRALIZED DEMO DATA — use this EXACT dataset in every Trustline file, do not invent your 
own vendor names/numbers, so all ten features reference the same coherent demo:

Primary vendor (the one most screens focus on): "Meridian Steel Fabrication" 
(id: vendor_meridian_steel), trade: Structural Steel, location: Houston, TX. 
Trust trajectory: 2023: 68 → 2024: 74 → 2025: 82 → Today: 76 (a recent drop — the story is 
"something just happened"). 

Comparison/stable vendor: "Titan Fabricators" (id: vendor_titan_fab), trust: 88, stable, 
used as a backup-candidate / comparison reference.

Distressed vendor: "Coastal Bolt & Fastener" (id: vendor_coastal_bolt), trust: 54, flagged 
for financial distress — used specifically in the Financial Distress Watch and Statutory-
adjacent screens.

Recent evidence events for Meridian Steel (reference these across relevant files): a 
delivery ticket 6 days late (Mar 14, verified_transaction), an excellent FAT result (Jun 2, 
third_party_observed), a UCC filing appearing against them (Jun 20), response time 
increasing from 1 day to 4 days average over the last quarter, EMR at 1.08 (industry 
average ~1.0), one OSHA recordable incident 8 months ago, SAM.gov status: active/eligible, 
state license: active, bonding line: $2.4M utilized of $4M capacity.

---

VISUAL SYSTEM — layer richer data-visualization treatment ON TOP of the existing ORCHESTRA 
tokens, do not switch to a different color system:
--background:#F3EDE7 --foreground:#0C0904 --muted:#DBC3B3 --muted-foreground:#AA8D74 
--accent:#AC723E; surfaces --surface-card:#FAF7F3 --surface-floating:#FFFFFF; 
semantic (now used more vividly, IN CHARTS specifically, not just as tiny badge dots): 
--success:#4A7A5C --warning:#B8873A --danger:#A6432F --info:#4A6A8A --ai:#6B5A7A

**Grid system:** every screen is a CSS grid (bento-style), mixing card sizes deliberately — 
one large hero card (e.g. `col-span-2 row-span-2`) for the primary chart/visualization, 
surrounded by 3-5 smaller stat cards (`col-span-1 row-span-1`) for individual metrics. 
Never a uniform single-column list of same-size cards — vary the grid meaningfully per 
screen based on what data actually deserves emphasis.

**Card depth — soft, not flat, not glassy-everywhere:** give cards a subtle embossed/
neumorphic-lite feel using a dual shadow (a very light highlight shadow top-left, a soft 
darker shadow bottom-right, both low opacity, on --surface-card) rather than a single flat 
1px border. Reserve an actual glass/frosted treatment (semi-transparent --surface-floating 
with `backdrop-filter: blur(12px)`) for exactly ONE featured/hero element per screen — used 
everywhere it stops being special and starts looking generic.

**Charts must visibly assemble, never appear instantly:**
- Line/area charts draw themselves via `stroke-dasharray`/`stroke-dashoffset` animating 0 
  to full length (~800ms).
- Bar charts grow from a zero baseline (`scaleY` or `height` animating in, staggered per 
  bar, ~80ms apart).
- Radial/gauge visualizations (e.g. bonding capacity, safety score) sweep-fill via an 
  animated SVG circle `stroke-dasharray` — never a static pre-filled ring.
- Every number that represents a live metric counts up via useSpring/useMotionValue.
- Use Recharts (or a similarly lightweight lib) for standard charts; hand-build custom SVG 
  for gauges/radial/network visualizations where a standard chart type doesn't fit.

**What to explicitly avoid:** generic purple-to-blue gradients, glassmorphism applied 
everywhere (it should read as special because it's rare), stock-photo imagery, emoji icons, 
bubble-radius corners (max 12px), and — this is the one to actively watch for — a page that 
LOOKS colorful/rich but where every number on it is still static once rendered. Motion is 
not optional here.

Import shared primitives from the existing design system (`Button`, `Card`, `Badge` from 
`@/components/ui/*`, `cn` from `@/lib/utils`) but you may need genuinely custom card/chart 
components for this system's richer visualizations — build those inline in the same file.

One single .tsx file per feature. Use framer-motion (`motion`, `AnimatePresence`) 
throughout — zero static state transitions.

---

PYTHON SIDE — every Trustline check reads from and writes to the same shared belief model:

```python
class TrustBelief(BaseModel):
    entity_id: str
    dimension: str          # e.g. "schedule_reliability", "financial_stability"
    current_value: float    # 0-1
    previous_value: float
    confidence: float
    evidence: list[EvidenceItem]   # same EvidenceItem shape as Sentinel's
    reasoning: str
    needs_human: bool
```
Use the centralized demo vendors above as seeded data in every file — same IDs, same 
numbers — so a request to any of the ten endpoints about `vendor_meridian_steel` returns 
results that agree with each other.

---

**Grid layout:** a masonry/grid of ranked candidate cards (not one uniform list) — each 
backup vendor candidate gets a small card (roughly equal size, 2-3 per row) showing: name, 
a small radial trust-score ring, trade match indicator, and a "Reserve Capacity" button. 
The top-ranked candidate's card is visually distinguished (col-span-2, slightly larger, the 
glass treatment) versus the rest, so the "best pick" is obviously emphasized rather than 
all options looking equal.

Cards animate in ranked order (best first, staggered), and reordering (if a filter is 
applied — build a simple trade/location filter above the grid) should animate cards to 
their new positions using layout animation (`layout` prop in framer-motion), not an 
instant re-render.

Clicking "Reserve Capacity" shows a real inline confirmation state on that specific card 
(not a toast/alert) — the button becomes a small confirmed state with a checkmark.

## FILE 2 — route.py
CENTRALIZED DEMO DATA — use this EXACT dataset in every Trustline file, do not invent your 
own vendor names/numbers, so all ten features reference the same coherent demo:

Primary vendor (the one most screens focus on): "Meridian Steel Fabrication" 
(id: vendor_meridian_steel), trade: Structural Steel, location: Houston, TX. 
Trust trajectory: 2023: 68 → 2024: 74 → 2025: 82 → Today: 76 (a recent drop — the story is 
"something just happened"). 

Comparison/stable vendor: "Titan Fabricators" (id: vendor_titan_fab), trust: 88, stable, 
used as a backup-candidate / comparison reference.

Distressed vendor: "Coastal Bolt & Fastener" (id: vendor_coastal_bolt), trust: 54, flagged 
for financial distress — used specifically in the Financial Distress Watch and Statutory-
adjacent screens.

Recent evidence events for Meridian Steel (reference these across relevant files): a 
delivery ticket 6 days late (Mar 14, verified_transaction), an excellent FAT result (Jun 2, 
third_party_observed), a UCC filing appearing against them (Jun 20), response time 
increasing from 1 day to 4 days average over the last quarter, EMR at 1.08 (industry 
average ~1.0), one OSHA recordable incident 8 months ago, SAM.gov status: active/eligible, 
state license: active, bonding line: $2.4M utilized of $4M capacity.

---

VISUAL SYSTEM — layer richer data-visualization treatment ON TOP of the existing ORCHESTRA 
tokens, do not switch to a different color system:
--background:#F3EDE7 --foreground:#0C0904 --muted:#DBC3B3 --muted-foreground:#AA8D74 
--accent:#AC723E; surfaces --surface-card:#FAF7F3 --surface-floating:#FFFFFF; 
semantic (now used more vividly, IN CHARTS specifically, not just as tiny badge dots): 
--success:#4A7A5C --warning:#B8873A --danger:#A6432F --info:#4A6A8A --ai:#6B5A7A

**Grid system:** every screen is a CSS grid (bento-style), mixing card sizes deliberately — 
one large hero card (e.g. `col-span-2 row-span-2`) for the primary chart/visualization, 
surrounded by 3-5 smaller stat cards (`col-span-1 row-span-1`) for individual metrics. 
Never a uniform single-column list of same-size cards — vary the grid meaningfully per 
screen based on what data actually deserves emphasis.

**Card depth — soft, not flat, not glassy-everywhere:** give cards a subtle embossed/
neumorphic-lite feel using a dual shadow (a very light highlight shadow top-left, a soft 
darker shadow bottom-right, both low opacity, on --surface-card) rather than a single flat 
1px border. Reserve an actual glass/frosted treatment (semi-transparent --surface-floating 
with `backdrop-filter: blur(12px)`) for exactly ONE featured/hero element per screen — used 
everywhere it stops being special and starts looking generic.

**Charts must visibly assemble, never appear instantly:**
- Line/area charts draw themselves via `stroke-dasharray`/`stroke-dashoffset` animating 0 
  to full length (~800ms).
- Bar charts grow from a zero baseline (`scaleY` or `height` animating in, staggered per 
  bar, ~80ms apart).
- Radial/gauge visualizations (e.g. bonding capacity, safety score) sweep-fill via an 
  animated SVG circle `stroke-dasharray` — never a static pre-filled ring.
- Every number that represents a live metric counts up via useSpring/useMotionValue.
- Use Recharts (or a similarly lightweight lib) for standard charts; hand-build custom SVG 
  for gauges/radial/network visualizations where a standard chart type doesn't fit.

**What to explicitly avoid:** generic purple-to-blue gradients, glassmorphism applied 
everywhere (it should read as special because it's rare), stock-photo imagery, emoji icons, 
bubble-radius corners (max 12px), and — this is the one to actively watch for — a page that 
LOOKS colorful/rich but where every number on it is still static once rendered. Motion is 
not optional here.

Import shared primitives from the existing design system (`Button`, `Card`, `Badge` from 
`@/components/ui/*`, `cn` from `@/lib/utils`) but you may need genuinely custom card/chart 
components for this system's richer visualizations — build those inline in the same file.

One single .tsx file per feature. Use framer-motion (`motion`, `AnimatePresence`) 
throughout — zero static state transitions.

---

PYTHON SIDE — every Trustline check reads from and writes to the same shared belief model:

```python
class TrustBelief(BaseModel):
    entity_id: str
    dimension: str          # e.g. "schedule_reliability", "financial_stability"
    current_value: float    # 0-1
    previous_value: float
    confidence: float
    evidence: list[EvidenceItem]   # same EvidenceItem shape as Sentinel's
    reasoning: str
    needs_human: bool
```
Use the centralized demo vendors above as seeded data in every file — same IDs, same 
numbers — so a request to any of the ten endpoints about `vendor_meridian_steel` returns 
results that agree with each other.

---

`GET /trustline/backup-suppliers?primary_vendor_id=&trade=` and 
`POST /trustline/reserve-capacity`. Deterministic ranking: filter seeded vendors by trade 
match, rank by trust score descending, return top N with a short reasoning string per 
candidate ("Ranked #1 — highest trust score in Structural Steel, no active flags"). No LLM 
needed for ranking itself; reasoning strings can be simple string templates, not a model 
call.
