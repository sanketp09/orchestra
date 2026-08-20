# Trustline

Vendor trust intelligence microservice. Called only by ORCHESTRA over HTTP.

## Layout

```
trustline/
├── common/
│   ├── models.py         # AgentTask / AgentResult contract (shared across agents)
│   └── supabase_client.py
├── main.py               # FastAPI app, the 5 capability endpoints + /capabilities
├── logic.py              # trust-scoring logic, no FastAPI/Supabase imports (unit-testable)
├── db.py                 # thin Supabase read/write helpers, no business logic
├── models.py              # Trustline-specific request bodies
├── capabilities.json      # sent to Person 1 for ORCHESTRA registration
├── requirements.txt
└── tests/
    └── test_update_trust_logic.py
```

## Setup

```bash
pip install -r requirements.txt
# .env (shared with the team) needs:
#   SUPABASE_URL=...
#   SUPABASE_SERVICE_ROLE_KEY=...
```

## Run

```bash
uvicorn main:app --reload
```

## Test

```bash
pytest
```

5 tests cover the core `update_trust` decision logic in `logic.py`:
external cause → little/no penalty, no external cause → full penalty,
external cause overridden by vendor fault, and drift detection (flag at 3+
negative events / no flag below threshold).

## Manual verification checklist

1. `uvicorn main:app --reload`
2. `curl localhost:8000/capabilities` — confirm all 5 capabilities list back
   with the descriptions from `capabilities.json`.
3. POST a fake `AgentTask`-shaped body to each endpoint (see `models.py` for
   the actual per-endpoint request shape - endpoints take the inner
   Trustline-specific fields directly, e.g. `{"vendor_id": "V-001"}`) and
   confirm each response is a schema-valid `AgentResult`.
4. Insert one `trust_events` row (or just call `/update_trust`) with
   `external_context={"relevance": 0.85, "explains_majority": true}` and
   `verified_event.vendor_at_fault=false` → expect `external_cause=true` and
   a barely-moved score.
5. Call `/update_trust` again with `external_context=None` (or
   `vendor_at_fault=true`) → expect `external_cause=false` and a real drop in
   `overall_trust`. This external-cause-vs-penalty branch is the one piece of
   logic worth checking by hand end-to-end against the real DB, since the
   unit tests only exercise the pure decision function.
6. Send `capabilities.json` to Person 1 for ORCHESTRA registration.

## Notes / assumptions made while building

- `verified_event.vendor_at_fault` (bool, default `True`) is read as an
  explicit fault determination from Sentinel. If present and `True`, it
  overrides even a strong external-cause signal, per the spec ("or Sentinel's
  verified_event shows the vendor is clearly at fault").
- `external_context.explains_majority` (bool) is read as Sentinel's
  explicit signal that the external factor explains most of the impact; if
  absent, it defaults to `relevance > 0.6` so the endpoint still works with a
  minimal `{"relevance": ...}` payload.
- "Little or no penalty" for a verified external cause is implemented as 5%
  of the raw delta (not exactly zero), so a genuinely external event still
  leaves a faint trace rather than being fully invisible - reconsider if you
  want a true zero-penalty behavior instead.
- `update_trust`'s `impact_delta` is clamped to ≤ 0 before use, since this
  endpoint is a penalty path only, not a general score-adjustment endpoint.
