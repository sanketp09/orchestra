# 03 — Database Schema

Exactly four tables. Do not add a fifth "systems" table for Sentinel/Trustline/etc. — those are code, not data.

```sql
-- ENTITY: vendors, projects, contracts, purchase orders
CREATE TABLE entity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('vendor','project','contract','purchase_order')),
  name TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- EVIDENCE: everything that supports a belief
CREATE TABLE evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entity(id),
  type TEXT NOT NULL CHECK (type IN ('photo','contract','email','weather','delivery_ticket','invoice')),
  reliability_tier TEXT NOT NULL CHECK (reliability_tier IN ('self_reported','third_party_observed','verified_transaction')),
  raw_file_url TEXT,
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  extracted_data JSONB DEFAULT '{}'
);

-- DECISION: risk flags, recommendations, alerts, approvals
CREATE TABLE decision (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entity(id),
  type TEXT NOT NULL CHECK (type IN ('risk','recommendation','alert','approval')),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open',
  value NUMERIC,          -- e.g. trust score, risk score
  previous_value NUMERIC, -- for animating the change
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RECEIPT: the explanation linking a decision to its evidence
CREATE TABLE receipt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID REFERENCES decision(id),
  evidence_ids UUID[] NOT NULL,
  confidence NUMERIC CHECK (confidence BETWEEN 0 AND 1),
  reasoning TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Seed data bar — realism matters for demo credibility

Seed data must read like a real construction project, not `Vendor 1` / `test@test.com`. Use this shape and tone as the bar for every seeded vendor:

```json
{
  "entity": { "id": "e1", "type": "vendor", "name": "SteelCorp", "metadata": {"trade": "structural steel"} },
  "evidence": [
    { "id": "ev1", "entity_id": "e1", "type": "delivery_ticket", "reliability_tier": "verified_transaction",
      "uploaded_at": "2025-03-14", "extracted_data": {"on_time": false, "days_late": 6} },
    { "id": "ev2", "entity_id": "e1", "type": "photo", "reliability_tier": "third_party_observed",
      "uploaded_at": "2025-06-02", "extracted_data": {"assembly_stage_observed": "FAT passed"} }
  ],
  "decision": { "id": "d1", "entity_id": "e1", "type": "alert", "title": "Trust score updated",
                "value": 76, "previous_value": 82 },
  "receipt": { "decision_id": "d1", "evidence_ids": ["ev1"], "confidence": 0.88,
               "reasoning": "A verified delivery ticket showing a 6-day delay reduced schedule-reliability confidence." }
}
```

## Non-negotiable data rules
- `confidence` on any Receipt must never exceed what the weakest linked evidence's `reliability_tier` justifies (`verified_transaction` > `third_party_observed` > `self_reported`).
- Every Decision that has a `value`/`previous_value` pair (trust score, risk score) must have at least one Receipt backing the latest change — no orphaned number changes.
- Seed at least one vendor with a full realistic history (dispute, delay, recovery) for the Arbiter and Trustline demo moments — see `09-ROADMAP-TASKS.md` Week 1, Member D.
