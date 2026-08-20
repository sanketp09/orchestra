from typing import List, Dict, Any, Optional
from common.embedding_client import get_embedding_client
from common.supabase_client import get_supabase_client
from evidence_store.models import HistoricalCase


class EvidenceRetrievalEngine:
    """
    RAG retrieval engine performing semantic vector search over evidence chunks
    and historical precedent cases using local 384-d sentence embeddings.
    """
    def __init__(self):
        self.embedding_client = get_embedding_client()
        self.supabase = get_supabase_client()
        self.mock_cases: List[HistoricalCase] = [
            HistoricalCase(
                case_id="case_001",
                project_id="prj_riverside",
                vendor_id="vendor_meridian",
                dispute_type="delay",
                summary="Subcontractor claimed 14-day extension due to monsoon rain. Weather station records showed rain was below contractual stand-down threshold. Claim rejected.",
                outcome="Claim denied. Vendor assessed zero extension and penalized for delay.",
                embedding=self.embedding_client.embed_text("Subcontractor monsoon rain delay claim weather station verification rejected")
            ),
            HistoricalCase(
                case_id="case_002",
                project_id="prj_apex",
                vendor_id="vendor_apex",
                dispute_type="collusion",
                summary="Complementary bidding detected between Apex Rebar and Coastal Metal due to identical PDF metadata and matching unit price variations.",
                outcome="Disqualified from RFP-2026-08 and trust score reduced by 35%.",
                embedding=self.embedding_client.embed_text("Complementary bidding identical unit price PDF metadata collusion disqualified")
            ),
            HistoricalCase(
                case_id="case_003",
                project_id="prj_metro",
                vendor_id="vendor_voltline",
                dispute_type="progress",
                summary="Pay application #7 claimed 90% electrical progress. Site walk visual audit showed 68% complete. Overbilling flagged.",
                outcome="Payment capped at 68% verified milestone ($139,400). $45,100 hold applied.",
                embedding=self.embedding_client.embed_text("Pay application electrical progress overbilling vision site walk audit hold")
            )
        ]

    def search_similar_cases(self, query: str, top_k: int = 3, case_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Embeds query and computes cosine similarity against stored cases using pgvector on Supabase,
        with fallback to in-memory mock cases.
        """
        try:
            query_vec = self.embedding_client.embed_text(query)
            res = self.supabase.rpc(
                "match_historical_cases",
                {
                    "query_embedding": query_vec,
                    "match_case_type": case_type,
                    "match_count": top_k
                }
            ).execute()
            if res.data:
                formatted = []
                for row in res.data:
                    formatted.append({
                        "case_id": row.get("case_id"),
                        "project_id": row.get("project_id"),
                        "vendor_id": row.get("vendor_id"),
                        "summary": row.get("summary"),
                        "outcome": row.get("outcome"),
                        "dispute_type": row.get("case_type"),
                        "similarity": round(float(row.get("similarity", 0.5)), 4)
                    })
                return formatted
        except Exception as e:
            print(f"[EvidenceRetrievalEngine] DB RPC error: {e}. Falling back to in-memory search.")

        query_vec = self.embedding_client.embed_text(query)
        scored_cases = []

        for case in self.mock_cases:
            if not case.embedding:
                case.embedding = self.embedding_client.embed_text(case.summary)
            score = self.embedding_client.similarity(query_vec, case.embedding)
            scored_cases.append({
                "case_id": case.case_id,
                "project_id": case.project_id,
                "vendor_id": case.vendor_id,
                "summary": case.summary,
                "outcome": case.outcome,
                "dispute_type": case.dispute_type,
                "similarity": round(float(score), 4)
            })

        scored_cases.sort(key=lambda x: x["similarity"], reverse=True)
        return scored_cases[:top_k]



_retrieval_engine_instance = None

def get_retrieval_engine() -> EvidenceRetrievalEngine:
    global _retrieval_engine_instance
    if _retrieval_engine_instance is None:
        _retrieval_engine_instance = EvidenceRetrievalEngine()
    return _retrieval_engine_instance
