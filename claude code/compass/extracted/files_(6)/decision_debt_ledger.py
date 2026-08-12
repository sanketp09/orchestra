"""
COMPASS — Decision Debt Ledger
GET  /compass/decision-debt-ledger?company_id=
POST /compass/decision-debt-ledger/{debt_id}/simulate-deadline

"What risk did we knowingly postpone, who owns it, and when must it be resolved?"

Design notes:
- Zero LLM calls. Age, overdue-state, exposure aggregation, priority score,
  and the next-best-action text are all deterministic — date arithmetic,
  sums, and threshold comparisons, plus plain string templates.
- A decision debt is NOT an accidental risk or a missed control — it's a
  team KNOWINGLY choosing to proceed without something (a certification, a
  competitive bid, a signed drawing) because the schedule required it. The
  `reason` field is what makes this "debt" instead of "an error."
- Seeded data below is tuned to land on the exact demo figures from the
  product brief: 7 open decisions, $640K total exposure, 3 overdue, 2
  critical — that's a deliberate property of the seed data, not a
  coincidence baked into the math.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

TODAY = date(2026, 8, 11)

# Thresholds — the only inputs the overdue-state / priority math depends on.
AGING_WINDOW_DAYS = 14          # days-remaining at or below this -> "aging"
CRITICAL_EXPOSURE_USD = 150_000  # exposure at/above this can trigger "critical"
CRITICAL_URGENCY_DAYS = 7        # days-remaining at/below this can trigger "critical" (once aging/overdue)

Status = Literal["open", "aging", "overdue", "resolved"]
PriorityLabel = Literal["low", "medium", "high", "critical"]


# ---------------------------------------------------------------------------
# Storage shape
# ---------------------------------------------------------------------------

class DecisionDebt(BaseModel):
    id: str
    company_id: str
    project: str
    decision: str
    reason: str
    owner: str
    deadline: date
    exposure_usd: float
    risk: str                 # short risk label, e.g. "Certification failure post-installation"
    evidence: list[str]
    dependencies: list[str]
    impact: str
    created_date: date
    resolved: bool = False

    # computed at read time, not stored
    status: Optional[Status] = None
    age_days: Optional[int] = None
    days_remaining: Optional[int] = None
    is_critical: Optional[bool] = None
    priority_score: Optional[float] = None
    priority_label: Optional[PriorityLabel] = None
    next_best_action: Optional[str] = None


class DebtStackSummary(BaseModel):
    open_decisions: int
    total_exposure_usd: float
    overdue_count: int
    critical_count: int


class DecisionDebtLedgerResponse(BaseModel):
    company_id: str
    as_of: str
    stack: DebtStackSummary
    debts: list[DecisionDebt]


class SimulateDeadlineRequest(BaseModel):
    advance_days: Optional[int] = None  # if omitted, jumps to (deadline + 1 day)


class SimulateDeadlineResponse(BaseModel):
    debt_id: str
    evaluated_as_of: str
    previous_status: Status
    new_status: Status
    transition: list[Status]
    new_next_best_action: str
    debt: DecisionDebt


# ---------------------------------------------------------------------------
# SEEDED / MOCK REFERENCE DATA
# 7 knowingly-deferred procurement decisions across Coastal Bay Builders'
# active projects. Statuses below are what these dates/thresholds compute
# to as of TODAY — they aren't hardcoded, they fall out of the dates.
# ---------------------------------------------------------------------------

_RAW_DEBTS: list[dict] = [
    {
        "id": "debt-001",
        "company_id": "company_coastal_bay",
        "project": "Riverside Commons — Phase 2",
        "decision": "Proceed without final supplier certification",
        "reason": "Certification lab has a 3-week backlog and the structural steel is needed to hold the foundation schedule.",
        "owner": "Marcus Webb, Procurement Lead",
        "deadline": date(2026, 8, 18),
        "exposure_usd": 180_000,
        "risk": "Steel installed before certification could fail inspection",
        "evidence": [
            "Lab quote confirms 3-week certification backlog (Jul 30)",
            "Structural engineer sign-off is pending certification (Aug 2)",
        ],
        "dependencies": ["Foundation pour schedule", "City inspection sign-off"],
        "impact": "If certification fails after installation, may require partial demolition and re-fabrication of placed steel.",
        "created_date": date(2026, 7, 10),
    },
    {
        "id": "debt-002",
        "company_id": "company_coastal_bay",
        "project": "Bayview Tower",
        "decision": "Award electrical subcontract without a third competitive bid",
        "reason": "Only two of three invited vendors responded by the bid deadline; the schedule couldn't absorb another extension.",
        "owner": "Priya Anand, Project Manager",
        "deadline": date(2026, 8, 5),
        "exposure_usd": 95_000,
        "risk": "Contract price may exceed competitive market rate",
        "evidence": [
            "Bid log shows 2 of 3 invited vendors responded (Jul 28)",
            "Vendor C requested a 10-day extension (Jul 30)",
        ],
        "dependencies": ["Electrical rough-in start date"],
        "impact": "Without competitive pressure, contract price may land 8-12% above market rate.",
        "created_date": date(2026, 7, 15),
    },
    {
        "id": "debt-003",
        "company_id": "company_coastal_bay",
        "project": "Harbor District Retail",
        "decision": "Accept concrete supplier's delivery schedule despite a missed pour window",
        "reason": "The alternate supplier's lead time is 3 weeks longer, and the pour window is already tight.",
        "owner": "Owen Reyes, Site Superintendent",
        "deadline": date(2026, 7, 28),
        "exposure_usd": 60_000,
        "risk": "Liquidated damages clause exposure from continued schedule slip",
        "evidence": [
            "Delivery schedule email shows a 2-day slip (Jul 18)",
            "Supplier confirmed no alternate slot before September (Jul 22)",
        ],
        "dependencies": ["Slab pour sequencing", "Rebar delivery"],
        "impact": "Continued slip risks triggering the liquidated damages clause at 30 days.",
        "created_date": date(2026, 7, 1),
    },
    {
        "id": "debt-004",
        "company_id": "company_coastal_bay",
        "project": "Harbor District Retail",
        "decision": "Proceed with HVAC ductwork order despite a missing insurance certificate",
        "reason": "The vendor's insurance renewal is delayed at their carrier, and ductwork lead time is on the critical path.",
        "owner": "Marcus Webb, Procurement Lead",
        "deadline": date(2026, 8, 25),
        "exposure_usd": 40_000,
        "risk": "Uninsured vendor on site before renewal clears",
        "evidence": [
            "Vendor certificate expired Jul 31, renewal pending (Aug 1)",
            "Broker confirmed renewal is in process (Aug 5)",
        ],
        "dependencies": ["HVAC rough-in start"],
        "impact": "Uninsured vendor on site exposes the company to liability if an incident occurs before renewal clears.",
        "created_date": date(2026, 8, 1),
    },
    {
        "id": "debt-005",
        "company_id": "company_coastal_bay",
        "project": "Harbor District Retail",
        "decision": "Single-source copper wiring despite a pending antitrust inquiry disclosure",
        "reason": "This vendor is the only qualified supplier within the required lead time; the inquiry is preliminary and unconfirmed.",
        "owner": "Priya Anand, Project Manager",
        "deadline": date(2026, 9, 30),
        "exposure_usd": 25_000,
        "risk": "Reputational exposure if the inquiry becomes public",
        "evidence": [
            "Industry trade alert flags a preliminary inquiry (Aug 3)",
            "Vendor legal counsel denies wrongdoing (Aug 6)",
        ],
        "dependencies": ["Electrical trim-out"],
        "impact": "Low direct cost exposure, but reputational risk if the inquiry becomes public during the project.",
        "created_date": date(2026, 8, 6),
    },
    {
        "id": "debt-006",
        "company_id": "company_coastal_bay",
        "project": "Bayview Tower",
        "decision": "Start structural steel fabrication before final shop drawing approval",
        "reason": "Fabrication must start now to hit the steel erection date; architect review is 90% complete.",
        "owner": "Owen Reyes, Site Superintendent",
        "deadline": date(2026, 8, 14),
        "exposure_usd": 210_000,
        "risk": "Fabricated steel may not match final approved drawings",
        "evidence": [
            "Architect redlines returned with 2 open items remaining (Aug 4)",
            "Fabricator confirmed the slot is reserved only through Aug 14 (Aug 5)",
        ],
        "dependencies": ["Steel erection schedule", "Crane mobilization"],
        "impact": "If final drawings require design changes, fabricated steel may need costly rework or scrap.",
        "created_date": date(2026, 7, 20),
    },
    {
        "id": "debt-007",
        "company_id": "company_coastal_bay",
        "project": "Riverside Commons — Phase 2",
        "decision": "Approve drywall subcontractor despite an unresolved lien from a prior project",
        "reason": "This subcontractor is the only available crew for the schedule window; the lien is against a different developer.",
        "owner": "Marcus Webb, Procurement Lead",
        "deadline": date(2026, 8, 1),
        "exposure_usd": 30_000,
        "risk": "Subcontractor's bonding capacity could be frozen mid-project",
        "evidence": [
            "Lien filing pulled from county records (Jul 25)",
            "Subcontractor's attorney provided a dispute letter (Jul 29)",
        ],
        "dependencies": ["Drywall start date", "Paint schedule"],
        "impact": "If the lien escalates to judgment, the subcontractor's bonding could be frozen, forcing an emergency replacement.",
        "created_date": date(2026, 7, 18),
    },
]

DEBTS: dict[str, DecisionDebt] = {d["id"]: DecisionDebt(**d) for d in _RAW_DEBTS}


# ---------------------------------------------------------------------------
# Deterministic calculations
# ---------------------------------------------------------------------------

def calculate_age(debt: DecisionDebt, as_of: date) -> int:
    return (as_of - debt.created_date).days


def calculate_overdue_state(debt: DecisionDebt, as_of: date) -> tuple[Status, int]:
    if debt.resolved:
        return "resolved", (debt.deadline - as_of).days
    days_remaining = (debt.deadline - as_of).days
    if days_remaining < 0:
        return "overdue", days_remaining
    if days_remaining <= AGING_WINDOW_DAYS:
        return "aging", days_remaining
    return "open", days_remaining


def calculate_is_critical(status: Status, exposure_usd: float, days_remaining: int) -> bool:
    if status == "resolved":
        return False
    return status in ("aging", "overdue") and exposure_usd >= CRITICAL_EXPOSURE_USD and days_remaining <= CRITICAL_URGENCY_DAYS


def calculate_priority(status: Status, exposure_usd: float, is_critical: bool) -> tuple[float, PriorityLabel]:
    urgency_weight = {"open": 0.0, "aging": 0.5, "overdue": 1.0, "resolved": -1.0}[status]
    score = exposure_usd * (1 + urgency_weight)
    if is_critical:
        score *= 1.2
    score = round(score, 2)

    if status == "resolved":
        label: PriorityLabel = "low"
    elif is_critical or score >= 300_000:
        label = "critical"
    elif score >= 150_000:
        label = "high"
    elif score >= 50_000:
        label = "medium"
    else:
        label = "low"
    return score, label


def calculate_next_best_action(debt: DecisionDebt, status: Status, is_critical: bool, days_remaining: int) -> str:
    owner_first = debt.owner.split(",")[0]
    if status == "resolved":
        return f"Resolved — no further action needed."
    if status == "overdue" and is_critical:
        return (
            f"Escalate immediately — schedule an emergency review with {owner_first} before any further "
            f"procurement proceeds on dependent work: {', '.join(debt.dependencies)}."
        )
    if status == "overdue":
        return f"Deadline has passed — {owner_first} must resolve this or formally accept the residual risk this week."
    if status == "aging" and is_critical:
        return f"{owner_first} should close this out in the next {max(days_remaining, 0)} day(s) — exposure and urgency are both high."
    if status == "aging":
        return f"Set a reminder — confirm the resolution path with {owner_first} before the {days_remaining}-day window closes."
    return "Monitor — no action needed yet, deadline is not imminent."


def _hydrate(debt: DecisionDebt, as_of: date) -> DecisionDebt:
    status, days_remaining = calculate_overdue_state(debt, as_of)
    is_critical = calculate_is_critical(status, debt.exposure_usd, days_remaining)
    priority_score, priority_label = calculate_priority(status, debt.exposure_usd, is_critical)
    next_best_action = calculate_next_best_action(debt, status, is_critical, days_remaining)

    hydrated = debt.model_copy()
    hydrated.status = status
    hydrated.age_days = calculate_age(debt, as_of)
    hydrated.days_remaining = days_remaining
    hydrated.is_critical = is_critical
    hydrated.priority_score = priority_score
    hydrated.priority_label = priority_label
    hydrated.next_best_action = next_best_action
    return hydrated


def _stack_summary(hydrated_debts: list[DecisionDebt]) -> DebtStackSummary:
    open_debts = [d for d in hydrated_debts if d.status != "resolved"]
    return DebtStackSummary(
        open_decisions=len(open_debts),
        total_exposure_usd=round(sum(d.exposure_usd for d in open_debts), 2),
        overdue_count=sum(1 for d in open_debts if d.status == "overdue"),
        critical_count=sum(1 for d in open_debts if d.is_critical),
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/compass/decision-debt-ledger", response_model=DecisionDebtLedgerResponse)
def decision_debt_ledger(company_id: str) -> DecisionDebtLedgerResponse:
    company_debts = [d for d in DEBTS.values() if d.company_id == company_id]
    if not company_debts:
        raise HTTPException(status_code=404, detail=f"No decision debt records for company_id: {company_id}")

    hydrated = [_hydrate(d, TODAY) for d in company_debts]
    hydrated.sort(key=lambda d: d.priority_score or 0, reverse=True)

    return DecisionDebtLedgerResponse(
        company_id=company_id,
        as_of=TODAY.isoformat(),
        stack=_stack_summary(hydrated),
        debts=hydrated,
    )


@router.post("/compass/decision-debt-ledger/{debt_id}/simulate-deadline", response_model=SimulateDeadlineResponse)
def simulate_deadline(debt_id: str, payload: SimulateDeadlineRequest) -> SimulateDeadlineResponse:
    """
    Advances the evaluation date for ONE debt (not the whole ledger's clock)
    and recomputes its status — this is how OPEN -> AGING -> OVERDUE gets
    demonstrated deterministically without waiting for real time to pass.
    """
    debt = DEBTS.get(debt_id)
    if debt is None:
        raise HTTPException(status_code=404, detail=f"Unknown debt_id: {debt_id}")

    previous_status, _ = calculate_overdue_state(debt, TODAY)

    if payload.advance_days is not None:
        as_of = TODAY + timedelta(days=payload.advance_days)
    else:
        as_of = debt.deadline + timedelta(days=1)

    hydrated = _hydrate(debt, as_of)

    # Build the state transition path for the frontend to animate through.
    transition_path: list[Status] = []
    for candidate_date in (TODAY, min(as_of, debt.deadline + timedelta(days=AGING_WINDOW_DAYS)), as_of):
        s, _ = calculate_overdue_state(debt, candidate_date)
        if not transition_path or transition_path[-1] != s:
            transition_path.append(s)

    return SimulateDeadlineResponse(
        debt_id=debt_id,
        evaluated_as_of=as_of.isoformat(),
        previous_status=previous_status,
        new_status=hydrated.status,  # type: ignore[arg-type]
        transition=transition_path,
        new_next_best_action=hydrated.next_best_action,  # type: ignore[arg-type]
        debt=hydrated,
    )
