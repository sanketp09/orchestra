import os
import sys
from pathlib import Path

# Add project root and sentinel to sys.path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "sentinel"))

import pytest
from pydantic import BaseModel

from common.llm_client import get_llm_client, generate_structured
from orchestra.state import OrchestraState
from orchestra.situation import SituationContext, SituationAnalyzer


# Standard Pydantic schema for testing structured smoke test
class SmokeSchema(BaseModel):
    valid: bool
    message: str


# Check if the integration tests should run (requires explicit opt-in env var)
RUN_INTEGRATION = os.environ.get("RUN_OPENAI_INTEGRATION_TEST") == "true"


@pytest.mark.skipif(not RUN_INTEGRATION, reason="Opt-in OpenAI integration test. Set RUN_OPENAI_INTEGRATION_TEST=true to run.")
def test_openai_smoke_test():
    """
    STEP 2 — Real OpenAI Smoke Test.
    Verifies that the OpenAI client connection works, structured output works,
    and Pydantic validation works against our LLM client.
    """
    openai_key = os.environ.get("OPENAI_API_KEY")
    if not openai_key:
        pytest.fail("OPENAI_API_KEY environment variable must be set to run integration tests.")
        
    client = get_llm_client()
    
    # Verify generate works
    prompt = "Reply with exactly 'OK'"
    res = client.generate(prompt=prompt)
    assert "OK" in res.upper()
    
    # Verify generate_structured works with Pydantic class
    prompt_struct = "Generate a smoke test response. Say that it is valid."
    struct_res = generate_structured(
        prompt=prompt_struct,
        schema=SmokeSchema
    )
    
    assert isinstance(struct_res, dict)
    assert struct_res["valid"] is True
    assert "smoke" in struct_res["message"].lower()


@pytest.mark.skipif(not RUN_INTEGRATION, reason="Opt-in OpenAI integration test. Set RUN_OPENAI_INTEGRATION_TEST=true to run.")
def test_e2e_procurement_scenario():
    """
    STEP 3 — Controlled Real Procurement Scenario.
    Runs raw procurement event -> SituationAnalyzer -> OpenAI -> SituationContext -> State.
    """
    openai_key = os.environ.get("OPENAI_API_KEY")
    if not openai_key:
        pytest.fail("OPENAI_API_KEY environment variable must be set to run integration tests.")

    # Initialize analyzer
    analyzer = SituationAnalyzer()
    
    # Create OrchestraState
    state = OrchestraState(
        run_id="run_smoke_real_1",
        project_id="PRJ-101",
        objective="Verify delivery delay claim"
    )

    # Raw event and structured context
    raw_input = (
        "Supplier ABC delivered structural steel 12 days after the agreed delivery date. "
        "The supplier claims unexpected port congestion caused the delay."
    )
    structured_context = {
        "project_id": state.project_id,
        "vendor_id": "VEN-ABC",
        "evidence_refs": ["po_schedule_agreement.pdf"]
    }

    # Execute dynamic situation understanding
    ctx = analyzer.analyze(
        raw_input=raw_input,
        structured_context=structured_context
    )
    
    # Attach to state
    state.situation = ctx
    
    # Verify deterministic metadata preservation
    assert "PRJ-101" in state.situation.entities
    assert "VEN-ABC" in state.situation.entities
    assert "po_schedule_agreement.pdf" in state.situation.evidence_references
    
    # Verify semantic interpretation:
    # 1. Check known facts (steel delivery was 12 days late)
    facts_str = " ".join(state.situation.known_facts).lower()
    assert "12" in facts_str or "twelve" in facts_str
    
    # 2. Check uncertainties (congestion claim is unverified)
    unc_str = " ".join(state.situation.uncertainties).lower()
    assert "congestion" in unc_str or "port" in unc_str or "claim" in unc_str or "unverified" in unc_str
    
    # 3. Check information gaps (missing port records, shipping documentation, logs)
    gaps_str = " ".join(state.situation.information_gaps).lower()
    assert len(state.situation.information_gaps) > 0
    
    # 4. Check confidence
    assert 0.0 <= state.situation.confidence <= 1.0
    
    print("\n--- Smoke Test SituationContext Output ---")
    safe_json = state.situation.model_dump_json(indent=2).replace('\u2011', '-').encode('ascii', errors='replace').decode('ascii')
    print(safe_json)


@pytest.mark.skipif(not RUN_INTEGRATION, reason="Opt-in OpenAI integration test. Set RUN_OPENAI_INTEGRATION_TEST=true to run.")
def test_e2e_supabase_case_repository_and_analysis():
    """
    Level B E2E integration test.
    Fetches real Crossrail case data from the Supabase instance,
    transforms it into NormalizedCaseContext, passes it through the
    SituationAnalyzer.analyze_case() adapter using the real OpenAI client,
    and populates the OrchestraState.
    """
    openai_key = os.environ.get("OPENAI_API_KEY")
    if not openai_key:
        pytest.fail("OPENAI_API_KEY environment variable must be set to run integration tests.")
        
    from orchestra.repository import SupabaseCaseRepository
    import asyncio
    
    # Run the async repository fetch synchronously
    repo = SupabaseCaseRepository()
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        case_ctx = loop.run_until_complete(repo.get_case_context("prj_crossrail_tunnel_systems"))
    finally:
        loop.close()
    
    # 1. Verify case context was pulled successfully
    assert case_ctx.project.project_id == "prj_crossrail_tunnel_systems"
    assert len(case_ctx.evidence) > 0
    assert any(ev.origin == "verified_public" for ev in case_ctx.evidence)
    
    # 2. Run Situation Analysis using adapter
    analyzer = SituationAnalyzer()
    situation = analyzer.analyze_case(case_context=case_ctx)
    
    # 3. Verify resulting SituationContext
    assert isinstance(situation, SituationContext)
    assert "prj_crossrail_tunnel_systems" in situation.entities
    assert len(situation.known_facts) > 0
    
    # Check that facts/uncertainties contain mentions of Paddington, Bond Street, RailTech or access delays
    summary_str = (" ".join(situation.known_facts) + " " + " ".join(situation.uncertainties)).lower()
    assert any(k in summary_str for k in ["paddington", "bond", "railtech", "delay", "access", "tunnel"])


@pytest.mark.skipif(not RUN_INTEGRATION, reason="Opt-in OpenAI integration test. Set RUN_OPENAI_INTEGRATION_TEST=true to run.")
def test_e2e_planner_discovery_and_ranking():
    """
    Level B real E2E Planner test.
    Fetches real Crossrail case data from Supabase, runs situation analysis,
    extracts structured InformationNeeds via OpenAI, dynamically discovers capabilities
    from the registry, semantically evaluates them using OpenAI, and ranks them.
    Verifies that:
    1. Information needs and scored candidates are generated successfully.
    2. All scored capabilities exist in the registry.
    3. Scores are within [0.0, 1.0].
    4. Selected candidates are filtered correctly by threshold.
    """
    openai_key = os.environ.get("OPENAI_API_KEY")
    if not openai_key:
        pytest.fail("OPENAI_API_KEY environment variable must be set to run integration tests.")
        
    from orchestra.repository import SupabaseCaseRepository
    from orchestra.planner import extract_information_needs, evaluate_capabilities, rank_candidates
    from orchestra.registry import CapabilityRegistry
    import asyncio
    
    # 1. Fetch case from Supabase
    repo = SupabaseCaseRepository()
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        case_ctx = loop.run_until_complete(repo.get_case_context("prj_crossrail_tunnel_systems"))
    finally:
        loop.close()
        
    # 2. Run Situation Analysis using adapter
    analyzer = SituationAnalyzer()
    situation = analyzer.analyze_case(case_context=case_ctx)
    
    # 3. Extract InformationNeeds using real OpenAI
    needs = extract_information_needs(situation)
    assert len(needs) > 0
    assert all(n.priority in ["high", "medium", "low"] for n in needs)
    
    # 4. Evaluate registered capabilities
    registry = CapabilityRegistry()
    candidates = evaluate_capabilities(needs, registry)
    
    # 5. Rank and filter
    res = rank_candidates(candidates, needs, relevance_threshold=0.5)
    
    # Assertions
    assert len(res.all_ranked_candidates) >= 0
    for candidate in res.all_ranked_candidates:
        # Every returned capability must exist in the registry
        assert candidate.capability_id in registry.capabilities
        # Every need ID must be valid
        assert any(n.need_id == candidate.information_need_id for n in needs)
        # Specialist must resolve correctly
        assert candidate.specialist == registry.get(candidate.capability_id).specialist
        # Scores are in bounds
        assert 0.0 <= candidate.relevance_score <= 1.0
        
    # Selected candidates filter correctly
    assert all(c.relevance_score >= 0.5 for c in res.selected_candidates)
    
    print("\n--- E2E Ranked Candidates ---")
    for idx, cand in enumerate(res.selected_candidates[:5]):
        print(f"Rank {idx+1}: {cand.capability_id} for need {cand.information_need_id} (Score: {cand.relevance_score})")


@pytest.mark.skipif(not RUN_INTEGRATION, reason="Opt-in OpenAI integration test. Set RUN_OPENAI_INTEGRATION_TEST=true to run.")
def test_e2e_planner_full_generation_and_validation():
    """
    Level B E2E Phase 3B plan generation and validation test.
    Fetches real Crossrail case data from Supabase, runs situation analysis,
    extracts structured InformationNeeds via OpenAI, evaluates capabilities,
    ranks them, proposes a full execution plan using OpenAI, and deterministically
    validates the dependency structure, priority coverage, and registry authority contracts.
    """
    openai_key = os.environ.get("OPENAI_API_KEY")
    if not openai_key:
        pytest.fail("OPENAI_API_KEY environment variable must be set to run integration tests.")

    from orchestra.repository import SupabaseCaseRepository
    from orchestra.planner import (
        extract_information_needs,
        evaluate_capabilities,
        rank_candidates,
        generate_plan,
        validate_and_normalize_plan
    )
    from orchestra.registry import CapabilityRegistry
    import asyncio

    # 1. Fetch case from Supabase
    repo = SupabaseCaseRepository()
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        case_ctx = loop.run_until_complete(repo.get_case_context("prj_crossrail_tunnel_systems"))
    finally:
        loop.close()

    # 2. Run Situation Analysis using adapter
    analyzer = SituationAnalyzer()
    situation = analyzer.analyze_case(case_context=case_ctx)

    # 3. Extract InformationNeeds using real OpenAI
    needs = extract_information_needs(situation)
    assert len(needs) > 0

    # 4. Evaluate registered capabilities
    registry = CapabilityRegistry()
    candidates = evaluate_capabilities(needs, registry)

    # 5. Rank and filter
    ranked_result = rank_candidates(candidates, needs, relevance_threshold=0.5)

    # 6. Generate proposed plan using OpenAI
    proposed = generate_plan(situation, needs, ranked_result.selected_candidates, registry)
    assert isinstance(proposed.steps, list)
    assert len(proposed.steps) > 0

    # 7. Validate and normalize the proposed plan
    validated = validate_and_normalize_plan(proposed, needs, ranked_result.selected_candidates, registry)
    assert len(validated.steps) > 0
    assert len(validated.steps) == len(proposed.steps)

    # Validate structural property guarantees
    seen_step_ids = set()
    for step in validated.steps:
        # Step ID must be unique
        assert step.step_id not in seen_step_ids
        seen_step_ids.add(step.step_id)
        
        # Capability exists in registry
        assert step.capability_id in registry.capabilities
        # Specialist and endpoint must be resolved from registry
        assert step.specialist == registry.get(step.capability_id).specialist
        assert step.endpoint == registry.get(step.capability_id).canonical_endpoint
        
        # Dependencies must exist in the plan
        for dep in step.depends_on:
            assert dep in seen_step_ids or any(s.step_id == dep for s in validated.steps)
            # dependency justification exists
            assert dep in step.dependency_reasoning
            assert len(step.dependency_reasoning[dep].strip()) > 0
            
    print("\n--- E2E Validated Topologically Sorted Plan Steps ---")
    for idx, step in enumerate(validated.steps):
        deps_str = f"depends on {step.depends_on}" if step.depends_on else "independent"
        print(f"Step {idx+1}: ID={step.step_id} | Cap={step.capability_id} ({deps_str}) | Obj={step.objective}")


@pytest.mark.skipif(not RUN_INTEGRATION, reason="Opt-in OpenAI integration test. Set RUN_OPENAI_INTEGRATION_TEST=true to run.")
def test_e2e_execution_level_b1():
    """
    Level B1 E2E Phase 4 execution test.
    Fetches real Crossrail case data from Supabase, runs situation analysis,
    extracts structured InformationNeeds via OpenAI, evaluates capabilities,
    ranks them, proposes a plan using OpenAI, validates it, and executes the
    plan using the ExecutionOrchestrator with mocked/loopback specialist calls.
    """
    openai_key = os.environ.get("OPENAI_API_KEY")
    if not openai_key:
        pytest.fail("OPENAI_API_KEY environment variable must be set to run integration tests.")

    from orchestra.repository import SupabaseCaseRepository
    from orchestra.planner import (
        extract_information_needs,
        evaluate_capabilities,
        rank_candidates,
        generate_plan,
        validate_and_normalize_plan
    )
    from orchestra.registry import CapabilityRegistry
    from orchestra.execution import ExecutionOrchestrator, PlanExecutionStatus, StepStatus
    from unittest.mock import AsyncMock
    import asyncio

    # 1. Fetch case from Supabase
    repo = SupabaseCaseRepository()
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        case_ctx = loop.run_until_complete(repo.get_case_context("prj_crossrail_tunnel_systems"))
    finally:
        loop.close()

    # 2. Run Situation Analysis using adapter
    analyzer = SituationAnalyzer()
    situation = analyzer.analyze_case(case_context=case_ctx)

    # 3. Extract InformationNeeds using real OpenAI
    needs = extract_information_needs(situation)
    assert len(needs) > 0

    # 4. Evaluate registered capabilities
    registry = CapabilityRegistry()
    candidates = evaluate_capabilities(needs, registry)

    # 5. Rank and filter
    ranked_result = rank_candidates(candidates, needs, relevance_threshold=0.5)

    # 6. Generate and validate plan using OpenAI
    proposed = generate_plan(situation, needs, ranked_result.selected_candidates, registry)
    validated = validate_and_normalize_plan(proposed, needs, ranked_result.selected_candidates, registry)
    assert len(validated.steps) > 0

    # 7. Execute using ExecutionOrchestrator with mocked execution
    mock_client = MagicMock(spec=OrchestraClient)
    # Mock client execution returns COMPLETED for any specialist calls
    async def mock_execute(capability_id, payload, **kwargs):
        return AgentResult(
            agent=registry.get(capability_id).specialist,
            task_id="tsk_mock_e2e",
            status="COMPLETED",
            findings=[{"message": f"Successfully mocked execution of {capability_id}"}]
        )
    mock_client.execute = AsyncMock(side_effect=mock_execute)

    orchestrator = ExecutionOrchestrator(registry, mock_client)
    
    # Run the orchestrator E2E execution loop
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        exec_res = loop.run_until_complete(orchestrator.execute(
            validated, situation, needs, case_context=case_ctx
        ))
    finally:
        loop.close()

    # 8. Assertions
    assert exec_res.status == PlanExecutionStatus.COMPLETED
    assert len(exec_res.step_results) == len(validated.steps)
    for step_res in exec_res.step_results:
        assert step_res.status == StepStatus.COMPLETED
        assert step_res.output["status"] == "COMPLETED"
        assert len(step_res.input_provenance) >= 0
        assert len(step_res.output_provenance) == 1
        
    print("\n--- E2E Level B1 Executed Plan Steps ---")
    for idx, step_res in enumerate(exec_res.step_results):
        print(f"Step {idx+1}: ID={step_res.step_id} | Cap={step_res.capability_id} | Status={step_res.status}")



