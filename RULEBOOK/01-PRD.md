# 01 — Product Requirements: ORCHESTRA

## Product philosophy
Every number ORCHESTRA shows — a trust score, a flag, a recommendation — comes with a full, clickable trail back to real evidence. Internally this is "Receipts": the reason the Receipt Panel is the first component built, not the last.

## Architecture principle (for context, detail lives in 02)
Four primitives — Entity, Evidence, Decision, Receipt — power every screen. Six backend systems (Sentinel, Trustline, Compass, Precedent, Arbiter, Atlas) read and write those four tables. None of the six are ever visible as pages, labels, or "agents" to the user.

## Design principle
Every screen answers exactly one question. Every card answers exactly one question. If either tries to answer two, split it.

## The four demoed moments (nothing else needs to be polished to this level)
1. Decision Center that tells the user what matters, not a dashboard of widgets.
2. Upload a document into Procurement X-Ray, watch real staged flags appear with a receipt behind each.
3. A vendor's trust score visibly moving as new evidence is added, live.
4. One click, anywhere, always lands on the identical Receipt Center.

---

## Screens

### Homepage
**Purpose:** answer "what deserves my attention right now."
**Layout:** greeting header ("Good morning, Sarah — 3 decisions need you"), global search bar, vertical stack of Decision cards, each with a single CTA.
**Components:** Decision Card, Search Bar (global), Alert Badge.
**States:**
- Loading: skeleton cards + cycling real-sounding status text ("Checking overnight vendor updates...").
- Empty: "All clear — nothing needs your attention," plus a quiet recent-activity feed.
- Success: populated Decision cards, most urgent first.
- Error: "Couldn't refresh your decisions — showing the last known state," with a retry action. Never a raw error.
**Animations:** cards fade/slide in staggered by 80ms; urgency badge pulses once on new items only.
**Flow:** land → scan cards → click one CTA → route transitions into the relevant screen with a shared-element animation (feels like continuation, not reload).
**APIs:** `GET /dashboard/decisions`, `GET /dashboard/search?q=`

### Procurement X-Ray
**Purpose:** answer "what could go wrong before I sign."
**Layout:** drag-and-drop upload zone → scanning sequence → Risk Score (large, animated) → stacked Flag Cards → side panel Receipt view on click.
**Components:** Upload Dropzone, Scan Progress List, Risk Score Badge, Flag Card, Receipt Panel (shared with Receipt Center).
**States:**
- Loading: real step labels cycling ("Checking scope vs. drawings...", "Checking clause history...", "Checking pricing pattern..."), 1.5–2s per step. Never a bare spinner.
- Empty (pre-upload): dropzone with example prompt text.
- Success: Risk Score eases in (count-up), flags stagger in one by one.
- Error (unreadable file): "Couldn't read this file — try a text-based PDF." Never a stack trace.
**Animations:** Risk Score counts up from 0; flags stagger by 150ms; clicking a flag slides the Receipt Panel in from the right, pushing content left (not overlaying).
**Flow:** upload → watch scan → read Risk Score → click each flag → read Receipt → close panel or move to next flag.
**APIs:** `POST /xray/analyze` (returns `risk_score` + `flags[]`), `GET /receipt/:decision_id`

### Trustline (Vendor Profile)
**Purpose:** answer "can I trust this vendor, right now."
**Layout:** vendor header with large animated trust number, trust trajectory line chart, "Recent Changes" feed below.
**Components:** Trust Badge (large), Trust Trajectory Chart, Timeline Card, Reliability Badge.
**States:**
- Loading: chart skeleton + "Calculating trust trajectory...".
- Empty (new vendor): "No trust history yet — evidence will build as you work together," with a CTA to send a Supplier Workspace request.
- Success: full chart + feed.
- Error: last-cached trust value shown with a small "last updated" note instead of a blank screen.
**Animations:** trust number eases from previous to new value over ~600ms whenever evidence changes it, with a tooltip ("Updated 12s ago — Factory photo uploaded"). Must fire on increases as well as decreases.
**Flow:** land on vendor → scan trust trend → click a "Recent Changes" entry → expands into the Receipt Panel.
**APIs:** `GET /vendor/:id/trust`, `GET /vendor/:id/timeline`, `POST /vendor/:id/evidence`

### Receipt Center
**Purpose:** answer "why does ORCHESTRA believe this." This is the one component reused everywhere "View Receipt" appears — **build it first, as a component, not last, as a page.**
**Layout:** search bar, filter tabs by evidence type, list of entries; detail panel shows source, uploader, date, reliability tier, what it supports, linked-decision count.
**Components:** Evidence Card, Reliability Badge, Search Result, Linked Decision List.
**States:**
- Empty: "No supporting evidence yet. Upload a Contract, Inspection, Site Photo, or Delivery Ticket to strengthen this decision."
- Loading: skeleton list.
- Success: full list + detail panel.
- Error: "Couldn't load this evidence record," with the decision it belongs to still shown.
**Animations:** detail panel slides in, doesn't overlay; reliability badge briefly highlights on first view.
**APIs:** `GET /evidence?search=&type=`, `GET /evidence/:id`

### Supplier Workspace
**Purpose:** answer "what am I missing" — for the vendor, not the buyer.
**Layout:** simplified nav (no buyer-side sidebar), outstanding-documents checklist, upload button per item, completion percentage bar.
**Components:** Checklist Item, Upload Button, Progress Bar.
**States:**
- Empty (brand-new vendor): full checklist, 0% complete, encouraging copy.
- Loading: progress bar shimmer during upload/verification.
- Success: item flips to checked with a small confirmation animation.
- Error: "That file didn't match what we expected — try re-uploading," specific to the document type.
**Animations:** checkmark draws in ~300ms on successful verification; progress bar eases to new percentage.
**APIs:** `POST /supplier/:id/upload`, `GET /supplier/:id/checklist`

### Global Search
**Purpose:** answer any specific question in one place — not its own page, a persistent component on every screen's header.
**Layout:** single input; results as a dropdown or takeover panel on submit.
**States:**
- Empty (pre-type): example prompts shown ("Why hasn't the chiller shipped?").
- Loading: "Searching evidence and decisions...".
- Success: grouped results (Vendors / Decisions / Evidence).
- No results: "Nothing matches yet — try rephrasing, or ask a broader question."
**APIs:** `POST /search` (natural-language query over Entity/Evidence/Decision)

### Timeline View
**Purpose:** answer "how did we get here" — a tab within Vendor Profile and Project, not a top-level nav item.
**Layout:** vertical chronological list, each entry a dot + label + date, connected by a line.
**States:**
- Empty: "No events recorded yet for this project."
- Success: populated, most recent at top or bottom — pick one, stay consistent across the whole app.
**APIs:** `GET /project/:id/timeline` or `GET /vendor/:id/timeline`

### Mobile Site Capture
**Purpose:** turn a voice note or video into structured action.
**Layout:** one large record button, transcription appears below, resulting action confirms as a card.
**States:**
- Recording: waveform animation.
- Processing: "Understanding what you said...".
- Success: action confirmation card ("Purchase Request Created").
- Error: "Didn't catch that clearly — try again." Never a silent failure.
**Demo note:** run this on a specific, rehearsed phrase and pre-tested video, not open-ended live audio.
**APIs:** `POST /site/voice-capture` (audio/video in, structured action out)
