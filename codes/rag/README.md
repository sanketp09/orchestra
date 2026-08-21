# common/rag

Shared retrieval-augmented-generation library used by Sentinel (`evidence`
table) and Precedent (`historical_cases` table). Nothing in here hardcodes
either table name - both services call the same functions with their own
table/column arguments.

## Layout

```
common/
├── supabase_client.py       # shared get_client()
└── rag/
    ├── __init__.py           # from common.rag import ingest, hybrid_search
    ├── chunking.py            # text -> chunks (RecursiveCharacterTextSplitter)
    ├── embedding.py             # wraps BAAI/bge-small-en-v1.5
    ├── rerank.py                 # cross-encoder reranker
    ├── models.py                  # Chunk, RetrievalResult
    ├── ingestion.py                 # chunk -> embed -> store (table-parameterized)
    ├── retrieval.py                  # hybrid search + merge + rerank (table-parameterized)
    ├── test_rag.py                    # standalone live-infra integration check
    ├── tests/
    │   └── test_rag_logic.py           # pure-logic unit tests (no live infra needed)
    └── sql/
        └── hybrid_search_functions.sql  # REQUIRED one-time Supabase SQL setup
```

## One extra setup step beyond RAG_01_SETUP.md

PostgREST's table query builder can't express "order by cosine distance" or
`ts_rank` scoring directly, so `retrieval.py` calls two small Postgres RPC
functions instead. **Run `sql/hybrid_search_functions.sql` once in the
Supabase SQL editor**, same as the index migration from `RAG_01_SETUP.md`.
It defines `rag_vector_search` and `rag_keyword_search` - both
table-parameterized via dynamic SQL, so one copy of each covers every table
that follows the `evidence` / `historical_cases` shape.

## Install

```bash
pip install -r common/requirements.txt
```

## Test

```bash
# Pure logic (chunking, candidate merging) - no live infra needed:
pytest common/rag/tests/

# Live integration check (needs real Supabase + the SQL above installed +
# the embedding/reranker models downloaded on first run):
python common/rag/test_rag.py
```

`test_rag.py` ingests 3-4 fake snippets into a throwaway `project_id` in
`evidence`, runs `hybrid_search` with a query that should clearly match one
of them, asserts it comes back as the top result, and deletes every row it
created (by `project_id`) in a `finally` block even if the assertion fails.

## After it's built (per the build prompt)

1. `pytest common/rag/tests/` - pure-logic tests pass.
2. `python common/rag/test_rag.py` - confirms the expected chunk comes back
   on top against your real Supabase project.
3. Manually call `hybrid_search` once against `evidence` and once against
   `historical_cases` with a real-ish query for each; eyeball whether
   results and rerank scores look sensible.

## Assumptions made while building (worth knowing before the Sentinel/Precedent refactor)

The build prompt didn't fully specify how a chunk row relates back to its
parent document, or what a chunk row's own primary key column is called.
Rather than guess a single hardcoded name that might not match your actual
schema, both are configurable, with defaults:

- **`source_id_column` (default `"source_id"`)** - `ingest()` writes
  `record_id` into this column on every chunk row it creates;
  `hybrid_search()` reads it back out as `RetrievalResult.source_id`. If
  `evidence`/`historical_cases` name this column differently (e.g.
  `evidence_id` / `case_id`), pass `source_id_column=...` explicitly when
  calling `ingest`/`hybrid_search` - nothing else assumes a fixed name.
- **`id_column` (default `"id"`)** - each chunk row's own primary key.
  `ingest()` generates a `uuid4` client-side and writes it into this column
  (so the returned row ids are known without depending on what Supabase's
  insert response includes). Override if your tables use a different PK
  column name.
- **Metadata on `RetrievalResult`** is *every other column* on the matched
  row (the SQL functions strip `embedding` and the text column itself from
  the jsonb payload) - so `source_ref` on `evidence` or `outcome` on
  `historical_cases` show up automatically with no per-table code needed on
  the Python side.
- **`rerank=False` scoring**: min-max normalizes `vector_score` and
  `keyword_score` independently across the merged candidate set, then sums
  them. This is a simple, documented placeholder, not a tuned formula -
  `rerank=True` (the default) is the intended path for real usage.

If your actual `evidence`/`historical_cases` schema already has
`source_id`/`id` columns matching the defaults, none of this requires any
changes at the call site - it's only relevant if the refactor into
`sentinel/` and `precedent/` hits a column-name mismatch.
