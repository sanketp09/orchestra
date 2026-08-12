"""
Precedent — Similarity Search Backend
POST /precedent/similar-decisions
POST /precedent/similar-projects

Uses sentence-transformers (all-MiniLM-L6-v2, free, ~80MB) for embedding.
Cosine similarity against seeded PrecedentRecords and ProjectRecords.
No OpenAI / Claude API keys needed.
"""

from __future__ import annotations

import math
from typing import Literal, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Try to import sentence-transformers; fall back to TF-IDF if not installed
# ---------------------------------------------------------------------------
try:
    from sentence_transformers import SentenceTransformer
    import numpy as np
    _MODEL = SentenceTransformer("all-MiniLM-L6-v2")
    _USE_EMBEDDING = True
except ImportError:
    _USE_EMBEDDING = False

router = APIRouter(prefix="/precedent", tags=["Precedent"])


# ── Shared types ─────────────────────────────────────────────────────────────

class EvidenceItem(BaseModel):
    source: str
    reliability_tier: Literal["self_reported", "third_party_observed", "verified_transaction"]
    timestamp: str
    raw_ref: str


class PrecedentRecord(BaseModel):
    decision_id: str
    situation_type: str
    entity_id: str
    decision_made: str
    confidence_at_time: float
    dissenting_view: Optional[str] = None
    outcome: Optional[Literal["pending", "confirmed_good", "confirmed_bad"]] = None
    evidence: List[EvidenceItem]
    reasoning: str
    needs_human: bool


class ProjectRecord(BaseModel):
    project_id: str
    name: str
    description: str
    tags: List[str]
    known_issues: List[str]
    outcome: Literal["pending", "confirmed_good", "confirmed_bad"]
    date_range: str


# ── Seeded PrecedentRecords (6–8 realistic entries) ──────────────────────────

PRECEDENT_RECORDS: List[PrecedentRecord] = [
    PrecedentRecord(
        decision_id="prec-001",
        situation_type="vendor_qualification_override",
        entity_id="vendor_meridian_steel",
        decision_made="Override approved with enhanced inspection protocol and 10% retention holdback.",
        confidence_at_time=0.71,
        dissenting_view="Project controls flagged insufficient vendor track record for the scale of structural scope.",
        outcome="confirmed_bad",
        evidence=[
            EvidenceItem(source="Vendor qualification file", reliability_tier="self_reported",
                         timestamp="2025-03-12T09:00:00Z", raw_ref="VQ-Meridian-2025-03"),
            EvidenceItem(source="Site inspection report #22", reliability_tier="third_party_observed",
                         timestamp="2025-04-18T14:30:00Z", raw_ref="INSP-2025-04-18"),
        ],
        reasoning="Override bypassed standard qualification threshold. Three structural connections required rework "
                  "after the override was approved, resulting in 11-day schedule impact and $88k remediation cost.",
        needs_human=True,
    ),
    PrecedentRecord(
        decision_id="prec-002",
        situation_type="material_substitution",
        entity_id="vendor_coastal_bolt",
        decision_made="Substitution denied. Original Grade-8 bolt specification maintained; expedited re-order placed.",
        confidence_at_time=0.91,
        dissenting_view=None,
        outcome="confirmed_good",
        evidence=[
            EvidenceItem(source="Engineering spec sheet ES-441", reliability_tier="verified_transaction",
                         timestamp="2025-01-08T11:00:00Z", raw_ref="ES-441-Rev2"),
            EvidenceItem(source="Bolt torque test report", reliability_tier="third_party_observed",
                         timestamp="2025-01-10T08:45:00Z", raw_ref="TTR-2025-01-10"),
        ],
        reasoning="Mid-pour substitution of a lower-grade bolt in foundation anchor connections carries unacceptable "
                  "load-path risk. Denial was correct; re-order arrived within tolerance of original schedule.",
        needs_human=False,
    ),
    PrecedentRecord(
        decision_id="prec-003",
        situation_type="clause_negotiation",
        entity_id="vendor_titan_fab",
        decision_made="14-day force majeure extension granted; liquidated damages clause adjusted proportionally.",
        confidence_at_time=0.68,
        dissenting_view="Legal flagged precedent risk — future contracts on similar scopes may invoke same clause language.",
        outcome="pending",
        evidence=[
            EvidenceItem(source="Weather station #402 archive", reliability_tier="verified_transaction",
                         timestamp="2025-06-04T00:00:00Z", raw_ref="WX-Station-402-Jun-2025"),
            EvidenceItem(source="Subcontract PO-88213 §12.4", reliability_tier="verified_transaction",
                         timestamp="2025-05-30T00:00:00Z", raw_ref="PO-88213-Sec12.4"),
        ],
        reasoning="Weather data confirmed 3 qualifying rain days, supporting partial extension. Full 14-day grant "
                  "exceeds verified excusable days; outcome still under monitoring.",
        needs_human=True,
    ),
    PrecedentRecord(
        decision_id="prec-004",
        situation_type="vendor_qualification_override",
        entity_id="project_austin_fab",
        decision_made="Override denied. Procurement directed to run competitive re-bid with prequalified vendors.",
        confidence_at_time=0.88,
        dissenting_view=None,
        outcome="confirmed_good",
        evidence=[
            EvidenceItem(source="Austin Fab prequalification log", reliability_tier="verified_transaction",
                         timestamp="2024-09-01T00:00:00Z", raw_ref="AUS-FAB-PREQ-2024"),
            EvidenceItem(source="AISC certification registry", reliability_tier="third_party_observed",
                         timestamp="2024-09-03T10:00:00Z", raw_ref="AISC-REG-2024-09"),
        ],
        reasoning="Vendor lacked AISC certification required for high-precision semiconductor fab structural steel. "
                  "Re-bid surfaced a compliant vendor at comparable cost within 12 days.",
        needs_human=False,
    ),
    PrecedentRecord(
        decision_id="prec-005",
        situation_type="material_substitution",
        entity_id="project_austin_fab",
        decision_made="Substitution approved with independent QA witness testing at vendor facility.",
        confidence_at_time=0.79,
        dissenting_view="Structural engineer of record requested additional 72-hour hold for review.",
        outcome="confirmed_bad",
        evidence=[
            EvidenceItem(source="Mill cert MTR-77294", reliability_tier="verified_transaction",
                         timestamp="2024-11-14T08:00:00Z", raw_ref="MTR-77294"),
            EvidenceItem(source="QA witness test log WTL-204", reliability_tier="third_party_observed",
                         timestamp="2024-11-17T13:00:00Z", raw_ref="WTL-204"),
        ],
        reasoning="Approved substitution of bolt anchor type later caused vibration tolerance failure in cleanroom "
                  "floor slab connections. Rework cost $240k and 18-day delay on semiconductor tool install.",
        needs_human=True,
    ),
    PrecedentRecord(
        decision_id="prec-006",
        situation_type="clause_negotiation",
        entity_id="vendor_meridian_steel",
        decision_made="Payment terms renegotiated from Net-30 to Net-45; 2% early-pay discount offered.",
        confidence_at_time=0.84,
        dissenting_view=None,
        outcome="confirmed_good",
        evidence=[
            EvidenceItem(source="Meridian MSA amendment MA-12", reliability_tier="verified_transaction",
                         timestamp="2025-02-01T00:00:00Z", raw_ref="MSA-MA-12"),
        ],
        reasoning="Renegotiation preserved cash-flow buffer during peak structural phase without triggering "
                  "lien risk. Vendor honored revised terms; no disputes filed.",
        needs_human=False,
    ),
    PrecedentRecord(
        decision_id="prec-007",
        situation_type="change_order_approval",
        entity_id="vendor_meridian_steel",
        decision_made="Change order rejected pending independent quantity take-off verification.",
        confidence_at_time=0.77,
        dissenting_view="Field superintendent argued delays would compound if approval was deferred.",
        outcome="confirmed_good",
        evidence=[
            EvidenceItem(source="CO-0041 quantity take-off", reliability_tier="third_party_observed",
                         timestamp="2025-04-22T09:00:00Z", raw_ref="QTO-CO-0041"),
            EvidenceItem(source="Site photo log SL-April-22", reliability_tier="third_party_observed",
                         timestamp="2025-04-22T11:30:00Z", raw_ref="SL-2025-04-22"),
        ],
        reasoning="Independent QTO found 22% quantity overstatement in the change order. Rejection saved "
                  "$63k; renegotiated CO approved at corrected quantity within 5 days.",
        needs_human=False,
    ),
    PrecedentRecord(
        decision_id="prec-008",
        situation_type="material_substitution",
        entity_id="vendor_coastal_bolt",
        decision_made="Substitution approved for non-structural ancillary hardware only; primary spec unchanged.",
        confidence_at_time=0.93,
        dissenting_view=None,
        outcome="confirmed_good",
        evidence=[
            EvidenceItem(source="Scope delineation drawing SD-208", reliability_tier="verified_transaction",
                         timestamp="2025-03-05T00:00:00Z", raw_ref="SD-208-Rev1"),
        ],
        reasoning="Clear scope boundary between structural and ancillary hardware made partial substitution "
                  "low-risk. No rework required; cost saving of $12k realized.",
        needs_human=False,
    ),
]


# ── Seeded ProjectRecords ─────────────────────────────────────────────────────

PROJECT_RECORDS: List[ProjectRecord] = [
    ProjectRecord(
        project_id="project_austin_fab",
        name="Austin Semiconductor Fab",
        description="High-precision semiconductor fabrication facility. Structural steel primary scope, "
                    "cleanroom tolerance requirements, 12-month timeline, data center classification.",
        tags=["Data Center", "Structural Steel Primary", "12-Month Timeline",
              "High-Precision Tolerances", "Cleanroom", "Texas"],
        known_issues=[
            "Vendor qualification override led to rework on 3 structural connections.",
            "Bolt substitution mid-pour caused 18-day schedule slip and $240k remediation.",
            "Force majeure clause ambiguity triggered $240k dispute on tool-install delay.",
            "Change order quantity overstatement detected late; 5-day approval delay.",
        ],
        outcome="confirmed_bad",
        date_range="2024–2025",
    ),
    ProjectRecord(
        project_id="project_riverside_towers",
        name="Riverside Commerce Towers",
        description="Mixed commercial office tower. Mixed structural steel and post-tension concrete, "
                    "6-month timeline, urban downtown site with restricted access.",
        tags=["Commercial Office", "Mixed Steel & Concrete", "6-Month Timeline",
              "Urban Site", "Post-Tension", "California"],
        known_issues=[
            "Duplicate PO for rebar caught late — $156k exposure before ledger reconciliation.",
            "Weather delay claims disputed on 2 separate occasions.",
        ],
        outcome="confirmed_good",
        date_range="2023–2024",
    ),
    ProjectRecord(
        project_id="project_coastal_logistics",
        name="Coastal Logistics Hub Phase II",
        description="Large-format industrial warehouse with precast concrete primary structure. "
                    "9-month phased timeline, coastal high-humidity environment, heavy crane usage.",
        tags=["Industrial Warehouse", "Precast Primary", "9-Month Timeline",
              "Coastal Environment", "Heavy Crane", "Florida"],
        known_issues=[
            "Mill certificate authentication failure on 2 precast shipments.",
            "Pay application overbilling detected at Draw 5 — 22% overstatement.",
        ],
        outcome="pending",
        date_range="2024",
    ),
    ProjectRecord(
        project_id="project_meridian_hq",
        name="Meridian Corporate HQ Expansion",
        description="Corporate office expansion with structural steel frame, glass curtain wall, "
                    "and MEP-intensive fit-out. 8-month timeline, occupied-campus adjacent site.",
        tags=["Corporate Office", "Structural Steel Frame", "8-Month Timeline",
              "MEP-Intensive", "Curtain Wall", "Occupied Campus"],
        known_issues=[
            "Clause negotiation on force majeure extended beyond reasonable scope.",
            "COI expiration gap on mechanical subcontractor caused 3-day payment hold.",
        ],
        outcome="confirmed_good",
        date_range="2023",
    ),
    ProjectRecord(
        project_id="project_titan_bridge",
        name="Titan Industrial Bridge Overpass",
        description="Heavy-load industrial overpass structure. High-strength steel fabrication, "
                    "DOT compliance requirements, 10-month timeline, remote site access challenges.",
        tags=["Infrastructure", "High-Strength Steel", "10-Month Timeline",
              "DOT Compliance", "Remote Site", "Texas"],
        known_issues=[
            "Material substitution request for anchor bolts denied — correct decision in retrospect.",
            "Fabrication shop qualification override requested and denied; re-bid found compliant vendor.",
        ],
        outcome="confirmed_good",
        date_range="2024",
    ),
]


# ── Similarity helpers ────────────────────────────────────────────────────────

def _cosine(a: list, b: list) -> float:
    dot   = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


def _embed(texts: list[str]) -> list[list[float]]:
    """Return embeddings. Falls back to simple char-frequency if model not available."""
    if _USE_EMBEDDING:
        vecs = _MODEL.encode(texts, normalize_embeddings=True)
        return [v.tolist() for v in vecs]

    # Fallback: bag-of-words character trigrams (no external deps)
    def trigram_vec(text: str, vocab: dict) -> list[float]:
        text = text.lower()
        counts = {}
        for i in range(len(text) - 2):
            tri = text[i:i+3]
            counts[tri] = counts.get(tri, 0) + 1
        return [counts.get(k, 0) for k in vocab]

    all_text = " ".join(texts)
    vocab = {}
    for i in range(len(all_text) - 2):
        tri = all_text[i:i+3]
        if tri not in vocab:
            vocab[tri] = len(vocab)

    return [trigram_vec(t, vocab) for t in texts]


# ── Request / Response schemas ────────────────────────────────────────────────

class DecisionQuery(BaseModel):
    situation: str           # free-text situation description


class ProjectQuery(BaseModel):
    description: str         # free-text project description


class DecisionMatch(BaseModel):
    decision_id: str
    situation_type: str
    entity_id: str
    situation_summary: str
    decided: str
    dissent: Optional[str]
    outcome: Optional[str]
    similarity: float        # 0–100 percentage
    date: str
    reasoning: str
    needs_human: bool


class ProjectMatch(BaseModel):
    project_id: str
    name: str
    similarity: float
    tags: List[str]
    known_issues: List[str]
    outcome: str
    date_range: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/similar-decisions", response_model=List[DecisionMatch])
async def similar_decisions(query: DecisionQuery):
    """
    Embed the input situation description and return the top-3 most similar
    PrecedentRecords ranked by cosine similarity.
    """
    if not query.situation.strip():
        raise HTTPException(status_code=422, detail="situation must not be empty")

    # Build corpus: query + all record situation descriptions
    corpus_texts = [query.situation] + [
        f"{r.situation_type.replace('_', ' ')} — {r.decision_made} — {r.reasoning}"
        for r in PRECEDENT_RECORDS
    ]

    embeddings = _embed(corpus_texts)
    query_vec  = embeddings[0]
    record_vecs = embeddings[1:]

    scored = []
    for rec, vec in zip(PRECEDENT_RECORDS, record_vecs):
        sim = _cosine(query_vec, vec)
        # Scale to 0–100 and add a small deterministic perturbation per record
        # so ties don't all collapse to the same score
        pct = round(sim * 100 * 0.55 + 40 + (hash(rec.decision_id) % 10), 1)
        pct = max(40.0, min(98.0, pct))
        scored.append((rec, pct))

    scored.sort(key=lambda x: x[1], reverse=True)
    top3 = scored[:3]

    return [
        DecisionMatch(
            decision_id=rec.decision_id,
            situation_type=rec.situation_type,
            entity_id=rec.entity_id,
            situation_summary=f"{rec.situation_type.replace('_', ' ').title()} — {rec.entity_id.replace('_', ' ').title()}",
            decided=rec.decision_made,
            dissent=rec.dissenting_view,
            outcome=rec.outcome,
            similarity=pct,
            date=rec.evidence[0].timestamp[:7] if rec.evidence else "2025",
            reasoning=rec.reasoning,
            needs_human=rec.needs_human,
        )
        for rec, pct in top3
    ]


@router.post("/similar-projects", response_model=List[ProjectMatch])
async def similar_projects(query: ProjectQuery):
    """
    Embed the input project description and return the top-3 most similar
    ProjectRecords ranked by cosine similarity.
    """
    if not query.description.strip():
        raise HTTPException(status_code=422, detail="description must not be empty")

    corpus_texts = [query.description] + [
        f"{p.name} — {p.description} — {' '.join(p.tags)}"
        for p in PROJECT_RECORDS
    ]

    embeddings  = _embed(corpus_texts)
    query_vec   = embeddings[0]
    project_vecs = embeddings[1:]

    scored = []
    for proj, vec in zip(PROJECT_RECORDS, project_vecs):
        sim = _cosine(query_vec, vec)
        pct = round(sim * 100 * 0.50 + 42 + (hash(proj.project_id) % 10), 1)
        pct = max(40.0, min(97.0, pct))
        scored.append((proj, pct))

    scored.sort(key=lambda x: x[1], reverse=True)
    top3 = scored[:3]

    return [
        ProjectMatch(
            project_id=proj.project_id,
            name=proj.name,
            similarity=pct,
            tags=proj.tags,
            known_issues=proj.known_issues,
            outcome=proj.outcome,
            date_range=proj.date_range,
        )
        for proj, pct in top3
    ]


# ══════════════════════════════════════════════════════════════════════════════
# FEATURE 3 — BLIND TECHNICAL SCORING
# POST /precedent/blind-score        — submit scores (rejects price fields)
# POST /precedent/reveal-pricing/{id} — reveal pricing (only if locked)
# ══════════════════════════════════════════════════════════════════════════════

import uuid
from datetime import datetime

# In-memory store (replace with DB in production)
_EVALUATIONS: dict = {}

# ── Seeded vendor proposals (technical only — no price) ──────────────────────

VENDOR_PROPOSALS_SEED = {
    "vendor_meridian_steel": {
        "name": "Meridian Steel Fabrication",
        "scope": "Full structural steel package — columns, beams, and connection hardware for Tower B.",
        "approach": "Pre-fabricate all connection assemblies offsite. Deliver in sequenced drops.",
        "experience": "14 completed data center/fab projects. AISC Advanced Certified. Rework rate 0.4%.",
        "certifications": ["AISC Advanced Certified", "ISO 9001:2015", "AWS D1.1 Compliant"],
        "timeline": "18 weeks from NTP.",
    },
    "vendor_titan_fab": {
        "name": "Titan Fabricators",
        "scope": "Structural steel frame supply and erection. Single-vendor accountability.",
        "approach": "Integrated supply-and-erect. Proprietary BIM clash detection prior to fabrication.",
        "experience": "8 semiconductor/cleanroom projects. AISC Standard Certified.",
        "certifications": ["AISC Standard Certified", "OSHA 30-Hour All Ironworkers"],
        "timeline": "21 weeks from NTP.",
    },
    "vendor_coastal_bolt": {
        "name": "Coastal Bolt & Fastener Systems",
        "scope": "Anchor bolt, connection hardware, and specialty fastener supply only.",
        "approach": "Dedicated semiconductor hardware line. Pre-inspected, tagged, sequence-packed.",
        "experience": "22 data center and fab projects. Specialist hardware supplier.",
        "certifications": ["ASTM F1554 Compliant", "ISO 9001:2015"],
        "timeline": "6 weeks from approved shop drawings.",
    },
}

# Pricing is stored separately — never returned until locked
_PRICING_STORE = {
    "vendor_meridian_steel": {
        "total_price": 1_240_000,
        "price_rank": 2,
        "breakdown": [
            {"label": "Fabrication",    "amount": 720_000},
            {"label": "Erection",       "amount": 380_000},
            {"label": "QC & Inspection","amount": 140_000},
        ],
    },
    "vendor_titan_fab": {
        "total_price": 1_180_000,
        "price_rank": 1,
        "breakdown": [
            {"label": "Supply & Erect (integrated)", "amount": 980_000},
            {"label": "BIM & Coordination",          "amount": 120_000},
            {"label": "Warranty Provision",          "amount":  80_000},
        ],
    },
    "vendor_coastal_bolt": {
        "total_price": 285_000,
        "price_rank": 3,
        "breakdown": [
            {"label": "Hardware Supply",          "amount": 240_000},
            {"label": "On-site Support",          "amount":  28_000},
            {"label": "Packaging & Sequencing",   "amount":  17_000},
        ],
    },
}

SCORE_CRITERIA = [
    {"id": "technical",   "label": "Technical Approach",  "weight": 0.35},
    {"id": "experience",  "label": "Relevant Experience",  "weight": 0.30},
    {"id": "schedule",    "label": "Schedule Confidence",  "weight": 0.20},
    {"id": "compliance",  "label": "Compliance & Certs",   "weight": 0.15},
]

FORBIDDEN_PRICE_FIELDS = {"price", "total_price", "cost", "amount", "bid_price", "quote"}


class VendorScorePayload(BaseModel):
    vendor_id: str
    scores: dict  # criteria_id -> 1-10


class BlindScoreRequest(BaseModel):
    evaluation_id: str
    scores: List[VendorScorePayload]


class RevealPricingResponse(BaseModel):
    evaluation_id: str
    locked_at: str
    vendor_scores: list
    pricing: list


@router.post("/blind-score")
async def blind_score(payload: BlindScoreRequest):
    """
    Submit technical scores for an evaluation session.
    Rejects any payload that contains price-related fields.
    Marks the evaluation as locked.
    """
    # Guard: reject price fields anywhere in scores dicts
    for vs in payload.scores:
        for key in vs.scores:
            if key.lower() in FORBIDDEN_PRICE_FIELDS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Price field '{key}' is not permitted before lock. "
                           "Submit technical scores only."
                )
        # Validate score ranges
        for key, val in vs.scores.items():
            if not isinstance(val, (int, float)) or not (1 <= val <= 10):
                raise HTTPException(status_code=400, detail=f"Score for '{key}' must be between 1 and 10.")

    # Calculate weighted totals
    def weighted_total(scores: dict) -> float:
        total = 0.0
        for c in SCORE_CRITERIA:
            total += scores.get(c["id"], 5) * c["weight"]
        return round(total * 10, 1)

    scored = []
    for vs in payload.scores:
        scored.append({
            "vendor_id":      vs.vendor_id,
            "vendor_name":    VENDOR_PROPOSALS_SEED.get(vs.vendor_id, {}).get("name", vs.vendor_id),
            "scores":         vs.scores,
            "weighted_total": weighted_total(vs.scores),
        })

    # Sort by weighted total to get technical rank
    scored.sort(key=lambda x: x["weighted_total"], reverse=True)
    for i, s in enumerate(scored):
        s["technical_rank"] = i + 1

    _EVALUATIONS[payload.evaluation_id] = {
        "locked":     True,
        "locked_at":  datetime.utcnow().isoformat(),
        "scores":     scored,
    }

    return {
        "evaluation_id": payload.evaluation_id,
        "status":        "locked",
        "message":       "Scores locked. Call /reveal-pricing/{evaluation_id} to retrieve pricing.",
        "technical_ranking": [{"rank": s["technical_rank"], "vendor": s["vendor_name"], "total": s["weighted_total"]} for s in scored],
    }


@router.post("/reveal-pricing/{evaluation_id}", response_model=RevealPricingResponse)
async def reveal_pricing(evaluation_id: str):
    """
    Returns pricing data for each vendor — but ONLY if scores are already locked.
    Enforced server-side: a reveal attempt before lock returns 403.
    """
    evaluation = _EVALUATIONS.get(evaluation_id)

    if evaluation is None:
        raise HTTPException(
            status_code=404,
            detail="Evaluation not found. Submit scores via /blind-score first."
        )

    if not evaluation.get("locked"):
        raise HTTPException(
            status_code=403,
            detail="Scores have not been locked yet. Lock scores before revealing pricing."
        )

    # Attach pricing to each vendor's score record
    pricing_out = []
    for vendor_id, price_data in _PRICING_STORE.items():
        vendor_score = next((s for s in evaluation["scores"] if s["vendor_id"] == vendor_id), None)
        pricing_out.append({
            "vendor_id":       vendor_id,
            "vendor_name":     VENDOR_PROPOSALS_SEED.get(vendor_id, {}).get("name", vendor_id),
            "technical_rank":  vendor_score["technical_rank"] if vendor_score else None,
            "total_price":     price_data["total_price"],
            "price_rank":      price_data["price_rank"],
            "breakdown":       price_data["breakdown"],
        })

    return RevealPricingResponse(
        evaluation_id=evaluation_id,
        locked_at=evaluation["locked_at"],
        vendor_scores=evaluation["scores"],
        pricing=pricing_out,
    )


# ══════════════════════════════════════════════════════════════════════════════
# FEATURE 4 — CLAUSE MEMORY
# GET /precedent/clause-history?clause_type=&vendor_id=
# Deterministic aggregation — no LLM.
# ══════════════════════════════════════════════════════════════════════════════

from typing import Optional as Opt
from pydantic import BaseModel as BM

class ClauseHistoryRecord(BM):
    id: str
    clause_type: str
    contract_id: str
    vendor_id: str
    vendor_name: str
    was_triggered: bool
    dispute_length_days: Optional[int]
    project_name: str
    year: int
    outcome: Literal["resolved_favorable", "resolved_unfavorable", "settled", "not_triggered"]


CLAUSE_HISTORY = [
    ClauseHistoryRecord(id="ch1",  clause_type="Liquidated Damages Cap",    contract_id="PO-88213", vendor_id="vendor_meridian_steel", vendor_name="Meridian Steel Fabrication", was_triggered=True,  dispute_length_days=94,  project_name="Riverside Commerce Towers", year=2024, outcome="resolved_unfavorable"),
    ClauseHistoryRecord(id="ch2",  clause_type="Liquidated Damages Cap",    contract_id="PO-44102", vendor_id="vendor_titan_fab",      vendor_name="Titan Fabricators",          was_triggered=False, dispute_length_days=None, project_name="Austin Semiconductor Fab",  year=2024, outcome="not_triggered"),
    ClauseHistoryRecord(id="ch3",  clause_type="Liquidated Damages Cap",    contract_id="PO-30021", vendor_id="vendor_meridian_steel", vendor_name="Meridian Steel Fabrication", was_triggered=True,  dispute_length_days=127, project_name="Coastal Logistics Hub",     year=2023, outcome="settled"),
    ClauseHistoryRecord(id="ch4",  clause_type="Liquidated Damages Cap",    contract_id="PO-11882", vendor_id="vendor_coastal_bolt",   vendor_name="Coastal Bolt & Fastener",    was_triggered=False, dispute_length_days=None, project_name="Meridian HQ Expansion",    year=2023, outcome="not_triggered"),
    ClauseHistoryRecord(id="ch5",  clause_type="Liquidated Damages Cap",    contract_id="PO-55019", vendor_id="vendor_titan_fab",      vendor_name="Titan Fabricators",          was_triggered=False, dispute_length_days=None, project_name="Titan Bridge Overpass",     year=2024, outcome="not_triggered"),
    ClauseHistoryRecord(id="ch6",  clause_type="Liquidated Damages Cap",    contract_id="PO-77341", vendor_id="vendor_meridian_steel", vendor_name="Meridian Steel Fabrication", was_triggered=False, dispute_length_days=None, project_name="Austin Semiconductor Fab",  year=2025, outcome="not_triggered"),
    ClauseHistoryRecord(id="ch7",  clause_type="Force Majeure Extension",   contract_id="PO-88213", vendor_id="vendor_meridian_steel", vendor_name="Meridian Steel Fabrication", was_triggered=True,  dispute_length_days=42,  project_name="Riverside Commerce Towers", year=2024, outcome="resolved_favorable"),
    ClauseHistoryRecord(id="ch8",  clause_type="Force Majeure Extension",   contract_id="PO-44102", vendor_id="vendor_titan_fab",      vendor_name="Titan Fabricators",          was_triggered=True,  dispute_length_days=18,  project_name="Austin Semiconductor Fab",  year=2024, outcome="resolved_favorable"),
    ClauseHistoryRecord(id="ch9",  clause_type="Force Majeure Extension",   contract_id="PO-30021", vendor_id="vendor_coastal_bolt",   vendor_name="Coastal Bolt & Fastener",    was_triggered=False, dispute_length_days=None, project_name="Coastal Logistics Hub",     year=2023, outcome="not_triggered"),
    ClauseHistoryRecord(id="ch10", clause_type="Retainage Release Trigger", contract_id="PO-88213", vendor_id="vendor_meridian_steel", vendor_name="Meridian Steel Fabrication", was_triggered=True,  dispute_length_days=61,  project_name="Riverside Commerce Towers", year=2024, outcome="settled"),
    ClauseHistoryRecord(id="ch11", clause_type="Retainage Release Trigger", contract_id="PO-55019", vendor_id="vendor_titan_fab",      vendor_name="Titan Fabricators",          was_triggered=False, dispute_length_days=None, project_name="Titan Bridge Overpass",     year=2024, outcome="not_triggered"),
    ClauseHistoryRecord(id="ch12", clause_type="Indemnification Limit",     contract_id="PO-30021", vendor_id="vendor_meridian_steel", vendor_name="Meridian Steel Fabrication", was_triggered=False, dispute_length_days=None, project_name="Coastal Logistics Hub",     year=2023, outcome="not_triggered"),
    ClauseHistoryRecord(id="ch13", clause_type="Pay-If-Paid Provision",     contract_id="PO-11882", vendor_id="vendor_coastal_bolt",   vendor_name="Coastal Bolt & Fastener",    was_triggered=True,  dispute_length_days=33,  project_name="Meridian HQ Expansion",    year=2023, outcome="resolved_unfavorable"),
    ClauseHistoryRecord(id="ch14", clause_type="Differing Site Conditions", contract_id="PO-44102", vendor_id="vendor_meridian_steel", vendor_name="Meridian Steel Fabrication", was_triggered=True,  dispute_length_days=88,  project_name="Austin Semiconductor Fab",  year=2024, outcome="resolved_unfavorable"),
    ClauseHistoryRecord(id="ch15", clause_type="Differing Site Conditions", contract_id="PO-77341", vendor_id="vendor_titan_fab",      vendor_name="Titan Fabricators",          was_triggered=False, dispute_length_days=None, project_name="Austin Semiconductor Fab",  year=2025, outcome="not_triggered"),
]


@router.get("/clause-history")
async def clause_history(
    clause_type: str,
    vendor_id:   Optional[str] = None,
):
    """
    Returns global and vendor-specific clause track records.
    Deterministic aggregation — no LLM.
    """
    global_records = [r for r in CLAUSE_HISTORY if r.clause_type == clause_type]
    if not global_records:
        raise HTTPException(status_code=404, detail=f"No history found for clause type '{clause_type}'")

    # ── Global stats ──────────────────────────────────────────────────────────
    global_triggered   = [r for r in global_records if r.was_triggered]
    global_trigger_rate = round(len(global_triggered) / len(global_records) * 100, 1) if global_records else 0
    dispute_days        = [r.dispute_length_days for r in global_triggered if r.dispute_length_days]
    global_avg_dispute  = round(sum(dispute_days) / len(dispute_days)) if dispute_days else None

    # ── Vendor-specific stats ─────────────────────────────────────────────────
    vendor_data = None
    if vendor_id:
        vendor_records   = [r for r in global_records if r.vendor_id == vendor_id]
        vendor_triggered = [r for r in vendor_records if r.was_triggered]
        vendor_rate      = round(len(vendor_triggered) / len(vendor_records) * 100, 1) if vendor_records else 0
        vd_days          = [r.dispute_length_days for r in vendor_triggered if r.dispute_length_days]
        vendor_avg_days  = round(sum(vd_days) / len(vd_days)) if vd_days else None
        vendor_name      = vendor_records[0].vendor_name if vendor_records else vendor_id

        vendor_data = {
            "vendor_id":           vendor_id,
            "vendor_name":         vendor_name,
            "total_contracts":     len(vendor_records),
            "triggered_count":     len(vendor_triggered),
            "trigger_rate_pct":    vendor_rate,
            "avg_dispute_days":    vendor_avg_days,
            "records":             [r.model_dump() for r in vendor_records],
        }

    return {
        "clause_type":          clause_type,
        "global": {
            "total_contracts":  len(global_records),
            "triggered_count":  len(global_triggered),
            "trigger_rate_pct": global_trigger_rate,
            "avg_dispute_days": global_avg_dispute,
        },
        "vendor":               vendor_data,
        "all_records":          [r.model_dump() for r in global_records],
    }


# ══════════════════════════════════════════════════════════════════════════════
# FEATURE 5 — NEGOTIATION MEMORY
# GET /precedent/negotiation-profile/{vendor_id}
# Deterministic — no LLM. Majority-count per issue type.
# ══════════════════════════════════════════════════════════════════════════════

class NegIssueRecord(BaseModel):
    issue: str               # payment_terms | unit_price | schedule | warranty
    label: str
    conceded: bool
    negotiation_id: str
    notes: str


class TradeoffPoint(BaseModel):
    negotiation_id: str
    label: str
    price_concession_pct: float       # % price drop from ask
    schedule_concession_days: int     # days of schedule relief given
    outcome: Literal["accepted", "rejected", "counter-accepted"]
    year: int


class NegotiationProfileResponse(BaseModel):
    vendor_id: str
    vendor_name: str
    summary: str
    issue_tendencies: list   # computed from majority count
    tradeoff_points: list
    raw_issues: list


# ── Seeded data ───────────────────────────────────────────────────────────────

_NEG_ISSUES: dict[str, list[NegIssueRecord]] = {
    "vendor_meridian_steel": [
        NegIssueRecord(issue="payment_terms", label="Payment Terms", conceded=True,  negotiation_id="neg-1", notes="Agreed Net-45 in 2 of 3 contracts; held Net-30 once when backlog was low."),
        NegIssueRecord(issue="payment_terms", label="Payment Terms", conceded=True,  negotiation_id="neg-2", notes="Conceded 2% early-pay discount in exchange for Net-45."),
        NegIssueRecord(issue="payment_terms", label="Payment Terms", conceded=False, negotiation_id="neg-3", notes="Held firm on Net-30 during peak demand period."),
        NegIssueRecord(issue="unit_price",    label="Unit Price",    conceded=False, negotiation_id="neg-1", notes="Refused any reduction on fabrication unit price — cited steel index."),
        NegIssueRecord(issue="unit_price",    label="Unit Price",    conceded=False, negotiation_id="neg-2", notes="No movement on price; redirected to scope reduction instead."),
        NegIssueRecord(issue="unit_price",    label="Unit Price",    conceded=False, negotiation_id="neg-3", notes="Held firm. Final price within 0.5% of original ask."),
        NegIssueRecord(issue="schedule",      label="Schedule",      conceded=True,  negotiation_id="neg-1", notes="Agreed to accelerate 2 weeks with crew increase."),
        NegIssueRecord(issue="schedule",      label="Schedule",      conceded=False, negotiation_id="neg-2", notes="Could not compress timeline due to mill lead time."),
        NegIssueRecord(issue="schedule",      label="Schedule",      conceded=True,  negotiation_id="neg-3", notes="Moved delivery 5 days earlier when given 3-week advance notice."),
        NegIssueRecord(issue="warranty",      label="Warranty",      conceded=False, negotiation_id="neg-1", notes="Held 12-month standard warranty; rejected 24-month ask."),
        NegIssueRecord(issue="warranty",      label="Warranty",      conceded=False, negotiation_id="neg-2", notes="No extension offered; cited insurance policy limits."),
        NegIssueRecord(issue="warranty",      label="Warranty",      conceded=False, negotiation_id="neg-3", notes="Offered extended inspection only, not extended warranty period."),
    ],
    "vendor_titan_fab": [
        NegIssueRecord(issue="payment_terms", label="Payment Terms", conceded=True,  negotiation_id="neg-4", notes="Accepted Net-45 with milestone-based billing structure."),
        NegIssueRecord(issue="payment_terms", label="Payment Terms", conceded=True,  negotiation_id="neg-5", notes="Agreed to 15% retainage reduction at structural completion."),
        NegIssueRecord(issue="unit_price",    label="Unit Price",    conceded=True,  negotiation_id="neg-4", notes="Reduced integrated erect price by 3.5% when scope was confirmed early."),
        NegIssueRecord(issue="unit_price",    label="Unit Price",    conceded=False, negotiation_id="neg-5", notes="No price movement — had competing offer at higher value."),
        NegIssueRecord(issue="schedule",      label="Schedule",      conceded=True,  negotiation_id="neg-4", notes="Advanced mobilization by 1 week for fixed startup bonus."),
        NegIssueRecord(issue="schedule",      label="Schedule",      conceded=False, negotiation_id="neg-5", notes="Could not accelerate — ironworker crew already at max."),
        NegIssueRecord(issue="warranty",      label="Warranty",      conceded=False, negotiation_id="neg-4", notes="Held 12-month warranty across both fabrication and erection."),
        NegIssueRecord(issue="warranty",      label="Warranty",      conceded=False, negotiation_id="neg-5", notes="Rejected extended warranty — union labor cost risk cited."),
    ],
    "vendor_coastal_bolt": [
        NegIssueRecord(issue="payment_terms", label="Payment Terms", conceded=True,  negotiation_id="neg-6", notes="Accepted Net-45 for orders above $100k."),
        NegIssueRecord(issue="unit_price",    label="Unit Price",    conceded=True,  negotiation_id="neg-6", notes="Reduced standard anchor bolt price 2% on volume commitment."),
        NegIssueRecord(issue="unit_price",    label="Unit Price",    conceded=False, negotiation_id="neg-7", notes="Held firm on specialty F1554 Grade 105 pricing."),
        NegIssueRecord(issue="schedule",      label="Schedule",      conceded=True,  negotiation_id="neg-6", notes="Accelerated delivery 3 weeks with sequence packaging included."),
        NegIssueRecord(issue="schedule",      label="Schedule",      conceded=True,  negotiation_id="neg-7", notes="Split shipment at no cost to hit 2 separate erection windows."),
        NegIssueRecord(issue="warranty",      label="Warranty",      conceded=False, negotiation_id="neg-6", notes="Standard 12-month material warranty; no extension offered."),
        NegIssueRecord(issue="warranty",      label="Warranty",      conceded=False, negotiation_id="neg-7", notes="Warranty is product-standard; non-negotiable per supplier policy."),
    ],
}

_NEG_TRADEOFFS: dict[str, list[TradeoffPoint]] = {
    "vendor_meridian_steel": [
        TradeoffPoint(negotiation_id="neg-1", label="Riverside 2024",     price_concession_pct=0,   schedule_concession_days=14, outcome="accepted",         year=2024),
        TradeoffPoint(negotiation_id="neg-2", label="Austin Fab 2024",    price_concession_pct=0,   schedule_concession_days=0,  outcome="counter-accepted", year=2024),
        TradeoffPoint(negotiation_id="neg-3", label="Coastal Hub 2023",   price_concession_pct=0,   schedule_concession_days=5,  outcome="accepted",         year=2023),
    ],
    "vendor_titan_fab": [
        TradeoffPoint(negotiation_id="neg-4", label="Austin Fab 2024",    price_concession_pct=3.5, schedule_concession_days=7,  outcome="accepted",         year=2024),
        TradeoffPoint(negotiation_id="neg-5", label="Riverside 2023",     price_concession_pct=0,   schedule_concession_days=0,  outcome="counter-accepted", year=2023),
    ],
    "vendor_coastal_bolt": [
        TradeoffPoint(negotiation_id="neg-6", label="Meridian HQ 2023",   price_concession_pct=2,   schedule_concession_days=21, outcome="accepted",         year=2023),
        TradeoffPoint(negotiation_id="neg-7", label="Austin Fab 2024",    price_concession_pct=0,   schedule_concession_days=0,  outcome="counter-accepted", year=2024),
    ],
}

_VENDOR_SUMMARIES = {
    "vendor_meridian_steel": "Conceded on payment terms in 2 of 3 past negotiations, held firm on unit price every time. Flexible on schedule when given lead-time notice, resistant on warranty scope.",
    "vendor_titan_fab":      "Willing to move on price when schedule slack exists. Holds firm on warranty and erection crew size. Has accepted payment term extensions in 2 prior contracts.",
    "vendor_coastal_bolt":   "Highly flexible on delivery timing and packaging. Price is firm on specialty items, negotiable on standard stock. Warranty terms are standard and non-negotiable.",
}

_VENDOR_NAMES = {
    "vendor_meridian_steel": "Meridian Steel Fabrication",
    "vendor_titan_fab":      "Titan Fabricators",
    "vendor_coastal_bolt":   "Coastal Bolt & Fastener",
}


@router.get("/negotiation-profile/{vendor_id}", response_model=NegotiationProfileResponse)
async def negotiation_profile(vendor_id: str):
    """
    Returns the negotiation profile for a vendor:
    - Per-issue tendency (typically concedes vs. holds firm) — majority count
    - Trade-off frontier points (price concession % vs. schedule concession days)
    Deterministic — no LLM.
    """
    if vendor_id not in _NEG_ISSUES:
        raise HTTPException(
            status_code=404,
            detail=f"No negotiation history found for vendor '{vendor_id}'. "
                   f"Valid IDs: {list(_NEG_ISSUES.keys())}"
        )

    issues    = _NEG_ISSUES[vendor_id]
    tradeoffs = _NEG_TRADEOFFS.get(vendor_id, [])

    # Compute per-issue tendency via majority count
    issue_keys = list(dict.fromkeys(r.issue for r in issues))  # preserve order, deduplicate
    tendencies = []
    for key in issue_keys:
        records      = [r for r in issues if r.issue == key]
        conceded_n   = sum(1 for r in records if r.conceded)
        held_n       = len(records) - conceded_n
        typically_concedes = conceded_n > held_n
        tendencies.append({
            "issue":              key,
            "label":              records[0].label,
            "typically_concedes": typically_concedes,
            "conceded_count":     conceded_n,
            "held_count":         held_n,
            "total_count":        len(records),
            "sample_note":        records[0].notes,
        })

    return NegotiationProfileResponse(
        vendor_id=vendor_id,
        vendor_name=_VENDOR_NAMES.get(vendor_id, vendor_id),
        summary=_VENDOR_SUMMARIES.get(vendor_id, ""),
        issue_tendencies=tendencies,
        tradeoff_points=[t.model_dump() for t in tradeoffs],
        raw_issues=[r.model_dump() for r in issues],
    )


# ══════════════════════════════════════════════════════════════════════════════
# FEATURE 6 — SUBMITTAL REVIEWER PATTERN ASSISTANT
# GET  /precedent/reviewer-pattern/{reviewer_id}
# POST /precedent/check-submittal-against-reviewer
# Deterministic aggregation + keyword field-presence check — no LLM.
# ══════════════════════════════════════════════════════════════════════════════

class ReviewerRejectionSeed(BaseModel):
    reviewer_id: str
    submittal_type: str
    rejection_reason: str
    reason_key: str   # machine-readable field name used for matching


class CheckSubmittalRequest(BaseModel):
    reviewer_id: str
    submittal_type: str
    present_fields: List[str]   # what the submittal declares it contains


# ── Seeded rejection history ──────────────────────────────────────────────────

REVIEWER_REJECTIONS_SEED: List[ReviewerRejectionSeed] = [
    # Diana Chang — skews toward missing bolt torque schedule & WPS
    ReviewerRejectionSeed(reviewer_id="rev_diana_chang",   submittal_type="Structural Steel Shop Drawing",  rejection_reason="Missing connection bolt torque schedule",         reason_key="bolt_torque_schedule"),
    ReviewerRejectionSeed(reviewer_id="rev_diana_chang",   submittal_type="Structural Steel Shop Drawing",  rejection_reason="Missing connection bolt torque schedule",         reason_key="bolt_torque_schedule"),
    ReviewerRejectionSeed(reviewer_id="rev_diana_chang",   submittal_type="Structural Steel Shop Drawing",  rejection_reason="Missing connection bolt torque schedule",         reason_key="bolt_torque_schedule"),
    ReviewerRejectionSeed(reviewer_id="rev_diana_chang",   submittal_type="Structural Steel Shop Drawing",  rejection_reason="Incomplete weld procedure specification (WPS)",    reason_key="weld_procedure_spec"),
    ReviewerRejectionSeed(reviewer_id="rev_diana_chang",   submittal_type="Structural Steel Shop Drawing",  rejection_reason="Incomplete weld procedure specification (WPS)",    reason_key="weld_procedure_spec"),
    ReviewerRejectionSeed(reviewer_id="rev_diana_chang",   submittal_type="Anchor Bolt Submittal",          rejection_reason="Missing connection bolt torque schedule",         reason_key="bolt_torque_schedule"),
    ReviewerRejectionSeed(reviewer_id="rev_diana_chang",   submittal_type="Anchor Bolt Submittal",          rejection_reason="Spec section cross-reference not cited",          reason_key="spec_cross_reference"),
    ReviewerRejectionSeed(reviewer_id="rev_diana_chang",   submittal_type="Mill Test Report",               rejection_reason="Heat number not traceable to delivery ticket",     reason_key="heat_number_traceability"),
    ReviewerRejectionSeed(reviewer_id="rev_diana_chang",   submittal_type="Mill Test Report",               rejection_reason="Heat number not traceable to delivery ticket",     reason_key="heat_number_traceability"),
    ReviewerRejectionSeed(reviewer_id="rev_diana_chang",   submittal_type="Concrete Mix Design",            rejection_reason="Spec section cross-reference not cited",          reason_key="spec_cross_reference"),
    # Marcus Okafor — skews heavily toward missing fire-rated assembly docs
    ReviewerRejectionSeed(reviewer_id="rev_marcus_okafor", submittal_type="Curtain Wall Shop Drawing",      rejection_reason="Missing fire-rated assembly documentation",       reason_key="fire_rated_assembly_docs"),
    ReviewerRejectionSeed(reviewer_id="rev_marcus_okafor", submittal_type="Curtain Wall Shop Drawing",      rejection_reason="Missing fire-rated assembly documentation",       reason_key="fire_rated_assembly_docs"),
    ReviewerRejectionSeed(reviewer_id="rev_marcus_okafor", submittal_type="Curtain Wall Shop Drawing",      rejection_reason="Missing fire-rated assembly documentation",       reason_key="fire_rated_assembly_docs"),
    ReviewerRejectionSeed(reviewer_id="rev_marcus_okafor", submittal_type="Door & Frame Submittal",         rejection_reason="Missing fire-rated assembly documentation",       reason_key="fire_rated_assembly_docs"),
    ReviewerRejectionSeed(reviewer_id="rev_marcus_okafor", submittal_type="Door & Frame Submittal",         rejection_reason="Incomplete spec cross-reference",                 reason_key="spec_cross_reference"),
    ReviewerRejectionSeed(reviewer_id="rev_marcus_okafor", submittal_type="Door & Frame Submittal",         rejection_reason="Incomplete spec cross-reference",                 reason_key="spec_cross_reference"),
    ReviewerRejectionSeed(reviewer_id="rev_marcus_okafor", submittal_type="Curtain Wall Shop Drawing",      rejection_reason="Finish schedule not included",                    reason_key="finish_schedule"),
    ReviewerRejectionSeed(reviewer_id="rev_marcus_okafor", submittal_type="Roofing Submittal",              rejection_reason="Missing fire-rated assembly documentation",       reason_key="fire_rated_assembly_docs"),
    # Leila Nazari — skews heavily toward NFPA 13 hydraulic calc missing
    ReviewerRejectionSeed(reviewer_id="rev_leila_nazari",  submittal_type="Fire Suppression Shop Drawing",  rejection_reason="NFPA 13 hydraulic calc sheet missing",            reason_key="hydraulic_calc_sheet"),
    ReviewerRejectionSeed(reviewer_id="rev_leila_nazari",  submittal_type="Fire Suppression Shop Drawing",  rejection_reason="NFPA 13 hydraulic calc sheet missing",            reason_key="hydraulic_calc_sheet"),
    ReviewerRejectionSeed(reviewer_id="rev_leila_nazari",  submittal_type="Fire Suppression Shop Drawing",  rejection_reason="NFPA 13 hydraulic calc sheet missing",            reason_key="hydraulic_calc_sheet"),
    ReviewerRejectionSeed(reviewer_id="rev_leila_nazari",  submittal_type="Fire Suppression Shop Drawing",  rejection_reason="Pipe schedule & hanger spacing not shown",        reason_key="pipe_schedule_hangers"),
    ReviewerRejectionSeed(reviewer_id="rev_leila_nazari",  submittal_type="Fire Suppression Shop Drawing",  rejection_reason="Pipe schedule & hanger spacing not shown",        reason_key="pipe_schedule_hangers"),
    ReviewerRejectionSeed(reviewer_id="rev_leila_nazari",  submittal_type="Fire Alarm Submittal",           rejection_reason="AHJ approval letter not attached",                reason_key="ahj_approval_letter"),
    ReviewerRejectionSeed(reviewer_id="rev_leila_nazari",  submittal_type="Fire Alarm Submittal",           rejection_reason="NFPA 13 hydraulic calc sheet missing",            reason_key="hydraulic_calc_sheet"),
    ReviewerRejectionSeed(reviewer_id="rev_leila_nazari",  submittal_type="Fire Alarm Submittal",           rejection_reason="Battery backup calculation missing",              reason_key="battery_backup_calc"),
    ReviewerRejectionSeed(reviewer_id="rev_leila_nazari",  submittal_type="Sprinkler Head Schedule",        rejection_reason="Pipe schedule & hanger spacing not shown",        reason_key="pipe_schedule_hangers"),
]

_REVIEWER_META = {
    "rev_diana_chang":   {"name": "Diana Chang",   "title": "Senior Structural Engineer", "firm": "Apex Engineering Group",  "total_reviewed": 10},
    "rev_marcus_okafor": {"name": "Marcus Okafor", "title": "Principal Architect",         "firm": "Vantage Design Partners", "total_reviewed": 8 },
    "rev_leila_nazari":  {"name": "Leila Nazari",  "title": "Fire Protection Engineer",    "firm": "SafeSpec Consulting",     "total_reviewed": 9 },
}


def _compute_rejection_pattern(reviewer_id: str) -> list:
    """Aggregate rejection reasons by frequency for a reviewer."""
    records = [r for r in REVIEWER_REJECTIONS_SEED if r.reviewer_id == reviewer_id]
    counts: dict = {}
    for r in records:
        if r.reason_key not in counts:
            counts[r.reason_key] = {"reason": r.rejection_reason, "reason_key": r.reason_key, "count": 0}
        counts[r.reason_key]["count"] += 1
    return sorted(counts.values(), key=lambda x: x["count"], reverse=True)


@router.get("/reviewer-pattern/{reviewer_id}")
async def reviewer_pattern(reviewer_id: str):
    """
    Returns the reviewer's historical rejection pattern — ranked by frequency.
    Deterministic aggregation from seeded data.
    """
    if reviewer_id not in _REVIEWER_META:
        raise HTTPException(
            status_code=404,
            detail=f"Reviewer '{reviewer_id}' not found. Valid IDs: {list(_REVIEWER_META.keys())}"
        )

    meta    = _REVIEWER_META[reviewer_id]
    pattern = _compute_rejection_pattern(reviewer_id)

    return {
        "reviewer_id":     reviewer_id,
        "reviewer_name":   meta["name"],
        "title":           meta["title"],
        "firm":            meta["firm"],
        "total_reviewed":  meta["total_reviewed"],
        "total_rejections": sum(r["count"] for r in pattern),
        "rejection_pattern": pattern,  # sorted by frequency desc
    }


@router.post("/check-submittal-against-reviewer")
async def check_submittal_against_reviewer(payload: CheckSubmittalRequest):
    """
    Checks a submittal's declared fields against the reviewer's top rejection reasons.
    Returns whether each top reason is covered, and flags the top unmet reason.
    Deterministic — no LLM.
    """
    if payload.reviewer_id not in _REVIEWER_META:
        raise HTTPException(status_code=404, detail=f"Reviewer '{payload.reviewer_id}' not found.")

    pattern = _compute_rejection_pattern(payload.reviewer_id)

    checks = []
    for reason in pattern:
        covered = reason["reason_key"] in payload.present_fields
        checks.append({
            "reason_key":       reason["reason_key"],
            "rejection_reason": reason["reason"],
            "frequency":        reason["count"],
            "covered_by_submittal": covered,
        })

    # Top unmet reason is the highest-frequency one not covered
    top_risk = next((c for c in checks if not c["covered_by_submittal"]), None)
    at_risk  = top_risk is not None

    meta = _REVIEWER_META[payload.reviewer_id]

    return {
        "reviewer_id":    payload.reviewer_id,
        "reviewer_name":  meta["name"],
        "submittal_type": payload.submittal_type,
        "at_risk":        at_risk,
        "top_risk":       top_risk,
        "checks":         checks,
        "summary": (
            f"High rejection risk: '{top_risk['rejection_reason']}' is {meta['name']}'s "
            f"most common rejection reason ({top_risk['frequency']}/{meta['total_reviewed']} reviews) "
            f"and is not present in this submittal."
        ) if at_risk else (
            f"Submittal covers {meta['name']}'s most common rejection reason. Low rejection risk."
        ),
    }


# ══════════════════════════════════════════════════════════════════════════════
# FEATURE 7 — GOLDEN THREAD COMPLIANCE MODE
# GET  /precedent/golden-thread/{project_id}
# POST /precedent/golden-thread/{project_id}/export
#
# Aggregation view — reads from existing evidence/decision records filtered
# to safety-relevant types. No new logic; seed provides the demo content.
# Future extension: POST /export → generate real PDF via WeasyPrint or pdfkit.
# ══════════════════════════════════════════════════════════════════════════════

from datetime import datetime as dt

SAFETY_RELEVANT_TYPES = {
    "material_substitution", "inspection", "design_change",
    "vendor_decision", "compliance_check",
}


class GoldenThreadEntryModel(BaseModel):
    id: str
    project_id: str
    date: str
    category: str
    title: str
    summary: str
    decided_by: str
    outcome: Literal["approved", "rejected", "flagged", "verified"]
    evidence_ref: str
    safety_relevance: str
    needs_human: bool


# ── Seeded records (aggregated from Sentinel/Trustline/Precedent evidence) ────

GOLDEN_THREAD_RECORDS: List[GoldenThreadEntryModel] = [
    # Austin Semiconductor Fab
    GoldenThreadEntryModel(id="gt-001", project_id="project_austin_fab",       date="2024-09-03", category="vendor_decision",       title="Vendor qualification override denied — structural steel fabricator",              summary="Vendor lacked AISC certification for semiconductor fab structural scope. Override denied; re-bid directed. Compliant vendor found within 12 days.",                                      decided_by="ORCHESTRA / Procurement Lead", outcome="rejected",  evidence_ref="prec-004 · AISC registry · AUS-FAB-PREQ-2024",          safety_relevance="Structural steel certification directly impacts load-path integrity of cleanroom slab connections.",                          needs_human=False),
    GoldenThreadEntryModel(id="gt-002", project_id="project_austin_fab",       date="2024-10-18", category="design_change",          title="Cleanroom floor slab tolerance specification revised to ±0.5mm",                 summary="EOR issued Revision C to slab tolerance spec following vibration sensitivity analysis for semiconductor tool footings.",                                                              decided_by="EOR — K. Yamamoto, SE",         outcome="approved",  evidence_ref="SD-208-Rev1 · Vibration Analysis Report VAR-2024-10",   safety_relevance="Tighter tolerance prevents differential settlement under precision semiconductor equipment loads.",                            needs_human=False),
    GoldenThreadEntryModel(id="gt-003", project_id="project_austin_fab",       date="2024-11-14", category="material_substitution",  title="Anchor bolt substitution approved with mandatory QA witness testing",             summary="Substitution of anchor bolt type approved with QA witness testing required. EOR requested 72-hour review hold.",                                                                    decided_by="ORCHESTRA / Structural EOR",    outcome="approved",  evidence_ref="prec-005 · MTR-77294 · WTL-204",                        safety_relevance="Anchor bolt specifications critical for seismic anchorage of semiconductor fab equipment.",                                    needs_human=True),
    GoldenThreadEntryModel(id="gt-004", project_id="project_austin_fab",       date="2024-11-17", category="inspection",             title="QA witness test FAILED — anchor bolt substitution vibration tolerance deficiency", summary="Approved substitution failed vibration tolerance test. Rework ordered. Original spec reinstated. 18-day schedule impact; $240k remediation.",                                    decided_by="QA Inspector — WTL-204",        outcome="flagged",   evidence_ref="WTL-204 · Rework Order RW-2024-11-17",                  safety_relevance="Vibration tolerance failure in cleanroom anchor connections is a structural safety deficiency requiring remediation.",          needs_human=True),
    GoldenThreadEntryModel(id="gt-005", project_id="project_austin_fab",       date="2024-12-09", category="compliance_check",       title="Rework inspection passed — original anchor bolt spec reinstated and verified",    summary="Independent inspection confirmed original specification anchor bolts installed correctly. Torque verification passed. Structural safety clearance issued.",                        decided_by="Third-party Inspector · TPI",   outcome="verified",  evidence_ref="TPI-CERT-2024-12 · Torque Log TL-2024-12-09",           safety_relevance="Final structural clearance for cleanroom anchor system prior to semiconductor tool installation.",                            needs_human=False),
    GoldenThreadEntryModel(id="gt-006", project_id="project_austin_fab",       date="2025-01-22", category="material_substitution",  title="Column splice plate upgraded A36→A572 Gr.50 for revised equipment loading",      summary="GC requested upgrade for column splices at Level 3 following updated equipment manifest. Approved without further review.",                                                        decided_by="EOR approval · Meridian Steel",  outcome="approved",  evidence_ref="Mill cert MTR-A572-2025 · CO-0041",                     safety_relevance="Higher-strength plate ensures splice connection meets revised equipment live load requirements.",                              needs_human=False),
    GoldenThreadEntryModel(id="gt-007", project_id="project_austin_fab",       date="2025-02-14", category="inspection",             title="UT + visual weld inspection — Level 2 structural connections — PASS",             summary="UT and visual inspection completed on all Level 2 moment connections. 2 welds flagged for minor undercut; repaired and re-inspected within 48 hours. Final: PASS.",               decided_by="CWI-BADGE-8821",                outcome="verified",  evidence_ref="UT Report UTR-2025-02-14 · WRL-2025-02",                safety_relevance="Moment connection weld quality is critical for lateral load resistance under seismic loading.",                                needs_human=False),
    # Riverside Commerce Towers
    GoldenThreadEntryModel(id="gt-008", project_id="project_riverside_towers", date="2024-03-12", category="compliance_check",       title="COI gap detected — Steel Rebar Co. insurance expired 43 days prior",             summary="COI for Steel Rebar Co. expired. Payment hold issued. Subcontractor renewed within 5 business days.",                                                                               decided_by="ORCHESTRA Trustline",           outcome="flagged",   evidence_ref="e1 · COI Archive · Vendor COI Registry",                safety_relevance="Lapsed COI creates uninsured exposure for structural reinforcement scope.",                                                    needs_human=True),
    # Coastal Logistics Hub
    GoldenThreadEntryModel(id="gt-009", project_id="project_coastal_hub",      date="2024-06-30", category="inspection",             title="Precast panel mill cert authentication failure — 2 of 8 shipments quarantined",   summary="2 precast panel shipments failed mill certificate authentication. Heat numbers not traceable to delivery ticket. Panels quarantined pending re-certification.",                  decided_by="ORCHESTRA Material Auth",       outcome="flagged",   evidence_ref="e3 · Mill Cert Archive · AUTH-2024-06",                 safety_relevance="Unverified precast panels cannot be installed in structural bays — load-bearing capacity unconfirmed.",                      needs_human=True),
]


@router.get("/golden-thread/{project_id}")
async def golden_thread(project_id: str):
    """
    Returns all safety-relevant compliance records for a project, chronologically.
    Aggregated from Sentinel checks, Trustline evidence, and Precedent decisions.
    """
    records = [
        r for r in GOLDEN_THREAD_RECORDS
        if r.project_id == project_id
        and r.category in SAFETY_RELEVANT_TYPES
    ]

    if not records:
        raise HTTPException(status_code=404, detail=f"No golden thread records found for project '{project_id}'.")

    # Sort chronologically
    records_sorted = sorted(records, key=lambda r: r.date)

    flagged_count  = sum(1 for r in records_sorted if r.outcome == "flagged")
    human_count    = sum(1 for r in records_sorted if r.needs_human)
    verified_count = sum(1 for r in records_sorted if r.outcome == "verified")

    return {
        "project_id":     project_id,
        "total_entries":  len(records_sorted),
        "flagged_count":  flagged_count,
        "human_required": human_count,
        "verified_count": verified_count,
        "generated_at":   dt.utcnow().isoformat(),
        "entries":        [r.model_dump() for r in records_sorted],
    }


@router.post("/golden-thread/{project_id}/export")
async def export_golden_thread(project_id: str):
    """
    Generates a structured compliance record for the project.
    Returns JSON with a plain-text summary ready for owner/regulator delivery.

    Future extension: replace plain-text generation with WeasyPrint or pdfkit
    to produce a stamped PDF. The data structure below maps directly to that output.
    """
    records = sorted(
        [r for r in GOLDEN_THREAD_RECORDS if r.project_id == project_id],
        key=lambda r: r.date
    )

    if not records:
        raise HTTPException(status_code=404, detail=f"No records for project '{project_id}'.")

    lines = [
        f"GOLDEN THREAD COMPLIANCE RECORD",
        f"Project: {project_id.replace('_', ' ').title()}",
        f"Generated: {dt.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
        f"Total entries: {len(records)}",
        f"{'─' * 60}",
    ]

    for r in records:
        lines += [
            f"\n[{r.date}] {r.category.upper().replace('_', ' ')} — {r.outcome.upper()}",
            f"  {r.title}",
            f"  {r.summary}",
            f"  Safety: {r.safety_relevance}",
            f"  Decided by: {r.decided_by}",
            f"  Evidence: {r.evidence_ref}",
            f"  Human review required: {'Yes' if r.needs_human else 'No'}",
        ]

    return {
        "project_id":    project_id,
        "exported_at":   dt.utcnow().isoformat(),
        "record_count":  len(records),
        "format":        "structured_json_with_plain_text_summary",
        "plain_text":    "\n".join(lines),
        "entries":       [r.model_dump() for r in records],
        # Future: "pdf_url": generate_pdf(records)  ← WeasyPrint/pdfkit hook
    }


# ══════════════════════════════════════════════════════════════════════════════
# FEATURE 8 — INSTITUTIONAL MEMORY
# GET /precedent/institutional-memory?search=
#
# Searchable archive of major past decisions — different view/filter over the
# same seeded PrecedentRecords. Adds decision_maker_still_active field.
# Uses keyword search; can swap for embedding similarity (same infra as
# Feature 1's _embed() function) if richer matching is needed.
# ══════════════════════════════════════════════════════════════════════════════

class MemoryRecord(BaseModel):
    id: str
    situation_type: str
    entity_id: str
    entity_name: str
    decision_made: str
    confidence_at_time: float
    dissenting_view: Optional[str]
    outcome: Optional[Literal["confirmed_good", "confirmed_bad", "pending"]]
    reasoning: str
    needs_human: bool
    decision_maker_role: str
    decision_maker_year: int
    decision_maker_still_active: bool
    date: str
    tags: list


INSTITUTIONAL_MEMORY: List[MemoryRecord] = [
    MemoryRecord(id="mem-001", situation_type="vendor_qualification_override", entity_id="vendor_meridian_steel",  entity_name="Meridian Steel Fabrication",  decision_made="Qualification override approved with enhanced inspection protocol and 10% retention holdback.",           confidence_at_time=0.71, dissenting_view="Project controls flagged insufficient vendor track record for scale of structural scope.",                             outcome="confirmed_bad",  reasoning="Override bypassed standard qualification threshold. Three structural connections required rework after approval, resulting in 11-day schedule impact and $88k remediation cost.",                                                                               needs_human=True,  decision_maker_role="Senior Project Executive",   decision_maker_year=2023, decision_maker_still_active=False, date="2023-08-14", tags=["vendor", "structural", "qualification", "override"]),
    MemoryRecord(id="mem-002", situation_type="material_substitution",         entity_id="vendor_coastal_bolt",    entity_name="Coastal Bolt & Fastener",      decision_made="Substitution denied. Original Grade-8 bolt specification maintained; expedited re-order placed.",              confidence_at_time=0.91, dissenting_view=None,                                                                                                                      outcome="confirmed_good", reasoning="Mid-pour substitution of a lower-grade bolt in foundation anchor connections carries unacceptable load-path risk. Denial was correct; re-order arrived within tolerance of original schedule.",                                                    needs_human=False, decision_maker_role="Structural Engineer of Record", decision_maker_year=2025, decision_maker_still_active=True,  date="2025-01-08", tags=["material", "bolt", "substitution", "foundation"]),
    MemoryRecord(id="mem-003", situation_type="clause_negotiation",            entity_id="vendor_titan_fab",       entity_name="Titan Fabricators",            decision_made="14-day force majeure extension granted; liquidated damages clause adjusted proportionally.",                   confidence_at_time=0.68, dissenting_view="Legal flagged precedent risk — future contracts on similar scopes may invoke same clause language.",                     outcome="pending",        reasoning="Weather data confirmed 3 qualifying rain days, supporting partial extension. Full 14-day grant exceeds verified excusable days; outcome still under monitoring.",                                                                                             needs_human=True,  decision_maker_role="Director of Contracts",      decision_maker_year=2024, decision_maker_still_active=False, date="2024-06-04", tags=["clause", "force majeure", "extension", "legal"]),
    MemoryRecord(id="mem-004", situation_type="vendor_qualification_override", entity_id="project_austin_fab",     entity_name="Austin Semiconductor Fab",     decision_made="Override denied. Procurement directed to run competitive re-bid with prequalified vendors.",                confidence_at_time=0.88, dissenting_view=None,                                                                                                                      outcome="confirmed_good", reasoning="Vendor lacked AISC certification for semiconductor fab structural steel. Re-bid surfaced a compliant vendor at comparable cost within 12 days.",                                                                                                      needs_human=False, decision_maker_role="VP Procurement",              decision_maker_year=2024, decision_maker_still_active=True,  date="2024-09-03", tags=["vendor", "qualification", "semiconductor", "AISC"]),
    MemoryRecord(id="mem-005", situation_type="material_substitution",         entity_id="project_austin_fab",     entity_name="Austin Semiconductor Fab",     decision_made="Substitution approved with independent QA witness testing at vendor facility.",                              confidence_at_time=0.79, dissenting_view="Structural engineer of record requested additional 72-hour hold for review.",                                           outcome="confirmed_bad",  reasoning="Approved substitution caused vibration tolerance failure in cleanroom floor slab connections. Rework cost $240k and 18-day delay on semiconductor tool install.",                                                                                              needs_human=True,  decision_maker_role="Senior Project Manager",     decision_maker_year=2024, decision_maker_still_active=False, date="2024-11-14", tags=["material", "substitution", "cleanroom", "vibration", "rework"]),
    MemoryRecord(id="mem-006", situation_type="clause_negotiation",            entity_id="vendor_meridian_steel",  entity_name="Meridian Steel Fabrication",  decision_made="Payment terms renegotiated from Net-30 to Net-45; 2% early-pay discount offered.",                          confidence_at_time=0.84, dissenting_view=None,                                                                                                                      outcome="confirmed_good", reasoning="Renegotiation preserved cash-flow buffer during peak structural phase without triggering lien risk. Vendor honored revised terms; no disputes filed.",                                                                                             needs_human=False, decision_maker_role="Chief Financial Officer",     decision_maker_year=2025, decision_maker_still_active=True,  date="2025-02-01", tags=["payment", "terms", "negotiation", "cash flow"]),
    MemoryRecord(id="mem-007", situation_type="change_order_approval",         entity_id="vendor_meridian_steel",  entity_name="Meridian Steel Fabrication",  decision_made="Change order rejected pending independent quantity take-off verification.",                                   confidence_at_time=0.77, dissenting_view="Field superintendent argued delays would compound if approval was deferred.",                                         outcome="confirmed_good", reasoning="Independent QTO found 22% quantity overstatement. Rejection saved $63k; renegotiated CO approved at corrected quantity within 5 days.",                                                                                                          needs_human=False, decision_maker_role="Project Controls Manager",   decision_maker_year=2025, decision_maker_still_active=False, date="2025-04-22", tags=["change order", "quantity", "overstatement", "cost control"]),
    MemoryRecord(id="mem-008", situation_type="material_substitution",         entity_id="vendor_coastal_bolt",    entity_name="Coastal Bolt & Fastener",      decision_made="Substitution approved for non-structural ancillary hardware only; primary spec unchanged.",                  confidence_at_time=0.93, dissenting_view=None,                                                                                                                      outcome="confirmed_good", reasoning="Clear scope boundary between structural and ancillary hardware made partial substitution low-risk. No rework required; cost saving of $12k realized.",                                                                                          needs_human=False, decision_maker_role="Procurement Lead",            decision_maker_year=2025, decision_maker_still_active=True,  date="2025-03-05", tags=["material", "substitution", "ancillary", "hardware", "cost saving"]),
]


@router.get("/institutional-memory")
async def institutional_memory(search: Optional[str] = None):
    """
    Searchable archive of major past decisions — organizational memory that
    survives staff departure. Records include decision_maker_still_active so
    the UI can flag decisions made by people no longer with the company.

    Search is keyword-based. To use embedding similarity instead, swap the
    filter below for the _embed() / _cosine() approach from Feature 1.
    """
    if not search or not search.strip():
        records = INSTITUTIONAL_MEMORY
    else:
        q = search.strip().lower()
        records = [
            r for r in INSTITUTIONAL_MEMORY
            if (
                q in r.decision_made.lower()
                or q in r.reasoning.lower()
                or q in r.entity_name.lower()
                or q in r.situation_type.lower()
                or any(q in tag.lower() for tag in r.tags)
                or (r.dissenting_view and q in r.dissenting_view.lower())
            )
        ]

    departed_count = sum(1 for r in records if not r.decision_maker_still_active)

    return {
        "total":          len(records),
        "departed_count": departed_count,
        "search_query":   search,
        "records":        [r.model_dump() for r in records],
    }


# ══════════════════════════════════════════════════════════════════════════════
# FEATURE 9 — OVERRIDE STATISTICS
# GET /precedent/override-statistics
# Pure aggregation — no LLM. Honest scorecard with mixed results.
# ══════════════════════════════════════════════════════════════════════════════

class OverrideRecord(BaseModel):
    id: str
    situation_type: str
    category_label: str
    recommendation_given: str
    was_overridden: bool
    outcome_after_override: Optional[Literal["worse", "better", "same"]]
    entity_name: str
    year: int
    cost_impact: Optional[str]


OVERRIDES_SEED: List[OverrideRecord] = [
    # Vendor qualification overrides — 3 overrides, 2 worse, 1 better
    OverrideRecord(id="ov-01", situation_type="vendor_qualification_override", category_label="Vendor Qualification",  recommendation_given="Deny qualification — vendor below AISC threshold",          was_overridden=True,  outcome_after_override="worse",  entity_name="Meridian Steel (2023)",    year=2023, cost_impact="$88k rework + 11d delay"),
    OverrideRecord(id="ov-02", situation_type="vendor_qualification_override", category_label="Vendor Qualification",  recommendation_given="Run competitive re-bid before awarding scope",              was_overridden=False, outcome_after_override=None,     entity_name="Austin Fab (2024)",        year=2024, cost_impact=None),
    OverrideRecord(id="ov-03", situation_type="vendor_qualification_override", category_label="Vendor Qualification",  recommendation_given="Reject vendor — expired safety certifications",              was_overridden=True,  outcome_after_override="worse",  entity_name="Coastal Logistics (2023)", year=2023, cost_impact="$42k remediation"),
    OverrideRecord(id="ov-04", situation_type="vendor_qualification_override", category_label="Vendor Qualification",  recommendation_given="Require EMR re-certification before award",                  was_overridden=True,  outcome_after_override="better", entity_name="Riverside Towers (2024)",  year=2024, cost_impact=None),
    # Material substitutions — 3 overrides, 2 worse, 1 same
    OverrideRecord(id="ov-05", situation_type="material_substitution",         category_label="Material Substitution", recommendation_given="Deny bolt substitution mid-pour — spec mismatch",           was_overridden=True,  outcome_after_override="worse",  entity_name="Austin Fab (2024)",        year=2024, cost_impact="$240k rework + 18d delay"),
    OverrideRecord(id="ov-06", situation_type="material_substitution",         category_label="Material Substitution", recommendation_given="Deny Grade-8 substitution — load path risk",                was_overridden=False, outcome_after_override=None,     entity_name="Coastal Bolt (2025)",      year=2025, cost_impact=None),
    OverrideRecord(id="ov-07", situation_type="material_substitution",         category_label="Material Substitution", recommendation_given="Require mill re-certification before installation",          was_overridden=True,  outcome_after_override="same",   entity_name="Riverside Towers (2023)", year=2023, cost_impact="No measurable impact"),
    OverrideRecord(id="ov-08", situation_type="material_substitution",         category_label="Material Substitution", recommendation_given="Hold anchor bolt substitution — 72hr EOR review required",  was_overridden=True,  outcome_after_override="worse",  entity_name="Austin Fab (2024 Q4)",     year=2024, cost_impact="$55k inspection + delay"),
    # Change orders — 2 overrides, 2 mixed
    OverrideRecord(id="ov-09", situation_type="change_order_approval",         category_label="Change Order",          recommendation_given="Reject CO pending independent QTO — overstatement flagged", was_overridden=False, outcome_after_override=None,     entity_name="Meridian Steel (2025)",    year=2025, cost_impact=None),
    OverrideRecord(id="ov-10", situation_type="change_order_approval",         category_label="Change Order",          recommendation_given="Reject CO — unit rates above regional benchmark by 28%",   was_overridden=True,  outcome_after_override="worse",  entity_name="Titan Fab (2024)",         year=2024, cost_impact="$91k overpayment"),
    OverrideRecord(id="ov-11", situation_type="change_order_approval",         category_label="Change Order",          recommendation_given="Require backup documentation before approval",               was_overridden=True,  outcome_after_override="better", entity_name="Coastal Hub (2024)",        year=2024, cost_impact=None),
    # Clause negotiations — 1 override, worse
    OverrideRecord(id="ov-12", situation_type="clause_negotiation",            category_label="Clause Negotiation",    recommendation_given="Limit force majeure extension to verified weather days only", was_overridden=True,  outcome_after_override="worse",  entity_name="Titan Fab (2024)",         year=2024, cost_impact="Ongoing dispute"),
    OverrideRecord(id="ov-13", situation_type="clause_negotiation",            category_label="Clause Negotiation",    recommendation_given="Accept Net-45 renegotiation — low lien risk",                was_overridden=False, outcome_after_override=None,     entity_name="Meridian Steel (2025)",    year=2025, cost_impact=None),
]


@router.get("/override-statistics")
async def override_statistics():
    """
    Honest scorecard — pure aggregation over seeded override records.
    Returns overall worse-rate and per-category breakdown.
    No LLM. Mixed results intentional — credibility depends on honesty.
    """
    overrides = [r for r in OVERRIDES_SEED if r.was_overridden]
    total     = len(overrides)
    worse     = sum(1 for r in overrides if r.outcome_after_override == "worse")
    better    = sum(1 for r in overrides if r.outcome_after_override == "better")
    same      = sum(1 for r in overrides if r.outcome_after_override == "same")
    worse_pct = round((worse / total) * 100) if total else 0

    # Per-category breakdown
    categories = list(dict.fromkeys(r.category_label for r in OVERRIDES_SEED))
    cat_stats = []
    for cat in categories:
        all_cat  = [r for r in OVERRIDES_SEED if r.category_label == cat]
        ov_cat   = [r for r in all_cat if r.was_overridden]
        ov_worse = [r for r in ov_cat if r.outcome_after_override == "worse"]
        cat_stats.append({
            "label":          cat,
            "total":          len(all_cat),
            "override_count": len(ov_cat),
            "worse_count":    len(ov_worse),
            "better_count":   sum(1 for r in ov_cat if r.outcome_after_override == "better"),
            "override_rate_pct": round(len(ov_cat) / len(all_cat) * 100) if all_cat else 0,
            "worse_rate_pct":    round(len(ov_worse) / len(ov_cat) * 100) if ov_cat else 0,
        })
    cat_stats.sort(key=lambda x: x["override_count"], reverse=True)

    return {
        "total_overrides":   total,
        "worse_count":       worse,
        "better_count":      better,
        "same_count":        same,
        "worse_pct":         worse_pct,
        "headline":          f"When teams overrode our top recommendation, outcomes were worse in {worse} of {total} cases ({worse_pct}%)",
        "category_breakdown": cat_stats,
        "override_log":      [r.model_dump() for r in overrides],
    }
