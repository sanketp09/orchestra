"""
Unit tests for the parts of common.rag that don't require a live Supabase
connection or a downloaded embedding model: chunking and candidate merging.
"""

import sys
from pathlib import Path

# Add project root to sys.path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

from common.rag import chunking
from common.rag.retrieval import _merge_candidates, _normalize


def test_chunk_text_respects_overlap_and_order():
    text = "Sentence one. " * 100  # long enough to force multiple chunks
    chunks = chunking.chunk_text(text, chunk_size=100, chunk_overlap=20)

    assert len(chunks) > 1
    assert all(len(c) <= 120 for c in chunks)
    # Overlap means the tail of one chunk should reappear near the start of the next.
    assert chunks[0][-10:] in chunks[1]


def test_chunk_text_empty_input_returns_empty_list():
    assert chunking.chunk_text("") == []
    assert chunking.chunk_text("   \n  ") == []


def test_normalize_min_max():
    assert _normalize([1.0, 2.0, 3.0]) == [0.0, 0.5, 1.0]


def test_normalize_flat_values_returns_zeros():
    assert _normalize([5.0, 5.0, 5.0]) == [0.0, 0.0, 0.0]


def test_normalize_empty_returns_empty():
    assert _normalize([]) == []


def test_merge_candidates_union_and_dedup():
    vector_rows = [
        {"row_id": "a", "source_id": "doc1", "chunk_text": "alpha", "score": 0.9, "metadata": {}},
        {"row_id": "b", "source_id": "doc1", "chunk_text": "beta", "score": 0.5, "metadata": {}},
    ]
    keyword_rows = [
        {"row_id": "b", "source_id": "doc1", "chunk_text": "beta", "score": 0.7, "metadata": {}},
        {"row_id": "c", "source_id": "doc2", "chunk_text": "gamma", "score": 0.3, "metadata": {}},
    ]

    merged = _merge_candidates(vector_rows, keyword_rows)
    by_id = {r.chunk_id: r for r in merged}

    # a: vector-only -> keyword_score defaults to 0
    assert by_id["a"].vector_score == 0.9
    assert by_id["a"].keyword_score == 0.0

    # b: appears in both -> both scores kept
    assert by_id["b"].vector_score == 0.5
    assert by_id["b"].keyword_score == 0.7

    # c: keyword-only -> vector_score defaults to 0
    assert by_id["c"].vector_score == 0.0
    assert by_id["c"].keyword_score == 0.3

    assert len(merged) == 3  # deduped, not 4
