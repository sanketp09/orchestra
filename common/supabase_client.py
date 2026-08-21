import os
from typing import Optional, Any, Dict, List

# Try to import supabase client, fallback to mock in-memory client if not installed/configured
try:
    from supabase import create_client, Client
    HAS_SUPABASE = True
except ImportError:
    HAS_SUPABASE = False
    Client = Any


class MockSupabaseClient:
    """In-memory fallback seeded with realistic procurement & vendor data."""
    def __init__(self):
        self.tables: Dict[str, List[Dict[str, Any]]] = {
            "belief_edges": [],
            "evidence": [],
            "receipts": [],
            "vendors": [
                {"vendor_id": "vendor_apex", "name": "Apex Rebar Supply", "projects": ["prj_riverside"]},
                {"vendor_id": "vendor_meridian", "name": "Meridian Steelworks", "projects": ["prj_riverside"]},
                {"vendor_id": "vendor_voltline", "name": "Voltline Electrical", "projects": ["prj_riverside"]},
                {"vendor_id": "V-001", "name": "Apex Rebar Supply", "projects": ["prj_riverside"]},
                {"vendor_id": "V-002", "name": "Meridian Steelworks", "projects": ["prj_riverside"]}
            ],
            "trust_profiles": [
                {
                    "vendor_id": "vendor_apex",
                    "schedule_reliability": 0.72,
                    "commercial_reliability": 0.68,
                    "claim_reliability": 0.55,
                    "quality_reliability": 0.88,
                    "financial_stability": 0.80,
                    "overall_trust": 0.726,
                    "last_updated": "2026-08-20T10:00:00Z"
                },
                {
                    "vendor_id": "V-001",
                    "schedule_reliability": 0.72,
                    "commercial_reliability": 0.68,
                    "claim_reliability": 0.55,
                    "quality_reliability": 0.88,
                    "financial_stability": 0.80,
                    "overall_trust": 0.726,
                    "last_updated": "2026-08-20T10:00:00Z"
                },
                {
                    "vendor_id": "vendor_meridian",
                    "schedule_reliability": 0.94,
                    "commercial_reliability": 0.92,
                    "claim_reliability": 0.95,
                    "quality_reliability": 0.96,
                    "financial_stability": 0.90,
                    "overall_trust": 0.934,
                    "last_updated": "2026-08-20T10:00:00Z"
                },
                {
                    "vendor_id": "V-002",
                    "schedule_reliability": 0.94,
                    "commercial_reliability": 0.92,
                    "claim_reliability": 0.95,
                    "quality_reliability": 0.96,
                    "financial_stability": 0.90,
                    "overall_trust": 0.934,
                    "last_updated": "2026-08-20T10:00:00Z"
                },
                {
                    "vendor_id": "vendor_voltline",
                    "schedule_reliability": 0.81,
                    "commercial_reliability": 0.75,
                    "claim_reliability": 0.62,
                    "quality_reliability": 0.90,
                    "financial_stability": 0.85,
                    "overall_trust": 0.786,
                    "last_updated": "2026-08-20T10:00:00Z"
                }
            ],
            "trust_events": [
                {
                    "event_id": "evt_001",
                    "vendor_id": "vendor_apex",
                    "event_type": "delay_claim",
                    "verified": True,
                    "external_cause": False,
                    "impact_dimension": "schedule_reliability",
                    "impact_delta": -0.08,
                    "source_agent": "sentinel",
                    "created_at": "2026-08-10T12:00:00Z"
                },
                {
                    "event_id": "evt_002",
                    "vendor_id": "V-001",
                    "event_type": "delay_claim",
                    "verified": True,
                    "external_cause": False,
                    "impact_dimension": "schedule_reliability",
                    "impact_delta": -0.08,
                    "source_agent": "sentinel",
                    "created_at": "2026-08-10T12:00:00Z"
                }
            ],
            "claims": [],
            "historical_cases": []
        }

    def table(self, table_name: str):
        parent = self

        class TableQuery:
            def __init__(self, name: str):
                self.name = name
                if name not in parent.tables:
                    parent.tables[name] = []
                self._filters: List[tuple] = []
                self._order_col = None
                self._order_desc = False
                self._limit_val = None
                self._update_payload = None

            def insert(self, data: Any):
                if isinstance(data, list):
                    parent.tables[self.name].extend(data)
                    self._inserted = data
                else:
                    parent.tables[self.name].append(data)
                    self._inserted = [data]
                return self

            def update(self, updates: dict):
                self._update_payload = updates
                return self

            def delete(self):
                self._delete_pending = True
                return self

            def select(self, *args, **kwargs):
                return self

            def eq(self, column: str, value: Any):
                self._filters.append((column, value))
                return self

            def order(self, column: str, desc: bool = False):
                self._order_col = column
                self._order_desc = desc
                return self

            def limit(self, count: int):
                self._limit_val = count
                return self

            def execute(self):
                rows = parent.tables.get(self.name, [])

                # Apply delete if pending
                if getattr(self, "_delete_pending", False):
                    deleted_rows = []
                    remaining_rows = []
                    for row in rows:
                        match = all(row.get(col) == val for col, val in self._filters)
                        if match:
                            deleted_rows.append(row)
                        else:
                            remaining_rows.append(row)
                    parent.tables[self.name] = remaining_rows
                    class MockDeleteResult:
                        def __init__(self, data):
                            self.data = data
                    return MockDeleteResult(deleted_rows)

                # Apply update if pending
                if self._update_payload is not None:
                    updated_rows = []
                    for row in rows:
                        match = all(row.get(col) == val for col, val in self._filters)
                        if match:
                            row.update(self._update_payload)
                            updated_rows.append(row)
                    class MockUpdateResult:
                        def __init__(self, data):
                            self.data = data
                    return MockUpdateResult(updated_rows)

                # Return inserted if insert called
                if hasattr(self, "_inserted"):
                    class MockInsertResult:
                        def __init__(self, data):
                            self.data = data
                    return MockInsertResult(self._inserted)

                # Filtering
                if self._filters:
                    rows = [
                        r for r in rows
                        if all(r.get(col) == val for col, val in self._filters)
                    ]

                # Ordering
                if self._order_col:
                    rows = sorted(rows, key=lambda x: str(x.get(self._order_col, "")), reverse=self._order_desc)

                # Limiting
                if self._limit_val is not None:
                    rows = rows[:self._limit_val]

                class MockResult:
                    def __init__(self, data):
                        self.data = data

                return MockResult(rows)

        return TableQuery(table_name)

    def rpc(self, fn_name: str, params: dict):
        parent = self

        class RpcQuery:
            def __init__(self, name: str, args: dict):
                self.name = name
                self.args = args

            def execute(self):
                if self.name == "match_historical_cases":
                    query_embedding = self.args.get("query_embedding") or []
                    match_case_type = self.args.get("match_case_type")
                    match_count = self.args.get("match_count") or 5

                    rows = parent.tables.get("historical_cases", [])
                    scored = []
                    for row in rows:
                        if match_case_type and row.get("case_type") != match_case_type:
                            continue

                        # Calculate similarity
                        row_emb = row.get("embedding")
                        similarity = 0.5
                        if isinstance(row_emb, list) and isinstance(query_embedding, list):
                            try:
                                dot_product = sum(a * b for a, b in zip(row_emb, query_embedding))
                                magnitude1 = sum(a * a for a in row_emb) ** 0.5
                                magnitude2 = sum(b * b for b in query_embedding) ** 0.5
                                if magnitude1 > 0 and magnitude2 > 0:
                                    similarity = dot_product / (magnitude1 * magnitude2)
                            except Exception:
                                similarity = 0.5

                        # Copy row and add similarity
                        item = dict(row)
                        item["similarity"] = similarity
                        scored.append(item)

                    # Sort by similarity descending
                    scored.sort(key=lambda x: x.get("similarity", 0), reverse=True)

                    class MockRpcResult:
                        def __init__(self, data):
                            self.data = data

                    return MockRpcResult(scored[:match_count])

                elif self.name == "rag_vector_search":
                    target_table = self.args.get("target_table")
                    text_column = self.args.get("text_column") or "extracted_text"
                    query_embedding = self.args.get("query_embedding") or []
                    filter_project_id = self.args.get("filter_project_id")
                    extra_filters = self.args.get("extra_filters") or {}
                    candidate_limit = self.args.get("candidate_limit") or 20
                    id_column = self.args.get("id_column") or "id"
                    source_id_column = self.args.get("source_id_column") or "source_id"

                    rows = parent.tables.get(target_table, [])
                    scored = []
                    for row in rows:
                        if filter_project_id and row.get("project_id") != filter_project_id:
                            continue
                        filter_match = True
                        for k, v in extra_filters.items():
                            if row.get(k) != v:
                                filter_match = False
                                break
                        if not filter_match:
                            continue

                        row_emb = row.get("embedding")
                        similarity = 0.5
                        if isinstance(row_emb, list) and isinstance(query_embedding, list):
                            try:
                                dot_product = sum(a * b for a, b in zip(row_emb, query_embedding))
                                magnitude1 = sum(a * a for a in row_emb) ** 0.5
                                magnitude2 = sum(b * b for b in query_embedding) ** 0.5
                                if magnitude1 > 0 and magnitude2 > 0:
                                    similarity = dot_product / (magnitude1 * magnitude2)
                            except Exception:
                                similarity = 0.5

                        scored.append({
                            "row_id": str(row.get(id_column)),
                            "source_id": str(row.get(source_id_column)),
                            "chunk_text": str(row.get(text_column, "")),
                            "score": similarity,
                            "metadata": {k: v for k, v in row.items() if k not in [id_column, source_id_column, text_column, "embedding"]}
                        })

                    scored.sort(key=lambda x: x.get("score", 0.0), reverse=True)

                    class MockRpcResult:
                        def __init__(self, data):
                            self.data = data
                    return MockRpcResult(scored[:candidate_limit])

                elif self.name == "rag_keyword_search":
                    target_table = self.args.get("target_table")
                    text_column = self.args.get("text_column") or "extracted_text"
                    query_text = self.args.get("query_text") or ""
                    filter_project_id = self.args.get("filter_project_id")
                    extra_filters = self.args.get("extra_filters") or {}
                    candidate_limit = self.args.get("candidate_limit") or 20
                    id_column = self.args.get("id_column") or "id"
                    source_id_column = self.args.get("source_id_column") or "source_id"

                    rows = parent.tables.get(target_table, [])
                    scored = []
                    query_words = set(query_text.lower().split())
                    for row in rows:
                        if filter_project_id and row.get("project_id") != filter_project_id:
                            continue
                        filter_match = True
                        for k, v in extra_filters.items():
                            if row.get(k) != v:
                                filter_match = False
                                break
                        if not filter_match:
                            continue

                        chunk_text_val = str(row.get(text_column, ""))
                        text_words = set(chunk_text_val.lower().split())
                        overlap = len(query_words.intersection(text_words))
                        score = float(overlap) / float(max(len(query_words), 1))

                        scored.append({
                            "row_id": str(row.get(id_column)),
                            "source_id": str(row.get(source_id_column)),
                            "chunk_text": chunk_text_val,
                            "score": score,
                            "metadata": {k: v for k, v in row.items() if k not in [id_column, source_id_column, text_column, "embedding"]}
                        })

                    scored.sort(key=lambda x: x.get("score", 0.0), reverse=True)

                    class MockRpcResult:
                        def __init__(self, data):
                            self.data = data
                    return MockRpcResult(scored[:candidate_limit])

                class MockRpcEmptyResult:
                    def __init__(self):
                        self.data = []
                return MockRpcEmptyResult()

        return RpcQuery(fn_name, params)



_supabase_instance: Optional[Any] = None


def get_supabase_client():
    """
    Returns configured Supabase client or robust in-memory mock client.
    """
    global _supabase_instance
    if _supabase_instance is not None:
        return _supabase_instance

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")

    if HAS_SUPABASE and url and key:
        try:
            _supabase_instance = create_client(url, key)
            return _supabase_instance
        except Exception as e:
            print(f"[SupabaseClient] Warning: Failed to init Supabase client ({e}). Using mock client.")

    _supabase_instance = MockSupabaseClient()
    return _supabase_instance


def get_client():
    """Alias for get_supabase_client used across services."""
    return get_supabase_client()
