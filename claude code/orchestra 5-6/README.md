# Orchestra — Feature 5 & 6

## Setup

```bash
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-...
python -m scripts.seed_bid_data
python -m scripts.seed_mill_references
uvicorn app.main:app --reload
```

Run tests with `pytest`.

Endpoints:
- `POST /sentinel/bid-integrity/{package_id}/analyze`, `GET /sentinel/bid-integrity/{package_id}`
- `POST /sentinel/material-auth` (multipart: `photo`, `claimed_manufacturer`, optional `po_line_item_id`), `GET /sentinel/material-auth/history/{manufacturer_name}`

## Assumed-existing shared infra

These files are stubs standing in for infrastructure the plan describes as already built
from earlier features. If your project already has real versions, delete these and
repoint the imports:

- `app/db.py` — `Base` / `SessionLocal` / `get_db`
- `app/schemas/shared.py` — `EvidenceResult`
- `app/core/evidence.py` — `write_evidence()` (the shared evidence-graph writer)
- `app/core/llm.py` — `call_claude_structured()` (the shared Claude tool-calling wrapper)

## What's real vs. mocked

**Bid Integrity & Collusion Check** — fully real computation against seeded data.
`price_outlier.py` and `synchronization_detector.py` are pure statistics/pattern-matching,
no LLM involved. `shared_entity_checker.py` is a real filtered-query comparison. The one
LLM call (`synthesis_node`) only explains findings the deterministic nodes already
produced — it never detects anything itself. The bid/vendor data itself is seeded
(`scripts/seed_bid_data.py`), not pulled from a live procurement system.

**Material Authentication** — the vision extraction (`stamp_extractor.py`) is a real
Claude vision call against whatever photo is uploaded. The verdict logic
(`stamp_matcher.py`) is real, deterministic, explainable scoring — the model never decides
the verdict. What's necessarily mocked is the **reference database**
(`scripts/seed_mill_references.py`): there's no public source for mill stamp patterns, so
those rows are realistic but fictional. `tests/test_material_auth.py` tests the matcher
against synthetic extracted data rather than real photos — two real test images (one
clean match, one deliberate mismatch) still need to be supplied to exercise the full
vision pipeline end-to-end, per the plan's own note.

## Cost/latency

Both features are cheap to run synchronously in the request/response cycle: Bid Integrity
makes zero or one LLM call per analysis (the synthesis step only), Material Authentication
makes exactly one vision call per photo. No background task needed for either.
