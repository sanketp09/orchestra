# 10 — Demo Script

Every bracketed action below must be rehearsed on a specific file and a specific vendor record, run enough times that the team could do it with the wifi down, on a backup laptop, without missing a beat.

> "This is Sarah's morning. **[Homepage loads]** Three things need her. **[Click 'Analyze Quote']** Now she's inside Procurement X-Ray. **[Drop the PDF]** Watch — checking scope against drawings, checking this vendor's dispute history, checking pricing. **[Risk Score counts up, flags stagger in]** Three flags. **[Click the pricing flag]** Here's the receipt — the actual quote, the past project, the market median, the confidence, the recommendation. **[Navigate to Trustline]** Now watch this vendor's trust score. **[Upload a new evidence file live]** Watch the number move — 82 to 76 — one click shows exactly why. **[Click the tooltip → Receipt Panel]** Every number in this product works exactly like this. That's not six tools. That's one brain that never gives you an answer without showing its work."

## Rehearsal checklist
- [ ] Specific PDF chosen and pre-tested for the X-Ray upload moment (a file that reliably produces 3 flags, one of them pricing)
- [ ] Specific vendor record chosen for the Trustline moment, with a specific evidence file that reliably moves trust 82 → 76
- [ ] Full run timed end to end, on the actual demo network
- [ ] Backup laptop tested with the same seed data and same files
- [ ] Offline/API-failure fallback confirmed: does the app show cached/last-known state per the Error states in `01-PRD.md`, or does the demo need a recorded backup clip?

## Proactive scope disclosure (say this before being asked)
Reference `08-SCOPE-BOUNDARIES.md` — state plainly what's not built and why, framed as "same brain, next application," not as a gap.
