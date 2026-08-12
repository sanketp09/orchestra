"""
ATLAS — Daily Briefing (Aggregation)
----------------------------------------
The "morning briefing" for external risk: one condensed WorldSignal headline
per Atlas feature, sorted by severity.

This file computes NOTHING about commodities, weather, customs, tariffs,
etc. itself — it imports and calls each sibling feature's own
`get_headline_signal()` and assembles the result. If a feature's underlying
data changes, this file updates automatically with zero changes here.

Endpoint:
    GET /atlas/daily-briefing?project_id=
"""

from datetime import datetime
from typing import Callable, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from atlas.common import WorldSignal

# Each sibling Atlas feature exposes exactly one function returning a single
# condensed WorldSignal for today. Import and call them directly — do not
# re-derive commodity prices, weather, customs data, tariff detail, etc.
# here; that logic already lives in, and belongs to, each feature's own file.
from atlas.political_regulatory_risk.route import get_headline_signal as political_regulatory_risk_signal
from atlas.customs_delay.route import get_headline_signal as customs_delay_signal
from atlas.port_congestion.route import get_headline_signal as port_congestion_signal
from atlas.commodity_price_watch.route import get_headline_signal as commodity_price_signal
from atlas.fx_exposure.route import get_headline_signal as fx_exposure_signal
from atlas.weather_disruption.route import get_headline_signal as weather_disruption_signal
from atlas.labor_disruption.route import get_headline_signal as labor_disruption_signal
from atlas.alternate_sourcing.route import get_headline_signal as alternate_sourcing_signal
from atlas.shipment_delay_risk.route import get_headline_signal as shipment_delay_risk_signal

router = APIRouter()


# ---------------------------------------------------------------------------
# Feature registry — the only place this file knows about its 9 siblings.
# Adding a 10th Atlas feature later means adding one line here, nothing else.
# ---------------------------------------------------------------------------

class FeatureEntry(BaseModel):
    slug: str
    label: str
    icon: str
    view_details_path: str


FEATURE_REGISTRY: list[tuple[FeatureEntry, Callable[[], WorldSignal]]] = [
    (FeatureEntry(slug="political_regulatory_risk", label="Political & Regulatory Risk",
                  icon="alert-triangle", view_details_path="/atlas/political-regulatory-risk"),
     political_regulatory_risk_signal),
    (FeatureEntry(slug="shipment_delay_risk", label="Shipment Delay Cascade",
                  icon="clock", view_details_path="/atlas/shipment-delay-risk"),
     shipment_delay_risk_signal),
    (FeatureEntry(slug="customs_delay", label="Customs & Border Delay",
                  icon="stamp", view_details_path="/atlas/customs-delay"),
     customs_delay_signal),
    (FeatureEntry(slug="port_congestion", label="Port Congestion Monitor",
                  icon="anchor", view_details_path="/atlas/port-congestion"),
     port_congestion_signal),
    (FeatureEntry(slug="weather_disruption", label="Weather & Natural Disaster Watch",
                  icon="cloud-rain", view_details_path="/atlas/weather-disruption"),
     weather_disruption_signal),
    (FeatureEntry(slug="alternate_sourcing", label="Alternate Global Sourcing",
                  icon="search", view_details_path="/atlas/alternate-sourcing"),
     alternate_sourcing_signal),
    (FeatureEntry(slug="commodity_price_watch", label="Commodity Price Watch",
                  icon="trending-up", view_details_path="/atlas/commodity-price-watch"),
     commodity_price_signal),
    (FeatureEntry(slug="fx_exposure", label="Currency & FX Exposure",
                  icon="banknote", view_details_path="/atlas/fx-exposure"),
     fx_exposure_signal),
    (FeatureEntry(slug="labor_disruption", label="Labor Action Risk",
                  icon="users", view_details_path="/atlas/labor-disruption"),
     labor_disruption_signal),
]

SEVERITY_RANK: dict[str, int] = {"action_needed": 0, "watch": 1, "info": 2}
COL_SPAN: dict[str, int] = {"action_needed": 2, "watch": 1, "info": 1}


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class BriefingTile(BaseModel):
    slug: str
    label: str
    icon: str
    headline: str  # deterministically condensed one-liner
    severity: str
    col_span: int
    view_details_path: str
    signal: WorldSignal  # full underlying signal, for drill-down


class BriefingSummary(BaseModel):
    action_needed: int
    watch: int
    info: int
    total: int


class DailyBriefingResult(BaseModel):
    project_id: Optional[str]
    generated_at: datetime
    tiles: list[BriefingTile]
    summary: BriefingSummary


# ---------------------------------------------------------------------------
# Deterministic condensation — no LLM, just string handling
# ---------------------------------------------------------------------------

def _condense(summary: str, max_len: int = 110) -> str:
    """First sentence of the full summary, capped to a tile-friendly length."""
    first_sentence = summary.split(". ")[0].strip()
    if not first_sentence.endswith((".", "!", "?")):
        first_sentence += "."
    if len(first_sentence) <= max_len:
        return first_sentence
    truncated = first_sentence[:max_len]
    last_space = truncated.rfind(" ")
    if last_space > 0:
        truncated = truncated[:last_space]
    return truncated.rstrip(",;: ") + "\u2026"


def _build_tile(entry: FeatureEntry, fetch: Callable[[], WorldSignal]) -> BriefingTile:
    signal = fetch()
    return BriefingTile(
        slug=entry.slug,
        label=entry.label,
        icon=entry.icon,
        headline=_condense(signal.summary),
        severity=signal.severity,
        col_span=COL_SPAN[signal.severity],
        view_details_path=entry.view_details_path,
        signal=signal,
    )


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get("/atlas/daily-briefing", response_model=DailyBriefingResult)
def daily_briefing(
    project_id: Optional[str] = Query(default=None, description="Filter tiles to signals affecting this project"),
) -> DailyBriefingResult:
    """
    Pull one condensed headline from each of the other 9 Atlas features and
    return them sorted most-urgent first — the single screen a project
    executive checks each morning instead of visiting 9 separate screens.
    """
    tiles = [_build_tile(entry, fetch) for entry, fetch in FEATURE_REGISTRY]

    if project_id:
        tiles = [t for t in tiles if project_id in t.signal.affected_entity_ids]

    # Sort by severity first; within the same severity, surface signals
    # touching more of the user's entities first (broader real exposure).
    tiles.sort(key=lambda t: (SEVERITY_RANK[t.severity], -len(t.signal.affected_entity_ids)))

    summary = BriefingSummary(
        action_needed=sum(1 for t in tiles if t.severity == "action_needed"),
        watch=sum(1 for t in tiles if t.severity == "watch"),
        info=sum(1 for t in tiles if t.severity == "info"),
        total=len(tiles),
    )

    return DailyBriefingResult(
        project_id=project_id, generated_at=datetime.utcnow(), tiles=tiles, summary=summary,
    )
