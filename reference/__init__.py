"""
Shared RAG library used by Sentinel (evidence) and Precedent
(historical_cases). Table-parameterized - nothing in here hardcodes either
table name.

Public API:
    from common.rag import ingest, hybrid_search
"""

from common.rag.ingestion import ingest
from common.rag.models import Chunk, RetrievalResult
from common.rag.retrieval import hybrid_search

__all__ = ["ingest", "hybrid_search", "Chunk", "RetrievalResult"]
