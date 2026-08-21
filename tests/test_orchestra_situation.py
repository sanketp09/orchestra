import sys
from pathlib import Path

# Add project root and sentinel to sys.path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "sentinel"))

import pytest
from unittest.mock import patch
from pydantic import ValidationError

from orchestra.state import OrchestraState
from orchestra.registry import CapabilityRegistry
from orchestra.situation import SituationContext, SituationAnalyzer, SituationAnalysisError


# Mocked data templates corresponding to what real LLM or local parsing would output
MOCK_WEATHER_CONTEXT = {
    "objective": "Verify weather-related delay claim",
    "requested_outcome": "Determine contract extension and delay penalty applicability",
    "entities": [],
    "known_facts": ["Subcontractor submitted a delay claim for monsoon rain events."],
    "evidence_references": [],
    "uncertainties": ["Whether rain intensity exceeded contractual stand-down thresholds"],
    "information_gaps": ["Daily weather station logs"],
    "constraints": ["Contractual stand-down threshold definitions"],
    "urgency": "medium",
    "risk_indicators": ["Potential liquidated damages penalty dispute"],
    "confidence": 0.9
}

MOCK_INVOICE_CONTEXT = {
    "objective": "Verify contractor payment application and invoice variance",
    "requested_outcome": "Approve or adjust billing amounts based on verified work",
    "entities": [],
    "known_facts": ["Invoice submitted for steel/rebar unit cost verification."],
    "evidence_references": [],
    "uncertainties": ["Invoiced unit price vs active PO master rate"],
    "information_gaps": ["Approved PO terms"],
    "constraints": ["PO maximum budget caps"],
    "urgency": "high",
    "risk_indicators": ["Overbilling exposure"],
    "confidence": 0.95
}


# ============================================================================
# Phase 2 — Situation Understanding Tests
# ============================================================================

def test_structured_metadata_preservation():
    analyzer = SituationAnalyzer()
    
    # Check normalization directly
    deterministic = analyzer.normalize_deterministic_context(
        raw_input="Monsoon rain delay",
        structured_context={
            "project_id": "prj_riverside",
            "vendor_id": "vendor_meridian",
            "evidence_refs": ["ev_s1_1", "ev_s1_2"]
        }
    )
    
    assert "prj_riverside" in deterministic["entities"]
    assert "vendor_meridian" in deterministic["entities"]
    assert "ev_s1_1" in deterministic["evidence_references"]
    assert "ev_s1_2" in deterministic["evidence_references"]


@patch("common.llm_client.UnifiedLLMClient.generate_structured")
def test_procurement_event_semantic_interpretation(mock_generate):
    analyzer = SituationAnalyzer()
    
    # 1. Test weather delay parsing
    mock_generate.return_value = MOCK_WEATHER_CONTEXT.copy()
    ctx = analyzer.analyze(
        raw_input="Subcontractor submitted a progress claim delay in July due to heavy monsoon rain.",
        structured_context={"project_id": "prj_riverside", "vendor_id": "vendor_meridian"}
    )
    
    assert isinstance(ctx, SituationContext)
    assert ctx.objective == "Verify weather-related delay claim"
    assert "monsoon rain" in str(ctx.known_facts).lower() or "delay claim" in str(ctx.known_facts).lower()
    assert "vendor_meridian" in ctx.entities
    assert "prj_riverside" in ctx.entities
    assert ctx.confidence > 0.0
    
    # 2. Test billing/invoice issue parsing
    mock_generate.return_value = MOCK_INVOICE_CONTEXT.copy()
    ctx_invoice = analyzer.analyze(
        raw_input="We received a payment application invoice from Apex Rebar and need to verify the billing unit cost against PO terms.",
        structured_context={"project_id": "prj_apex", "vendor_id": "vendor_apex"}
    )
    
    assert ctx_invoice.objective == "Verify contractor payment application and invoice variance"
    assert "vendor_apex" in ctx_invoice.entities
    assert ctx_invoice.urgency == "high"


@patch("common.llm_client.UnifiedLLMClient.generate_structured")
def test_uncertainties_and_gaps_distinguished(mock_generate):
    analyzer = SituationAnalyzer()
    mock_generate.return_value = MOCK_WEATHER_CONTEXT.copy()
    
    ctx = analyzer.analyze(
        raw_input="Subcontractor delay claim during monsoon rain.",
        structured_context={"project_id": "prj_riverside"}
    )
    
    # In SituationContext, known_facts, uncertainties, and information_gaps should be separated
    assert isinstance(ctx.known_facts, list)
    assert len(ctx.known_facts) > 0
    
    assert isinstance(ctx.uncertainties, list)
    assert len(ctx.uncertainties) > 0
    
    assert isinstance(ctx.information_gaps, list)
    assert len(ctx.information_gaps) > 0
    
    # Assert that gaps and uncertainties represent different strings
    assert not set(ctx.uncertainties).intersection(set(ctx.known_facts))


@patch("common.llm_client.UnifiedLLMClient.generate_structured")
def test_invalid_llm_structured_output_rejection(mock_generate):
    analyzer = SituationAnalyzer()
    
    # Mock structured output that fails validation against SituationContext (e.g. missing objective)
    mock_generate.return_value = {
        # missing objective and requested_outcome
        "entities": ["vendor_meridian"]
    }
    
    with pytest.raises(SituationAnalysisError) as exc_info:
        analyzer.analyze(
            raw_input="Delay claim weather monsoon",
            structured_context={"project_id": "prj_riverside"}
        )
    
    assert "Validation error" in str(exc_info.value)
    
    # Verify deterministic metadata is preserved in partial context
    partial = exc_info.value.partial_context
    assert partial is not None
    assert "prj_riverside" in partial.entities
    assert partial.objective == "Interpretation Failed"


# ============================================================================
# Phase 1 Compatibility Verification
# ============================================================================

def test_phase_1_compatibility_continues_to_work():
    # Registry must load all capabilities
    registry = CapabilityRegistry()
    cap = registry.get("sentinel.verify_claim")
    assert cap.specialist == "sentinel"
    assert cap.canonical_endpoint == "/sentinel/execute"


# ============================================================================
# E2E Realistic Situation Loop Test
# ============================================================================

@patch("common.llm_client.UnifiedLLMClient.generate_structured")
def test_e2e_raw_input_to_state_attachment(mock_generate):
    analyzer = SituationAnalyzer()
    mock_generate.return_value = MOCK_WEATHER_CONTEXT.copy()
    
    # Initial OrchestraState for run
    state = OrchestraState(
        run_id="run_e2e_situation_1",
        project_id="prj_riverside",
        objective="Verify raw delay alert"
    )
    
    raw_input = "Subcontractor claims schedule delay of 14 days due to heavy monsoon rain stand down in July."
    structured = {
        "project_id": state.project_id,
        "vendor_id": "vendor_meridian",
        "evidence_refs": ["delay_claim_submittal.pdf"]
    }
    
    # 1. Analyze raw input
    ctx = analyzer.analyze(raw_input, structured)
    assert isinstance(ctx, SituationContext)
    
    # 2. Attach to OrchestraState
    state.situation = ctx
    state.status = "RUNNING"
    
    # 3. Verify state integrity
    assert state.situation is not None
    assert state.situation.objective == "Verify weather-related delay claim"
    assert "vendor_meridian" in state.situation.entities
    assert "prj_riverside" in state.situation.entities
    assert "delay_claim_submittal.pdf" in state.situation.evidence_references
    assert state.status == "RUNNING"
