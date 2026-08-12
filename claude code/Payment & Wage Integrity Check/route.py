"""
SENTINEL — Payment & Wage Integrity Route
POST /sentinel/payment-wage-integrity

This endpoint is entirely deterministic — zero LLM calls. Wage compliance is
a lookup-and-compare problem against published wage determinations, and a
lien-waiver/payment match is an exact numeric comparison. Neither needs a
model; both need to be auditable, reproducible, and fast. (get_claude_client()
is intentionally unused here — noted so it's clear the omission is by design,
not an oversight.)
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter()


# ---------------------------------------------------------------------------
# Base evidence shapes (fixed contract)
# ---------------------------------------------------------------------------

class EvidenceItem(BaseModel):
    source: str
    reliability_tier: Literal["self_reported", "third_party_observed", "verified_transaction"]
    timestamp: datetime
    raw_ref: str


class EvidenceResult(BaseModel):
    confidence: float
    evidence: list[EvidenceItem]
    reasoning: str
    needs_human: bool
    writes_to: list[str]


class UnderpaymentAlert(BaseModel):
    worker_classification: str
    shortfall_per_hour: float
    total_exposure: float


class PaymentWageIntegrityResult(EvidenceResult):
    payment_compliance: bool
    underpayment_alerts: list[UnderpaymentAlert]
    compliance_report: str


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class PayrollRow(BaseModel):
    worker_id: str
    worker_classification: str
    hourly_rate: float
    hours: float
    project_state: str


class PaymentWageIntegrityRequest(BaseModel):
    rows: list[PayrollRow]
    lien_waiver_amount: Optional[float] = None
    payment_amount: Optional[float] = None


# ---------------------------------------------------------------------------
# Seeded / mock reference data (clearly fake — for demo & test purposes only)
# ---------------------------------------------------------------------------

# Seeded prevailing-wage determinations: (classification, state) -> required
# hourly rate. In production this would come from a state labor department
# feed (e.g. Davis-Bacon / state DIR wage determination API), not hardcoded.
WAGE_DETERMINATIONS: dict[tuple[str, str], float] = {
    ("Electrician", "CA"): 58.75,
    ("Electrician", "TX"): 42.10,
    ("Laborer", "CA"): 41.20,
    ("Carpenter", "CA"): 52.30,
    ("Plumber", "CA"): 55.00,
    ("Laborer", "TX"): 28.50,
}

# Tolerance for float comparisons (cents-level rounding noise), not a
# leniency policy — payroll systems routinely round to the nearest cent.
RATE_TOLERANCE = 0.005
PAYMENT_TOLERANCE = 0.01

# needs_human / compliance thresholds, stated explicitly so they're auditable.
UNDERPAYMENT_EXPOSURE_THRESHOLD = 0.0  # any underpayment at all triggers review


# ---------------------------------------------------------------------------
# Deterministic checks
# ---------------------------------------------------------------------------

class RowCheckResult(BaseModel):
    worker_id: str
    worker_classification: str
    project_state: str
    hourly_rate: float
    required_rate: Optional[float]
    hours: float
    underpaid: bool
    shortfall_per_hour: float
    row_exposure: float
    note: str


def check_certified_payroll(
    rows: list[PayrollRow],
    wage_table: dict[tuple[str, str], float] = WAGE_DETERMINATIONS,
) -> tuple[list[RowCheckResult], float]:
    """
    Compares each payroll row's paid rate against the seeded wage
    determination for its classification + state. Flags underpaid rows and
    sums total dollar exposure. Pure plain-Python arithmetic/comparison —
    no LLM involved.
    """
    results: list[RowCheckResult] = []
    total_exposure = 0.0

    for row in rows:
        key = (row.worker_classification, row.project_state)
        required_rate = wage_table.get(key)

        if required_rate is None:
            results.append(
                RowCheckResult(
                    worker_id=row.worker_id,
                    worker_classification=row.worker_classification,
                    project_state=row.project_state,
                    hourly_rate=row.hourly_rate,
                    required_rate=None,
                    hours=row.hours,
                    underpaid=False,
                    shortfall_per_hour=0.0,
                    row_exposure=0.0,
                    note="No wage determination on file for this classification/state combination",
                )
            )
            continue

        shortfall = round(required_rate - row.hourly_rate, 2)
        is_underpaid = shortfall > RATE_TOLERANCE

        row_exposure = round(shortfall * row.hours, 2) if is_underpaid else 0.0
        if is_underpaid:
            total_exposure = round(total_exposure + row_exposure, 2)

        results.append(
            RowCheckResult(
                worker_id=row.worker_id,
                worker_classification=row.worker_classification,
                project_state=row.project_state,
                hourly_rate=row.hourly_rate,
                required_rate=required_rate,
                hours=row.hours,
                underpaid=is_underpaid,
                shortfall_per_hour=max(shortfall, 0.0),
                row_exposure=row_exposure,
                note="Underpaid vs. wage determination" if is_underpaid else "Meets or exceeds required rate",
            )
        )

    return results, round(total_exposure, 2)


def check_lien_waiver(waiver_amount: Optional[float], payment_amount: Optional[float]) -> Optional[bool]:
    """
    Exact-match check (with float tolerance) between a submitted lien waiver
    amount and the actual payment amount. Returns None if either value is
    absent (check not applicable). Deterministic — no LLM.
    """
    if waiver_amount is None or payment_amount is None:
        return None
    return abs(waiver_amount - payment_amount) <= PAYMENT_TOLERANCE


def build_underpayment_alerts(row_results: list[RowCheckResult]) -> list[UnderpaymentAlert]:
    """
    Aggregates underpaid rows by classification into alert entries, e.g.
    "3 electricians underpaid by $2.50/hr — total exposure $840".
    Grouping/summation is plain Python, not LLM synthesis.
    """
    grouped: dict[str, dict[str, float]] = {}
    counts: dict[str, int] = {}

    for r in row_results:
        if not r.underpaid:
            continue
        cls = r.worker_classification
        grouped.setdefault(cls, {"shortfall_per_hour": r.shortfall_per_hour, "total_exposure": 0.0})
        grouped[cls]["total_exposure"] = round(grouped[cls]["total_exposure"] + r.row_exposure, 2)
        # Use the max observed shortfall/hr for the classification as the headline figure;
        # underlying per-row shortfalls remain visible in row_results.
        grouped[cls]["shortfall_per_hour"] = max(grouped[cls]["shortfall_per_hour"], r.shortfall_per_hour)
        counts[cls] = counts.get(cls, 0) + 1

    alerts: list[UnderpaymentAlert] = []
    for cls, agg in grouped.items():
        alerts.append(
            UnderpaymentAlert(
                worker_classification=cls,
                shortfall_per_hour=agg["shortfall_per_hour"],
                total_exposure=agg["total_exposure"],
            )
        )
    return alerts


def format_alert_line(alert: UnderpaymentAlert, count: int) -> str:
    plural = "s" if count != 1 else ""
    return (
        f"{count} {alert.worker_classification.lower()}{plural} underpaid by "
        f"${alert.shortfall_per_hour:.2f}/hr — total exposure ${alert.total_exposure:,.2f}"
    )


def build_compliance_report(
    row_results: list[RowCheckResult],
    alerts: list[UnderpaymentAlert],
    total_exposure: float,
    waiver_check: Optional[bool],
    payment_compliance: bool,
) -> str:
    """Plain Python string formatting — not an LLM call."""
    total_rows = len(row_results)
    flagged_rows = sum(1 for r in row_results if r.underpaid)
    unrated_rows = sum(1 for r in row_results if r.required_rate is None)

    lines = [
        f"Reviewed {total_rows} payroll row(s) against seeded wage determinations.",
        f"{flagged_rows} row(s) flagged as underpaid; total wage exposure ${total_exposure:,.2f}.",
    ]
    if unrated_rows:
        lines.append(f"{unrated_rows} row(s) had no matching wage determination on file and were not scored.")
    if waiver_check is not None:
        lines.append(
            "Lien waiver amount matches payment amount." if waiver_check
            else "Lien waiver amount does NOT match payment amount — discrepancy flagged."
        )
    else:
        lines.append("No lien waiver / payment amount pair supplied — payment-match check skipped.")
    lines.append(f"Overall payment compliance: {'PASS' if payment_compliance else 'FAIL'}.")
    return " ".join(lines)


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.post("/sentinel/payment-wage-integrity", response_model=PaymentWageIntegrityResult)
async def payment_wage_integrity(payload: PaymentWageIntegrityRequest) -> PaymentWageIntegrityResult:
    now = datetime.now(timezone.utc)
    evidence: list[EvidenceItem] = []

    # --- Certified payroll check (deterministic) ----------------------------
    row_results, total_exposure = check_certified_payroll(payload.rows)
    alerts = build_underpayment_alerts(row_results)

    evidence.append(
        EvidenceItem(
            source="wage_determination_table",
            reliability_tier="third_party_observed",  # seeded reference table, standing in for a labor-dept feed
            timestamp=now,
            raw_ref=f"rows_checked:{len(payload.rows)}",
        )
    )
    evidence.append(
        EvidenceItem(
            source="payroll_submission",
            reliability_tier="self_reported",  # payroll rows as submitted by the contractor
            timestamp=now,
            raw_ref=f"payroll_batch:{len(payload.rows)}_rows",
        )
    )

    # --- Lien waiver / payment match check (deterministic) ------------------
    waiver_check = check_lien_waiver(payload.lien_waiver_amount, payload.payment_amount)
    if waiver_check is not None:
        evidence.append(
            EvidenceItem(
                source="lien_waiver_payment_match",
                reliability_tier="verified_transaction",  # comparing two submitted transaction figures directly
                timestamp=now,
                raw_ref=f"waiver:{payload.lien_waiver_amount}_payment:{payload.payment_amount}",
            )
        )

    has_underpayment = len(alerts) > 0
    waiver_mismatch = waiver_check is False

    payment_compliance = (not has_underpayment) and (not waiver_mismatch)

    # needs_human is a real computed boolean from a stated threshold
    needs_human = has_underpayment or waiver_mismatch

    # Confidence reflects how much of the payload was actually scoreable —
    # deterministic, not a model's self-assessment.
    scored_rows = sum(1 for r in row_results if r.required_rate is not None)
    coverage = (scored_rows / len(row_results)) if row_results else 1.0
    confidence = round(coverage if payment_compliance else min(coverage, 0.5), 3)

    compliance_report = build_compliance_report(
        row_results, alerts, total_exposure, waiver_check, payment_compliance
    )

    reasoning_parts = [
        f"Checked {len(row_results)} payroll row(s) against {len(WAGE_DETERMINATIONS)} seeded wage determinations.",
    ]
    if alerts:
        # Count rows per classification for natural-language alert lines
        counts: dict[str, int] = {}
        for r in row_results:
            if r.underpaid:
                counts[r.worker_classification] = counts.get(r.worker_classification, 0) + 1
        alert_lines = [format_alert_line(a, counts.get(a.worker_classification, 0)) for a in alerts]
        reasoning_parts.append("Underpayment detected: " + "; ".join(alert_lines) + ".")
    else:
        reasoning_parts.append("No underpayment detected against wage determinations on file.")
    if waiver_check is not None:
        reasoning_parts.append(
            "Lien waiver matches payment." if waiver_check else "Lien waiver amount mismatches payment amount."
        )
    reasoning_parts.append(
        f"payment_compliance={payment_compliance}, needs_human={needs_human} "
        f"(threshold: any underpayment OR lien waiver mismatch)."
    )

    return PaymentWageIntegrityResult(
        confidence=confidence,
        evidence=evidence,
        reasoning=" ".join(reasoning_parts),
        needs_human=needs_human,
        writes_to=["payroll_compliance_log", "wage_audit_queue"] if needs_human else ["payroll_compliance_log"],
        payment_compliance=payment_compliance,
        underpayment_alerts=alerts,
        compliance_report=compliance_report,
    )
