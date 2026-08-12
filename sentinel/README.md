# Orchestra Sentinel — Feature 1: AI Site Walk

## What's real computation vs. what depends on seeded/demo data

**Real, non-mocked computation:**
- **Frame extraction** (`app/services/video_processor.py`) — genuine OpenCV
  decoding of `.mp4`/`.mov` files, resizing to a max 1024px dimension, and
  time-interval sampling with a hard `max_frames` cap.
- **Vision detection** (`app/services/vision_detector.py`) — a real call to
  Claude (`claude-sonnet-4-6`) with base64 image input and a constrained
  tool-calling schema. Requires a real `ANTHROPIC_API_KEY` env var; there is
  no mock/stub path in the actual pipeline.
- **Deduplication heuristic** (`app/graphs/site_walk_graph.py::_deduplicate`)
  — real clustering logic based on category + a 3-second time window.
- **PO diffing** (`_match_against_po`) — real arithmetic against whatever PO
  line items exist for the session's project, computing `delta = expected - detected`
  per line item.
- **Conditional routing** — the graph genuinely branches to `flag_for_review`
  when any detection is damaged or below the 0.6 confidence threshold.

**Depends on seeded/demo data:**
- The PO records and line items themselves (`scripts/seed_po_data.py`) — the
  matching logic is real, but it's only as good as the PO data it's compared
  against. Without seeded (or otherwise real) PO rows for a project, there's
  nothing to match detections to.
- The sample video (`tests/fixtures/site_walk_sample.mp4`) — a synthetic clip
  generated for testing purposes only (see
  `tests/fixtures/generate_sample_video.py`), not a real site walkthrough. For
  an actual demo, replace this with a real 15–20 second walkthrough video.
- `tests/test_site_walk.py` mocks `vision_detector.detect_items_in_frame`
  specifically (not the rest of the pipeline) since exercising a live Claude
  vision call in CI would require a real API key, cost money per run, and be
  non-deterministic. Every other node in the graph runs for real in the test.

## Setup

```bash
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...
export DATABASE_URL=postgresql+psycopg2://user:pass@localhost:5432/sentinel
python -m scripts.seed_po_data
uvicorn app.main:app --reload
```

## Cost / latency note

AI Site Walk makes one Claude vision call per sampled frame. At a 2-second
sampling interval, a 30-second video is 15 calls. Keep demo videos to
15–20 seconds — the `max_frames=20` cap in `video_processor.extract_frames`
is a backstop, not a substitute for a short demo video.

## API

- `POST /sentinel/site-walk/upload` — multipart video upload (`project_id`
  query param + `video` file field). Saves the file, creates a
  `SiteWalkSession`, kicks off the LangGraph pipeline via `BackgroundTasks`,
  returns `{session_id, status: "pending"}` immediately.
- `GET /sentinel/site-walk/{session_id}` — poll for status
  (`pending|processing|complete|error`) and the final `SiteWalkResult` once
  complete.

## Known assumption

The prompt references a shared `EvidenceResult` base schema and
`EvidenceNode`/`EvidenceEdge` types "from the architecture doc," which wasn't
included alongside the feature spec. `app/schemas/evidence.py` implements a
reasonable, self-consistent version of that contract based on how it's used
in the spec (`writes_to`, severity, a generic `detail` payload for
`ReceiptCard` to render). If the real architecture doc defines these
differently, that file is the one to reconcile.

## Tests

```bash
pytest tests/test_site_walk.py -v
```

Regenerate the synthetic fixture video if needed:

```bash
python tests/fixtures/generate_sample_video.py
```

## Not yet built

Neither — both Feature 1 (AI Site Walk) and Feature 2 (Duplicate & Conflicting
Order Catcher) are built and passing tests.

---

# Feature 2: Duplicate & Conflicting Order Catcher

## What's real vs. seeded

**Real, non-mocked computation:**
- **Embedding calls** (`app/services/embeddings.py`) — a real call to
  OpenAI's `text-embedding-3-small`. Requires a real `OPENAI_API_KEY`; no
  mock path in the actual pipeline.
- **Exact-SKU matching, cosine-similarity fuzzy matching, and severity
  escalation** (`app/services/duplicate_checker.py`) — all real, deterministic
  logic. No LangGraph involved, per the spec — this is comparison logic, not
  multi-step reasoning.
- Cosine similarity is computed in Python rather than via a native pgvector
  `ORDER BY ... <=>` query, so the exact same code path runs identically
  against real Postgres+pgvector in production and against SQLite in tests.
  At real production scale (thousands of line items), swap this for a native
  pgvector ANN query — the comparison logic itself doesn't change.

**Depends on seeded/demo data:**
- `scripts/seed_po_data.py` now includes a deliberate near-duplicate: "12mm
  rebar" (Structural team) vs. "12mm reinforcement bar" (Electrical team),
  same project, overlapping delivery windows, no shared SKU — guaranteed to
  be caught by the fuzzy pass, not the exact-SKU pass. Note the seed script
  only inserts structured PO data; embeddings still need to be generated
  separately via `embeddings.embed_text()` (requires `OPENAI_API_KEY`) since
  seeding shouldn't require a live API key to run.
- `tests/test_duplicate_checker.py` constructs embeddings by hand (simple
  unit vectors with controlled cosine similarity) rather than calling the
  real embeddings API, so tests are deterministic and don't require an API
  key. The matching/scoring/severity logic itself is exercised for real.

## Severity logic

| | same project + overlapping window + different team | otherwise |
|---|---|---|
| **Exact SKU match** | `exact_duplicate` | `likely_duplicate` |
| **Fuzzy match (similarity > 0.85)** | `likely_duplicate` | `possible_overlap` |

`estimated_savings_if_merged` is only populated when both line items have a
`unit_cost` set — the PO line item model doesn't require cost data, so this
degrades gracefully to `None` rather than fabricating a number.

## API

- `POST /purchase-orders` — creates the PO + line items. Runs
  `check_for_duplicates` synchronously per line item (embedding failure
  degrades to exact-SKU-only checking rather than blocking PO creation).
  Returns the created PO plus a `warnings` array of `DuplicateCheckResult`
  for any `exact_duplicate`/`likely_duplicate` match. **The PO is still
  created even when a duplicate is found** — duplicates are surfaced as
  warnings, not blockers.
- `GET /purchase-orders/{id}/duplicate-check` — re-runs the check on demand
  for every line item on an existing PO.

## Tests

```bash
pytest tests/test_duplicate_checker.py -v
```

Three assertions, as specified: (a) an exact SKU duplicate is caught, (b) the
fuzzy-worded near-duplicate is caught with similarity > 0.85, (c) two
genuinely unrelated line items are not flagged.
