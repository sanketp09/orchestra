"""
COMPASS — Procurement Opportunity Engine
GET /compass/procurement-opportunities?company_id=

"How could we make this procurement decision better, not merely safer?"

Design notes:
- Zero LLM calls. Every opportunity here is arithmetic over seeded
  procurement-plan data: tiered bulk pricing, price-trend lookups, and
  vendor price comparisons. That's exactly the kind of comparison/
  statistics logic that belongs in deterministic code, not a model.
- Opportunities only ever combine line items that share a company_id.
  vendor_lattice's Westgate project is seeded specifically to prove this —
  it shares an item and even a vendor with Coastal Bay Builders' plan, and
  the ranking logic must never merge across that boundary.
- All five required calculations are separate, individually testable
  functions: calculate_volume_savings, calculate_timing_savings,
  calculate_consolidation_opportunities, calculate_supplier_competition,
  calculate_early_buy_advantage. rank_opportunities() merges their output.
"""

from __future__ import annotations

from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

TODAY = date(2026, 8, 11)


# ---------------------------------------------------------------------------
# Response shapes
# ---------------------------------------------------------------------------

OpportunityType = Literal["consolidate", "cross_project", "buy_early", "wait", "renegotiate"]


class Opportunity(BaseModel):
    id: str
    type: OpportunityType
    title: str
    company_id: str
    projects_involved: list[str]
    items_involved: list[str]
    current_cost: float
    optimized_cost: float
    potential_savings: float
    savings_pct: float
    reasoning: str
    calculation_steps: list[str]
    rank: int = 0


class OpportunityScanResult(BaseModel):
    company_id: str
    company_name: str
    scanned_at: str
    portfolio_current_cost: float
    total_potential_value: float
    opportunities: list[Opportunity]


# ---------------------------------------------------------------------------
# SEEDED / MOCK REFERENCE DATA
# ---------------------------------------------------------------------------

COMPANIES = {
    "company_coastal_bay": "Coastal Bay Builders",
    "company_lattice": "Lattice Development Partners",
}

PROJECT_NAMES = {
    "proj_riverside": "Riverside Commons — Phase 2",
    "proj_bayview": "Bayview Tower",
    "proj_harbor": "Harbor District Retail",
    "proj_westgate": "Westgate Logistics Park",
}

# Every planned purchase line across the portfolio. Two companies are
# seeded on purpose: Coastal Bay Builders (3 projects, the interesting
# case) and Lattice Development Partners (1 project) sharing an item AND
# a vendor with Coastal Bay — proving the "same company only" rule.
PROCUREMENT_PLAN: list[dict] = [
    # --- Coastal Bay Builders: structural steel, same item + vendor across two projects ---
    {"id": "pl-001", "company_id": "company_coastal_bay", "project_id": "proj_riverside",
     "item": "structural_steel", "quantity": 420, "unit": "tons", "unit_price": 980.0,
     "vendor": "Metro Steel Supply", "need_by": date(2026, 9, 15)},
    {"id": "pl-002", "company_id": "company_coastal_bay", "project_id": "proj_bayview",
     "item": "structural_steel", "quantity": 417, "unit": "tons", "unit_price": 980.0,
     "vendor": "Metro Steel Supply", "need_by": date(2026, 9, 20)},

    # --- Coastal Bay Builders: electrical panels, same item + spec, different vendors/prices ---
    {"id": "pl-003", "company_id": "company_coastal_bay", "project_id": "proj_bayview",
     "item": "electrical_panel_400a", "quantity": 44, "unit": "units", "unit_price": 4200.0,
     "vendor": "Circuit & Pipe Co", "need_by": date(2026, 9, 1)},
    {"id": "pl-004", "company_id": "company_coastal_bay", "project_id": "proj_riverside",
     "item": "electrical_panel_400a", "quantity": 8, "unit": "units", "unit_price": 3700.0,
     "vendor": "Volthouse Electrical", "need_by": date(2026, 9, 10)},

    # --- Coastal Bay Builders: PVC conduit, part of the electrical bundle ---
    {"id": "pl-005", "company_id": "company_coastal_bay", "project_id": "proj_riverside",
     "item": "pvc_conduit_25mm", "quantity": 1200, "unit": "meters", "unit_price": 3.20,
     "vendor": "Circuit & Pipe Co", "need_by": date(2026, 9, 12)},
    {"id": "pl-006", "company_id": "company_coastal_bay", "project_id": "proj_bayview",
     "item": "pvc_conduit_25mm", "quantity": 1000, "unit": "meters", "unit_price": 3.20,
     "vendor": "Circuit & Pipe Co", "need_by": date(2026, 9, 22)},
    {"id": "pl-007", "company_id": "company_coastal_bay", "project_id": "proj_harbor",
     "item": "pvc_conduit_25mm", "quantity": 1000, "unit": "meters", "unit_price": 3.20,
     "vendor": "Circuit & Pipe Co", "need_by": date(2026, 10, 3)},

    # --- Coastal Bay Builders: HVAC ductwork, also part of the electrical/mechanical bundle ---
    {"id": "pl-008", "company_id": "company_coastal_bay", "project_id": "proj_harbor",
     "item": "hvac_ductwork", "quantity": 900, "unit": "meters", "unit_price": 28.0,
     "vendor": "ClimateFab Systems", "need_by": date(2026, 10, 10)},

    # --- Coastal Bay Builders: ready-mix concrete, price trending up — early buy signal ---
    {"id": "pl-009", "company_id": "company_coastal_bay", "project_id": "proj_riverside",
     "item": "ready_mix_concrete", "quantity": 1200, "unit": "cubic_yards", "unit_price": 142.0,
     "vendor": "Apex Building Materials", "need_by": date(2026, 9, 20)},
    {"id": "pl-010", "company_id": "company_coastal_bay", "project_id": "proj_bayview",
     "item": "ready_mix_concrete", "quantity": 800, "unit": "cubic_yards", "unit_price": 142.0,
     "vendor": "Apex Building Materials", "need_by": date(2026, 9, 25)},

    # --- Coastal Bay Builders: copper wiring, price trending down — wait signal ---
    {"id": "pl-011", "company_id": "company_coastal_bay", "project_id": "proj_harbor",
     "item": "copper_wiring_4mm2", "quantity": 10000, "unit": "meters", "unit_price": 2.90,
     "vendor": "Circuit & Pipe Co", "need_by": date(2026, 10, 15)},

    # --- Lattice Development Partners: same item + vendor as Coastal Bay's steel, but a
    #     DIFFERENT company — must never be combined with Coastal Bay's lines above. ---
    {"id": "pl-012", "company_id": "company_lattice", "project_id": "proj_westgate",
     "item": "structural_steel", "quantity": 300, "unit": "tons", "unit_price": 940.0,
     "vendor": "Metro Steel Supply", "need_by": date(2026, 9, 18)},
]

# Deterministic tiered bulk pricing per item — combined order volume moves
# the whole combined quantity to a lower per-unit rate. This is the model
# a real system would source from vendor rate cards.
BULK_PRICE_TIERS: dict[str, list[tuple[float, float, float]]] = {
    "structural_steel": [(0, 499, 980.0), (500, 799, 930.0), (800, float("inf"), 885.30)],
    # Note: pvc_conduit_25mm deliberately has no standalone tier table — its
    # volume upside is already captured inside the cross-project electrical
    # bundle below, so it isn't double-counted as its own consolidation line.
}

# Seeded market price-trend forecast per item: today vs. 2 weeks out vs.
# 1 month out. A real system would source this from a commodity index or
# vendor quote history; here it's mocked and clearly labeled as such.
PRICE_TRENDS: dict[str, dict[str, float]] = {
    "ready_mix_concrete": {"buy_now": 142.0, "wait_2_weeks": 148.0, "wait_1_month": 156.0},  # rising
    "copper_wiring_4mm2": {"buy_now": 2.90, "wait_2_weeks": 2.80, "wait_1_month": 2.70},       # falling
}

CROSS_PROJECT_BUNDLE_DISCOUNT = 0.06  # logistics/single-vendor-package discount, stated assumption
CONSOLIDATION_MIN_PROJECTS = 2


# ---------------------------------------------------------------------------
# Deterministic helpers
# ---------------------------------------------------------------------------

def _tier_rate(item: str, quantity: float) -> Optional[float]:
    tiers = BULK_PRICE_TIERS.get(item)
    if not tiers:
        return None
    for low, high, rate in tiers:
        if low <= quantity <= high:
            return rate
    return None


def _lines_for_company(company_id: str) -> list[dict]:
    return [l for l in PROCUREMENT_PLAN if l["company_id"] == company_id]


def _project_name(project_id: str) -> str:
    return PROJECT_NAMES.get(project_id, project_id)


def _days_until(need_by: date) -> int:
    return (need_by - TODAY).days


# ---------------------------------------------------------------------------
# 1. Consolidation opportunities (same item, 2+ projects, same company)
# ---------------------------------------------------------------------------

def calculate_consolidation_opportunities(company_id: str) -> list[Opportunity]:
    lines = _lines_for_company(company_id)
    by_item: dict[str, list[dict]] = {}
    for l in lines:
        if l["item"] in BULK_PRICE_TIERS:
            by_item.setdefault(l["item"], []).append(l)

    opportunities: list[Opportunity] = []
    for item, item_lines in by_item.items():
        distinct_projects = {l["project_id"] for l in item_lines}
        if len(distinct_projects) < CONSOLIDATION_MIN_PROJECTS:
            continue

        current_total = sum(l["quantity"] * l["unit_price"] for l in item_lines)
        combined_qty = sum(l["quantity"] for l in item_lines)
        combined_rate = _tier_rate(item, combined_qty)
        if combined_rate is None:
            continue
        combined_total = combined_qty * combined_rate
        savings = round(current_total - combined_total, 2)
        if savings <= 0:
            continue

        steps = [f"Current: {len(item_lines)} separate order(s) across {', '.join(sorted(_project_name(p) for p in distinct_projects))}."]
        for l in item_lines:
            steps.append(f"  {_project_name(l['project_id'])}: {l['quantity']:g} {l['unit']} @ ${l['unit_price']:,.2f} = ${l['quantity'] * l['unit_price']:,.2f}")
        steps.append(f"Combined volume: {combined_qty:g} {item_lines[0]['unit']} qualifies for ${combined_rate:,.2f}/unit tier rate.")
        steps.append(f"Combined total: {combined_qty:g} × ${combined_rate:,.2f} = ${combined_total:,.2f}")
        steps.append(f"Savings: ${current_total:,.2f} − ${combined_total:,.2f} = ${savings:,.2f}")

        opportunities.append(
            Opportunity(
                id=f"consolidate-{item}",
                type="consolidate",
                title=f"Consolidate {item.replace('_', ' ').title()}",
                company_id=company_id,
                projects_involved=[_project_name(p) for p in sorted(distinct_projects)],
                items_involved=[item],
                current_cost=round(current_total, 2),
                optimized_cost=round(combined_total, 2),
                potential_savings=savings,
                savings_pct=round(savings / current_total * 100, 1),
                reasoning=(
                    f"{len(item_lines)} separate orders for {item.replace('_', ' ')} across "
                    f"{len(distinct_projects)} projects qualify for a lower bulk rate if placed as one order."
                ),
                calculation_steps=steps,
            )
        )
    return opportunities


def calculate_cross_project_bundle(company_id: str) -> Optional[Opportunity]:
    """Bundle multiple DIFFERENT electrical-trade items across projects under
    one vendor package to unlock a logistics/volume discount. Distinct from
    same-item consolidation above — this is cross-project, cross-item."""
    lines = _lines_for_company(company_id)
    bundle_items = {"electrical_panel_400a", "pvc_conduit_25mm", "hvac_ductwork"}
    bundle_lines = [l for l in lines if l["item"] in bundle_items]
    distinct_projects = {l["project_id"] for l in bundle_lines}
    if len(distinct_projects) < CONSOLIDATION_MIN_PROJECTS:
        return None

    current_total = sum(l["quantity"] * l["unit_price"] for l in bundle_lines)
    savings = round(current_total * CROSS_PROJECT_BUNDLE_DISCOUNT, 2)
    optimized_total = round(current_total - savings, 2)

    steps = [f"Bundle scope: electrical panels + conduit + ductwork across {len(distinct_projects)} projects."]
    for l in bundle_lines:
        steps.append(f"  {_project_name(l['project_id'])} — {l['item'].replace('_', ' ')}: {l['quantity']:g} {l['unit']} = ${l['quantity'] * l['unit_price']:,.2f}")
    steps.append(f"Total bundled spend: ${current_total:,.2f}")
    steps.append(f"Single-vendor package discount ({CROSS_PROJECT_BUNDLE_DISCOUNT:.0%}): −${savings:,.2f}")
    steps.append(f"Optimized total: ${optimized_total:,.2f}")

    return Opportunity(
        id="cross-project-electrical-bundle",
        type="cross_project",
        title="Bundle Electrical Trades Across Projects",
        company_id=company_id,
        projects_involved=[_project_name(p) for p in sorted(distinct_projects)],
        items_involved=sorted(bundle_items & {l["item"] for l in bundle_lines}),
        current_cost=round(current_total, 2),
        optimized_cost=optimized_total,
        potential_savings=savings,
        savings_pct=round(CROSS_PROJECT_BUNDLE_DISCOUNT * 100, 1),
        reasoning=(
            f"Panels, conduit, and ductwork across {len(distinct_projects)} projects are currently "
            f"ordered piecemeal from multiple vendors. Packaging them under one vendor unlocks a "
            f"logistics/volume discount."
        ),
        calculation_steps=steps,
    )


# ---------------------------------------------------------------------------
# 2. Volume savings — top-line aggregate from consolidation
# ---------------------------------------------------------------------------

def calculate_volume_savings(company_id: str) -> float:
    consolidation = calculate_consolidation_opportunities(company_id)
    bundle = calculate_cross_project_bundle(company_id)
    total = sum(o.potential_savings for o in consolidation)
    if bundle:
        total += bundle.potential_savings
    return round(total, 2)


# ---------------------------------------------------------------------------
# 3. Timing savings — buy early / wait, per item with a price trend
# ---------------------------------------------------------------------------

def calculate_timing_savings(company_id: str) -> list[Opportunity]:
    lines = _lines_for_company(company_id)
    by_item: dict[str, list[dict]] = {}
    for l in lines:
        if l["item"] in PRICE_TRENDS:
            by_item.setdefault(l["item"], []).append(l)

    opportunities: list[Opportunity] = []
    for item, item_lines in by_item.items():
        trend = PRICE_TRENDS[item]
        total_qty = sum(l["quantity"] for l in item_lines)
        projects = sorted({l["project_id"] for l in item_lines})
        unit = item_lines[0]["unit"]

        # Feasibility: can't recommend waiting past the earliest need-by date.
        earliest_need_by_days = min(_days_until(l["need_by"]) for l in item_lines)
        feasible_options = {"buy_now": trend["buy_now"]}
        if earliest_need_by_days >= 14:
            feasible_options["wait_2_weeks"] = trend["wait_2_weeks"]
        if earliest_need_by_days >= 30:
            feasible_options["wait_1_month"] = trend["wait_1_month"]

        best_option, best_price = min(feasible_options.items(), key=lambda kv: kv[1])
        baseline_option, baseline_price = max(feasible_options.items(), key=lambda kv: kv[1])
        if best_option == baseline_option:
            continue  # no feasible variation, nothing to recommend

        current_total = total_qty * baseline_price
        optimized_total = total_qty * best_price
        savings = round(current_total - optimized_total, 2)
        if savings <= 0:
            continue

        opp_type: OpportunityType = "buy_early" if best_option == "buy_now" else "wait"
        label = {"buy_now": "buy now", "wait_2_weeks": "wait 2 weeks", "wait_1_month": "wait 1 month"}

        steps = [
            f"Quantity needed: {total_qty:g} {unit} across {', '.join(_project_name(p) for p in projects)}.",
            f"Price trend — buy now: ${trend['buy_now']:.2f}, wait 2 weeks: ${trend.get('wait_2_weeks', float('nan')):.2f}, wait 1 month: ${trend.get('wait_1_month', float('nan')):.2f}.",
            f"Earliest need-by date allows waiting up to {earliest_need_by_days} days.",
            f"Baseline plan ({label[baseline_option]}): {total_qty:g} × ${baseline_price:.2f} = ${current_total:,.2f}",
            f"Recommended ({label[best_option]}): {total_qty:g} × ${best_price:.2f} = ${optimized_total:,.2f}",
            f"Savings: ${current_total:,.2f} − ${optimized_total:,.2f} = ${savings:,.2f}",
        ]

        opportunities.append(
            Opportunity(
                id=f"timing-{item}",
                type=opp_type,
                title=f"{'Buy Early' if opp_type == 'buy_early' else 'Wait to Buy'}: {item.replace('_', ' ').title()}",
                company_id=company_id,
                projects_involved=[_project_name(p) for p in projects],
                items_involved=[item],
                current_cost=round(current_total, 2),
                optimized_cost=round(optimized_total, 2),
                potential_savings=savings,
                savings_pct=round(savings / current_total * 100, 1),
                reasoning=(
                    f"Market price for {item.replace('_', ' ')} is {'rising' if opp_type == 'buy_early' else 'falling'} — "
                    f"{label[best_option]} is ${best_price:.2f}/{unit.rstrip('s')} vs. {label[baseline_option]} at ${baseline_price:.2f}."
                ),
                calculation_steps=steps,
            )
        )
    return opportunities


def calculate_early_buy_advantage(company_id: str) -> list[Opportunity]:
    """Subset of timing_savings where buying now beats waiting."""
    return [o for o in calculate_timing_savings(company_id) if o.type == "buy_early"]


# ---------------------------------------------------------------------------
# 4. Supplier competition — same item, same company, different vendor rates
# ---------------------------------------------------------------------------

def calculate_supplier_competition(company_id: str) -> list[Opportunity]:
    lines = _lines_for_company(company_id)
    by_item: dict[str, list[dict]] = {}
    for l in lines:
        by_item.setdefault(l["item"], []).append(l)

    opportunities: list[Opportunity] = []
    for item, item_lines in by_item.items():
        if len(item_lines) < 2:
            continue
        cheapest = min(item_lines, key=lambda l: l["unit_price"])
        for l in item_lines:
            if l["id"] == cheapest["id"] or l["unit_price"] <= cheapest["unit_price"]:
                continue
            savings = round((l["unit_price"] - cheapest["unit_price"]) * l["quantity"], 2)
            if savings <= 0:
                continue
            current_total = round(l["unit_price"] * l["quantity"], 2)
            optimized_total = round(cheapest["unit_price"] * l["quantity"], 2)

            steps = [
                f"{_project_name(l['project_id'])} is paying ${l['unit_price']:,.2f}/unit to {l['vendor']} for {item.replace('_', ' ')}.",
                f"{_project_name(cheapest['project_id'])} sources the same item from {cheapest['vendor']} at ${cheapest['unit_price']:,.2f}/unit.",
                f"Current: {l['quantity']:g} × ${l['unit_price']:,.2f} = ${current_total:,.2f}",
                f"At the lower internal rate: {l['quantity']:g} × ${cheapest['unit_price']:,.2f} = ${optimized_total:,.2f}",
                f"Savings: ${current_total:,.2f} − ${optimized_total:,.2f} = ${savings:,.2f}",
            ]

            opportunities.append(
                Opportunity(
                    id=f"renegotiate-{l['id']}",
                    type="renegotiate",
                    title=f"Renegotiate {item.replace('_', ' ').title()} — {_project_name(l['project_id'])}",
                    company_id=company_id,
                    projects_involved=[_project_name(l["project_id"]), _project_name(cheapest["project_id"])],
                    items_involved=[item],
                    current_cost=current_total,
                    optimized_cost=optimized_total,
                    potential_savings=savings,
                    savings_pct=round(savings / current_total * 100, 1),
                    reasoning=(
                        f"{l['vendor']} is charging ${l['unit_price'] - cheapest['unit_price']:,.2f} more per unit than "
                        f"{cheapest['vendor']} charges this same company for the identical item elsewhere in the portfolio."
                    ),
                    calculation_steps=steps,
                )
            )
    return opportunities


# ---------------------------------------------------------------------------
# Ranking
# ---------------------------------------------------------------------------

def rank_opportunities(company_id: str) -> OpportunityScanResult:
    if company_id not in COMPANIES:
        raise HTTPException(status_code=404, detail=f"Unknown company_id: {company_id}")

    all_opportunities: list[Opportunity] = []
    all_opportunities.extend(calculate_consolidation_opportunities(company_id))
    bundle = calculate_cross_project_bundle(company_id)
    if bundle:
        all_opportunities.append(bundle)
    all_opportunities.extend(calculate_timing_savings(company_id))
    all_opportunities.extend(calculate_supplier_competition(company_id))

    all_opportunities.sort(key=lambda o: o.potential_savings, reverse=True)
    for i, o in enumerate(all_opportunities, start=1):
        o.rank = i

    lines = _lines_for_company(company_id)
    portfolio_current_cost = round(sum(l["quantity"] * l["unit_price"] for l in lines), 2)
    total_potential_value = round(sum(o.potential_savings for o in all_opportunities), 2)

    return OpportunityScanResult(
        company_id=company_id,
        company_name=COMPANIES[company_id],
        scanned_at=TODAY.isoformat(),
        portfolio_current_cost=portfolio_current_cost,
        total_potential_value=total_potential_value,
        opportunities=all_opportunities,
    )


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.get("/compass/procurement-opportunities", response_model=OpportunityScanResult)
def procurement_opportunities(company_id: str) -> OpportunityScanResult:
    """
    Deterministic scan across the company's current procurement plan.
    No LLM anywhere — every number here is arithmetic over seeded rate
    tables and price trends. Opportunities only ever combine line items
    that share company_id (see pl-012 / Lattice Development Partners for
    the deliberate counter-example that must NOT get merged in).
    """
    return rank_opportunities(company_id)
