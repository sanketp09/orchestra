"""
COMPASS — Clause Value Calculator
GET  /api/compass/clauses                 — list available clauses + slider config
POST /api/compass/clause-value            — compute exposure/value for a clause at a given parameter

Answers: "What is this contract clause actually worth to us?"

Design:
  - Every number is plain deterministic arithmetic (no LLM). Each clause type
    has a small, named-constant formula for:
      * potential_exposure  — a fixed worst-case $ ceiling for that clause
      * protected_amount(v) — how much of that ceiling is mitigated at
                               parameter value v (clause-specific, monotonic
                               in the favorable direction)
      * expected_value      — the "gap": ceiling - protected_amount(current)
                               (how much is still at risk today)
      * negotiation_value   — protected_amount(recommended) - protected_amount(current)
                               (the $ value of moving to the recommended terms)
  - `recommended_value` is a stated, named target per clause (e.g. 92% of the
    exposure ceiling for a cap, or a market-baseline for a term) — never an
    arbitrary number tuned to produce a specific output.
  - Scenario paths (best/expected/worst) are the same ceiling scaled by
    named fractions, applied uniformly across clause types.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()

# --------------------------------------------------------------------------
# Models
# --------------------------------------------------------------------------

ClauseId = Literal[
    "liquidated_damages_cap",
    "termination_right",
    "payment_term",
    "warranty",
    "escalation_clause",
]

Unit = Literal["usd", "percent", "days", "months"]


class ClauseParameterConfig(BaseModel):
    unit: Unit
    current_value: float
    slider_min: float
    slider_max: float
    slider_step: float
    presets: list[float]


class ClauseDefinition(BaseModel):
    clause_id: ClauseId
    name: str
    clause_text: str
    parameter: ClauseParameterConfig


class ScenarioSet(BaseModel):
    best_case: float
    expected: float
    worst_case: float


class EvidenceItem(BaseModel):
    source: str
    value: str
    reliability: Literal["verified_transaction", "third_party_observed", "self_reported"]


class ClauseValueResult(BaseModel):
    clause_id: ClauseId
    name: str
    parameter_value: float
    parameter_unit: Unit
    potential_exposure: float = Field(..., description="Fixed worst-case $ ceiling for this clause")
    expected_value: float = Field(..., description="Amount of the ceiling still at risk today (the 'gap')")
    best_case: float
    worst_case: float
    scenarios: ScenarioSet
    recommended_value: float
    negotiation_value: float = Field(..., description="$ value of moving from current to recommended")
    negotiation_headline: str
    assumptions: list[str]
    evidence: list[EvidenceItem]
    reasoning: str


# --------------------------------------------------------------------------
# Named constants — the deterministic financial model per clause
# --------------------------------------------------------------------------

BEST_CASE_FRACTION = 1 / 6      # ~17% of the worst-case ceiling
EXPECTED_CASE_FRACTION = 0.5    # 50% of the worst-case ceiling

# Reference project used across all clause calculations for this demo.
REFERENCE_CONTRACT_VALUE = 8_500_000.0
REFERENCE_CONTRACT_MONTHS = 14

# Liquidated Damages Cap
LD_WORST_CASE_DELAY_DAYS = 60
LD_PER_DIEM_DELAY_COST = 7_000.0
LD_RECOMMENDED_CEILING_CAPTURE = 0.92  # target: capture 92% of the exposure ceiling

# Escalation Clause
ESC_MATERIAL_PORTION_OF_CONTRACT = 3_000_000.0
ESC_WORST_CASE_MARKET_ESCALATION_PCT = 9.0
ESC_RECOMMENDED_CAP_PCT = 1.0

# Termination Right (notice period)
TERM_DAILY_LOCK_IN_COST = 4_500.0
TERM_RECOMMENDED_NOTICE_DAYS = 15.0

# Payment Term
PAY_COST_OF_CAPITAL_ANNUAL = 0.09
PAY_BASELINE_DAYS = 30.0
PAY_DAILY_BILLING = REFERENCE_CONTRACT_VALUE / (REFERENCE_CONTRACT_MONTHS * 30)
PAY_QUADRATIC_COEFFICIENT = PAY_DAILY_BILLING * PAY_COST_OF_CAPITAL_ANNUAL / 365
PAY_RECOMMENDED_DAYS = PAY_BASELINE_DAYS

# Warranty
WAR_ANNUAL_DEFECT_REMEDIATION_COST = 95_000.0
WAR_OBSERVATION_WINDOW_MONTHS = 36.0
WAR_RECOMMENDED_MONTHS = 24.0


# --------------------------------------------------------------------------
# Clause definitions (text, slider config)
# --------------------------------------------------------------------------

CLAUSE_DEFINITIONS: dict[ClauseId, ClauseDefinition] = {
    "liquidated_damages_cap": ClauseDefinition(
        clause_id="liquidated_damages_cap",
        name="Liquidated Damages Cap",
        clause_text=(
            "In no event shall Contractor's aggregate liability for liquidated damages "
            "under this Agreement exceed One Hundred Thousand Dollars ($100,000), "
            "regardless of the duration of any delay in Substantial Completion."
        ),
        parameter=ClauseParameterConfig(
            unit="usd", current_value=100_000, slider_min=50_000, slider_max=500_000,
            slider_step=10_000, presets=[100_000, 200_000, 300_000, 400_000],
        ),
    ),
    "termination_right": ClauseDefinition(
        clause_id="termination_right",
        name="Termination Right",
        clause_text=(
            "Owner may terminate this Agreement for cause upon thirty (30) days' "
            "prior written notice to Contractor, provided such default remains "
            "uncured at the expiration of the notice period."
        ),
        parameter=ClauseParameterConfig(
            unit="days", current_value=30, slider_min=0, slider_max=90,
            slider_step=15, presets=[15, 30, 45, 60],
        ),
    ),
    "payment_term": ClauseDefinition(
        clause_id="payment_term",
        name="Payment Term",
        clause_text=(
            "Owner shall pay each undisputed invoice within forty-five (45) days "
            "of receipt. Amounts not paid when due shall not accrue interest."
        ),
        parameter=ClauseParameterConfig(
            unit="days", current_value=45, slider_min=30, slider_max=90,
            slider_step=15, presets=[30, 45, 60, 75],
        ),
    ),
    "warranty": ClauseDefinition(
        clause_id="warranty",
        name="Warranty",
        clause_text=(
            "Contractor warrants its work against defects in materials and "
            "workmanship for a period of twelve (12) months following Substantial "
            "Completion."
        ),
        parameter=ClauseParameterConfig(
            unit="months", current_value=12, slider_min=6, slider_max=36,
            slider_step=6, presets=[12, 18, 24, 36],
        ),
    ),
    "escalation_clause": ClauseDefinition(
        clause_id="escalation_clause",
        name="Escalation Clause",
        clause_text=(
            "Contract Sum shall be adjusted for increases in the producer price "
            "index for structural steel, provided that Owner's exposure under "
            "this clause shall not exceed three percent (3%) annually."
        ),
        parameter=ClauseParameterConfig(
            unit="percent", current_value=3, slider_min=0, slider_max=10,
            slider_step=1, presets=[3, 5, 7, 9],
        ),
    ),
}


# --------------------------------------------------------------------------
# Deterministic per-clause math
# --------------------------------------------------------------------------


def _ld_ceiling() -> float:
    return LD_WORST_CASE_DELAY_DAYS * LD_PER_DIEM_DELAY_COST


def _ld_protected(v: float) -> float:
    return min(max(v, 0.0), _ld_ceiling())


def _esc_ceiling() -> float:
    return ESC_MATERIAL_PORTION_OF_CONTRACT * ESC_WORST_CASE_MARKET_ESCALATION_PCT / 100


def _esc_protected(v: float) -> float:
    return ESC_MATERIAL_PORTION_OF_CONTRACT * max(0.0, ESC_WORST_CASE_MARKET_ESCALATION_PCT - v) / 100


def _term_ceiling() -> float:
    return CLAUSE_DEFINITIONS["termination_right"].parameter.slider_max * TERM_DAILY_LOCK_IN_COST


def _term_protected(v: float) -> float:
    return _term_ceiling() - v * TERM_DAILY_LOCK_IN_COST


def _pay_ceiling() -> float:
    max_days = CLAUSE_DEFINITIONS["payment_term"].parameter.slider_max
    return PAY_QUADRATIC_COEFFICIENT * (max_days - PAY_BASELINE_DAYS) ** 2


def _pay_protected(v: float) -> float:
    extra_days = max(0.0, v - PAY_BASELINE_DAYS)
    exposure = PAY_QUADRATIC_COEFFICIENT * extra_days**2
    return _pay_ceiling() - exposure


def _war_ceiling() -> float:
    return WAR_ANNUAL_DEFECT_REMEDIATION_COST * WAR_OBSERVATION_WINDOW_MONTHS / 12


def _war_protected(v: float) -> float:
    return WAR_ANNUAL_DEFECT_REMEDIATION_COST * v / 12


CEILING_FN = {
    "liquidated_damages_cap": _ld_ceiling,
    "escalation_clause": _esc_ceiling,
    "termination_right": _term_ceiling,
    "payment_term": _pay_ceiling,
    "warranty": _war_ceiling,
}

PROTECTED_FN = {
    "liquidated_damages_cap": _ld_protected,
    "escalation_clause": _esc_protected,
    "termination_right": _term_protected,
    "payment_term": _pay_protected,
    "warranty": _war_protected,
}

RECOMMENDED_VALUE_FN = {
    "liquidated_damages_cap": lambda: round(_ld_ceiling() * LD_RECOMMENDED_CEILING_CAPTURE, -3),
    "escalation_clause": lambda: ESC_RECOMMENDED_CAP_PCT,
    "termination_right": lambda: TERM_RECOMMENDED_NOTICE_DAYS,
    "payment_term": lambda: PAY_RECOMMENDED_DAYS,
    "warranty": lambda: WAR_RECOMMENDED_MONTHS,
}


def compute_clause_value(clause_id: ClauseId, parameter_value: float) -> ClauseValueResult:
    definition = CLAUSE_DEFINITIONS[clause_id]
    ceiling = CEILING_FN[clause_id]()
    protected_fn = PROTECTED_FN[clause_id]

    current_protected = protected_fn(parameter_value)
    expected_value = round(max(0.0, ceiling - current_protected), 0)

    recommended_value = RECOMMENDED_VALUE_FN[clause_id]()
    recommended_protected = protected_fn(recommended_value)
    negotiation_value = round(recommended_protected - current_protected, 0)

    best_case = round(ceiling * BEST_CASE_FRACTION, 0)
    expected_case = round(ceiling * EXPECTED_CASE_FRACTION, 0)
    worst_case = round(ceiling, 0)

    unit = definition.parameter.unit
    unit_fmt = {"usd": "${:,.0f}", "percent": "{:.0f}%", "days": "{:.0f} days", "months": "{:.0f} months"}[unit]

    negotiation_headline = (
        f"Moving this clause from {unit_fmt.format(parameter_value)} to "
        f"{unit_fmt.format(recommended_value)} is worth approximately "
        f"${abs(negotiation_value):,.0f} to the project."
    )

    assumptions = _assumptions_for(clause_id)
    evidence = _evidence_for(clause_id)
    reasoning = (
        f"At the current {unit_fmt.format(parameter_value)} setting, {definition.name} leaves "
        f"${expected_value:,.0f} of a ${ceiling:,.0f} worst-case exposure unmitigated. "
        f"Moving to the recommended {unit_fmt.format(recommended_value)} would capture an "
        f"additional ${negotiation_value:,.0f} of protection."
    )

    return ClauseValueResult(
        clause_id=clause_id,
        name=definition.name,
        parameter_value=parameter_value,
        parameter_unit=unit,
        potential_exposure=round(ceiling, 0),
        expected_value=expected_value,
        best_case=best_case,
        worst_case=worst_case,
        scenarios=ScenarioSet(best_case=best_case, expected=expected_case, worst_case=worst_case),
        recommended_value=recommended_value,
        negotiation_value=negotiation_value,
        negotiation_headline=negotiation_headline,
        assumptions=assumptions,
        evidence=evidence,
        reasoning=reasoning,
    )


def _assumptions_for(clause_id: ClauseId) -> list[str]:
    return {
        "liquidated_damages_cap": [
            f"Worst-case delay of {LD_WORST_CASE_DELAY_DAYS} days, based on this project's critical-path float.",
            f"Owner's actual per-diem delay cost estimated at ${LD_PER_DIEM_DELAY_COST:,.0f}/day (lost revenue + carrying cost).",
            f"Recommended cap targets {LD_RECOMMENDED_CEILING_CAPTURE:.0%} of full worst-case exposure.",
        ],
        "escalation_clause": [
            f"${ESC_MATERIAL_PORTION_OF_CONTRACT:,.0f} of contract value is materials subject to price escalation.",
            f"Worst-case annual market escalation assumed at {ESC_WORST_CASE_MARKET_ESCALATION_PCT:.0f}% (recent peak).",
            f"Recommended cap of {ESC_RECOMMENDED_CAP_PCT:.0f}% reflects a tighter, still-bankable pass-through limit.",
        ],
        "termination_right": [
            f"Estimated cost of being locked in with an underperforming vendor: ${TERM_DAILY_LOCK_IN_COST:,.0f}/day.",
            "Ceiling assumes the maximum notice period allowed under the current negotiating range.",
            f"Recommended notice period of {TERM_RECOMMENDED_NOTICE_DAYS:.0f} days matches this owner's standard template.",
        ],
        "payment_term": [
            f"Cost of capital assumed at {PAY_COST_OF_CAPITAL_ANNUAL:.0%} annually.",
            f"Average daily billing of ${PAY_DAILY_BILLING:,.0f}, derived from the ${REFERENCE_CONTRACT_VALUE:,.0f} contract over {REFERENCE_CONTRACT_MONTHS} months.",
            f"Baseline market payment term assumed at Net {PAY_BASELINE_DAYS:.0f}.",
        ],
        "warranty": [
            f"Annual latent-defect remediation cost estimated at ${WAR_ANNUAL_DEFECT_REMEDIATION_COST:,.0f}.",
            f"Latent defects assumed to emerge within a {WAR_OBSERVATION_WINDOW_MONTHS:.0f}-month observation window.",
            f"Recommended coverage of {WAR_RECOMMENDED_MONTHS:.0f} months matches this trade's typical negotiated extension.",
        ],
    }[clause_id]


def _evidence_for(clause_id: ClauseId) -> list[EvidenceItem]:
    return {
        "liquidated_damages_cap": [
            EvidenceItem(source="Master schedule — critical path float", value=f"{LD_WORST_CASE_DELAY_DAYS} days", reliability="verified_transaction"),
            EvidenceItem(source="Owner revenue-per-day model", value=f"${LD_PER_DIEM_DELAY_COST:,.0f}/day", reliability="third_party_observed"),
        ],
        "escalation_clause": [
            EvidenceItem(source="Steel & rebar spend schedule", value=f"${ESC_MATERIAL_PORTION_OF_CONTRACT:,.0f}", reliability="verified_transaction"),
            EvidenceItem(source="Producer price index, 12-month peak", value=f"{ESC_WORST_CASE_MARKET_ESCALATION_PCT:.0f}%", reliability="third_party_observed"),
        ],
        "termination_right": [
            EvidenceItem(source="Program management overhead rate", value=f"${TERM_DAILY_LOCK_IN_COST:,.0f}/day", reliability="third_party_observed"),
        ],
        "payment_term": [
            EvidenceItem(source="Treasury cost-of-capital rate", value=f"{PAY_COST_OF_CAPITAL_ANNUAL:.0%}", reliability="third_party_observed"),
            EvidenceItem(source="Contract billing schedule", value=f"${REFERENCE_CONTRACT_VALUE:,.0f} / {REFERENCE_CONTRACT_MONTHS} mo", reliability="verified_transaction"),
        ],
        "warranty": [
            EvidenceItem(source="Trade-specific defect claims history", value=f"${WAR_ANNUAL_DEFECT_REMEDIATION_COST:,.0f}/yr", reliability="third_party_observed"),
        ],
    }[clause_id]


# --------------------------------------------------------------------------
# Routes
# --------------------------------------------------------------------------


@router.get("/api/compass/clauses", response_model=list[ClauseDefinition])
async def list_clauses() -> list[ClauseDefinition]:
    return list(CLAUSE_DEFINITIONS.values())


class ClauseValueRequest(BaseModel):
    clause_id: ClauseId
    parameter_value: float | None = None  # defaults to the clause's current_value if omitted


@router.post("/api/compass/clause-value", response_model=ClauseValueResult)
async def clause_value(request: ClauseValueRequest) -> ClauseValueResult:
    if request.clause_id not in CLAUSE_DEFINITIONS:
        raise HTTPException(status_code=404, detail=f"Unknown clause_id: {request.clause_id!r}")

    definition = CLAUSE_DEFINITIONS[request.clause_id]
    value = request.parameter_value if request.parameter_value is not None else definition.parameter.current_value

    if not (definition.parameter.slider_min <= value <= definition.parameter.slider_max):
        raise HTTPException(
            status_code=400,
            detail=f"parameter_value must be between {definition.parameter.slider_min} and {definition.parameter.slider_max}",
        )

    return compute_clause_value(request.clause_id, value)
