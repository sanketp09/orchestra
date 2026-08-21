"""
Standalone integration test for the RAG library, run against a REAL Supabase
project (not mocked) - it needs the actual pgvector/tsvector columns and the
rag_vector_search / rag_keyword_search RPC functions from
sql/hybrid_search_functions.sql to be installed.

What it does:
    1. Ingests 3-4 fake text snippets into a throwaway project_id in the
       `evidence` table via common.rag.ingest.
    2. Runs common.rag.hybrid_search with a query that should clearly match
       one specific snippet.
    3. Asserts that snippet's chunk comes back as the #1 result.
    4. Deletes every row it created (by project_id), even if the assertion
       fails.

Run with:
    python test_rag.py

(Not a pytest file - it needs live infra and a downloaded embedding model,
so it's meant to be run manually per the "after it's built" checklist, not
as part of an automated CI unit-test run.)
"""

from __future__ import annotations

import sys
import uuid

from common.rag import hybrid_search, ingest
from common.supabase_client import get_client

TABLE = "evidence"
TEXT_COLUMN = "extracted_text"

SNIPPETS = {
    "target": (
        "The vendor missed the agreed delivery window for the steel beams "
        "by eleven days, and provided no advance notice of the delay to the "
        "project team."
    ),
    "distractor_1": (
        "Quarterly financial statements show the vendor's revenue grew "
        "twelve percent year over year, driven by expansion into new "
        "regional markets."
    ),
    "distractor_2": (
        "The site safety audit found all scaffolding and fall-protection "
        "equipment in compliance with local building codes."
    ),
    "distractor_3": (
        "Contract renewal terms include a revised payment schedule with "
        "net-45 terms instead of the previous net-30."
    ),
}

QUERY = "Did the vendor deliver the steel beams on time?"


def main() -> int:
    project_id = f"test-rag-{uuid.uuid4().hex[:8]}"
    created_ids: list[str] = []

    print(f"Using throwaway project_id={project_id!r}")

    try:
        for label, text in SNIPPETS.items():
            row_ids = ingest(
                table=TABLE,
                text_column=TEXT_COLUMN,
                record_id=f"doc-{label}",
                raw_text=text,
                project_id=project_id,
                extra_fields={},
            )
            created_ids.extend(row_ids)
            print(f"  ingested {label!r} -> {len(row_ids)} chunk row(s)")

        print(f"\nRunning hybrid_search(query={QUERY!r}) ...")
        results = hybrid_search(
            table=TABLE,
            text_column=TEXT_COLUMN,
            query=QUERY,
            project_id=project_id,
            top_k_final=3,
        )

        if not results:
            print("FAIL: hybrid_search returned no results.")
            return 1

        top = results[0]
        print(f"\nTop result (score={top.rerank_score}): {top.text[:120]}...")

        assert SNIPPETS["target"] in top.text or top.text in SNIPPETS["target"], (
            "Expected the steel-beam delivery snippet to be the top result, "
            f"got: {top.text!r}"
        )
        print("\nPASS: expected snippet returned as top result.")
        return 0

    finally:
        if created_ids:
            print(f"\nCleaning up {len(created_ids)} row(s) for project_id={project_id!r} ...")
            get_client().table(TABLE).delete().eq("project_id", project_id).execute()
            print("Cleanup done.")


if __name__ == "__main__":
    sys.exit(main())
