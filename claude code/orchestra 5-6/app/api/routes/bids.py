from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.graphs.bid_integrity_graph import build_bid_integrity_graph
from app.schemas.bids import BidIntegrityResult

router = APIRouter(prefix="/sentinel/bid-integrity", tags=["bid-integrity"])
_graph = build_bid_integrity_graph()

# Stands in for the real persistence layer described in finalize_node. Swap for a query
# against the persisted BidIntegrityResult table once that's wired up.
_results_cache: dict[str, BidIntegrityResult] = {}


@router.post("/{package_id}/analyze", response_model=BidIntegrityResult)
async def analyze_bid_package(package_id: str, db: Session = Depends(get_db)):
    final_state = await _graph.ainvoke({"package_id": package_id, "db": db})
    result: BidIntegrityResult = final_state["result"]
    _results_cache[package_id] = result
    return result


@router.get("/{package_id}", response_model=BidIntegrityResult)
def get_bid_integrity_result(package_id: str):
    result = _results_cache.get(package_id)
    if not result:
        raise HTTPException(status_code=404, detail="No analysis found for this package")
    return result
