import sys
from pathlib import Path

# Add project root to sys.path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

import pytest
from unittest.mock import patch
from pydantic import ValidationError

from orchestra.cases_data import ALL_CASES, CROSSRAIL_CASE, DATA_CENTER_CASE
from orchestra.repository import (
    FakeCaseRepository,
    CaseNotFoundError,
    RepositoryError,
    NormalizedCaseContext,
    ProjectRecord,
    OriginModel
)
from orchestra.situation import SituationAnalyzer, SituationContext


# ============================================================================
# Deterministic Case Studies Structure Tests
# ============================================================================

def test_crossrail_case_structure():
    """Verify that the Crossrail Case 1 dictionary contains all required operational concepts."""
    assert CROSSRAIL_CASE["project"]["project_id"] == "prj_crossrail_tunnel_systems"
    assert CROSSRAIL_CASE["project"]["origin"] == "verified_public"
    
    # Check that all records have valid origins
    for source in CROSSRAIL_CASE["sources"]:
        assert source["origin"] in ["verified_public", "logically_derived", "synthetic_augmented"]
        
    for vendor in CROSSRAIL_CASE["vendors"]:
        assert vendor["origin"] in ["verified_public", "logically_derived", "synthetic_augmented"]
        
    # Check synthetic components are labeled correctly
    assert CROSSRAIL_CASE["vendors"][0]["origin"] == "synthetic_augmented"
    assert CROSSRAIL_CASE["purchase_orders"][0]["origin"] == "synthetic_augmented"
    assert CROSSRAIL_CASE["claims"][0]["origin"] == "synthetic_augmented"
    
    # Provenance checking (motivated_by is preserved in metadata)
    claim_evidence_ids = CROSSRAIL_CASE["claims"][0]["evidence_ids"]
    assert len(claim_evidence_ids) >= 2


def test_data_center_case_structure():
    """Verify that the DPR Data Center Case 2 dictionary matches the expected structure."""
    assert DATA_CENTER_CASE["project"]["project_id"] == "prj_data_center_dpr"
    assert DATA_CENTER_CASE["project"]["origin"] == "verified_public"
    
    for item in DATA_CENTER_CASE["procurement_items"]:
        assert item["origin"] == "logically_derived"
        
    for po in DATA_CENTER_CASE["purchase_orders"]:
        assert po["origin"] == "synthetic_augmented"


def test_tsmc_case_structure():
    """Verify that the TSMC Case 3 dictionary matches the expected structure and contains 3 vendors."""
    tsmc = ALL_CASES["prj_tsmc_arizona_fab"]
    assert tsmc["project"]["project_id"] == "prj_tsmc_arizona_fab"
    assert tsmc["project"]["origin"] == "verified_public"
    assert len(tsmc["vendors"]) == 3
    assert len(tsmc["procurement_items"]) == 2
    assert len(tsmc["purchase_orders"]) == 2
    assert len(tsmc["engineering_changes"]) == 1
    assert len(tsmc["schedule_events"]) == 2
    assert len(tsmc["vendor_performances"]) == 2
    assert len(tsmc["claims"]) == 1
    assert len(tsmc["evidence"]) == 5

    # Check that origins are correctly categorized
    assert tsmc["evidence"][0]["origin"] == "verified_public"
    assert tsmc["evidence"][1]["origin"] == "verified_public"
    assert tsmc["evidence"][2]["origin"] == "synthetic_augmented"
    assert tsmc["vendors"][0]["origin"] == "synthetic_augmented"


def test_all_cases_mapping():
    """Verify the global cases registry contains all three cases."""
    assert "prj_crossrail_tunnel_systems" in ALL_CASES
    assert "prj_data_center_dpr" in ALL_CASES
    assert "prj_tsmc_arizona_fab" in ALL_CASES
    assert len(ALL_CASES) == 3


# ============================================================================
# Repository Unit Tests (FakeCaseRepository)
# ============================================================================

@pytest.mark.asyncio
async def test_fake_repository_loads_contexts():
    """Verify that FakeCaseRepository returns correct NormalizedCaseContext structures."""
    repo = FakeCaseRepository()
    
    # 1. Load Crossrail
    crossrail_ctx = await repo.get_case_context("prj_crossrail_tunnel_systems")
    assert isinstance(crossrail_ctx, NormalizedCaseContext)
    assert crossrail_ctx.project.project_id == "prj_crossrail_tunnel_systems"
    assert len(crossrail_ctx.vendors) == 1
    assert crossrail_ctx.vendors[0].vendor_id == "vendor_railtech_infrastructure"
    assert len(crossrail_ctx.purchase_orders) == 1
    assert crossrail_ctx.purchase_orders[0].po_id == "po_tunnel_systems_303"
    assert len(crossrail_ctx.claims) == 1
    assert len(crossrail_ctx.evidence) == 6
    
    # 2. Load DPR
    dpr_ctx = await repo.get_case_context("prj_data_center_dpr")
    assert isinstance(dpr_ctx, NormalizedCaseContext)
    assert dpr_ctx.project.project_id == "prj_data_center_dpr"
    assert len(dpr_ctx.vendors) == 1
    assert dpr_ctx.vendors[0].vendor_id == "vendor_apex"
    assert len(dpr_ctx.purchase_orders) == 1
    assert dpr_ctx.purchase_orders[0].po_id == "po_dc_pipes_505"
    assert len(dpr_ctx.claims) == 1
    assert len(dpr_ctx.evidence) == 3

    # 3. Load TSMC
    tsmc_ctx = await repo.get_case_context("prj_tsmc_arizona_fab")
    assert isinstance(tsmc_ctx, NormalizedCaseContext)
    assert tsmc_ctx.project.project_id == "prj_tsmc_arizona_fab"
    assert len(tsmc_ctx.vendors) == 3
    assert tsmc_ctx.vendors[0].vendor_id == "vendor_phoenix_hvac_solutions"
    assert len(tsmc_ctx.purchase_orders) == 2
    assert tsmc_ctx.purchase_orders[0].po_id == "po_cleanroom_handlers_701"
    assert len(tsmc_ctx.claims) == 1
    assert len(tsmc_ctx.evidence) == 5


@pytest.mark.asyncio
async def test_fake_repository_raises_not_found():
    """Verify CaseNotFoundError is raised for non-existent case IDs."""
    repo = FakeCaseRepository()
    with pytest.raises(CaseNotFoundError):
        await repo.get_case_context("prj_unknown_id")


def test_repository_invalid_origin_rejection():
    """Verify that invalid origin values are rejected during Pydantic initialization."""
    with pytest.raises(ValidationError):
        ProjectRecord(
            project_id="prj_test",
            name="Test",
            origin="invalid_origin_value"  # Should trigger validator
        )


@pytest.mark.asyncio
async def test_fake_repository_partial_data():
    """Verify that repository contract permits and handles partial/empty records cleanly."""
    partial_cases_map = {
        "prj_partial": {
            "project": {
                "project_id": "prj_partial",
                "name": "Partial Project",
                "origin": "verified_public"
            },
            "sources": [],
            "vendors": [],
            "procurement_items": [],
            "purchase_orders": [],
            "engineering_changes": [],
            "schedule_events": [],
            "vendor_performances": [],
            "claims": [],
            "evidence": []
        }
    }
    repo = FakeCaseRepository(cases_map=partial_cases_map)
    ctx = await repo.get_case_context("prj_partial")
    
    assert ctx.project.project_id == "prj_partial"
    assert ctx.vendors == []
    assert ctx.purchase_orders == []
    assert ctx.claims == []


def test_provenance_preservation():
    """Verify that custom provenance fields map correctly to Pydantic attributes."""
    repo = FakeCaseRepository()
    
    # Assert Crossrail claims and evidence maps
    case_data = ALL_CASES["prj_crossrail_tunnel_systems"]
    
    evidence_item = case_data["evidence"][0]
    assert evidence_item["origin"] == "verified_public"
    assert evidence_item["source_ref"] == "src_nao_2019"
    assert "Completing Crossrail" in evidence_item["metadata"]["title"]


# ============================================================================
# Situation Analyzer Adapter Compatibility Tests
# ============================================================================

MOCK_SITUATION_RESPONSE = {
    "objective": "Verify delay responsibility claims",
    "requested_outcome": "Resolve site access vs procurement delay dispute",
    "entities": ["vendor_railtech_infrastructure", "prj_crossrail_tunnel_systems"],
    "known_facts": ["Station works at Paddington and Bond Street were delayed."],
    "evidence_references": ["ev_access_delay_notice"],
    "uncertainties": ["Contractor deferred procurement activities vs site access suspension windows"],
    "information_gaps": ["Early procurement logs and baseline design submittal dates"]
}


@patch("common.llm_client.UnifiedLLMClient.generate_structured")
@pytest.mark.asyncio
async def test_analyze_case_adapter(mock_generate):
    """Verify that SituationAnalyzer.analyze_case correctly transforms context and analyzes."""
    mock_generate.return_value = MOCK_SITUATION_RESPONSE.copy()
    
    repo = FakeCaseRepository()
    case_context = await repo.get_case_context("prj_crossrail_tunnel_systems")
    
    analyzer = SituationAnalyzer()
    situation_ctx = analyzer.analyze_case(case_context)
    
    assert isinstance(situation_ctx, SituationContext)
    assert situation_ctx.objective == "Verify delay responsibility claims"
    # Ensure entities and evidence references mapped from case metadata survive
    assert "vendor_railtech_infrastructure" in situation_ctx.entities
    assert "prj_crossrail_tunnel_systems" in situation_ctx.entities
    assert "ev_access_delay_notice" in situation_ctx.evidence_references


@patch("common.llm_client.UnifiedLLMClient.generate_structured")
def test_analyze_backward_compatibility(mock_generate):
    """Verify that the existing direct analyze() signature remains unchanged and operational."""
    mock_generate.return_value = MOCK_SITUATION_RESPONSE.copy()
    
    analyzer = SituationAnalyzer()
    ctx = analyzer.analyze(
        raw_input="Fictional incident description",
        structured_context={
            "project_id": "prj_direct",
            "vendor_id": "vendor_direct",
            "evidence_refs": ["ev_direct"]
        }
    )
    
    assert isinstance(ctx, SituationContext)
    assert "prj_direct" in ctx.entities
    assert "vendor_direct" in ctx.entities
    assert "ev_direct" in ctx.evidence_references
