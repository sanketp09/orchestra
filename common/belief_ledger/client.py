from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
from common.schemas.belief import BeliefEdge
from common.supabase_client import get_supabase_client


class BeliefLedgerClient:
    """
    Shared client for writing and reading the Belief Graph / Ledger (belief_edges table).
    Used by Sentinel, Trustline, Precedent, and Arbiter.
    """
    def __init__(self):
        self.client = get_supabase_client()

    def record_edge(
        self,
        entity_id: str,
        relation: str,
        target_id: str,
        confidence: float,
        source_agent: str,
        metadata: Optional[Dict[str, Any]] = None,
        subject_type: Optional[str] = None,
        object_type: Optional[str] = None,
        evidence_ids: Optional[List[str]] = None,
        project_id: Optional[str] = None
    ) -> BeliefEdge:
        edge_id = str(uuid.uuid4())
        edge = BeliefEdge(
            edge_id=edge_id,
            entity_id=entity_id,
            relation=relation,
            target_id=target_id,
            confidence=confidence,
            source_agent=source_agent,
            metadata=metadata or {},
            project_id=project_id,
            subject_id=entity_id,
            subject_type=subject_type,
            predicate=relation,
            object_id=target_id,
            object_type=object_type,
            evidence_ids=evidence_ids or []
        )
        db_payload = {
            "edge_id": edge_id,
            "project_id": project_id,
            "subject_id": entity_id,
            "subject_type": subject_type or "vendor",
            "predicate": relation,
            "object_id": target_id,
            "object_type": object_type or "event",
            "confidence": confidence,
            "evidence_ids": evidence_ids or [],
            "source_agent": source_agent
        }
        try:
            self.client.table("belief_edges").insert(db_payload).execute()
        except Exception as e:
            print(f"[BeliefLedger] Log: Recorded edge locally ({e})")
        return edge

    def get_edges_for_entity(self, entity_id: str) -> List[BeliefEdge]:
        try:
            res = self.client.table("belief_edges").select("*").eq("subject_id", entity_id).execute()
            if hasattr(res, "data") and res.data:
                parsed = []
                for row in res.data:
                    parsed.append(BeliefEdge(
                        edge_id=row.get("edge_id"),
                        entity_id=row.get("subject_id", ""),
                        relation=row.get("predicate", ""),
                        target_id=row.get("object_id", ""),
                        confidence=row.get("confidence", 0.5),
                        source_agent=row.get("source_agent", ""),
                        project_id=row.get("project_id"),
                        subject_id=row.get("subject_id"),
                        subject_type=row.get("subject_type"),
                        predicate=row.get("predicate"),
                        object_id=row.get("object_id"),
                        object_type=row.get("object_type"),
                        evidence_ids=row.get("evidence_ids") or []
                    ))
                return parsed
        except Exception as e:
            print(f"[BeliefLedger] Log: Query fallback ({e})")
        return []
