import sys
import uuid
from pathlib import Path

# Add project root to sys.path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

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


def test_rag_ingest_and_hybrid_search():
    """Verify that text snippets are correctly ingested and retrieved via hybrid search."""
    project_id = f"test-rag-{uuid.uuid4().hex[:8]}"
    created_ids = []

    try:
        # Ingest snippets
        for label, text in SNIPPETS.items():
            row_ids = ingest(
                table=TABLE,
                text_column=TEXT_COLUMN,
                record_id=f"doc-{label}",
                raw_text=text,
                project_id=project_id,
                extra_fields={"origin": "verified_public"},
            )
            created_ids.extend(row_ids)

        # Run hybrid search
        results = hybrid_search(
            table=TABLE,
            text_column=TEXT_COLUMN,
            query=QUERY,
            project_id=project_id,
            top_k_final=3,
        )

        assert len(results) > 0
        top = results[0]
        
        # Verify targeted text is returned
        assert SNIPPETS["target"] in top.text or top.text in SNIPPETS["target"]
        
        # Verify metadata and provenance source ID survived
        assert top.source_id == "doc-target"
        assert top.metadata.get("origin") == "verified_public"

    finally:
        # Clean up mock table
        if created_ids:
            get_client().table(TABLE).delete().eq("project_id", project_id).execute()


def test_rag_empty_result_graceful():
    """Verify that retrieval returns empty list instead of failing if no results match."""
    results = hybrid_search(
        table=TABLE,
        text_column=TEXT_COLUMN,
        query="completely non-existent terms",
        project_id="non-existent-project",
        top_k_final=3,
    )
    assert results == []
