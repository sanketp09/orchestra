import pytest
from common.schemas.task import AgentTask, AgentResult
from common.schemas.belief import BeliefEdge
from common.belief_ledger.client import BeliefLedgerClient
from common.llm_client import get_llm_client
from common.embedding_client import get_embedding_client

from evidence_store.ingestion import get_ingestion_engine
from evidence_store.retrieval import get_retrieval_engine

from services.sentinel_service import sentinel_service
from services.trustline_service import trustline_service
from services.precedent_service import precedent_service
from services.arbiter_service import arbiter_service


def test_common_foundation():
    # LLM & Embedding verification
    llm = get_llm_client()
    res = llm.generate("Test prompt", provider="gemini")
    assert isinstance(res, str) and len(res) > 0

    embedder = get_embedding_client()
    vec = embedder.embed_text("Procurement test claim")
    assert len(vec) == 384

    # Belief Ledger verification
    ledger = BeliefLedgerClient()
    edge = ledger.record_edge(
        entity_id="test_vendor",
        relation="supported_by",
        target_id="test_receipt",
        confidence=0.95,
        source_agent="sentinel"
    )
    assert edge.entity_id == "test_vendor"


def test_evidence_store_ingestion_and_retrieval():
    ingest = get_ingestion_engine()
    doc = ingest.ingest_document(
        file_name="delay_claim.txt",
        content=b"Subcontractor claims 14 days delay due to heavy monsoon rain.",
        project_id="prj_test"
    )
    assert doc.evidence_id.startswith("evd_")

    retrieval = get_retrieval_engine()
    results = retrieval.search_similar_cases("monsoon rain delay", top_k=2)
    assert len(results) > 0
    assert "similarity" in results[0]


def test_sentinel_service():
    task = AgentTask(
        task_id="tsk_sentinel_1",
        capability="sentinel.verify_claim",
        project_id="prj_test",
        entity_ids=["vendor_apex"],
        payload={"claim_text": "Subcontractor claims rain delay between July 10-24."}
    )
    result = sentinel_service.execute_task(task)
    assert isinstance(result, AgentResult)
    assert result.agent == "sentinel"
    assert result.status in ["completed", "needs_more_evidence"]
    assert len(result.receipt_id) > 0


def test_trustline_service_context_aware_update():
    # 1. Test penalty applied when NO external context
    task_no_ext = AgentTask(
        task_id="tsk_trust_1",
        capability="trustline.update_trust",
        project_id="prj_test",
        entity_ids=["vendor_apex"],
        payload={"verified_event": {"verdict": "contradicted", "type": "delay"}},
        context={}
    )
    res_no_ext = trustline_service.execute_task(task_no_ext)
    assert res_no_ext.findings[0]["penalty_applied"] is True

    # 2. Test NO penalty applied when Atlas external context (port strike) exists
    task_ext = AgentTask(
        task_id="tsk_trust_2",
        capability="trustline.update_trust",
        project_id="prj_test",
        entity_ids=["vendor_apex"],
        payload={
            "verified_event": {"verdict": "contradicted", "type": "delay"},
            "external_context": {"event": "Major Port Strike at Nhava Sheva"}
        }
    )
    res_ext = trustline_service.execute_task(task_ext)
    assert res_ext.findings[0]["penalty_applied"] is False


def test_precedent_service():
    task = AgentTask(
        task_id="tsk_prec_1",
        capability="precedent.find_similar_case",
        project_id="prj_test",
        payload={"situation_description": "Rain delay weather claim stand down"}
    )
    result = precedent_service.execute_task(task)
    assert result.agent == "precedent"
    assert len(result.findings[0]["similar_cases"]) > 0


def test_arbiter_service():
    task = AgentTask(
        task_id="tsk_arb_1",
        capability="arbiter.analyze_dispute",
        project_id="prj_test",
        payload={"dispute_description": "Subcontractor DC-402 14-day delay claim"}
    )
    result = arbiter_service.execute_task(task)
    assert result.agent == "arbiter"
    if result.status == "completed":
        assert "reasoning_summary" in result.findings[0]
    else:
        assert result.status == "needs_more_evidence"
        assert "message" in result.findings[0]
