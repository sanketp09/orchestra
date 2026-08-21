from __future__ import annotations
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, field_validator, ValidationError

from common.supabase_client import get_supabase_client


# ============================================================================
# Repository Exceptions
# ============================================================================

class CaseNotFoundError(Exception):
    """Raised when a specific project/case ID cannot be found in the data store."""
    pass


class RepositoryError(Exception):
    """Raised when an active database error or schema validation failure occurs."""
    pass


# ============================================================================
# Standardized Provenance & Origin Base
# ============================================================================

class OriginModel(BaseModel):
    """Base Pydantic model enforcing strict provenance origins."""
    origin: str

    @field_validator("origin")
    @classmethod
    def validate_origin(cls, v: str) -> str:
        allowed = ["verified_public", "logically_derived", "synthetic_augmented"]
        if v not in allowed:
            raise ValueError(f"Invalid data origin value '{v}'. Must be one of {allowed}")
        return v


# ============================================================================
# Concept Record Schema Contracts
# ============================================================================

class ProjectRecord(OriginModel):
    project_id: str
    name: str
    description: Optional[str] = None
    scenario_type: Optional[str] = None
    real_world_basis: Optional[str] = None


class VendorRecord(OriginModel):
    vendor_id: str
    name: str
    projects: List[str] = Field(default_factory=list)
    category: Optional[str] = None


class ProcurementItemRecord(OriginModel):
    item_id: str
    project_id: str
    description: str
    category: Optional[str] = None
    criticality: Optional[str] = None
    lead_time_days: Optional[int] = None


class PORecord(OriginModel):
    po_id: str
    project_id: str
    vendor_id: str
    procurement_item_id: str
    issue_date: str
    original_delivery_date: str
    revised_delivery_date: Optional[str] = None
    status: str
    value_range: Optional[str] = None


class EngineeringChangeRecord(OriginModel):
    change_id: str
    project_id: str
    affected_entity: str
    revision_date: str
    description: str
    impact: Optional[str] = None


class ScheduleEventRecord(OriginModel):
    event_id: str
    project_id: str
    event_date: str
    affected_work_package: str
    description: str
    impact: Optional[str] = None


class VendorPerformanceRecord(OriginModel):
    performance_id: str
    vendor_id: str
    project_id: str
    metric: str
    value: float
    context: Optional[str] = None
    event_date: str


class ClaimRecord(OriginModel):
    claim_id: str
    project_id: str
    vendor_id: Optional[str] = None
    claim_text: str
    status: Optional[str] = "unverified"
    confidence: Optional[float] = 0.5
    evidence_ids: List[str] = Field(default_factory=list)
    source_agent: Optional[str] = None


class EvidenceRecord(OriginModel):
    evidence_id: str
    project_id: str
    vendor_id: Optional[str] = None
    source_type: Optional[str] = None
    source_ref: Optional[str] = None
    extracted_text: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    confidence: Optional[float] = 1.0


class SourceRecord(OriginModel):
    source_id: str
    project_id: str
    title: str
    organization: Optional[str] = None
    source_url: Optional[str] = None
    source_type: Optional[str] = None
    source_tier: Optional[str] = None


# ============================================================================
# Unified Case Context
# ============================================================================

class NormalizedCaseContext(BaseModel):
    """
    Standardized, source-agnostic data contract packaging all records
    retrieved for a specific validation case.
    """
    project: ProjectRecord
    vendors: List[VendorRecord] = Field(default_factory=list)
    procurement_items: List[ProcurementItemRecord] = Field(default_factory=list)
    purchase_orders: List[PORecord] = Field(default_factory=list)
    engineering_changes: List[EngineeringChangeRecord] = Field(default_factory=list)
    schedule_events: List[ScheduleEventRecord] = Field(default_factory=list)
    vendor_performances: List[VendorPerformanceRecord] = Field(default_factory=list)
    claims: List[ClaimRecord] = Field(default_factory=list)
    evidence: List[EvidenceRecord] = Field(default_factory=list)
    sources: List[SourceRecord] = Field(default_factory=list)


# ============================================================================
# Repository Implementations
# ============================================================================

class BaseCaseRepository(ABC):
    """Abstract interface defining the Case Study data access contract."""
    @abstractmethod
    async def get_case_context(self, project_id: str) -> NormalizedCaseContext:
        pass


class SupabaseCaseRepository(BaseCaseRepository):
    """Concrete repository querying records from the connected Supabase DB."""
    async def get_case_context(self, project_id: str) -> NormalizedCaseContext:
        client = get_supabase_client()

        # 1. Fetch project case metadata (checking case existence)
        try:
            proj_res = client.table("projects").select("*").eq("project_id", project_id).execute()
        except Exception as e:
            raise RepositoryError(f"Database query failed during project lookup: {str(e)}") from e

        if not proj_res.data:
            raise CaseNotFoundError(f"Project case with ID '{project_id}' not found.")

        # 2. Fetch related entities
        try:
            # Query vendors globally and filter locally to remain compatible with both Mock client & real Supabase
            all_vendors = client.table("vendors").select("*").execute().data or []
            vendors = [v for v in all_vendors if project_id in v.get("projects", [])]

            items = client.table("procurement_items").select("*").eq("project_id", project_id).execute().data or []
            pos = client.table("purchase_orders").select("*").eq("project_id", project_id).execute().data or []
            changes = client.table("engineering_changes").select("*").eq("project_id", project_id).execute().data or []
            sched_events = client.table("schedule_events").select("*").eq("project_id", project_id).execute().data or []
            perf = client.table("vendor_performances").select("*").eq("project_id", project_id).execute().data or []
            claims = client.table("claims").select("*").eq("project_id", project_id).execute().data or []
            evidence = client.table("evidence").select("*").eq("project_id", project_id).execute().data or []
            sources = client.table("sources").select("*").eq("project_id", project_id).execute().data or []

            # 3. Compile and validate NormalizedCaseContext
            return NormalizedCaseContext(
                project=ProjectRecord.model_validate(proj_res.data[0]),
                vendors=[VendorRecord.model_validate(v) for v in vendors],
                procurement_items=[ProcurementItemRecord.model_validate(i) for i in items],
                purchase_orders=[PORecord.model_validate(p) for p in pos],
                engineering_changes=[EngineeringChangeRecord.model_validate(c) for c in changes],
                schedule_events=[ScheduleEventRecord.model_validate(s) for s in sched_events],
                vendor_performances=[VendorPerformanceRecord.model_validate(v) for v in perf],
                claims=[ClaimRecord.model_validate(c) for c in claims],
                evidence=[EvidenceRecord.model_validate(e) for e in evidence],
                sources=[SourceRecord.model_validate(s) for s in sources]
            )
        except ValidationError as e:
            raise RepositoryError(f"Data contract validation error: {str(e)}") from e
        except Exception as e:
            raise RepositoryError(f"Database query failed: {str(e)}") from e


class FakeCaseRepository(BaseCaseRepository):
    """
    Fake repository for isolated Level A unit testing, using
    the canonical cases_data module as a single source of truth.
    """
    def __init__(self, cases_map: dict = None):
        if cases_map is not None:
            self.cases = cases_map
        else:
            from orchestra.cases_data import ALL_CASES
            self.cases = ALL_CASES

    async def get_case_context(self, project_id: str) -> NormalizedCaseContext:
        if project_id not in self.cases:
            raise CaseNotFoundError(f"Project case with ID '{project_id}' not found.")

        case_data = self.cases[project_id]
        try:
            return NormalizedCaseContext(
                project=ProjectRecord.model_validate(case_data["project"]),
                vendors=[VendorRecord.model_validate(v) for v in case_data["vendors"]],
                procurement_items=[ProcurementItemRecord.model_validate(i) for i in case_data["procurement_items"]],
                purchase_orders=[PORecord.model_validate(p) for p in case_data["purchase_orders"]],
                engineering_changes=[EngineeringChangeRecord.model_validate(c) for c in case_data["engineering_changes"]],
                schedule_events=[ScheduleEventRecord.model_validate(s) for s in case_data["schedule_events"]],
                vendor_performances=[VendorPerformanceRecord.model_validate(v) for v in case_data["vendor_performances"]],
                claims=[ClaimRecord.model_validate(c) for c in case_data["claims"]],
                evidence=[EvidenceRecord.model_validate(e) for e in case_data["evidence"]],
                sources=[SourceRecord.model_validate(s) for s in case_data["sources"]]
            )
        except ValidationError as e:
            raise RepositoryError(f"Data contract validation error: {str(e)}") from e
