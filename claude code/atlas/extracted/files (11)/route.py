"""
ATLAS — Price Re-Check Before Reordering
GET /atlas/price-recheck?item=&habitual_vendor_id=&habitual_price=

Answers: "Before you reorder out of habit, is there still a better price
available from an already-approved vendor?"

Design:
  - Plain deterministic comparison against a seeded CURRENT_APPROVED_PRICING
    table — no LLM.
  - Extends the shared Atlas WorldSignal shape (this is a price_change
    signal about the user's actual habitual vendor and, where relevant, the
    real project budget line it draws from) with the specific comparison
    fields the reorder-flow UI needs.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter()

# --------------------------------------------------------------------------
# Shared Atlas shape
# --------------------------------------------------------------------------

Severity = Literal["info", "watch", "action_needed"]


class WorldSignal(BaseModel):
    signal_type: str
    affected_entity_ids: list[str]
    severity: Severity
    summary: str
    detail: dict[str, Any]
    recommended_action: str | None
    detected_at: datetime


class PriceOption(BaseModel):
    vendor_id: str
    vendor_name: str
    current_price: float
    lead_time_days: int
    is_habitual: bool
    is_best: bool


class PriceRecheckResult(WorldSignal):
    item: str
    item_label: str
    habitual_vendor_id: str
    habitual_vendor_name: str
    habitual_price: float
    options: list[PriceOption]
    better_option_exists: bool
    best_option: PriceOption
    potential_savings: float
    potential_savings_pct: float


# --------------------------------------------------------------------------
# Thresholds — named constants, not magic numbers buried in logic
# --------------------------------------------------------------------------

ACTION_NEEDED_SAVINGS_PCT = 8.0  # savings at/above this % warrant "action_needed"


# --------------------------------------------------------------------------
# Seeded demo data
# --------------------------------------------------------------------------


class ApprovedPrice(BaseModel):
    vendor_id: str
    vendor_name: str
    current_price: float
    lead_time_days: int


CURRENT_APPROVED_PRICING: dict[str, list[ApprovedPrice]] = {
    "copper_wiring_4_0_1000ft": [
        ApprovedPrice(vendor_id="vendor_coastal_bolt", vendor_name="Coastal Bolt & Fastener", current_price=4850, lead_time_days=5),
        ApprovedPrice(vendor_id="vendor_titan_fab", vendor_name="Titan Fabricators", current_price=4600, lead_time_days=7),
        ApprovedPrice(vendor_id="vendor_lonestar_wire", vendor_name="Lonestar Wire & Cable", current_price=4550, lead_time_days=4),
    ],
    "structural_steel_plate_a36_per_ton": [
        ApprovedPrice(vendor_id="vendor_meridian_steel", vendor_name="Meridian Steel Fabrication", current_price=1140, lead_time_days=10),
        ApprovedPrice(vendor_id="vendor_titan_fab", vendor_name="Titan Fabricators", current_price=1150, lead_time_days=9),
        ApprovedPrice(vendor_id="vendor_gulf_coast_machining", vendor_name="Gulf Coast Machining", current_price=1205, lead_time_days=8),
    ],
    "pvc_conduit_4in_100ft": [
        ApprovedPrice(vendor_id="vendor_gulf_coast_machining", vendor_name="Gulf Coast Machining", current_price=205, lead_time_days=3),
        ApprovedPrice(vendor_id="vendor_coastal_bolt", vendor_name="Coastal Bolt & Fastener", current_price=210, lead_time_days=3),
    ],
}

ITEM_LABELS: dict[str, str] = {
    "copper_wiring_4_0_1000ft": "Copper Wiring — 4/0 AWG (1000 ft spool)",
    "structural_steel_plate_a36_per_ton": "Structural Steel Plate — A36 (per ton)",
    "pvc_conduit_4in_100ft": "PVC Conduit — 4in (100 ft bundle)",
}

# Ties an item back to the real project_austin_fab budget line it draws from,
# so the signal connects to something specific and named, not just a price list.
ITEM_TO_BUDGET_LINE: dict[str, str] = {
    "copper_wiring_4_0_1000ft": "budget_copper_wiring",
    "structural_steel_plate_a36_per_ton": "budget_structural_steel",
}


# --------------------------------------------------------------------------
# Deterministic comparison (plain Python, no LLM)
# --------------------------------------------------------------------------


def compute_price_recheck(item: str, habitual_vendor_id: str, habitual_price: float) -> PriceRecheckResult:
    if item not in CURRENT_APPROVED_PRICING:
        raise HTTPException(status_code=404, detail=f"No approved pricing seeded for item={item!r}")

    approved = CURRENT_APPROVED_PRICING[item]
    ranked = sorted(approved, key=lambda p: p.current_price)
    best = ranked[0]

    habitual_match = next((p for p in approved if p.vendor_id == habitual_vendor_id), None)
    habitual_vendor_name = habitual_match.vendor_name if habitual_match else habitual_vendor_id

    options = [
        PriceOption(
            vendor_id=p.vendor_id,
            vendor_name=p.vendor_name,
            current_price=p.current_price,
            lead_time_days=p.lead_time_days,
            is_habitual=(p.vendor_id == habitual_vendor_id),
            is_best=(p.vendor_id == best.vendor_id),
        )
        for p in ranked
    ]
    best_option = next(o for o in options if o.is_best)

    better_option_exists = best.current_price < habitual_price
    potential_savings = round(max(0.0, habitual_price - best.current_price), 2)
    potential_savings_pct = round((potential_savings / habitual_price) * 100, 1) if habitual_price > 0 else 0.0

    if not better_option_exists:
        severity: Severity = "info"
        recommended_action = f"{habitual_vendor_name} is still the best available price — proceed with the reorder."
        summary = f"Price re-check confirms {habitual_vendor_name} remains the best price for {ITEM_LABELS[item]}."
    elif potential_savings_pct >= ACTION_NEEDED_SAVINGS_PCT:
        severity = "action_needed"
        recommended_action = f"Switch to {best_option.vendor_name} to save ${potential_savings:,.0f} ({potential_savings_pct:.1f}%) on this reorder."
        summary = f"{best_option.vendor_name} now beats {habitual_vendor_name}'s habitual price by {potential_savings_pct:.1f}% on {ITEM_LABELS[item]}."
    else:
        severity = "watch"
        recommended_action = f"Consider {best_option.vendor_name}, which would save ${potential_savings:,.0f} ({potential_savings_pct:.1f}%) on this reorder."
        summary = f"{best_option.vendor_name} offers a modest {potential_savings_pct:.1f}% savings over {habitual_vendor_name}'s habitual price on {ITEM_LABELS[item]}."

    affected_entity_ids = sorted({habitual_vendor_id, best_option.vendor_id} | (
        {ITEM_TO_BUDGET_LINE[item]} if item in ITEM_TO_BUDGET_LINE else set()
    ))

    return PriceRecheckResult(
        signal_type="price_change",
        affected_entity_ids=affected_entity_ids,
        severity=severity,
        summary=summary,
        detail={
            "item": ITEM_LABELS[item],
            "habitual_price": habitual_price,
            "cheapest_current_price": best.current_price,
            "cheapest_vendor": best.vendor_name,
        },
        recommended_action=recommended_action,
        detected_at=datetime.utcnow(),
        item=item,
        item_label=ITEM_LABELS[item],
        habitual_vendor_id=habitual_vendor_id,
        habitual_vendor_name=habitual_vendor_name,
        habitual_price=habitual_price,
        options=options,
        better_option_exists=better_option_exists,
        best_option=best_option,
        potential_savings=potential_savings,
        potential_savings_pct=potential_savings_pct,
    )


# --------------------------------------------------------------------------
# Route
# --------------------------------------------------------------------------


@router.get("/atlas/price-recheck", response_model=PriceRecheckResult)
async def price_recheck(
    item: str = Query(default="copper_wiring_4_0_1000ft", description="Item slug, e.g. copper_wiring_4_0_1000ft"),
    habitual_vendor_id: str = Query(default="vendor_coastal_bolt"),
    habitual_price: float = Query(default=4850.0, description="Price paid last time (the habitual price)"),
) -> PriceRecheckResult:
    return compute_price_recheck(item, habitual_vendor_id, habitual_price)
