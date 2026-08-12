"""
Unit tests for SENTINEL CORE Engine & 9 Feature Verification Logic
"""

import pytest
from app.services.sentinel_core import (
    classify_procurement_intent,
    process_sentinel_verification,
    FEATURE_METADATA
)


def test_feature_metadata_has_all_9_features():
    assert len(FEATURE_METADATA) == 9
    expected_ids = {
        "duplicate_conflicting_order",
        "delay_excuse_verification",
        "missing_purchase_detector",
        "bid_integrity_collusion",
        "material_authentication",
        "factory_cloud",
        "statutory_deadline_tracker",
        "pay_application_installation_proof",
        "payment_wage_integrity"
    }
    assert set(FEATURE_METADATA.keys()) == expected_ids


@pytest.mark.parametrize("input_text,expected_feature", [
    ("PO-1042 rebar grade 60 duplicate order check", "duplicate_conflicting_order"),
    ("Subcontractor claims 14 day delay due to monsoon rain on site", "delay_excuse_verification"),
    ("Site audit found unbooked HVAC ducting installed without PO", "missing_purchase_detector"),
    ("Bid package submittal unit price outlier collusion check", "bid_integrity_collusion"),
    ("Heat stamp #74829 mill test certificate MTC authentication", "material_authentication"),
    ("Shreeji factory IoT machine telemetry progress ORD-4471", "factory_cloud"),
    ("Statutory 20-day preliminary lien notice filing deadline", "statutory_deadline_tracker"),
    ("Pay Application #7 visual photo proof electrical rough-in 90%", "pay_application_installation_proof"),
    ("Certified payroll WH-347 prevailing wage rate underpayment", "payment_wage_integrity"),
])
def test_classifier_intent(input_text, expected_feature):
    assert classify_procurement_intent(input_text) == expected_feature


def test_execution_returns_strict_output_contract():
    for feature_id in FEATURE_METADATA.keys():
        sample_input = f"Testing verification for feature {feature_id}"
        result = process_sentinel_verification(sample_input)
        
        # Verify strict output contract fields
        assert hasattr(result, "claim")
        assert result.verdict in ["verified", "contradicted", "uncertain"]
        assert 0.0 <= result.confidence <= 1.0
        assert isinstance(result.evidence, list)
        assert len(result.evidence) > 0
        assert isinstance(result.reasoning, str)
        assert isinstance(result.writes_to, list)
        assert isinstance(result.needs_human, bool)
        
        # Check evidence item structure
        for ev in result.evidence:
            assert ev.reliability_tier in ["self_reported", "third_party_observed", "verified_transaction"]
            assert ev.source
            assert ev.raw_ref
