"""
Integration test for the RAG library using MockSupabaseClient.
Verifies the complete flow (ingestion -> hybrid search -> reranking)
without requiring live database RPC functions.
"""

import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import os
# Force mock database by clearing environment variables for this test
os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = ""
os.environ["SUPABASE_ANON_KEY"] = ""

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
}

QUERY = "Did the vendor deliver the steel beams on time?"

def main():
    project_id = "test-mock-rag-proj"
    client = get_client()
    
    print(f"Using mock database client: {type(client).__name__}")
    
    # Ingest text snippets
    for label, text in SNIPPETS.items():
        row_ids = ingest(
            table=TABLE,
            text_column=TEXT_COLUMN,
            record_id=f"doc-{label}",
            raw_text=text,
            project_id=project_id,
            extra_fields={},
        )
        print(f"Ingested {label!r} -> row IDs: {row_ids}")
        
    print(f"\nRunning hybrid search for query: {QUERY!r}")
    results = hybrid_search(
        table=TABLE,
        text_column=TEXT_COLUMN,
        query=QUERY,
        project_id=project_id,
        top_k_final=2,
    )
    
    print(f"\nReturned {len(results)} results:")
    for idx, r in enumerate(results):
        print(f" {idx + 1}. Score: {r.rerank_score or 'N/A'}, Text: {r.text[:80]}...")
        
    if not results:
        print("FAIL: No results returned.")
        sys.exit(1)
        
    top_result = results[0].text
    if SNIPPETS["target"] in top_result or top_result in SNIPPETS["target"]:
        print("\nPASS: Target snippet returned as the top result!")
        sys.exit(0)
    else:
        print(f"\nFAIL: Expected target snippet, but got: {top_result!r}")
        sys.exit(1)

if __name__ == "__main__":
    main()
