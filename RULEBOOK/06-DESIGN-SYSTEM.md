# 06 — Design System (condensed, deliberately)

This is intentionally not exhaustive. A full spec for every spacing token and animation curve is real design-system work a four-person team building in weeks won't get proportional value from. Consistency in the rules below reads as polished; a 40-page theme spec nobody implements fully does not.

## Color meaning (never repurpose these for anything else)
- **Green** — verified / confirmed evidence, trust rising
- **Yellow** — needs review, medium confidence
- **Red** — high-risk flag, trust falling
- **Blue** — a recommendation or opportunity
- **Purple** — visible AI reasoning, used sparingly, only on "why" moments — not everywhere

## Iconography
- Receipt icon: a small document/checkmark glyph, used identically everywhere, always opens the Receipt Panel. One icon, one meaning, no variants.

## Typography
- One sans-serif family. Three weights only: regular, medium, bold. Never introduce a second typeface.

## Spacing & radius
- Pick one corner-radius scale and one spacing scale from shadcn defaults. Never override per-component. Consistency here matters more than which specific values are chosen.

## Theme
- Build one theme well. Recommended: **dark** — evidence-heavy, "receipts"-forward UIs read as more serious in dark mode (Palantir/Linear-coded). Do not split effort across light + dark; a single polished theme beats two competent-but-unfinished ones.

## Animation presets (put these in `lib/animation-variants.ts`, reuse everywhere — don't hand-roll per screen)
- **Stagger-in for card lists:** 80ms offset (Homepage Decision cards), 150ms offset (X-Ray Flag cards).
- **Count-up:** used for Risk Score and Trust Badge — numeric value eases in from 0 (Risk Score) or from `previous_value` to `value` over ~600ms (Trust Badge), firing on increases as well as decreases.
- **Panel slide-in:** Receipt Panel and Evidence detail panel slide in from the right and push content left — never overlay as a modal.
- **Shared-element route transition:** Homepage → destination screen should feel like a continuation, not a reload.
- **Checklist confirmation:** checkmark draws in ~300ms on Supplier Workspace item completion.

## Copy tone
Every empty/error state string in `01-PRD.md` is written in the exact tone to ship — plain, calm, never technical. Do not "improve" this copy per-component; use it verbatim so the whole app reads as one voice.
