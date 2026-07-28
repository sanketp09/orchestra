# 04 — API Contracts

All routes live under `routers/` per `02-ARCHITECTURE.md`. Response shapes below are the contract frontend code should be written against — don't drift from these without updating this file first.

```
GET /dashboard/decisions
  out: Decision[]

GET /dashboard/search?q=
  out: { results: [{ type, title, snippet, link }] }

POST /xray/analyze
  in: { file: PDF }
  → Extract → Sentinel → Precedent → Compass → Combine → Receipt Generator
  out: { risk_score, flags: [{ title, severity, decision_id }] }

GET /receipt/:decision_id
  out: { evidence[], confidence, reasoning }

GET /vendor/:id/trust
  → Trustline (reads Evidence, computes weighted belief)
  out: { trust_score, previous_score, trend[], latest_receipt }

GET /vendor/:id/timeline
  out: TimelineEvent[]

POST /vendor/:id/evidence
  in: { type, file or data, reliability_tier }
  → writes Evidence → triggers Trustline recompute → writes Decision + Receipt
  out: { new_trust_score, receipt }

GET /evidence?search=&type=
  out: EvidenceCard[]

GET /evidence/:id
  out: { source, uploaded_by, date, reliability_tier, supports, linked_decision_count }

POST /supplier/:id/upload
  in: { document_type, file }
  → Sentinel (verifies document) → writes Evidence → updates checklist status
  out: { checklist_status, completion_percent }

GET /supplier/:id/checklist
  out: ChecklistItem[]

POST /search
  in: { query: string }
  → retrieves relevant Entity/Evidence/Decision rows → LLM summarizes with citations
  out: { results: [{ type, title, snippet, link }] }

GET /project/:id/timeline
  out: TimelineEvent[]

POST /site/voice-capture
  in: { audio or video file }
  → transcribe → classify intent → writes Evidence/Decision
  out: { action_taken, confirmation_text }
```

## Sample response — `GET /vendor/e1/trust`
```json
{
  "vendor": "SteelCorp",
  "trust_score": 76,
  "previous_score": 82,
  "trend": [ {"period": "2023", "value": 72}, {"period": "2024", "value": 79}, {"period": "2025", "value": 76} ],
  "latest_receipt": {
    "reasoning": "A verified delivery ticket showing a 6-day delay reduced schedule-reliability confidence.",
    "confidence": 0.88,
    "evidence": [{"type": "delivery_ticket", "reliability_tier": "verified_transaction"}]
  }
}
```

## Contract rules
- Every route that returns a `value`/`previous_value` pair must return both, even on first load (use the same value for both if there's no prior history) — the frontend animation logic in `06-DESIGN-SYSTEM.md` depends on both being present.
- Error responses across all routes should carry a `message` field written in the plain-English tone specified per-screen in `01-PRD.md` — never a raw stack trace or exception string.
- `POST /xray/analyze` and `POST /site/voice-capture` are the two long-running routes; both should support the staged "step label" progress pattern (streaming or polling) rather than a single blocking response, since the loading states in `01-PRD.md` depend on real intermediate labels, not fake delays.
